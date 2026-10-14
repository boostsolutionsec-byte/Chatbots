import type { IncomingMessage } from '../types.js';

/**
 * Agrupa los mensajes seguidos de un mismo cliente (la gente escribe en ráfagas: "hola" / "una consulta" / "en quito?")
 * y entrega uno solo después de `windowMs` sin mensajes nuevos (P-4). También descarta ids repetidos (reintentos del canal).
 */
export class Debouncer {
  private pending = new Map<string, { msgs: IncomingMessage[]; timer: ReturnType<typeof setTimeout> }>();
  private seen = new Set<string>();

  constructor(
    private windowMs: number,
    private handler: (merged: IncomingMessage) => Promise<void> | void,
    private maxSeen = 5000,
  ) {}

  push(key: string, msg: IncomingMessage): void {
    if (msg.messageId) {
      if (this.seen.has(msg.messageId)) return;
      this.seen.add(msg.messageId);
      if (this.seen.size > this.maxSeen) this.seen.delete(this.seen.values().next().value!);
    }
    if (this.windowMs <= 0) {
      void this.handler(msg);
      return;
    }
    const entry = this.pending.get(key);
    if (entry) clearTimeout(entry.timer);
    const msgs = [...(entry?.msgs ?? []), msg];
    const timer = setTimeout(() => {
      this.pending.delete(key);
      void this.handler(mergeMessages(msgs));
    }, this.windowMs);
    this.pending.set(key, { msgs, timer });
  }

  /** Entrega ya todo lo pendiente (al apagar el proceso). */
  async flush(): Promise<void> {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const e of all) {
      clearTimeout(e.timer);
      await this.handler(mergeMessages(e.msgs));
    }
  }
}

export function mergeMessages(msgs: IncomingMessage[]): IncomingMessage {
  if (msgs.length === 1) return msgs[0];
  const last = msgs[msgs.length - 1];
  return {
    ...last,
    text: msgs.map((m) => m.text).filter(Boolean).join('\n') || undefined,
    location: [...msgs].reverse().find((m) => m.location)?.location,
    mediaUrl: [...msgs].reverse().find((m) => m.mediaUrl)?.mediaUrl,
    buttonId: [...msgs].reverse().find((m) => m.buttonId)?.buttonId,
    messageId: msgs.map((m) => m.messageId).filter(Boolean).join('+') || undefined,
    timestamp: last.timestamp,
    raw: msgs.map((m) => m.raw),
  };
}
