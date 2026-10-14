import type { ChannelAdapter, IncomingMessage, OutgoingMessage, WebhookRequest } from '../types.js';

/**
 * ESQUELETO — Evolution API (WhatsApp no oficial, autoalojado; integra con n8n). No se conecta todavía. G-14.
 * Webhook `messages.upsert` (v2): { event, instance, data: { key: { remoteJid, fromMe, id }, message: {...}, messageTimestamp } }.
 * Envío: POST <EVOLUTION_API_URL>/message/sendText/<instancia> { number, text } con header `apikey`.
 * ⚠️ Formato tomado de la documentación pública de Evolution API v2 sin poder probarlo esta noche: verificar al conectar.
 * Envío apagado por defecto (EVOLUTION_ENABLE_SEND=true para activarlo). Ojo: WhatsApp no oficial puede bloquear el número.
 */
export class EvolutionAdapter implements ChannelAdapter {
  name = 'evolution';
  sent: { path: string; body: unknown }[] = [];

  constructor(private opts: { apiUrl?: string; apiKey?: string; instance?: string; webhookSecret?: string; enableSend?: boolean; fetchImpl?: typeof fetch } = {}) {}

  verifyWebhook(req: WebhookRequest): boolean {
    if (!this.opts.webhookSecret) return false;
    return req.headers['apikey'] === this.opts.webhookSecret || req.query['secret'] === this.opts.webhookSecret;
  }

  parseWebhook(req: WebhookRequest): IncomingMessage[] {
    const b = req.body as EvoWebhook;
    if (!b || !/messages[._]upsert/i.test(b.event ?? '')) return [];
    const items = Array.isArray(b.data) ? b.data : b.data ? [b.data] : [];
    const out: IncomingMessage[] = [];
    for (const d of items) {
      if (!d.key?.remoteJid || d.key.fromMe || d.key.remoteJid.endsWith('@g.us')) continue; // ignora propios y grupos
      const m = d.message ?? {};
      const text = m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? m.buttonsResponseMessage?.selectedDisplayText ?? m.listResponseMessage?.title;
      const loc = m.locationMessage;
      const media = m.audioMessage ? { type: 'audio' as const } : m.imageMessage ? { type: 'image' as const } : undefined;
      if (!text && !loc && !media) continue;
      out.push({
        channel: 'whatsapp',
        userId: d.key.remoteJid.split('@')[0],
        text,
        location: loc ? { lat: loc.degreesLatitude, lng: loc.degreesLongitude } : undefined,
        media,
        mediaUrl: media ? `evolution-media:${d.key.id}` : undefined,
        buttonId: m.buttonsResponseMessage?.selectedButtonId ?? m.listResponseMessage?.singleSelectReply?.selectedRowId,
        messageId: d.key.id,
        timestamp: d.messageTimestamp ? Number(d.messageTimestamp) * 1000 : Date.now(),
        raw: d,
      });
    }
    return out;
  }

  async send(userId: string, msg: OutgoingMessage): Promise<void> {
    const inst = encodeURIComponent(this.opts.instance ?? '');
    if (msg.location) {
      await this.post(`/message/sendLocation/${inst}`, { number: userId, name: msg.location.name ?? '', address: msg.location.address ?? '', latitude: msg.location.lat, longitude: msg.location.lng });
    }
    if (msg.mediaUrl) await this.post(`/message/sendMedia/${inst}`, { number: userId, mediatype: 'image', media: msg.mediaUrl, caption: msg.text ?? '' });
    else if (msg.text) await this.post(`/message/sendText/${inst}`, { number: userId, text: msg.text });
  }

  private async post(path: string, body: unknown): Promise<void> {
    this.sent.push({ path, body });
    if (!this.opts.enableSend || !this.opts.apiUrl || !this.opts.apiKey) return; // apagado por defecto
    const res = await (this.opts.fetchImpl ?? fetch)(`${this.opts.apiUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: this.opts.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Evolution ${res.status}`);
  }
}

interface EvoWebhook {
  event?: string;
  instance?: string;
  data?: EvoMessage | EvoMessage[];
}
interface EvoMessage {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  messageTimestamp?: number | string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    audioMessage?: unknown;
    locationMessage?: { degreesLatitude: number; degreesLongitude: number };
    buttonsResponseMessage?: { selectedButtonId?: string; selectedDisplayText?: string };
    listResponseMessage?: { title?: string; singleSelectReply?: { selectedRowId?: string } };
  };
}
