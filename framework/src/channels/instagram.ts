import type { ChannelAdapter, IncomingMessage, OutgoingMessage, WebhookRequest } from '../types.js';
import { DisabledTransport, needsTemplate, verifyMetaSignature, type MetaTransport } from './meta.js';

/**
 * ESQUELETO — Instagram Messaging API (Meta). No se conecta todavía.
 * Formato de webhook "messaging" (entry[].messaging[]): texto, quick replies, adjuntos (imagen, ubicación).
 * Instagram también tiene ventana de 24 h (fuera de ella solo con la etiqueta HUMAN_AGENT hasta 7 días).
 */
export class InstagramAdapter implements ChannelAdapter {
  name = 'instagram';
  constructor(
    private opts: {
      igUserId: string;
      appSecret?: string;
      transport?: MetaTransport;
      lastUserAt?: (userId: string) => Promise<number | undefined>;
      now?: () => number;
    },
  ) {}

  get transport(): MetaTransport {
    return (this.opts.transport ??= new DisabledTransport());
  }

  verifyWebhook(req: WebhookRequest): boolean {
    return verifyMetaSignature(req, this.opts.appSecret);
  }

  parseWebhook(req: WebhookRequest): IncomingMessage[] {
    const body = req.body as IgWebhook;
    const out: IncomingMessage[] = [];
    for (const entry of body?.entry ?? []) {
      for (const ev of entry.messaging ?? []) {
        const m = ev.message;
        if (!m || m.is_echo) continue; // ignora los mensajes que enviamos nosotros
        const base = { channel: 'instagram' as const, userId: ev.sender.id, messageId: m.mid, timestamp: ev.timestamp, raw: ev };
        const loc = m.attachments?.find((a) => a.type === 'location')?.payload?.coordinates;
        const img = m.attachments?.find((a) => a.type === 'image' || a.type === 'audio' || a.type === 'video');
        out.push({
          ...base,
          text: m.text,
          buttonId: m.quick_reply?.payload,
          location: loc ? { lat: loc.lat, lng: loc.long } : undefined,
          mediaUrl: img?.payload?.url,
        });
      }
    }
    return out.filter((m) => m.text || m.location || m.mediaUrl || m.buttonId);
  }

  buildPayloads(to: string, msg: OutgoingMessage): Record<string, unknown>[] {
    const recipient = { id: to };
    const out: Record<string, unknown>[] = [];
    if (msg.mediaUrl) out.push({ recipient, message: { attachment: { type: 'image', payload: { url: msg.mediaUrl } } } });
    let text = msg.text;
    if (msg.location) {
      const pin = `📍 https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`;
      text = text ? text : `${msg.location.name ?? ''}\n${pin}`.trim();
    }
    if (text) {
      out.push({
        recipient,
        message: {
          text: text.slice(0, 1000),
          quick_replies: msg.buttons?.length ? msg.buttons.slice(0, 13).map((b) => ({ content_type: 'text', title: b.title.slice(0, 20), payload: b.id })) : undefined,
        },
      });
    }
    return out;
  }

  async send(userId: string, msg: OutgoingMessage): Promise<void> {
    const now = this.opts.now?.() ?? Date.now();
    if (needsTemplate({ ...msg, template: undefined }, await this.opts.lastUserAt?.(userId), now)) {
      throw new Error('Fuera de la ventana de 24 h de Instagram: no se puede enviar sin etiqueta HUMAN_AGENT');
    }
    for (const p of this.buildPayloads(userId, msg)) await this.transport.post(`${this.opts.igUserId}/messages`, p);
  }
}

interface IgWebhook {
  entry?: {
    messaging?: {
      sender: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        quick_reply?: { payload: string };
        attachments?: { type: string; payload?: { url?: string; coordinates?: { lat: number; long: number } } }[];
      };
    }[];
  }[];
}
