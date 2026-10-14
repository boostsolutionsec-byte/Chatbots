import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Engine } from '../src/engine/engine.js';
import { MockProvider } from '../src/llm/mock.js';
import { RecordingTransport } from '../src/channels/meta.js';
import { SimulatorAdapter } from '../src/channels/simulator.js';

const env = { BOTS_DIR: new URL('../../bots', import.meta.url).pathname, ADMIN_TOKEN: 'adm', WHATSAPP_VERIFY_TOKEN: 'vt', DEBOUNCE_SECONDS: '0' } as NodeJS.ProcessEnv;

function setup() {
  const engine = new Engine({ provider: new MockProvider(), env });
  const sent = new SimulatorAdapter();
  const app = createApp({ engine, env, log: () => {}, adapters: (ch) => (ch === 'fake' ? fakeAdapter(sent) : undefined) });
  return { app, engine, sent };
}

function fakeAdapter(out: SimulatorAdapter) {
  return {
    name: 'fake',
    parseWebhook: (r: { body: unknown }) => {
      const b = r.body as { from: string; text: string; id: string };
      return [{ channel: 'simulator' as const, userId: b.from, text: b.text, messageId: b.id, timestamp: Date.now() }];
    },
    verifyWebhook: (r: { headers: Record<string, string | undefined> }) => r.headers['x-ok'] === '1',
    send: (u: string, m: object) => out.send(u, m),
  };
}

const post = (app: ReturnType<typeof setup>['app'], path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('servidor HTTP', () => {
  it('/health', async () => {
    const { app } = setup();
    const r = await app.request('/health');
    expect(await r.json()).toMatchObject({ ok: true, provider: 'mock' });
  });

  it('POST /sim/:botId conversa y devuelve estado', async () => {
    const { app } = setup();
    const r1 = await (await post(app, '/sim/_plantilla', { userId: 'u', text: 'hola' })).json();
    expect(r1.state.pendingField).toBe('ubicacion');
    const r2 = await (await post(app, '/sim/_plantilla', { userId: 'u', text: 'estoy en ambato' })).json();
    expect(r2.actions).toContain('buscar_tienda');
    expect(r2.tiendas[0].id).toBe('ej-amb-1');
  });

  it('POST /sim con ubicación y reset', async () => {
    const { app } = setup();
    const r = await (await post(app, '/sim/_plantilla', { userId: 'g', location: { lat: -2.9, lng: -79.0 } })).json();
    expect(r.tiendas[0].id).toBe('ej-cue-1');
    const z = await (await post(app, '/sim/_plantilla', { userId: 'g', reset: true })).json();
    expect(z.reset).toBe(true);
  });

  it('errores: bot inexistente y cuerpo vacío', async () => {
    const { app } = setup();
    expect((await post(app, '/sim/no-existe', { text: 'hola' })).status).toBe(404);
    expect((await post(app, '/sim/_plantilla', {})).status).toBe(400);
  });

  it('chat web: página y mensaje', async () => {
    const { app } = setup();
    const page = await app.request('/chat/_plantilla');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('EJEMPLO Distribuidora Andina');
    const r = await (await post(app, '/chat/_plantilla/message', { userId: 'w1', text: 'soy de loja' })).json();
    expect(r.tiendas[0].id).toBe('ej-loj-1');
  });

  it('webhook: firma inválida → 401; válido → 200 y responde en segundo plano', async () => {
    const { app, sent } = setup();
    expect((await post(app, '/webhook/fake/_plantilla', { from: 'x', text: 'hola', id: '1' })).status).toBe(401);
    const ok = await post(app, '/webhook/fake/_plantilla', { from: 'x', text: 'soy de manta', id: '2' }, { 'x-ok': '1' });
    expect(ok.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(sent.outbox.some((o) => o.msg.text?.includes('EJEMPLO Papelería Manta'))).toBe(true);
    expect((await post(app, '/webhook/desconocido/_plantilla', {})).status).toBe(404);
  });

  it('verificación GET de Meta', async () => {
    const { app } = setup();
    expect(await (await app.request('/webhook/whatsapp/_plantilla?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=99')).text()).toBe('99');
    expect((await app.request('/webhook/whatsapp/_plantilla?hub.mode=subscribe&hub.verify_token=no&hub.challenge=99')).status).toBe(403);
  });

  it('admin: reactivar requiere token', async () => {
    const { app, engine } = setup();
    await post(app, '/sim/_plantilla', { userId: 'h', text: 'quiero hablar con una persona' });
    expect((await engine.store.getConversation('_plantilla', 'h')).paused).toBe(true);
    expect((await post(app, '/admin/_plantilla/h/resume', {})).status).toBe(401);
    expect((await post(app, '/admin/_plantilla/h/resume', {}, { authorization: 'Bearer adm' })).status).toBe(200);
    expect((await engine.store.getConversation('_plantilla', 'h')).paused).toBe(false);
  });

  it('procesa en orden los mensajes del mismo usuario', async () => {
    const { app } = setup();
    const [a, b] = await Promise.all([post(app, '/sim/_plantilla', { userId: 'q', text: 'hola' }), post(app, '/sim/_plantilla', { userId: 'q', text: 'soy de quito' })]);
    expect((await a.json()).state.pendingField).toBe('ubicacion');
    expect((await b.json()).actions).toContain('buscar_tienda');
  });
});

describe('transporte de grabación', () => {
  it('guarda payloads', async () => {
    const t = new RecordingTransport();
    await t.post('x', { a: 1 });
    expect(t.sent).toHaveLength(1);
  });
});

describe('admin: recarga y métricas', () => {
  it('reload y métricas con token', async () => {
    const { app } = setup();
    await post(app, '/sim/_plantilla', { userId: 'm1', text: 'soy de quito' });
    await post(app, '/sim/_plantilla', { userId: 'm2', text: 'vivo en tena' });
    expect((await app.request('/admin/_plantilla/metricas')).status).toBe(401);
    const m = await (await app.request('/admin/_plantilla/metricas', { headers: { authorization: 'Bearer adm' } })).json();
    expect(m.conversaciones).toBe(2);
    expect(m.por_tipo.ciudad.quito).toBe(1);
    expect(m.por_tipo.sin_cobertura.tena).toBe(1);
    const r = await (await post(app, '/admin/_plantilla/reload', {}, { authorization: 'Bearer adm' })).json();
    expect(r.ok).toBe(true);
  });
});

describe('SIM_TOKEN y anti-spam', () => {
  it('con SIM_TOKEN, /sim y /chat piden token', async () => {
    const e2 = { ...env, SIM_TOKEN: 'tok' } as NodeJS.ProcessEnv;
    const engine = new Engine({ provider: new MockProvider(), env: e2 });
    const app = createApp({ engine, env: e2, log: () => {} });
    expect((await post(app, '/sim/_plantilla', { userId: 'a', text: 'hola' })).status).toBe(401);
    expect((await post(app, '/sim/_plantilla', { userId: 'a', text: 'hola' }, { authorization: 'Bearer tok' })).status).toBe(200);
    expect((await app.request('/chat/_plantilla')).status).toBe(401);
    const ok = await app.request('/chat/_plantilla?token=tok');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toContain('sim_token=tok');
  });
  it('frena a quien manda demasiados mensajes por minuto', async () => {
    const engine = new Engine({ provider: new MockProvider(), env, ratePerMinute: 3 });
    const rs = [];
    for (let i = 0; i < 6; i++) rs.push(await engine.handle('_plantilla', { channel: 'simulator', userId: 'sp', text: `hola ${i}`, timestamp: Date.now() }));
    expect(rs[3].skipped).toBe('rate_limited');
    expect(rs[3].replies[0].text).toMatch(/momentito/);
    expect(rs[4].replies).toHaveLength(0);
  });
});
