import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import type { Engine, EngineReply } from '../engine/engine.js';
import { normalize } from '../locator/normalize.js';
import type { IncomingMessage, LLMProvider } from '../types.js';
import type { Gazetteer } from '../locator/gazetteer.js';
import { dueFollowups } from '../followups/index.js';
import { parseDuration } from '../engine/time.js';

// Formato de evals: docs/CONTRATO.md §4 + extensiones (ver "Cambios" del contrato y bots/<id>/evals/README.md).
// Claves de `espera` que el runner verifica solo; las desconocidas se pasan al juez LLM como criterio extra.

const esperaSchema = z.record(z.string(), z.unknown());

const turnoSchema = z
  .object({
    usuario: z.unknown().optional(),
    ubicacion: z.object({ lat: z.number(), lng: z.number() }).optional(),
    esperar: z.string().optional(),
    espera: esperaSchema.optional(),
  })
  .passthrough()
  .refine((t) => t.usuario !== undefined || t.ubicacion !== undefined || t.esperar !== undefined, 'cada turno necesita "usuario", "ubicacion" o "esperar"');

export const evalSchema = z
  .object({
    nombre: z.string(),
    canal: z.string().default('simulator'),
    hora_simulada: z.string().optional(),
    turnos: z.array(turnoSchema).min(1),
    resultado_final: z.record(z.string(), z.unknown()).optional(),
    juez: z.string().optional(),
    etiquetas: z.array(z.string()).optional(),
  })
  .passthrough();

export type EvalCase = z.infer<typeof evalSchema> & { archivo: string };
type Espera = Record<string, unknown>;

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
  /** Claves de `espera` que no se pueden verificar automáticamente (van al juez). */
  paraJuez: string[];
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
      // uniqueKeys: false → tolera claves repetidas (gana la última) en vez de rechazar el archivo.
      const raw = YAML.parse(readFileSync(join(dir, f), 'utf8'), { uniqueKeys: false });
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
    return parseJudge(res.text);
  }
}

export function parseJudge(text: string): { nota: number; razon: string } {
  const tryParse = (s: string): { nota?: unknown; razon?: unknown; respuesta?: unknown } | undefined => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  let j = text.match(/\{[\s\S]*\}/) ? tryParse(text.match(/\{[\s\S]*\}/)![0]) : undefined;
  // ClaudeCli con protocolo de texto puede envolver en {"respuesta": "..."}
  if (j && j.nota === undefined && typeof j.respuesta === 'string') {
    const inner = j.respuesta.match(/\{[\s\S]*\}/);
    text = j.respuesta;
    j = inner ? tryParse(inner[0]) : undefined;
  }
  if (j && j.nota !== undefined) return { nota: clamp(Number(j.nota), 0, 10), razon: String(j.razon ?? '') };
  const n = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10|nota\D{0,5}(\d+(?:\.\d+)?)/i);
  return { nota: clamp(Number(n?.[1] ?? n?.[2] ?? 0), 0, 10), razon: text.slice(0, 200) };
}

function clamp(n: number, a: number, b: number) {
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
}

const norm = (s: string) => normalize(s);
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v === undefined || v === null ? [] : [String(v)]);

function cityMatches(gz: Gazetteer, tiendaCiudad: string, tiendaProvincia: string, wanted: string): boolean {
  const w = norm(wanted);
  if (norm(tiendaCiudad) === w || norm(tiendaProvincia) === w) return true;
  const a = gz.lookup(tiendaCiudad);
  const b = gz.lookup(wanted);
  if (a && b && norm(a.city || a.name) === norm(b.city || b.name)) return true;
  const prov = gz.provinceCode(wanted);
  return !!prov && !b && gz.provinceCode(tiendaProvincia) === prov;
}

const EN_WORDS = /\b(the|you|your|store|shop|where|can|buy|near|hello|hi|thanks|is|are)\b/i;
const ES_WORDS = /\b(el|la|los|las|que|de|en|tienda|puedes|hola|gracias|est[aá]s?)\b/i;

export interface CheckContext {
  gz: Gazetteer;
  /** Texto con todos los datos válidos del bot (tiendas, conocimiento) para no_inventa_tiendas. */
  allowedData: string;
  /** Pregunta configurada para cada campo (no_pide_campo). */
  preguntas: Record<string, string>;
  followupsSent?: number;
  followupsPending?: number;
}

/** Verifica un turno. Devuelve checks y las claves que no supo verificar (para el juez). */
export function checkTurn(espera: Espera | undefined, r: EngineReply, ctx: CheckContext | Gazetteer): { checks: Check[]; paraJuez: string[] } {
  const c: CheckContext = 'gz' in ctx ? ctx : { gz: ctx, allowedData: '', preguntas: {} };
  const checks: Check[] = [];
  const paraJuez: string[] = [];
  if (!espera) return { checks, paraJuez };
  const textReplies = r.replies.filter((x) => x.text);
  const text = textReplies.map((x) => x.text ?? '').join('\n');
  const t = norm(text);
  const lower = text.toLowerCase();
  const has = (s: string) => lower.includes(s.toLowerCase()) || (norm(s) !== '' && t.includes(norm(s)));
  const acts = r.actions.join(',') || '-';
  const usedAction = (a: string) => r.actions.some((x) => x === a || x.startsWith(`${a}:`));

  for (const [key, val] of Object.entries(espera)) {
    switch (key) {
      case 'pide_campo': {
        const ok = r.state.pendingField === val && text.includes('?') && !r.actions.includes('buscar_tienda');
        checks.push({ tipo: key, ok, detalle: `pendiente=${r.state.pendingField ?? '-'}; pregunta=${text.includes('?')}` });
        break;
      }
      case 'no_pide_campo': {
        const q = c.preguntas[String(val)];
        const asks = r.state.pendingField === val && text.includes('?') && (!q || has(q.slice(0, 25)));
        checks.push({ tipo: key, ok: !asks, detalle: `pendiente=${r.state.pendingField ?? '-'}` });
        break;
      }
      case 'tienda_en': {
        const shown = r.tiendas;
        // La tienda recomendada (la primera) debe estar en una de las ciudades esperadas.
        const ok = shown.length > 0 && asList(val).some((city) => cityMatches(c.gz, shown[0].ciudad, shown[0].provincia, city));
        checks.push({ tipo: key, ok, detalle: shown.length ? `mostró: ${shown.map((s) => `${s.nombre} (${s.ciudad})`).join(', ')}` : 'no mostró tiendas' });
        break;
      }
      case 'tienda_id':
      case 'tienda_id_en': {
        const first = r.tiendas[0]?.id;
        checks.push({ tipo: key, ok: !!first && asList(val).includes(first), detalle: `primera=${first ?? '-'}` });
        break;
      }
      case 'max_tiendas':
        checks.push({ tipo: key, ok: r.tiendas.length <= Number(val), detalle: `${r.tiendas.length} tiendas` });
        break;
      case 'motivo':
        checks.push({ tipo: key, ok: r.motivos[0] === val, detalle: `motivo=${r.motivos[0] ?? '-'}` });
        break;
      case 'no_inventa_tiendas': {
        if (val !== true) break;
        const digits = (s: string) => s.replace(/\D/g, '');
        const allowed = digits(c.allowedData);
        const phones = text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? [];
        const bad = phones.filter((p) => !allowed.includes(digits(p)));
        const flagged = /\[(número|link) no verificado\]/.test(text);
        checks.push({ tipo: key, ok: !bad.length && !flagged, detalle: bad.length ? `teléfonos fuera de datos: ${bad.join(', ')}` : flagged ? 'el motor tuvo que borrar datos inventados' : 'ok' });
        break;
      }
      case 'no_contiene':
        for (const s of asList(val)) checks.push({ tipo: key, ok: !has(s), detalle: `"${s}"` });
        break;
      case 'contiene':
        for (const s of asList(val)) checks.push({ tipo: key, ok: has(s), detalle: `"${s}"` });
        break;
      case 'contiene_alguno': {
        const list = asList(val);
        checks.push({ tipo: key, ok: list.some(has), detalle: list.map((x) => `"${x}"`).join(' | ') });
        break;
      }
      case 'deriva_a':
        checks.push({ tipo: key, ok: r.actions.includes(`derivar:${val}`), detalle: `acciones=${acts}` });
        break;
      case 'no_deriva':
        if (val === true) checks.push({ tipo: key, ok: !usedAction('derivar'), detalle: `acciones=${acts}` });
        break;
      case 'prioridad':
        checks.push({ tipo: key, ok: r.prioridad === val, detalle: `prioridad=${r.prioridad ?? '-'}` });
        break;
      case 'accion':
        checks.push({ tipo: key, ok: usedAction(String(val)), detalle: `acciones=${acts}` });
        break;
      case 'no_accion':
        checks.push({ tipo: key, ok: !usedAction(String(val)), detalle: `acciones=${acts}` });
        break;
      case 'ofrece_humano':
        if (val === true) checks.push({ tipo: key, ok: usedAction('derivar') || /asesor|persona|equipo|humano/.test(t), detalle: `acciones=${acts}` });
        break;
      case 'max_caracteres': {
        const len = (textReplies[0]?.text ?? '').length;
        checks.push({ tipo: key, ok: len <= Number(val), detalle: `${len} caracteres` });
        break;
      }
      case 'max_palabras': {
        const n = text.split(/\s+/).filter(Boolean).length;
        checks.push({ tipo: key, ok: r.tiendas.length > 0 || n <= Number(val), detalle: `${n} palabras${r.tiendas.length ? ' (lista tiendas: no aplica)' : ''}` });
        break;
      }
      case 'max_burbujas':
        checks.push({ tipo: key, ok: textReplies.length <= Number(val), detalle: `${textReplies.length} mensajes` });
        break;
      case 'pregunta_unica':
        if (val === true) {
          const n = (text.match(/\?/g) ?? []).length;
          checks.push({ tipo: key, ok: n <= 1, detalle: `${n} preguntas` });
        }
        break;
      case 'idioma': {
        const want = String(val).toLowerCase();
        const ok = want.startsWith('en') ? EN_WORDS.test(text) : want.startsWith('es') ? ES_WORDS.test(text) : true;
        checks.push({ tipo: key, ok, detalle: `idioma esperado ${want}` });
        break;
      }
      case 'seguimientos_enviados':
        checks.push({ tipo: key, ok: (c.followupsSent ?? 0) === Number(val), detalle: `${c.followupsSent ?? 0} enviados` });
        break;
      case 'seguimientos_pendientes':
        checks.push({ tipo: key, ok: (c.followupsPending ?? 0) === Number(val), detalle: `${c.followupsPending ?? 0} pendientes` });
        break;
      default:
        paraJuez.push(`${key}: ${JSON.stringify(val)}`);
    }
  }
  return { checks, paraJuez };
}

/** Normaliza las variantes de `usuario` (texto, número, ráfaga, audio/imagen/ubicación). */
export function userInput(turno: { usuario?: unknown; ubicacion?: { lat: number; lng: number } }): { text?: string; location?: { lat: number; lng: number }; label: string } {
  const u = turno.usuario;
  if (turno.ubicacion) return { location: turno.ubicacion, text: typeof u === 'string' ? u : undefined, label: `[ubicación ${turno.ubicacion.lat}, ${turno.ubicacion.lng}]` };
  if (Array.isArray(u)) {
    // Ráfaga de mensajes: el motor los agrupa (debounce) como un solo turno.
    return { text: u.map(String).join('\n'), label: u.map(String).join(' / ') };
  }
  if (u && typeof u === 'object') {
    const o = u as { audio_transcrito?: string; imagen_descrita?: string; ubicacion?: { lat: number; lng: number }; texto?: string };
    if (o.ubicacion) return { location: o.ubicacion, text: o.texto, label: `[ubicación ${o.ubicacion.lat}, ${o.ubicacion.lng}]` };
    if (o.audio_transcrito) return { text: `[nota de voz transcrita] ${o.audio_transcrito}`, label: `🎤 ${o.audio_transcrito}` };
    if (o.imagen_descrita) return { text: `[el cliente envió una imagen: ${o.imagen_descrita}]${o.texto ? `\n${o.texto}` : ''}`, label: `🖼️ ${o.imagen_descrita}` };
    return { text: JSON.stringify(o), label: JSON.stringify(o) };
  }
  return { text: u === undefined ? undefined : String(u), label: String(u ?? '') };
}

export async function runEval(engine: Engine, botId: string, ev: EvalCase, opts: { judge?: Judge } = {}): Promise<EvalResult> {
  const started = Date.now();
  const userId = `eval:${ev.archivo}:${started}:${Math.random().toString(36).slice(2, 6)}`;
  const rt = engine.runtime(botId);
  const ctx: CheckContext = {
    gz: rt.locator.gazetteer,
    allowedData: [JSON.stringify(rt.bot.tiendas), rt.bot.knowledge.map((k) => k.content).join('\n'), rt.bot.systemPrompt, JSON.stringify(rt.bot.config.destinos)].join('\n'),
    preguntas: Object.fromEntries(Object.values(rt.bot.config.flujos).flatMap((f) => f.campos.filter((x) => x.pregunta).map((x) => [x.id, x.pregunta!]))),
  };
  let clock = ev.hora_simulada && !Number.isNaN(Date.parse(ev.hora_simulada)) ? Date.parse(ev.hora_simulada) : Date.now();
  const turnos: TurnResult[] = [];
  const allActions: string[] = [];
  const paraJuez: string[] = [];
  const channel = (['web', 'telegram', 'whatsapp', 'instagram', 'simulator'].includes(ev.canal) ? ev.canal : 'simulator') as IncomingMessage['channel'];
  try {
    for (const turno of ev.turnos) {
      if (turno.esperar && turno.usuario === undefined && !turno.ubicacion) {
        // Paso del tiempo: corre los seguimientos que tocarían.
        clock += parseDuration(turno.esperar);
        const conv = await engine.store.getConversation(botId, userId);
        const due = dueFollowups(rt.bot, conv, clock);
        for (const f of due) {
          conv.followupsSent.push(f.key);
          conv.lastFollowupAt = clock;
          conv.messages.push({ role: 'assistant', text: f.message.text ?? `[plantilla ${f.message.template?.name}]`, at: clock });
        }
        if (due.length) {
          conv.lastBotAt = clock;
          await engine.store.saveConversation(conv);
        }
        const pending = rt.bot.config.seguimiento.length - conv.followupsSent.length;
        const fake: EngineReply = {
          replies: due.map((d) => ({ text: d.message.text ?? `[plantilla ${d.message.template?.name}]` })),
          toolCalls: [],
          actions: due.map(() => 'seguimiento'),
          tiendas: [],
          motivos: [],
          state: { fields: conv.fields, paused: !!conv.paused, turnsWithoutProgress: conv.turnsWithoutProgress },
        };
        const { checks, paraJuez: pj } = checkTurn(turno.espera, fake, { ...ctx, followupsSent: due.length, followupsPending: Math.max(0, pending) });
        paraJuez.push(...pj);
        turnos.push({ usuario: `(pasan ${turno.esperar})`, respuesta: fake.replies.map((x) => x.text).join('\n'), acciones: fake.actions, tiendas: [], checks, paraJuez: pj });
        continue;
      }
      const input = userInput(turno);
      const r = await engine.handle(botId, { channel, userId, text: input.text, location: input.location, timestamp: clock }, { now: new Date(clock) });
      clock += 60_000;
      allActions.push(...r.actions);
      const { checks, paraJuez: pj } = checkTurn(turno.espera, r, ctx);
      paraJuez.push(...pj);
      turnos.push({
        usuario: input.label,
        respuesta: r.replies.map((x) => x.text).filter(Boolean).join('\n'),
        acciones: r.actions,
        tiendas: r.tiendas.map((x) => x.id),
        checks,
        paraJuez: pj,
        skipped: r.skipped,
      });
    }
  } catch (e) {
    return { nombre: ev.nombre, archivo: ev.archivo, turnos, checksFinales: [], nota: 0, paso: false, error: (e as Error).message, ms: Date.now() - started };
  }
  const checksFinales: Check[] = [];
  const uniq = () => [...new Set(allActions)].join(',') || '-';
  for (const [key, val] of Object.entries(ev.resultado_final ?? {})) {
    if (key === 'accion') checksFinales.push({ tipo: 'resultado_final.accion', ok: allActions.some((x) => x === val || x.startsWith(`${val}:`)), detalle: `acciones=${uniq()}` });
    else if (key === 'deriva_a' || key === 'destino') checksFinales.push({ tipo: `resultado_final.${key}`, ok: allActions.includes(`derivar:${val}`), detalle: `acciones=${uniq()}` });
    else if (key === 'respuestas_totales') {
      const n = turnos.filter((x) => x.respuesta).length;
      checksFinales.push({ tipo: 'resultado_final.respuestas_totales', ok: n <= Number(val), detalle: `${n} respuestas` });
    } else paraJuez.push(`resultado_final.${key}: ${JSON.stringify(val)}`);
  }
  let juez: EvalResult['juez'];
  if ((ev.juez || paraJuez.length) && opts.judge) {
    const transcript = turnos.map((x) => `Cliente: ${x.usuario}\nBot: ${x.respuesta || '(sin respuesta)'}`).join('\n');
    const criterio = [ev.juez, paraJuez.length ? `Además verifica: ${paraJuez.join('; ')}` : ''].filter(Boolean).join('\n');
    try {
      juez = await opts.judge.grade(criterio, transcript);
    } catch (e) {
      juez = { nota: 0, razon: `juez falló: ${(e as Error).message}` };
    }
  }
  const all = [...turnos.flatMap((x) => x.checks), ...checksFinales];
  const checkScore = all.length ? all.filter((x) => x.ok).length / all.length : 1;
  const nota = Math.round(juez ? (all.length ? checkScore * 0.7 + (juez.nota / 10) * 0.3 : juez.nota / 10) * 100 : checkScore * 100);
  const paso = all.every((x) => x.ok) && (!juez || juez.nota >= 6);
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
  const unchecked = new Map<string, number>();
  for (const r of results) for (const t of r.turnos) for (const k of t.paraJuez) unchecked.set(k.split(':')[0], (unchecked.get(k.split(':')[0]) ?? 0) + 1);
  const lines: string[] = [
    `# Evals de \`${botId}\` — ${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    `- Proveedor de IA: **${provider}**${provider === 'mock' ? ' (determinista, sin IA: prueba el motor y los datos, no la calidad de la conversación)' : ''}`,
    `- Resultado: **${passed}/${results.length}** evals pasaron · nota promedio **${avg}/100**`,
    unchecked.size ? `- Claves que solo evalúa el juez LLM: ${[...unchecked].map(([k, n]) => `\`${k}\` (${n})`).join(', ')}` : '',
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
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export function reportFileName(date = new Date()): string {
  return `evals-${date.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`;
}
