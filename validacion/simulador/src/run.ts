#!/usr/bin/env tsx
/**
 * Corre las personas contra un bot y escribe validacion/reportes/<fecha-hora>.md (+ .json para tendencias).
 *
 *   npm run sim -- --target mock                       # bot de reglas (sin framework), cliente guion, sin juez IA
 *   npm run sim -- --target http --url http://localhost:3000 --bot mokalu --cliente ia --juez ia
 *   npm run sim -- --solo p01,p19 --cliente ia --juez ia --concurrencia 2
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPersonas, loadTiendas, resolveTiendasPath, validatePersona } from './data.js';
import { HttpSimTarget, MockBotTarget, type BotTarget } from './targets.js';
import { LLMCustomer, ScriptedCustomer } from './customer.js';
import { autoLLM } from './llm.js';
import { pool, runConversation } from './conversation.js';
import { resumir, toMarkdown, type Resumen } from './report.js';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..');

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const botId = arg('bot', 'mokalu')!;
  const targetKind = arg('target', 'mock')!;
  const clienteKind = arg('cliente', 'guion')!;
  const juezKind = arg('juez', targetKind === 'mock' ? 'reglas' : 'ia')!;
  const maxTurnos = Number(arg('max-turnos', '6'));
  const conc = Number(arg('concurrencia', '3'));
  const solo = arg('solo')?.split(',').map((s) => s.trim());
  const outDir = arg('salida', join(REPO, 'validacion', 'reportes'))!;
  const personasDir = arg('personas', join(REPO, 'validacion', 'personas'))!;

  const tp = resolveTiendasPath(REPO, botId, arg('tiendas'));
  const tiendas = loadTiendas(tp.path);
  let personas = loadPersonas(personasDir);
  const malas = personas.flatMap((p) => validatePersona(p).map((e) => `${p.id}: ${e}`));
  if (malas.length) { console.error('Personas inválidas:\n' + malas.join('\n')); process.exit(2); }
  if (solo) personas = personas.filter((p) => solo.some((s) => p.id === s || p.id.startsWith(s + '-')));

  const bot: BotTarget = targetKind === 'http'
    ? new HttpSimTarget(arg('url', process.env.SIM_URL ?? 'http://localhost:3000')!, botId)
    : new MockBotTarget(tiendas);
  const llm = clienteKind === 'ia' || juezKind === 'ia' ? autoLLM() : undefined;
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const permitidos = (arg('permitidos', process.env.SIM_PERMITIDOS ?? 'https://mokalu.com.ec') ?? '').split(',').filter(Boolean);

  console.log(`▶ ${personas.length} personas · bot=${bot.name} · cliente=${clienteKind} · juez=${juezKind}${llm ? ` (${llm.name})` : ''} · tiendas=${tp.path}${tp.esMock ? ' (FIXTURE)' : ''}`);
  const resultados = await pool(personas, conc, (p) =>
    runConversation(p, clienteKind === 'ia' ? new LLMCustomer(p, llm!) : new ScriptedCustomer(p), bot, tiendas, {
      maxTurnos,
      runId,
      juez: juezKind === 'ia' ? llm : undefined,
      permitidos,
    }),
  (r, n) => console.log(`  [${n}/${personas.length}] ${r.personaId}: ${r.notaPersona}/10${r.error ? ' ERROR ' + r.error : ''}`));

  const fecha = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const resumen = resumir(resultados, {
    fecha,
    target: bot.name,
    cliente: clienteKind === 'ia' ? `IA (${llm!.name})` : 'guion fijo',
    juez: juezKind === 'ia' ? `IA (${llm!.name}) + reglas` : 'solo reglas deterministas',
    tiendas: `${tp.path.replace(REPO + '/', '')}${tp.esMock ? ' (fixture del validador)' : ''} — ${tiendas.length} tiendas`,
  });

  mkdirSync(outDir, { recursive: true });
  const prev = readdirSync(outDir).filter((f) => f.endsWith('.json') && !f.startsWith('mock-')).sort().pop();
  const anterior: Resumen | undefined = prev && targetKind !== 'mock' ? JSON.parse(readFileSync(join(outDir, prev), 'utf8')) : undefined;
  const base = `${targetKind === 'mock' ? 'mock-' : ''}${fecha.replace(/[: ]/g, '-')}`;
  writeFileSync(join(outDir, `${base}.md`), toMarkdown(resumen, anterior));
  writeFileSync(join(outDir, `${base}.json`), JSON.stringify(resumen, null, 2));
  console.log(`✔ Nota global ${resumen.notaGlobal}/10 → ${join(outDir, base)}.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
