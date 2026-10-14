import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import type { Engine, EngineReply } from '../engine/engine.js';
import { normalize } from '../locator/normalize.js';
import type { IncomingMessage, LLMProvider } from '../types.js';
import type { Gazetteer } from '../locator/gazetteer.js';

const esperaSchema = z
  .object({
    pide_campo: z.string().optional(),
    tienda_en: z.array(z.string()).optional(),
    tienda_id: z.array(z.string()).optional(),
    no_contiene: z.array(z.string()).optional(),
    contiene: z.array(z.string()).optional(),
    deriva_a: z.string().optional(),
    accion: z.string().optional(),
    no_accion: z.string().optional(),
    max_caracteres: z.number().optional(),
  })
  .passthrough();

const turnoSchema = z
  .object({
    usuario: z.union([z.string(), z.number()]).transform(String).optional(),
    ubicacion: z.object({ lat: z.number(), lng: z.number() }).optional(),
    espera: esperaSchema.optional(),
  })
  .passthrough()
  .refine((t) => t.usuario !== undefined || t.ubicacion !== undefined, 'cada turno necesita "usuario" o "ubicacion"');

export const evalSchema = z
  .object({
    nombre: z.string(),
    canal: z.string().default('simulator'),
    turnos: z.array(turnoSchema).min(1),
    resultado_final: z.object({ accion: z.string().optional(), deriva_a: z.string().optional() }).passthrough().optional(),
    juez: z.string().optional(),
    etiquetas: z.array(z.string()).optional(),
  })
  .passthrough();

export type EvalCase = z.infer<typeof evalSchema> & { archivo: string };

export interface Check {
  tipo: string;
  ok: boolean;
  detalle: string;
}

export interface TurnResult {
  usuario: string;
  respuesta: string;
  acciones: string[];
  tiendas: string[];
  checks: Check[];
  skipped?: string;
}

export interface EvalResult {
  nombre: string;
  archivo: string;
  turnos: TurnResult[];
  checksFinales: Check[];
  juez?: { nota: number; razon: string };
  /** 0–100 */
  nota: number;
  paso: boolean;
  error?: string;
  ms: number;
}

export function loadEvals(dir: string): { cases: EvalCase[]; errors: string[] } {
  const cases: EvalCase[] = [];
  const errors: string[] = [];
  if (!existsSync(dir)) return { cases, errors: [`no existe ${dir}`] };
  for (const f of readdirSync(dir).filter((x) => /\.ya?ml$/.test(x)).sort()) {
    try {
      const raw = YAML.parse(readFileSync(join(dir, f), 'utf8'));
      const docs = Array.isArray(raw) ? raw : [raw];
      docs.forEach((d, i) => {
        const p = evalSchema.safeParse(d);
        if (p.success) cases.push({ ...p.data, archivo: docs.length > 1 ? `${f}#${i + 1}` : f });
        else errors.push(`${f}${docs.length > 1 ? `#${i + 1}` : ''}: ${p.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
      });
    } catch (e) {
      errors.push(`${f}: ${(e as Error).message}`);
    }
  }
  return { cases, errors };
}

export interface Judge {
  grade(criterio: string, transcript: string): Promise<{ nota: number; razon: string }>;
}

/** Juez LLM: devuelve nota 0–10 y una razón breve. */
export class LLMJudge implements Judge {
  constructor(private provider: LLMProvider, private model: string) {}
  async grade(criterio: string, transcript: string) {
    const res = await this.provider.complete({
      model: this.model,
      system:
        'Eres un evaluador estricto de chatbots de atención al cliente en Ecuador. Calificas una conversación según un criterio. ' +
        'Responde SOLO con JSON: {"nota": <0-10>, "razon": "<una frase>"}. Sin texto extra.',
      messages: [{ role: 'user', content: `Criterio: ${criterio}\n\nConversación:\n${transcript}\n\nCalifica (JSON):` }],
      tools: [],
    });
    const m = res.text.match(/\{[\s\S]*\}/);
    try {
      const j = JSON.parse(m?.[0] ?? res.text) as { nota?: number; razon?: string; respuesta?: string };
      // ClaudeCli con protocolo de texto puede envolver en {"respuesta": "..."}
      if (j.nota === undefined && typeof j.respuesta === 'string') return this.parseLoose(j.respuesta);
      return { nota: clamp(Number(j.nota ?? 0), 0, 10), razon: String(j.razon ?? '') };
    } catch {
      return this.parseLoose(res.text);
    }
  }
  private parseLoose(text: string) {
    const inner = text.match(/\{[\s\S]*\}/);
    if (inner) {
      try {
        const j = JSON.parse(inner[0]) as { nota?: number; razon?: string };
        return { nota: clamp(Number(j.nota ?? 0), 0, 10), razon: String(j.razon ?? '') };
      } catch {
        /* sigue */
      }
    }
    const n = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10|nota\D{0,5}(\d+(?:\.\d+)?)/i);
    return { nota: clamp(Number(n?.[1] ?? n?.[2] ?? 0), 0, 10), razon: text.slice(0, 200) };
  }
}

function clamp(n: number, a: number, b: number) {
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
}

function norm(s: string) {
  return normalize(s);
}

function cityMatches(gz: Gazetteer, tiendaCiudad: string, tiendaProvincia: string, wanted: string): boolean {
  const w = norm(wanted);
  if (norm(tiendaCiudad) === w || norm(tiendaProvincia) === w) return true;
  const a = gz.lookup(tiendaCiudad);
  const b = gz.lookup(wanted);
  if (a && b && norm(a.city || a.name) === norm(b.city || b.name)) return true;
  const prov = gz.provinceCode(wanted);
  return !!prov && !b && gz.provinceCode(tiendaProvincia) === prov;
}

export function checkTurn(espera: z.infer<typeof esperaSchema> | undefined, r: EngineReply, gz: Gazetteer): Check[] {
  if (!espera) return [];
  const text = r.replies.map((x) => x.text ?? '').join('\n');
  const t = norm(text);
  const lower = text.toLowerCase();
  const checks: Check[] = [];
  if (espera.pide_campo) {
    const ok = r.state.pendingField === espera.pide_campo && text.includes('?') && !r.actions.includes('buscar_tienda');
    checks.push({ tipo: 'pide_campo', ok, detalle: `pendiente=${r.state.pendingField ?? '-'}; pregunta=${text.includes('?')}` });
  }
  if (espera.tienda_en) {
    const shown = r.tiendas;
    // La tienda recomendada (la primera) debe estar en una de las ciudades esperadas.
    const ok = shown.length > 0 && espera.tienda_en.some((c) => cityMatches(gz, shown[0].ciudad, shown[0].provincia, c));
    checks.push({ tipo: 'tienda_en', ok, detalle: shown.length ? `mostró: ${shown.map((s) => `${s.nombre} (${s.ciudad})`).join(', ')}` : 'no mostró tiendas' });
  }
  if (espera.tienda_id) {
    const first = r.tiendas[0]?.id;
    checks.push({ tipo: 'tienda_id', ok: !!first && espera.tienda_id.includes(first), detalle: `primera=${first ?? '-'}` });
  }
  for (const s of espera.no_contiene ?? []) {
    const ok = !lower.includes(s.toLowerCase()) && !t.includes(norm(s) || '\u0000');
    checks.push({ tipo: 'no_contiene', ok, detalle: `"${s}"` });
  }
  for (const s of espera.contiene ?? []) {
    checks.push({ tipo: 'contiene', ok: lower.includes(s.toLowerCase()) || t.includes(norm(s)), detalle: `"${s}"` });
  }
  if (espera.deriva_a) checks.push({ tipo: 'deriva_a', ok: r.actions.includes(`derivar:${espera.deriva_a}`), detalle: `acciones=${r.actions.join(',') || '-'}` });
  if (espera.accion) checks.push({ tipo: 'accion', ok: r.actions.some((a) => a === espera.accion || a.startsWith(`${espera.accion}:`)), detalle: `acciones=${r.actions.join(',') || '-'}` });
  if (espera.no_accion) checks.push({ tipo: 'no_accion', ok: !r.actions.some((a) => a === espera.no_accion || a.startsWith(`${espera.no_accion}:`)), detalle: `acciones=${r.actions.join(',') || '-'}` });
  if (espera.max_caracteres) checks.push({ tipo: 'max_caracteres', ok: (r.replies[0]?.text ?? '').length <= espera.max_caracteres, detalle: `${(r.replies[0]?.text ?? '').length} caracteres` });
  return checks;
}

export async function runEval(engine: Engine, botId: string, ev: EvalCase, opts: { judge?: Judge } = {}): Promise<EvalResult> {
  const started = Date.now();
  const userId = `eval:${ev.archivo}:${started}:${Math.random().toString(36).slice(2, 6)}`;
  const gz = engine.runtime(botId).locator.gazetteer;
  const turnos: TurnResult[] = [];
  const allActions: string[] = [];
  const channel = (['web', 'telegram', 'whatsapp', 'instagram', 'simulator'].includes(ev.canal) ? ev.canal : 'simulator') as IncomingMessage['channel'];
  try {
    for (const turno of ev.turnos) {
      const label = turno.usuario ?? `[ubicación ${turno.ubicacion!.lat}, ${turno.ubicacion!.lng}]`;
      const r = await engine.handle(botId, { channel, userId, text: turno.usuario, location: turno.ubicacion, timestamp: Date.now() });
      allActions.push(...r.actions);
      turnos.push({
        usuario: label,
        respuesta: r.replies.map((x) => x.text).filter(Boolean).join('\n'),
        acciones: r.actions,
        tiendas: r.tiendas.map((t) => t.id),
        checks: checkTurn(turno.espera, r, gz),
        skipped: r.skipped,
      });
    }
  } catch (e) {
    return { nombre: ev.nombre, archivo: ev.archivo, turnos, checksFinales: [], nota: 0, paso: false, error: (e as Error).message, ms: Date.now() - started };
  }
  const checksFinales: Check[] = [];
  if (ev.resultado_final?.accion) {
    const a = ev.resultado_final.accion;
    checksFinales.push({ tipo: 'resultado_final.accion', ok: allActions.some((x) => x === a || x.startsWith(`${a}:`)), detalle: `acciones=${[...new Set(allActions)].join(',') || '-'}` });
  }
  if (ev.resultado_final?.deriva_a) {
    checksFinales.push({ tipo: 'resultado_final.deriva_a', ok: allActions.includes(`derivar:${ev.resultado_final.deriva_a}`), detalle: '' });
  }
  let juez: EvalResult['juez'];
  if (ev.juez && opts.judge) {
    const transcript = turnos.map((t) => `Cliente: ${t.usuario}\nBot: ${t.respuesta || '(sin respuesta)'}`).join('\n');
    try {
      juez = await opts.judge.grade(ev.juez, transcript);
    } catch (e) {
      juez = { nota: 0, razon: `juez falló: ${(e as Error).message}` };
    }
  }
  const all = [...turnos.flatMap((t) => t.checks), ...checksFinales];
  const checkScore = all.length ? all.filter((c) => c.ok).length / all.length : 1;
  const nota = Math.round(juez ? (checkScore * 0.7 + (juez.nota / 10) * 0.3) * 100 : checkScore * 100);
  const paso = all.every((c) => c.ok) && (!juez || juez.nota >= 6);
  return { nombre: ev.nombre, archivo: ev.archivo, turnos, checksFinales, juez, nota, paso, ms: Date.now() - started };
}

export async function runAll(
  engine: Engine,
  botId: string,
  cases: EvalCase[],
  opts: { judge?: Judge; concurrency?: number; onResult?: (r: EvalResult) => void } = {},
): Promise<EvalResult[]> {
  const results: EvalResult[] = new Array(cases.length);
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const i = next++;
      results[i] = await runEval(engine, botId, cases[i], opts);
      opts.onResult?.(results[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 1) }, worker));
  return results;
}

export function renderReport(botId: string, provider: string, results: EvalResult[], loadErrors: string[] = [], date = new Date()): string {
  const passed = results.filter((r) => r.paso).length;
  const avg = results.length ? Math.round(results.reduce((n, r) => n + r.nota, 0) / results.length) : 0;
  const lines: string[] = [
    `# Evals de \`${botId}\` — ${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    `- Proveedor de IA: **${provider}**${provider === 'mock' ? ' (determinista, sin IA: prueba el motor y los datos, no la calidad de la conversación)' : ''}`,
    `- Resultado: **${passed}/${results.length}** evals pasaron · nota promedio **${avg}/100**`,
    '',
    '| # | Eval | Nota | Pasó | Juez | Archivo |',
    '|---|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.nombre} | ${r.nota} | ${r.paso ? '✅' : '❌'} | ${r.juez ? `${r.juez.nota}/10` : '—'} | \`${r.archivo}\` |`),
    '',
  ];
  if (loadErrors.length) lines.push('## Evals con formato inválido', '', ...loadErrors.map((e) => `- ${e}`), '');
  const failed = results.filter((r) => !r.paso);
  if (failed.length) {
    lines.push('## Detalle de las que fallaron', '');
    for (const r of failed) {
      lines.push(`### ❌ ${r.nombre} (\`${r.archivo}\`) — ${r.nota}/100`, '');
      if (r.error) lines.push(`**Error:** ${r.error}`, '');
      for (const t of r.turnos) {
        lines.push(`**Cliente:** ${t.usuario}`, '', `**Bot:** ${(t.respuesta || '(sin respuesta' + (t.skipped ? `: ${t.skipped}` : '') + ')').replace(/\n/g, '  \n')}`, '');
        if (t.acciones.length) lines.push(`_acciones: ${t.acciones.join(', ')}_`, '');
        for (const c of t.checks) lines.push(`- ${c.ok ? '✅' : '❌'} ${c.tipo}: ${c.detalle}`);
        lines.push('');
      }
      for (const c of r.checksFinales) lines.push(`- ${c.ok ? '✅' : '❌'} ${c.tipo}: ${c.detalle}`);
      if (r.juez) lines.push(`- Juez: ${r.juez.nota}/10 — ${r.juez.razon}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function reportFileName(date = new Date()): string {
  return `evals-${date.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`;
}

