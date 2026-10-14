import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Engine } from './engine/engine.js';
import { createProvider } from './llm/index.js';
import { createStore } from './store/index.js';
import { createNotifier } from './handoff/index.js';
import { TelegramAdapter } from './channels/telegram.js';
import { WhatsAppCloudAdapter } from './channels/whatsapp.js';
import { InstagramAdapter } from './channels/instagram.js';
import { PeriskopeAdapter } from './channels/periskope.js';
import { EvolutionAdapter } from './channels/evolution.js';
import { createMetaTransport } from './channels/meta.js';
import type { ChannelAdapter } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Carga `.env` de framework/ o de la raíz del repo (si existen). Nunca sobrescribe variables ya definidas. */
export function loadDotEnv(): string | undefined {
  for (const p of [resolve(here, '..', '.env'), resolve(here, '..', '..', '.env')]) {
    if (existsSync(p)) {
      const before = { ...process.env };
      process.loadEnvFile(p);
      for (const [k, v] of Object.entries(before)) process.env[k] = v; // lo ya definido gana
      return p;
    }
  }
  return undefined;
}

export function createEngine(env: NodeJS.ProcessEnv = process.env, log: (s: string) => void = (s) => console.log(s)): Engine {
  return new Engine({
    provider: createProvider(env),
    store: createStore(env),
    notifier: createNotifier(env),
    env,
    pauseOnHandoff: env.HANDOFF_PAUSE !== 'false',
    pauseHours: env.HANDOFF_PAUSE_HOURS ? Number(env.HANDOFF_PAUSE_HOURS) : undefined,
    ratePerMinute: env.RATE_LIMIT_PER_MINUTE ? Number(env.RATE_LIMIT_PER_MINUTE) : undefined,
    log,
  });
}

/** Adaptadores por canal según variables de entorno. Telegram por bot: TELEGRAM_BOT_TOKEN_<BOTID> o TELEGRAM_BOT_TOKEN. */
export function createAdapterFactory(engine: Engine, env: NodeJS.ProcessEnv = process.env) {
  const cache = new Map<string, ChannelAdapter | undefined>();
  const lastUserAt = (botId: string) => async (userId: string) => (await engine.store.getConversation(botId, userId)).lastUserAt;
  return (channel: string, botId: string): ChannelAdapter | undefined => {
    const key = `${channel}:${botId}`;
    if (cache.has(key)) return cache.get(key);
    const suffix = botId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    let a: ChannelAdapter | undefined;
    switch (channel) {
      case 'telegram': {
        const token = env[`TELEGRAM_BOT_TOKEN_${suffix}`] || env.TELEGRAM_BOT_TOKEN;
        if (token) a = new TelegramAdapter({ token, webhookSecret: env.TELEGRAM_WEBHOOK_SECRET });
        break;
      }
      case 'whatsapp':
        if (env.WHATSAPP_PHONE_NUMBER_ID)
          a = new WhatsAppCloudAdapter({
            phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
            appSecret: env.WHATSAPP_APP_SECRET,
            transport: createMetaTransport(env.WHATSAPP_TOKEN, env),
            templateLanguage: env.WHATSAPP_TEMPLATE_LANG || undefined,
            lastUserAt: lastUserAt(botId),
          });
        break;
      case 'instagram':
        if (env.INSTAGRAM_USER_ID)
          a = new InstagramAdapter({
            igUserId: env.INSTAGRAM_USER_ID,
            appSecret: env.INSTAGRAM_APP_SECRET,
            transport: createMetaTransport(env.INSTAGRAM_TOKEN, env, env.INSTAGRAM_GRAPH_HOST),
            lastUserAt: lastUserAt(botId),
          });
        break;
      case 'evolution':
        if (env.EVOLUTION_WEBHOOK_SECRET)
          a = new EvolutionAdapter({ apiUrl: env.EVOLUTION_API_URL, apiKey: env.EVOLUTION_API_KEY, instance: env.EVOLUTION_INSTANCE, webhookSecret: env.EVOLUTION_WEBHOOK_SECRET, enableSend: env.EVOLUTION_ENABLE_SEND === 'true' });
        break;
      case 'periskope':
        if (env.PERISKOPE_WEBHOOK_SECRET)
          a = new PeriskopeAdapter({ apiUrl: env.PERISKOPE_API_URL, apiKey: env.PERISKOPE_API_KEY, webhookSecret: env.PERISKOPE_WEBHOOK_SECRET, enableSend: env.PERISKOPE_ENABLE_SEND === 'true' });
        break;
    }
    cache.set(key, a);
    return a;
  };
}
