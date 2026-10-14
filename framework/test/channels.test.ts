import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TelegramAdapter, parseTelegramUpdate, splitText, toTelegramHtml } from '../src/channels/telegram.js';
import { WhatsAppCloudAdapter } from '../src/channels/whatsapp.js';
import { InstagramAdapter } from '../src/channels/instagram.js';
import { PeriskopeAdapter } from '../src/channels/periskope.js';
import { DisabledTransport, RecordingTransport, canSendFreeForm, createMetaTransport, metaVerificationChallenge, verifyMetaSignature } from '../src/channels/meta.js';
import { SimulatorAdapter } from '../src/channels/simulator.js';
import { WebChatAdapter, chatPage } from '../src/channels/web.js';

const req = (body: unknown, headers: Record<string, string> = {}, rawBody?: string) => ({ headers, query: {}, body, rawBody: rawBody ?? JSON.stringify(body) });

describe('Telegram', () => {
  it('parsea texto, ubicación, foto y botones', () => {
    expect(parseTelegramUpdate({ update_id: 1, message: { message_id: 5, chat: { id: 42 }, date: 1700000000, text: 'hola' } })[0]).toMatchObject({
      channel: 'telegram',
      userId: '42',
      text: 'hola',
      messageId: '42_5',
      timestamp: 1700000000000,
    });
    expect(parseTelegramUpdate({ update_id: 2, message: { message_id: 6, chat: { id: 42 }, date: 1, location: { latitude: -1.6, longitude: -78.6 } } })[0].location).toEqual({ lat: -1.6, lng: -78.6 });
    expect(parseTelegramUpdate({ update_id: 3, message: { message_id: 7, chat: { id: 42 }, date: 1, photo: [{ file_id: 'a' }, { file_id: 'b' }], caption: 'mira' } })[0]).toMatchObject({ mediaUrl: 'telegram-file:b', text: 'mira' });
    expect(parseTelegramUpdate({ update_id: 4, callback_query: { id: 'c1', from: { id: 42 }, data: 'opcion_1', message: { message_id: 8, chat: { id: 42 }, date: 1 } } })[0]).toMatchObject({ buttonId: 'opcion_1', userId: '42' });
    expect(parseTelegramUpdate({ update_id: 5 })).toEqual([]);
  });

  it('verifica el secreto del webhook', () => {
    const a = new TelegramAdapter({ token: 't', webhookSecret: 's3' });
    expect(a.verifyWebhook(req({}, { 'x-telegram-bot-api-secret-token': 's3' }))).toBe(true);
    expect(a.verifyWebhook(req({}, { 'x-telegram-bot-api-secret-token': 'x' }))).toBe(false);
  });

  it('envía texto HTML con botones, ubicación y foto (fetch simulado)', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: {} }));
    }) as unknown as typeof fetch;
    const a = new TelegramAdapter({ token: 'TOKEN', fetchImpl });
    await a.send('42', { text: 'Hola *amigo* <3', buttons: [{ id: 'b1', title: 'Sí' }] });
    await a.send('42', { location: { lat: 1, lng: 2, name: 'Tienda' } });
    await a.send('42', { mediaUrl: 'https://x/y.jpg', text: 'foto' });
    expect(calls[0].url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
    expect(calls[0].body.text).toBe('Hola <b>amigo</b> &lt;3');
    expect(calls[0].body.reply_markup).toEqual({ inline_keyboard: [[{ text: 'Sí', callback_data: 'b1' }]] });
    expect(calls[1].url).toMatch(/sendVenue$/);
    expect(calls[2].url).toMatch(/sendPhoto$/);
  });

  it('error de la API se propaga', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ ok: false, description: 'Unauthorized' }))) as unknown as typeof fetch;
    await expect(new TelegramAdapter({ token: 'x', fetchImpl }).send('1', { text: 'a' })).rejects.toThrow(/Unauthorized/);
  });

  it('utilidades', () => {
    expect(toTelegramHtml('a & b')).toBe('a &amp; b');
    expect(splitText('a'.repeat(10), 4)).toEqual(['aaaa', 'aaaa', 'aa']);
  });
});

describe('Meta (sin conexión real)', () => {
  const secret = 'appsecret';
  const sign = (raw: string) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;

  it('verifica X-Hub-Signature-256', () => {
    const raw = '{"a":1}';
    expect(verifyMetaSignature({ headers: { 'x-hub-signature-256': sign(raw) }, query: {}, body: {}, rawBody: raw }, secret)).toBe(true);
    expect(verifyMetaSignature({ headers: { 'x-hub-signature-256': sign('otro') }, query: {}, body: {}, rawBody: raw }, secret)).toBe(false);
    expect(verifyMetaSignature({ headers: {}, query: {}, body: {}, rawBody: raw }, secret)).toBe(false);
    expect(verifyMetaSignature({ headers: { 'x-hub-signature-256': sign(raw) }, query: {}, body: {}, rawBody: raw }, undefined)).toBe(false);
  });

  it('handshake de verificación', () => {
    expect(metaVerificationChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'v', 'hub.challenge': '123' }, 'v')).toBe('123');
    expect(metaVerificationChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'x', 'hub.challenge': '123' }, 'v')).toBeUndefined();
  });

  it('el transporte por defecto nunca envía', async () => {
    expect(createMetaTransport('tok', {})).toBeInstanceOf(DisabledTransport);
    await expect(new DisabledTransport().post('x', {})).rejects.toThrow(/deshabilitado/);
  });

  it('ventana de 24 h', () => {
    const now = Date.now();
    expect(canSendFreeForm(now - 3600_000, now)).toBe(true);
    expect(canSendFreeForm(now - 25 * 3600_000, now)).toBe(false);
    expect(canSendFreeForm(undefined, now)).toBe(false);
  });

  it('WhatsApp: parsea texto, botón, ubicación e imagen', () => {
    const wa = new WhatsAppCloudAdapter({ phoneNumberId: 'P', appSecret: secret });
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: '593990000000', id: 'w1', timestamp: '1700000000', type: 'text', text: { body: 'hola' } },
                  { from: '593990000000', id: 'w2', timestamp: '1700000001', type: 'interactive', interactive: { button_reply: { id: 'si', title: 'Sí' } } },
                  { from: '593990000000', id: 'w3', timestamp: '1700000002', type: 'location', location: { latitude: -2.1, longitude: -79.9 } },
                  { from: '593990000000', id: 'w4', timestamp: '1700000003', type: 'image', image: { id: 'img1', caption: 'esta' } },
                  { from: '593990000000', id: 'w5', timestamp: '1700000004', type: 'sticker' },
                ],
              },
            },
          ],
        },
      ],
    };
    const msgs = wa.parseWebhook(req(body));
    expect(msgs).toHaveLength(4);
    expect(msgs[0]).toMatchObject({ channel: 'whatsapp', userId: '593990000000', text: 'hola', messageId: 'w1' });
    expect(msgs[1]).toMatchObject({ buttonId: 'si' });
    expect(msgs[2].location).toEqual({ lat: -2.1, lng: -79.9 });
    expect(msgs[3].mediaUrl).toBe('whatsapp-media:img1');
  });

  it('WhatsApp: payloads y ventana de 24 h al enviar', async () => {
    const transport = new RecordingTransport();
    let last: number | undefined = Date.now() - 1000;
    const wa = new WhatsAppCloudAdapter({ phoneNumberId: 'P', transport, lastUserAt: async () => last });
    await wa.send('593', { text: '¿Te ayudo?', buttons: [{ id: 'a', title: 'Sí, por favor ayúdame ya' }, { id: 'b', title: 'No' }] });
    expect(transport.sent[0].path).toBe('P/messages');
    const p = transport.sent[0].payload as { type: string; interactive: { action: { buttons: { reply: { title: string } }[] } } };
    expect(p.type).toBe('interactive');
    expect(p.interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20);
    last = Date.now() - 30 * 3600_000;
    await expect(wa.send('593', { text: 'hola' })).rejects.toThrow(/24 h/);
    await wa.send('593', { template: { name: 'recordatorio', vars: ['Ana'] } });
    expect((transport.sent.at(-1)!.payload as { type: string }).type).toBe('template');
  });

  it('Instagram: parsea mensajes e ignora ecos', () => {
    const ig = new InstagramAdapter({ igUserId: 'IG' });
    const body = {
      entry: [
        {
          messaging: [
            { sender: { id: 'u1' }, timestamp: 1, message: { mid: 'm1', text: 'hola' } },
            { sender: { id: 'page' }, timestamp: 2, message: { mid: 'm2', text: 'eco', is_echo: true } },
            { sender: { id: 'u1' }, timestamp: 3, message: { mid: 'm3', quick_reply: { payload: 'p1' }, text: 'Sí' } },
          ],
        },
      ],
    };
    const msgs = ig.parseWebhook(req(body));
    expect(msgs).toHaveLength(2);
    expect(msgs[1].buttonId).toBe('p1');
  });

  it('Instagram: payload de texto y ubicación como link', async () => {
    const transport = new RecordingTransport();
    const ig = new InstagramAdapter({ igUserId: 'IG', transport, lastUserAt: async () => Date.now() });
    await ig.send('u1', { location: { lat: 1, lng: 2, name: 'Tienda' } });
    expect(JSON.stringify(transport.sent[0].payload)).toContain('maps?q=1,2');
  });
});

describe('Periskope, simulador y web', () => {
  it('Periskope parsea y no envía por defecto', async () => {
    const p = new PeriskopeAdapter({ webhookSecret: 's' });
    expect(p.verifyWebhook(req({}, { 'x-periskope-secret': 's' }))).toBe(true);
    expect(p.parseWebhook(req({ event: 'message.created', data: { chat_id: 'c', body: 'hola', message_id: 'm' } }))[0]).toMatchObject({ userId: 'c', text: 'hola' });
    expect(p.parseWebhook(req({ event: 'message.created', data: { chat_id: 'c', body: 'yo', from_me: true } }))).toEqual([]);
    await p.send('c', { text: 'hola' });
    expect(p.sent).toHaveLength(1);
  });

  it('simulador y web', async () => {
    const s = new SimulatorAdapter();
    expect(s.parseWebhook(req({ userId: 'x', text: 'hola' }))[0]).toMatchObject({ userId: 'x', channel: 'simulator' });
    expect(s.parseWebhook(req({}))).toEqual([]);
    const w = new WebChatAdapter();
    expect(w.parseWebhook(req({ userId: 'abc', text: 'hola' }))[0].userId).toBe('web:abc');
    expect(chatPage('bot<x>', 'Mi "bot"')).toContain('Mi &quot;bot&quot;');
  });
});

describe('P-2 / P-3', () => {
  it('Telegram: botón de compartir ubicación y tipo de adjunto', async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (_u: string, init: { body: string }) => {
      calls.push({ body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: {} }));
    }) as unknown as typeof fetch;
    await new TelegramAdapter({ token: 'T', fetchImpl }).send('1', { text: '¿En qué ciudad estás?', requestLocation: true });
    expect(JSON.stringify(calls[0].body.reply_markup)).toContain('request_location');
    const voice = parseTelegramUpdate({ update_id: 9, message: { message_id: 1, chat: { id: 5 }, date: 1, voice: { file_id: 'v1' } } })[0];
    expect(voice.media).toEqual({ type: 'audio', id: 'v1' });
  });
  it('WhatsApp: pedido de ubicación y lista', () => {
    const wa = new WhatsAppCloudAdapter({ phoneNumberId: 'P' });
    expect(wa.buildPayloads('5', { text: '¿Dónde estás?', requestLocation: true })[0]).toMatchObject({ interactive: { type: 'location_request_message' } });
    const list = wa.buildPayloads('5', { text: 'Elige', list: { title: 'Ciudades', rows: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, title: `Ciudad ${i}` })) } })[0] as { interactive: { action: { sections: { rows: unknown[] }[] } } };
    expect(list.interactive.action.sections[0].rows).toHaveLength(10);
  });
});

describe('Evolution API (esqueleto)', () => {
  it('parsea texto y ubicación; ignora propios y grupos; no envía por defecto', async () => {
    const { EvolutionAdapter } = await import('../src/channels/evolution.js');
    const ev = new EvolutionAdapter({ webhookSecret: 's', instance: 'i' });
    expect(ev.verifyWebhook({ headers: {}, query: { secret: 's' }, body: {} })).toBe(true);
    const body = (data: unknown) => ({ headers: {}, query: {}, body: { event: 'messages.upsert', data } });
    expect(ev.parseWebhook(body({ key: { remoteJid: '593990000000@s.whatsapp.net', id: 'e1' }, message: { conversation: 'hola' }, messageTimestamp: 1 }))[0]).toMatchObject({ userId: '593990000000', text: 'hola', messageId: 'e1' });
    expect(ev.parseWebhook(body({ key: { remoteJid: '5@s.whatsapp.net', id: 'e2' }, message: { locationMessage: { degreesLatitude: -2, degreesLongitude: -79 } } }))[0].location).toEqual({ lat: -2, lng: -79 });
    expect(ev.parseWebhook(body({ key: { remoteJid: '5@s.whatsapp.net', fromMe: true, id: 'e3' }, message: { conversation: 'yo' } }))).toEqual([]);
    expect(ev.parseWebhook(body({ key: { remoteJid: '123@g.us', id: 'e4' }, message: { conversation: 'grupo' } }))).toEqual([]);
    await ev.send('5', { text: 'hola', location: { lat: 1, lng: 2 } });
    expect(ev.sent.map((x) => x.path)).toEqual(['/message/sendLocation/i', '/message/sendText/i']);
  });
});

describe('Telegram long polling (API simulada)', () => {
  it('borra webhook, procesa updates en orden y avanza el offset', async () => {
    const calls: { method: string; body: Record<string, unknown> }[] = [];
    let polls = 0;
    let adapter: TelegramAdapter;
    const fetchImpl = (async (url: string, init: { body: string }) => {
      const method = url.split('/').pop()!;
      const body = JSON.parse(init.body);
      calls.push({ method, body });
      if (method === 'getUpdates') {
        polls++;
        if (polls === 1) return new Response(JSON.stringify({ ok: true, result: [
          { update_id: 10, message: { message_id: 1, chat: { id: 7 }, date: 1, text: 'hola' } },
          { update_id: 11, callback_query: { id: 'cb', from: { id: 7 }, data: 'si' } },
        ] }));
        adapter.stop();
        return new Response(JSON.stringify({ ok: true, result: [] }));
      }
      return new Response(JSON.stringify({ ok: true, result: true }));
    }) as unknown as typeof fetch;
    adapter = new TelegramAdapter({ token: 'T', fetchImpl });
    const got: string[] = [];
    await adapter.startPolling(async (m) => {
      got.push(m.text ?? '');
    }, { timeoutSec: 0 });
    expect(calls[0].method).toBe('deleteWebhook');
    expect(got).toEqual(['hola', 'si']);
    expect(calls.filter((c) => c.method === 'getUpdates')[1].body.offset).toBe(12);
    expect(calls.some((c) => c.method === 'answerCallbackQuery')).toBe(true);
  });
});
