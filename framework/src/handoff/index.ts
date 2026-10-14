import type { Destino } from '../config/schema.js';
import type { Conversation, Handoff } from '../types.js';

export interface HandoffEvent {
  handoff: Handoff;
  destino: Destino;
  conversation: Conversation;
  /** Últimos mensajes en texto plano para que el humano tenga contexto. */
  transcript: string;
}

export interface HandoffNotifier {
  name: string;
  notify(e: HandoffEvent): Promise<void>;
}

/** Registra en consola (siempre activo; útil en desarrollo). */
export class ConsoleNotifier implements HandoffNotifier {
  name = 'console';
  constructor(private log: (s: string) => void = (s) => console.log(s)) {}
  async notify(e: HandoffEvent) {
    this.log(`[derivación] bot=${e.handoff.botId} usuario=${e.handoff.userId} → ${e.destino.id} (${e.handoff.prioridad}) motivo: ${e.handoff.motivo}`);
  }
}

/** POST JSON a un webhook (n8n, Make, Zapier…). Variable: HANDOFF_WEBHOOK_URL. */
export class WebhookNotifier implements HandoffNotifier {
  name = 'webhook';
  constructor(private url: string, private fetchImpl: typeof fetch = fetch, private secret?: string) {}
  async notify(e: HandoffEvent) {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.secret ? { 'x-handoff-secret': this.secret } : {}) },
      body: JSON.stringify({
        tipo: 'derivacion',
        ...e.handoff,
        destino: { id: e.destino.id, tipo: e.destino.tipo, descripcion: e.destino.descripcion, valor: e.destino.valor },
        campos: e.conversation.fields,
        canal: e.conversation.channel,
        transcript: e.transcript,
      }),
    });
    if (!res.ok) throw new Error(`webhook de derivación respondió ${res.status}`);
  }
}

/**
 * Avisa por Telegram a un chat de asesores (TELEGRAM_ADMIN_CHAT_ID) usando el mismo bot.
 * El asesor responde y reactiva el bot con POST /admin/:botId/:userId/resume (o /reactivar en el chat de admin).
 */
export class TelegramAdminNotifier implements HandoffNotifier {
  name = 'telegram-admin';
  constructor(private token: string, private chatId: string, private fetchImpl: typeof fetch = fetch) {}
  async notify(e: HandoffEvent) {
    const text =
      `🔔 Derivación ${e.handoff.prioridad === 'alta' ? '⚠️ PRIORIDAD ALTA' : ''}\n` +
      `Bot: ${e.handoff.botId} · Canal: ${e.conversation.channel ?? '?'} · Usuario: ${e.handoff.userId}\n` +
      `Destino: ${e.destino.descripcion ?? e.destino.id}\nMotivo: ${e.handoff.motivo}\n\n${e.transcript.slice(-3000)}\n\n` +
      `Para reactivar el bot: /reactivar ${e.handoff.botId} ${e.handoff.userId}`;
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text }),
    });
    if (!res.ok) throw new Error(`Telegram admin respondió ${res.status}`);
  }
}

/** Envía a todos; un fallo no impide los demás (se registra). */
export class CompositeNotifier implements HandoffNotifier {
  name = 'composite';
  constructor(public notifiers: HandoffNotifier[], private onError: (e: unknown, n: string) => void = (e, n) => console.error(`[derivación] ${n} falló:`, e)) {}
  async notify(e: HandoffEvent) {
    await Promise.all(
      this.notifiers.map(async (n) => {
        try {
          await n.notify(e);
        } catch (err) {
          this.onError(err, n.name);
        }
      }),
    );
  }
}

/** Notificador según variables de entorno. Nunca envía WhatsApp real (Meta no se conecta todavía). */
export function createNotifier(env: NodeJS.ProcessEnv = process.env): HandoffNotifier {
  const list: HandoffNotifier[] = [new ConsoleNotifier()];
  if (env.HANDOFF_WEBHOOK_URL) list.push(new WebhookNotifier(env.HANDOFF_WEBHOOK_URL, fetch, env.HANDOFF_WEBHOOK_SECRET));
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID) list.push(new TelegramAdminNotifier(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_ADMIN_CHAT_ID));
  return new CompositeNotifier(list);
}

export function transcriptOf(c: Conversation, last = 12): string {
  return c.messages
    .slice(-last)
    .map((m) => `${m.role === 'user' ? 'Cliente' : m.role === 'assistant' ? 'Bot' : 'Sistema'}: ${m.text}`)
    .join('\n');
}
