import type { ChannelAdapter, IncomingMessage, OutgoingMessage, WebhookRequest } from '../types.js';

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: { id: string; from: { id: number }; data?: string; message?: TgMessage };
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type?: string };
  from?: { id: number; first_name?: string; username?: string };
  date: number;
  text?: string;
  caption?: string;
  location?: { latitude: number; longitude: number };
  photo?: { file_id: string }[];
  voice?: { file_id: string };
}

export interface TelegramOptions {
  token: string;
  /** Secreto que Telegram manda en X-Telegram-Bot-Api-Secret-Token (modo webhook). */
  webhookSecret?: string;
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

/** Escapa HTML y convierte *negrita* (estilo WhatsApp) a <b>. */
export function toTelegramHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
}

/**
 * Telegram Bot API (token de @BotFather). Dos modos:
 *  - long polling (`startPolling`): no necesita dominio público, ideal para probar desde cualquier PC/servidor;
 *  - webhook (`POST /webhook/telegram/:botId`): para producción, con secreto.
 */
export class TelegramAdapter implements ChannelAdapter {
  name = 'telegram';
  private fetchImpl: typeof fetch;
  private base: string;
  private stopped = false;

  constructor(private opts: TelegramOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.base = `${opts.apiBase ?? 'https://api.telegram.org'}/bot${opts.token}`;
  }

  verifyWebhook(req: WebhookRequest): boolean {
    if (!this.opts.webhookSecret) return true;
    return req.headers['x-telegram-bot-api-secret-token'] === this.opts.webhookSecret;
  }

  parseWebhook(req: WebhookRequest): IncomingMessage[] {
    return parseTelegramUpdate(req.body as TgUpdate);
  }

  async call<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
    return json.result as T;
  }

  async send(userId: string, msg: OutgoingMessage): Promise<void> {
    const chat_id = userId;
    const reply_markup = msg.buttons?.length
      ? { inline_keyboard: msg.buttons.map((b) => [{ text: b.title.slice(0, 60), callback_data: b.id.slice(0, 64) }]) }
      : undefined;
    if (msg.location) {
      await this.call('sendVenue', {
        chat_id,
        latitude: msg.location.lat,
        longitude: msg.location.lng,
        title: msg.location.name ?? 'Ubicación',
        address: msg.location.address ?? '',
      });
    }
    if (msg.mediaUrl) {
      await this.call('sendPhoto', { chat_id, photo: msg.mediaUrl, caption: msg.text ? toTelegramHtml(msg.text).slice(0, 1000) : undefined, parse_mode: 'HTML', reply_markup });
      return;
    }
    if (msg.text) {
      for (const chunk of splitText(msg.text, 4000)) {
        await this.call('sendMessage', { chat_id, text: toTelegramHtml(chunk), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup });
      }
    }
  }

  async typing(userId: string): Promise<void> {
    await this.call('sendChatAction', { chat_id: userId, action: 'typing' }).catch(() => {});
  }

  async answerCallback(id: string): Promise<void> {
    await this.call('answerCallbackQuery', { callback_query_id: id }).catch(() => {});
  }

  async setWebhook(url: string): Promise<void> {
    await this.call('setWebhook', { url, secret_token: this.opts.webhookSecret, allowed_updates: ['message', 'callback_query'] });
  }

  /** Long polling. `onMessage` procesa cada mensaje (ya parseado). */
  async startPolling(onMessage: (m: IncomingMessage) => Promise<void>, opts: { timeoutSec?: number; onError?: (e: unknown) => void } = {}): Promise<void> {
    await this.call('deleteWebhook', { drop_pending_updates: false });
    let offset = 0;
    this.stopped = false;
    while (!this.stopped) {
      try {
        const updates = await this.call<TgUpdate[]>('getUpdates', { offset, timeout: opts.timeoutSec ?? 30, allowed_updates: ['message', 'callback_query'] });
        for (const u of updates) {
          offset = u.update_id + 1;
          if (u.callback_query) await this.answerCallback(u.callback_query.id);
          for (const m of parseTelegramUpdate(u)) await onMessage(m);
        }
      } catch (e) {
        (opts.onError ?? console.error)(e);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  stop() {
    this.stopped = true;
  }
}

export function parseTelegramUpdate(u: TgUpdate): IncomingMessage[] {
  if (!u) return [];
  if (u.callback_query) {
    const cq = u.callback_query;
    const chatId = cq.message?.chat.id ?? cq.from.id;
    return [{ channel: 'telegram', userId: String(chatId), buttonId: cq.data, text: cq.data, messageId: `cb_${cq.id}`, timestamp: Date.now(), raw: u }];
  }
  const m = u.message ?? u.edited_message;
  if (!m) return [];
  const text = m.text ?? m.caption;
  const location = m.location ? { lat: m.location.latitude, lng: m.location.longitude } : undefined;
  const mediaUrl = m.photo?.length ? `telegram-file:${m.photo[m.photo.length - 1].file_id}` : m.voice ? `telegram-file:${m.voice.file_id}` : undefined;
  if (!text && !location && !mediaUrl) return [];
  return [
    {
      channel: 'telegram',
      userId: String(m.chat.id),
      text,
      location,
      mediaUrl,
      messageId: `${m.chat.id}_${m.message_id}`,
      timestamp: m.date * 1000,
      raw: u,
    },
  ];
}

export function splitText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}
