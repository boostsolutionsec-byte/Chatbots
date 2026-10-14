import type { ChannelAdapter, IncomingMessage, OutgoingMessage, WebhookRequest } from '../types.js';

/**
 * ESQUELETO — Periskope (WhatsApp gestionado por un tercero). No se conecta todavía.
 * ⚠️ El formato exacto del webhook y del endpoint de envío NO está verificado contra la documentación oficial
 * de Periskope (sin acceso a internet completo esta noche). Se modela un evento genérico
 * `{ event: "message.created", data: { chat_id, message_id, body, from_me, timestamp } }` y un envío
 * `POST <PERISKOPE_API_URL>/message/send { chat_id, message }`. Ajustar cuando se conecte (anotado en PENDIENTES.md).
 */
export class PeriskopeAdapter implements ChannelAdapter {
  name = 'periskope';
  sent: { chat_id: string; message: string }[] = [];

  constructor(private opts: { apiUrl?: string; apiKey?: string; webhookSecret?: string; enableSend?: boolean; fetchImpl?: typeof fetch } = {}) {}

  verifyWebhook(req: WebhookRequest): boolean {
    if (!this.opts.webhookSecret) return false;
    return req.headers['x-periskope-secret'] === this.opts.webhookSecret;
  }

  parseWebhook(req: WebhookRequest): IncomingMessage[] {
    const b = req.body as { event?: string; data?: { chat_id?: string; message_id?: string; body?: string; from_me?: boolean; timestamp?: number } };
    if (b?.event !== 'message.created' || !b.data?.chat_id || b.data.from_me || !b.data.body) return [];
    return [{ channel: 'periskope', userId: b.data.chat_id, text: b.data.body, messageId: b.data.message_id, timestamp: b.data.timestamp ?? Date.now(), raw: b }];
  }

  async send(userId: string, msg: OutgoingMessage): Promise<void> {
    const text = [msg.text, msg.location ? `📍 https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}` : undefined].filter(Boolean).join('\n');
    if (!text) return;
    this.sent.push({ chat_id: userId, message: text });
    if (!this.opts.enableSend || !this.opts.apiUrl || !this.opts.apiKey) return; // deshabilitado por defecto
    const res = await (this.opts.fetchImpl ?? fetch)(`${this.opts.apiUrl}/message/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.opts.apiKey}` },
      body: JSON.stringify({ chat_id: userId, message: text }),
    });
    if (!res.ok) throw new Error(`Periskope ${res.status}`);
  }
}
