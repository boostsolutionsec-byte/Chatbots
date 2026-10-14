import type { ChannelAdapter, IncomingMessage, OutgoingMessage, WebhookRequest } from '../types.js';

export interface SimRequestBody {
  userId?: string;
  text?: string;
  location?: { lat: number; lng: number };
  buttonId?: string;
  messageId?: string;
  /** Canal que se quiere imitar (afecta solo al estado `canal` que ve el bot). */
  channel?: IncomingMessage['channel'];
}

/**
 * Canal para pruebas: lo usan `POST /sim/:botId`, el chat por terminal, las evals y el arnés del Agente 4.
 * Las respuestas no se envían a ningún lado: quedan en `outbox` (y el servidor las devuelve en la respuesta HTTP).
 */
export class SimulatorAdapter implements ChannelAdapter {
  name = 'simulator';
  outbox: { userId: string; msg: OutgoingMessage }[] = [];

  parseWebhook(req: WebhookRequest): IncomingMessage[] {
    const b = (req.body ?? {}) as SimRequestBody;
    if (!b.text && !b.location && !b.buttonId) return [];
    return [
      {
        channel: b.channel ?? 'simulator',
        userId: String(b.userId ?? 'sim-user'),
        text: b.text,
        location: b.location && Number.isFinite(b.location.lat) && Number.isFinite(b.location.lng) ? { lat: Number(b.location.lat), lng: Number(b.location.lng) } : undefined,
        buttonId: b.buttonId,
        messageId: b.messageId,
        timestamp: Date.now(),
        raw: b,
      },
    ];
  }

  async send(userId: string, msg: OutgoingMessage): Promise<void> {
    this.outbox.push({ userId, msg });
  }
}
