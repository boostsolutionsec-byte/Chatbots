#!/usr/bin/env tsx
/**
 * Servidor de mentira con la forma del framework: `POST /sim/:botId` → `{ replies: [{text}] }`.
 * Sirve para probar el modo `--target http` y promptfoo mientras no existe el servidor del Agente 2.
 *   npm run mock-server -- --puerto 3999
 */
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTiendas, resolveTiendasPath } from './data.js';
import { MockBotTarget } from './targets.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const i = process.argv.indexOf('--puerto');
const port = Number(i >= 0 ? process.argv[i + 1] : 3999);
const bot = new MockBotTarget(loadTiendas(resolveTiendasPath(REPO, 'mokalu').path));

createServer(async (req, res) => {
  const m = req.url?.match(/^\/sim\/([\w-]+)/);
  if (req.method === 'GET' && req.url === '/health') { res.end('ok'); return; }
  if (req.method !== 'POST' || !m) { res.statusCode = 404; res.end(); return; }
  let body = '';
  for await (const c of req) body += c;
  try {
    const { userId, text, location } = JSON.parse(body || '{}');
    const replies = await bot.send({ userId: userId ?? 'anon', text, location });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ replies: replies.map((t) => ({ text: t })) }));
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
}).listen(port, () => console.log(`mock /sim escuchando en http://localhost:${port}`));
