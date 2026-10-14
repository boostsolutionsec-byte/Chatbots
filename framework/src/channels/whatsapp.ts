import type { ChannelAdapter, IncomingMessage, OutgoingMessage, WebhookRequest } from '../types.js';
import { DisabledTransport, needsTemplate, verifyMetaSignature, type MetaTransport } from './meta.js';

/**
 * ESQUELETO — WhatsApp Cloud API (Meta). No se conecta todavía.
 * - parseWebhook: mensajes de texto, botones (interactive.button_reply / list_reply), ubicación, imagen, audio.
 * - verifyWebhook: firma X-Hub-Signature-256 con WHATSAPP_APP_SECRET.
 * - send: arma el payload (texto, botones ≤3, imagen, ubicación, plantilla) y respeta la ventana de 24 h.
 *   El envío real depende del transporte (por defecto DisabledTransport → no llama a la red).
 */
export class WhatsAppCloudAdapter implements ChannelAdapter {
  name = 'whatsapp';
  constructor(
    private opts: {
      phoneNumberId: string;
      appSecret?: string;
      transport?: MetaTransport;
      /** Último mensaje del cliente (para la ventana de 24 h). */
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
    const body = req.body as WaWebhook;
    const out: IncomingMessage[] = [];
    for (const entry of body?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          const base = { channel: 'whatsapp' as const, userId: m.from, messageId: m.id, timestamp: Number(m.timestamp) * 1000, raw: m };
          switch (m.type) {
            case 'text':
              out.push({ ...base, text: m.text?.body });
              break;
            case 'interactive': {
              const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
              if (r) out.push({ ...base, buttonId: r.id, text: r.title });
              break;
            }
            case 'button':
              out.push({ ...base, buttonId: m.button?.payload, text: m.button?.text });
              break;
            case 'location':
              if (m.location) out.push({ ...base, location: { lat: m.location.latitude, lng: m.location.longitude }, text: m.location.name });
              break;
            case 'image':
            case 'audio':
            case 'video':
            case 'document':
              out.push({ ...base, mediaUrl: `whatsapp-media:${m[m.type]?.id ?? ''}`, text: m[m.type]?.caption });
              break;
            default:
              break;
          }
        }
      }
    }
    return out;
  }

  /** Construye los payloads de la Cloud API para un mensaje saliente (sin enviarlos). */
  buildPayloads(to: string, msg: OutgoingMessage): Record<string, unknown>[] {
    const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
    const out: Record<string, unknown>[] = [];
    if (msg.template) {
      out.push({
        ...base,
        type: 'template',
        template: {
          name: msg.template.name,
          language: { code: 'es' },
          components: msg.template.vars.length ? [{ type: 'body', parameters: msg.template.vars.map((v) => ({ type: 'text', text: v })) }] : [],
        },
      });
      return out;
    }
    if (msg.location) {
      out.push({ ...base, type: 'location', location: { latitude: msg.location.lat, longitude: msg.location.lng, name: msg.location.name, address: msg.location.address } });
    }
    if (msg.mediaUrl) out.push({ ...base, type: 'image', image: { link: msg.mediaUrl, caption: msg.text?.slice(0, 1024) } });
    else if (msg.buttons?.length && msg.text) {
      out.push({
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: msg.text.slice(0, 1024) },
          action: { buttons: msg.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) },
        },
      });
    } else if (msg.text) out.push({ ...base, type: 'text', text: { body: msg.text.slice(0, 4096), preview_url: false } });
    return out;
  }

  async send(userId: string, msg: OutgoingMessage): Promise<void> {
    const now = this.opts.now?.() ?? Date.now();
    const lastUserAt = await this.opts.lastUserAt?.(userId);
    if (needsTemplate(msg, lastUserAt, now)) {
      throw new Error('Fuera de la ventana de 24 h de WhatsApp: solo se puede enviar una plantilla aprobada');
    }
    for (const p of this.buildPayloads(userId, msg)) await this.transport.post(`${this.opts.phoneNumberId}/messages`, p);
  }
}

interface WaWebhook {
  entry?: {
    changes?: {
      value?: {
        messages?: WaMessage[];
      };
    }[];
  }[];
}
interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { payload: string; text: string };
  location?: { latitude: number; longitude: number; name?: string };
  image?: WaMedia;
  audio?: WaMedia;
  video?: WaMedia;
  document?: WaMedia;
}
interface WaMedia {
  id?: string;
  caption?: string;
}
