import { newConversation, type Conversation, type Handoff, type Order, type Store } from '../types.js';

/** Persistencia en memoria (pruebas, simulador, desarrollo). Se pierde al reiniciar. */
export class MemoryStore implements Store {
  conversations = new Map<string, Conversation>();
  orders: Order[] = [];
  handoffs: Handoff[] = [];

  private key(botId: string, userId: string) {
    return `${botId}::${userId}`;
  }

  async getConversation(botId: string, userId: string): Promise<Conversation> {
    const c = this.conversations.get(this.key(botId, userId));
    return c ? structuredClone(c) : newConversation(botId, userId);
  }

  async saveConversation(c: Conversation): Promise<void> {
    this.conversations.set(this.key(c.botId, c.userId), structuredClone({ ...c, updatedAt: Date.now() }));
  }

  async saveOrder(o: Order): Promise<void> {
    this.orders.push(structuredClone(o));
  }

  async saveHandoff(h: Handoff): Promise<void> {
    this.handoffs.push(structuredClone(h));
  }

  async listConversations(botId: string): Promise<Conversation[]> {
    return [...this.conversations.values()].filter((c) => c.botId === botId).map((c) => structuredClone(c));
  }

  async deleteConversation(botId: string, userId: string): Promise<void> {
    this.conversations.delete(this.key(botId, userId));
  }
}
