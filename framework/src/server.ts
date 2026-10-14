import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createAdapterFactory, createEngine, loadDotEnv } from './runtime.js';
import { startFollowups } from './followups/index.js';
import { listBots, botsDir } from './config/loader.js';

const envFile = loadDotEnv();
const engine = createEngine();
const app = createApp({ engine, adapters: createAdapterFactory(engine) });
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Servidor listo en http://localhost:${port}`);
  console.log(`  IA: ${engine.provider.name}${envFile ? ` · .env: ${envFile}` : ''}`);
  console.log(`  Bots: ${listBots(botsDir()).join(', ') || '(ninguno)'} → chat web: http://localhost:${port}/chat/<bot>`);
  console.log(`  Simulador: POST http://localhost:${port}/sim/<bot> {"userId":"u1","text":"hola"}`);
});

if (process.env.FOLLOWUPS_ENABLED === 'true') startFollowups(engine, createAdapterFactory(engine));
