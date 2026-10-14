import { newConversation, type Conversation, type Handoff, type Order, type Store } from '../types.js';

/**
 * Persistencia en Supabase (Postgres) vía PostgREST con `fetch` (sin SDK).
 * Tablas: ver framework/supabase/migrations/0001_init.sql. Usa la service role key SOLO en el servidor.
 * - conversations: una fila por (bot_id, user_id) con el estado completo en `data` (jsonb).
 * - messages: historial append-only (para análisis / bandeja humana).
 * - leads (pedidos/interesados) y handoffs (derivaciones).
 */
export class SupabaseStore implements Store {
  /** Por conversación: mensajes ya guardados y cuántos quedaron fuera del estado (recortados). */
  private counts = new Map<string, { saved: number; offset: number }>();
  private fetchImpl: typeof fetch;

  constructor(
    private url: string,
    private key: string,
    opts: { fetchImpl?: typeof fetch; maxMessagesInState?: number } = {},
  ) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxMessages = opts.maxMessagesInState ?? 60;
  }
  private maxMessages: number;

  private async req(path: string, init: RequestInit & { prefer?: string } = {}): Promise<unknown> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        authorization: `Bearer ${this.key}`,
        'content-type': 'application/json',
        ...(init.prefer ? { prefer: init.prefer } : {}),
      },
    });
    if (!res.ok) throw new Error(`Supabase ${init.method ?? 'GET'} ${path.split('?')[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async getConversation(botId: string, userId: string): Promise<Conversation> {
    const rows = (await this.req(`conversations?bot_id=eq.${encodeURIComponent(botId)}&user_id=eq.${encodeURIComponent(userId)}&select=data,message_count`)) as
      | { data: Conversation; message_count: number }[]
      | null;
    const row = rows?.[0];
    this.counts.set(`${botId}::${userId}`, { saved: row?.message_count ?? 0, offset: (row?.message_count ?? 0) - (row?.data?.messages?.length ?? 0) });
    if (!row) return newConversation(botId, userId);
    return { ...newConversation(botId, userId), ...row.data };
  }

  async saveConversation(c: Conversation): Promise<void> {
    const k = `${c.botId}::${c.userId}`;
    const { saved, offset } = this.counts.get(k) ?? { saved: 0, offset: 0 };
    const total = offset + c.messages.length;
    const fresh = c.messages.slice(Math.max(0, saved - offset));
    if (fresh.length) {
      await this.req('messages', {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify(
          fresh.map((m) => ({ bot_id: c.botId, user_id: c.userId, role: m.role, text: m.text, channel: m.channel ?? c.channel, tool_calls: m.toolCalls ?? null, created_at: new Date(m.at).toISOString() })),
        ),
      });
    }
    const data = { ...c, messages: c.messages.slice(-this.maxMessages), updatedAt: Date.now() };
    await this.req('conversations?on_conflict=bot_id,user_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({ bot_id: c.botId, user_id: c.userId, channel: c.channel ?? null, paused: !!c.paused, fields: c.fields, data, message_count: Math.max(total, saved), updated_at: new Date().toISOString() }),
    });
    const kept = Math.min(c.messages.length, this.maxMessages);
    this.counts.set(k, { saved: Math.max(total, saved), offset: total - kept });
  }

  async saveOrder(o: Order): Promise<void> {
    await this.req('leads', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ id: o.id, bot_id: o.botId, user_id: o.userId, data: o.data, created_at: new Date(o.createdAt).toISOString() }) });
  }

  async saveHandoff(h: Handoff): Promise<void> {
    await this.req('handoffs', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({ id: h.id, bot_id: h.botId, user_id: h.userId, destino: h.destino, motivo: h.motivo, prioridad: h.prioridad ?? 'normal', resumen: h.resumen ?? null, created_at: new Date(h.createdAt).toISOString() }),
    });
  }

  async listConversations(botId: string): Promise<Conversation[]> {
    const rows = (await this.req(`conversations?bot_id=eq.${encodeURIComponent(botId)}&select=data&order=updated_at.desc&limit=200`)) as { data: Conversation }[];
    return rows.map((r) => r.data);
  }
}
