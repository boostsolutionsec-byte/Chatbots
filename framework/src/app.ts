import { Hono } from 'hono';
import type { Context } from 'hono';
import { listBots, botsDir, BotConfigError } from './config/loader.js';
import { Engine } from './engine/engine.js';
import { SimulatorAdapter } from './channels/simulator.js';
import { WebChatAdapter, chatPage } from './channels/web.js';
import { metaVerificationChallenge } from './channels/meta.js';
import type { ChannelAdapter, IncomingMessage, WebhookRequest } from './types.js';
import { Debouncer } from './channels/debounce.js';

export interface AppDeps {
  engine: Engine;
  env?: NodeJS.ProcessEnv;
  /** Adaptadores por canal y bot: adapters(channel, botId). */
  adapters?: (channel: string, botId: string) => ChannelAdapter | undefined;
  log?: (s: string) => void;
}

function toWebhookRequest(c: Context, rawBody: string): WebhookRequest {
  let body: unknown = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = {};
  }
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  return { headers, query: c.req.query(), body, rawBody };
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((s: string) => console.log(s));
  const engine = deps.engine;
  const sim = new SimulatorAdapter();
  const web = new WebChatAdapter();
  /** Cola por usuario: los mensajes del mismo chat se procesan en orden. */
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prev = queues.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    queues.set(key, next.catch(() => {}));
    return next;
  };

  const botExists = (botId: string) => {
    try {
      engine.runtime(botId);
      return true;
    } catch (e) {
      if (e instanceof BotConfigError) log(`[${botId}] ${e.message}`);
      return false;
    }
  };

  app.get('/health', (c) => c.json({ ok: true, provider: engine.provider.name, bots: listBots(botsDir(env)) }));

  app.get('/', (c) => {
    const bots = listBots(botsDir(env));
    return c.html(
      `<!doctype html><meta charset="utf-8"><title>Bots</title><body style="font-family:system-ui;padding:24px">` +
        `<h1>Bots disponibles</h1><ul>${bots.map((b) => `<li><a href="/chat/${encodeURIComponent(b)}">${b}</a></li>`).join('')}</ul>` +
        `<p>Proveedor de IA: <b>${engine.provider.name}</b></p></body>`,
    );
  });

  // Si SIM_TOKEN está definido, /sim y /chat exigen el token (producción: que nadie use la IA gratis por ahí).
  const testGuard = async (c: Context, next: () => Promise<void>) => {
    if (!env.SIM_TOKEN) return next();
    const auth = c.req.header('authorization');
    const q = c.req.query('token');
    const cookie = c.req.header('cookie')?.match(/(?:^|;\s*)sim_token=([^;]+)/)?.[1];
    if (auth === `Bearer ${env.SIM_TOKEN}` || q === env.SIM_TOKEN || cookie === env.SIM_TOKEN) {
      if (q === env.SIM_TOKEN) c.header('set-cookie', `sim_token=${encodeURIComponent(q)}; Path=/; HttpOnly; SameSite=Strict`);
      return next();
    }
    return c.json({ error: 'no autorizado (falta SIM_TOKEN)' }, 401);
  };
  app.use('/sim/*', testGuard);
  app.use('/chat/*', testGuard);

  // ── Simulador (Agentes 3 y 4, evals, n8n)
  app.post('/sim/:botId', async (c) => {
    const botId = c.req.param('botId');
    if (!botExists(botId)) return c.json({ error: `bot "${botId}" no existe o su bot.yaml es inválido` }, 404);
    const raw = await c.req.text();
    const req = toWebhookRequest(c, raw);
    const b = req.body as { reset?: boolean; userId?: string };
    if (b.reset) await engine.reset(botId, String(b.userId ?? 'sim-user'));
    const msgs = sim.parseWebhook(req);
    if (!msgs.length) return c.json(b.reset ? { ok: true, reset: true } : { error: 'falta text, location o buttonId' }, b.reset ? 200 : 400);
    try {
      const r = await enqueue(`${botId}:${msgs[0].userId}`, () => engine.handle(botId, msgs[0]));
      return c.json(r);
    } catch (e) {
      log(`[sim] error: ${(e as Error).stack ?? e}`);
      return c.json({ error: (e as Error).message }, 500);
    }
  });

  app.post('/sim/:botId/reset', async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { userId?: string };
    await engine.reset(c.req.param('botId'), String(b.userId ?? 'sim-user'));
    return c.json({ ok: true });
  });

  // ── Chat web local
  app.get('/chat/:botId', (c) => {
    const botId = c.req.param('botId');
    if (!botExists(botId)) return c.text(`Bot "${botId}" no encontrado`, 404);
    const rt = engine.runtime(botId);
    return c.html(chatPage(botId, rt.bot.config.marca || botId));
  });

  app.post('/chat/:botId/message', async (c) => {
    const botId = c.req.param('botId');
    if (!botExists(botId)) return c.json({ error: 'bot no encontrado' }, 404);
    const raw = await c.req.text();
    const msgs = web.parseWebhook(toWebhookRequest(c, raw));
    if (!msgs.length) return c.json({ error: 'mensaje vacío' }, 400);
    try {
      const r = await enqueue(`${botId}:${msgs[0].userId}`, () => engine.handle(botId, msgs[0]));
      return c.json(r);
    } catch (e) {
      log(`[web] error: ${(e as Error).stack ?? e}`);
      return c.json({ error: (e as Error).message }, 500);
    }
  });

  // ── Webhooks de canales (Telegram, WhatsApp, Instagram, Periskope)
  app.get('/webhook/:channel/:botId', (c) => {
    const ch = c.req.param('channel');
    const token = ch === 'whatsapp' ? env.WHATSAPP_VERIFY_TOKEN : ch === 'instagram' ? env.INSTAGRAM_VERIFY_TOKEN : undefined;
    const challenge = metaVerificationChallenge(c.req.query(), token);
    return challenge !== undefined ? c.text(challenge) : c.text('forbidden', 403);
  });

  app.post('/webhook/:channel/:botId', async (c) => {
    const { channel, botId } = c.req.param();
    const adapter = deps.adapters?.(channel, botId);
    if (!adapter) return c.json({ error: `canal "${channel}" no configurado` }, 404);
    if (!botExists(botId)) return c.json({ error: 'bot no encontrado' }, 404);
    const raw = await c.req.text();
    const req = toWebhookRequest(c, raw);
    if (adapter.verifyWebhook && !adapter.verifyWebhook(req)) return c.json({ error: 'firma inválida' }, 401);
    const msgs = adapter.parseWebhook(req);
    // Responder 200 rápido y procesar en segundo plano (Meta reintenta si tardamos); ráfagas agrupadas (P-4).
    for (const m of msgs) debouncerFor(botId, adapter).push(m.userId, m);
    return c.json({ ok: true, recibidos: msgs.length });
  });

  const debouncers = new Map<string, Debouncer>();
  const debounceMs = Number(env.DEBOUNCE_SECONDS ?? 3) * 1000;
  function debouncerFor(botId: string, adapter: ChannelAdapter): Debouncer {
    const key = `${adapter.name}:${botId}`;
    let d = debouncers.get(key);
    if (!d) {
      d = new Debouncer(Number.isFinite(debounceMs) ? debounceMs : 3000, (m) => processInBackground(botId, adapter, m));
      debouncers.set(key, d);
    }
    return d;
  }

  async function processInBackground(botId: string, adapter: ChannelAdapter, m: IncomingMessage) {
    try {
      const r = await enqueue(`${botId}:${m.userId}`, () => engine.handle(botId, m));
      for (const out of r.replies) await adapter.send(m.userId, out);
    } catch (e) {
      log(`[${adapter.name}] error procesando mensaje: ${(e as Error).message}`);
    }
  }

  // ── Administración (derivación): reactivar el bot para un chat
  app.post('/admin/:botId/:userId/resume', async (c) => {
    const auth = c.req.header('authorization');
    if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return c.json({ error: 'no autorizado' }, 401);
    await engine.resume(c.req.param('botId'), c.req.param('userId'));
    return c.json({ ok: true });
  });

  // Recargar la carpeta del bot sin reiniciar (tras editar tiendas.csv, prompt o conocimiento) — G-9
  app.post('/admin/:botId/reload', (c) => {
    const auth = c.req.header('authorization');
    if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return c.json({ error: 'no autorizado' }, 401);
    try {
      const rt = engine.runtime(c.req.param('botId'), true);
      return c.json({ ok: true, tiendas: rt.bot.tiendas.length, avisos: rt.bot.warnings });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  // Métricas para el dueño: intenciones, ciudades sin tienda, derivaciones — G-8
  app.get('/admin/:botId/metricas', async (c) => {
    const auth = c.req.header('authorization');
    if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return c.json({ error: 'no autorizado' }, 401);
    const list = (await engine.store.listConversations?.(c.req.param('botId'))) ?? [];
    return c.json(metrics(list));
  });

  app.get('/admin/:botId/conversations', async (c) => {
    const auth = c.req.header('authorization');
    if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return c.json({ error: 'no autorizado' }, 401);
    const list = (await engine.store.listConversations?.(c.req.param('botId'))) ?? [];
    return c.json(list.map((x) => ({ userId: x.userId, channel: x.channel, paused: x.paused, fields: x.fields, mensajes: x.messages.length, updatedAt: x.updatedAt })));
  });

  return app;
}

/** Cuenta etiquetas de las conversaciones: { total, por_tipo: { ciudad: {quito: 3}, sin_cobertura: {...}, ... } }. */
export function metrics(convs: { tags?: string[]; paused?: boolean }[]) {
  const porTipo: Record<string, Record<string, number>> = {};
  for (const c of convs) {
    for (const t of c.tags ?? []) {
      const [tipo, ...rest] = t.split(':');
      const valor = rest.join(':') || '(sí)';
      porTipo[tipo] ??= {};
      porTipo[tipo][valor] = (porTipo[tipo][valor] ?? 0) + 1;
    }
  }
  const ordenar = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
  return {
    conversaciones: convs.length,
    en_pausa_con_humano: convs.filter((c) => c.paused).length,
    por_tipo: Object.fromEntries(Object.entries(porTipo).map(([k, v]) => [k, ordenar(v)])),
  };
}
