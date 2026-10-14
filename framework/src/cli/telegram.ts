#!/usr/bin/env tsx
// Bot de Telegram en modo long polling (sin dominio público):  npm run telegram -- <bot-id>
// Requiere TELEGRAM_BOT_TOKEN (de @BotFather). Opcional: TELEGRAM_ADMIN_CHAT_ID para avisos de derivación.
import { loadDotEnv, createEngine } from '../runtime.js';
import { TelegramAdapter } from '../channels/telegram.js';
import { startFollowups } from '../followups/index.js';

loadDotEnv();
const botId = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!botId) {
  console.log('Uso: npm run telegram -- <bot-id>');
  process.exit(1);
}
const suffix = botId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
const token = process.env[`TELEGRAM_BOT_TOKEN_${suffix}`] || process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Falta TELEGRAM_BOT_TOKEN. Créalo con @BotFather (/newbot) y ponlo en framework/.env — ver framework/README.md');
  process.exit(1);
}

const engine = createEngine();
engine.runtime(botId); // valida la carpeta del bot al arrancar
const tg = new TelegramAdapter({ token });
const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
const me = await tg.call<{ username: string }>('getMe', {});
console.log(`Telegram listo: @${me.username} → bot "${botId}" · IA: ${engine.provider.name}. Ctrl+C para salir.`);

if (process.env.FOLLOWUPS_ENABLED === 'true') startFollowups(engine, (ch) => (ch === 'telegram' ? tg : undefined), [botId]);

const queues = new Map<string, Promise<void>>();
await tg.startPolling(async (m) => {
  // Comandos del chat de asesores: /reactivar <bot> <usuario>
  if (adminChat && m.userId === adminChat && m.text?.startsWith('/reactivar')) {
    const [, b, u] = m.text.split(/\s+/);
    if (b && u) {
      await engine.resume(b, u);
      await tg.send(m.userId, { text: `Bot ${b} reactivado para ${u}` });
    }
    return;
  }
  if (m.text === '/start') m.text = 'hola';
  const prev = queues.get(m.userId) ?? Promise.resolve();
  const job = prev.then(async () => {
    await tg.typing(m.userId);
    const r = await engine.handle(botId, m);
    for (const out of r.replies) await tg.send(m.userId, out);
  }).catch((e) => console.error(`[telegram] ${m.userId}:`, (e as Error).message));
  queues.set(m.userId, job);
});
