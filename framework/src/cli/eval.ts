#!/usr/bin/env tsx
// Corre las evals de un bot:  npm run eval -- <bot-id> [--ia] [--mock] [--sin-juez] [--filtro texto] [--concurrencia N] [--salida carpeta]
// Por defecto usa MockProvider (gratis, determinista) salvo que haya ANTHROPIC_API_KEY / LLM_PROVIDER.
// --ia usa la selección automática (Anthropic → DeepSeek → claude CLI) para probar con IA real.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDotEnv } from '../runtime.js';
import { Engine } from '../engine/engine.js';
import { createProvider, resolveModel } from '../llm/index.js';
import { MemoryStore } from '../store/memory.js';
import { loadEvals, runAll, renderReport, reportFileName, LLMJudge } from '../evals/runner.js';

loadDotEnv();
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const botId = args.find((a, i) => !a.startsWith('--') && !['--filtro', '--concurrencia', '--salida'].includes(args[i - 1] ?? ''));
if (!botId) {
  console.log('Uso: npm run eval -- <bot-id> [--ia] [--mock] [--sin-juez] [--filtro texto] [--concurrencia N] [--salida carpeta]');
  process.exit(1);
}

const env = { ...process.env };
if (flag('--mock')) env.LLM_PROVIDER = 'mock';
else if (!flag('--ia') && !env.LLM_PROVIDER && !env.ANTHROPIC_API_KEY) env.LLM_PROVIDER = 'mock';
const provider = createProvider(env);
const engine = new Engine({ provider, store: new MemoryStore(), env, pauseOnHandoff: false });
const rt = engine.runtime(botId);
const { cases: all, errors } = loadEvals(rt.bot.evalsDir);
const filtro = opt('--filtro')?.toLowerCase();
const cases = filtro ? all.filter((c) => c.nombre.toLowerCase().includes(filtro) || c.archivo.toLowerCase().includes(filtro)) : all;
const judge = provider.name !== 'mock' && !flag('--sin-juez') ? new LLMJudge(provider, env.LLM_MODEL_JUEZ || resolveModel(provider.name, 'claude-haiku')) : undefined;
const concurrency = Number(opt('--concurrencia') ?? (provider.name === 'mock' ? 4 : 2));

console.log(`Evals de "${botId}": ${cases.length} casos · IA: ${provider.name}${judge ? ' · con juez LLM' : ''}`);
for (const e of errors) console.log(`  ⚠️  ${e}`);
const results = await runAll(engine, botId, cases, {
  judge,
  concurrency,
  onResult: (r) => console.log(`  ${r.paso ? '✅' : '❌'} ${String(r.nota).padStart(3)}  ${r.nombre}${r.error ? `  (error: ${r.error})` : ''}`),
});
const passed = results.filter((r) => r.paso).length;
const avg = results.length ? Math.round(results.reduce((n, r) => n + r.nota, 0) / results.length) : 0;
const outDir = opt('--salida') ?? join(rt.bot.dir, 'reportes');
mkdirSync(outDir, { recursive: true });
const file = join(outDir, reportFileName());
writeFileSync(file, renderReport(botId, provider.name, results, errors));
writeFileSync(file.replace(/\.md$/, '.json'), JSON.stringify({ botId, provider: provider.name, passed, total: results.length, avg, results }, null, 2));
console.log(`\n${passed}/${results.length} pasaron · nota promedio ${avg}/100 · reporte: ${file}`);
process.exit(errors.length && !results.length ? 1 : 0);
