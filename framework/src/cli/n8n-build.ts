#!/usr/bin/env tsx
// Genera framework/n8n/ para un bot:  npm run n8n:build -- <bot-id>
// Produce: localizador.js (un solo archivo, pegable en un nodo Code), tiendas.json, lugares.json, sistema.md.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBot } from '../config/loader.js';

const botId = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!botId) {
  console.log('Uso: npm run n8n:build -- <bot-id>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'n8n');
mkdirSync(out, { recursive: true });
const bot = loadBot(botId, { env: { ...process.env } });
const online = bot.config.destinos.find((d) => d.id === bot.config.localizador?.ofrecer_ademas)?.valor;
const config = { maxResultados: bot.config.localizador?.max_resultados ?? 2, webTienda: online, distanciaLejanaKm: bot.config.localizador?.distancia_lejana_km ?? 60, alias: bot.config.localizador?.alias };

const tmp = join(out, '.bundle.js');
execFileSync('npx', ['--yes', 'esbuild@0.24.0', join(root, 'src/n8n/entry.ts'), '--bundle', '--format=iife', '--global-name=Localizador', '--platform=neutral', '--target=es2020', '--minify-whitespace', `--outfile=${tmp}`], { stdio: 'inherit' });
const bundle = readFileSync(tmp, 'utf8');
const tiendas = bot.tiendas;
writeFileSync(join(out, 'tiendas.json'), JSON.stringify(tiendas, null, 1));
writeFileSync(join(out, 'lugares.json'), JSON.stringify(bot.lugares, null, 1));
const header = `// ─────────────────────────────────────────────────────────────────────────────
// Localizador de tiendas para un nodo Code de n8n ("Run Once for Each Item"). Generado por
// \`npm run n8n:build -- ${botId}\` el ${new Date().toISOString().slice(0, 10)}. NO editar a mano: regenerar.
// Entrada: el item del Telegram Trigger ($json.message.text / $json.message.location).
// Salida: { atajo, respuesta?, contexto, tiendas, lugar, chatId, texto }.
//   atajo=true  → enviar "respuesta" directo a Telegram (sin IA).
//   atajo=false → mandar "texto" + "contexto" a DeepSeek con sistema.md como system prompt.
// ─────────────────────────────────────────────────────────────────────────────
`;
const footer = `
// Datos del bot (para actualizar tiendas: editar bots/${botId}/tiendas.csv y regenerar este archivo).
const TIENDAS = ${JSON.stringify(tiendas)};
const LUGARES = ${JSON.stringify(bot.lugares)};
const CONFIG = ${JSON.stringify(config)};

const msg = ($json && ($json.message || $json.edited_message)) || {};
const texto = msg.text || msg.caption || ($json && $json.texto) || '';
const r = Localizador.responder({
  texto,
  lat: msg.location ? msg.location.latitude : undefined,
  lng: msg.location ? msg.location.longitude : undefined,
  tiendas: TIENDAS,
  lugares: LUGARES,
  config: CONFIG,
});
return { json: { ...r, texto, chatId: msg.chat ? msg.chat.id : ($json && $json.chatId) } };
`;
writeFileSync(join(out, 'localizador.js'), header + bundle + footer);
writeFileSync(join(out, 'sistema.md'), bot.systemPrompt);
execFileSync('rm', ['-f', tmp]);
console.log(`Listo: ${out}/localizador.js (${Math.round((header + bundle + footer).length / 1024)} KB), tiendas.json (${tiendas.length}), lugares.json, sistema.md`);
