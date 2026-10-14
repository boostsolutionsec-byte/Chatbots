#!/usr/bin/env tsx
// Chat por terminal con cualquier bot:  npm run sim -- <bot-id> [--mock] [--debug]
// Comandos: /ubicacion <lat>,<lng> · /reiniciar · /estado · /salir
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadDotEnv, createEngine } from '../runtime.js';
import { listBots, botsDir } from '../config/loader.js';

loadDotEnv();
const args = process.argv.slice(2);
const botId = args.find((a) => !a.startsWith('--'));
if (args.includes('--mock')) process.env.LLM_PROVIDER = 'mock';
const debug = args.includes('--debug');

if (!botId) {
  console.log(`Uso: npm run sim -- <bot-id> [--mock] [--debug]\nBots: ${listBots(botsDir()).join(', ')}`);
  process.exit(1);
}

const engine = createEngine(process.env, debug ? (s) => console.log(`\x1b[2m${s}\x1b[0m`) : () => {});
try {
  const rt = engine.runtime(botId);
  for (const w of rt.bot.warnings) console.log(`\x1b[33maviso:\x1b[0m ${w}`);
  console.log(`\nChat con "${rt.bot.config.marca || botId}" · IA: ${engine.provider.name}`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
console.log('Comandos: /ubicacion -1.67,-78.65 · /reiniciar · /estado · /salir\n');

const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
const userId = 'terminal';
const ask = async (): Promise<string | null> => {
  try {
    return await rl.question('\x1b[36mtú>\x1b[0m ');
  } catch {
    return null;
  }
};

for (;;) {
  const line = await ask();
  if (line === null || /^\/(salir|exit|quit)$/.test(line.trim())) break;
  const text = line.trim();
  if (!text) continue;
  if (text === '/estado') {
    console.log(JSON.stringify(await engine.store.getConversation(botId, userId), null, 2));
    continue;
  }
  const loc = text.match(/^\/ubicacion\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const msg = loc
    ? { channel: 'simulator' as const, userId, location: { lat: Number(loc[1]), lng: Number(loc[2]) }, timestamp: Date.now() }
    : { channel: 'simulator' as const, userId, text, timestamp: Date.now() };
  try {
    const r = await engine.handle(botId, msg);
    if (r.skipped === 'paused') console.log('\x1b[2m(bot en pausa: lo atiende un humano; /reiniciar para seguir probando)\x1b[0m');
    for (const out of r.replies) {
      if (out.text) console.log(`\x1b[32mbot>\x1b[0m ${out.text}`);
      if (out.location) console.log(`\x1b[32mbot>\x1b[0m 📌 ${out.location.name ?? ''} https://www.google.com/maps?q=${out.location.lat},${out.location.lng}`);
      if (out.mediaUrl) console.log(`\x1b[32mbot>\x1b[0m 🖼️ ${out.mediaUrl}`);
    }
    if (debug) {
      for (const c of r.toolCalls) console.log(`\x1b[2m  ⚙ ${c.name}(${JSON.stringify(c.input)})\x1b[0m`);
      console.log(`\x1b[2m  estado: ${JSON.stringify(r.state)}\x1b[0m`);
    }
  } catch (e) {
    console.error(`\x1b[31merror:\x1b[0m ${(e as Error).message}`);
  }
}
rl.close();
