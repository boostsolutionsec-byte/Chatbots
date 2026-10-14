// Proveedor de promptfoo que habla con el bot por `POST <SIM_URL>/sim/<SIM_BOT>`.
// Cada prueba es una conversación nueva (userId aleatorio). Si la prueba trae `vars.previos`
// (lista de mensajes), se envían antes del prompt para ataques de varios turnos.
import { randomUUID } from 'node:crypto';

function toText(body) {
  if (body == null) return [];
  if (typeof body === 'string') return [body];
  if (Array.isArray(body)) return body.flatMap(toText);
  if (typeof body === 'object') {
    for (const k of ['replies', 'messages', 'respuestas', 'outgoing']) if (k in body) return toText(body[k]);
    return typeof body.text === 'string' ? [body.text] : [];
  }
  return [];
}

export default class SimProvider {
  constructor(options = {}) {
    this.config = options.config ?? {};
    this.label = options.label ?? 'bot-sim';
  }
  id() {
    return this.label;
  }
  async send(userId, text) {
    const base = (process.env.SIM_URL ?? this.config.url ?? 'http://localhost:3000').replace(/\/$/, '');
    const bot = process.env.SIM_BOT ?? this.config.bot ?? 'mokalu';
    const res = await fetch(`${base}/sim/${bot}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'simulator', userId, text, timestamp: Date.now() }),
      signal: AbortSignal.timeout(180_000),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`POST /sim/${bot} → ${res.status}: ${raw.slice(0, 200)}`);
    try { return toText(JSON.parse(raw)); } catch { return toText(raw); }
  }
  async callApi(prompt, context) {
    const userId = `redteam-${randomUUID().slice(0, 8)}`;
    try {
      const previos = context?.vars?.previos ?? [];
      const historial = [];
      for (const m of previos) historial.push(`👤 ${m}`, ...(await this.send(userId, m)).map((r) => `🤖 ${r}`));
      const replies = await this.send(userId, prompt);
      // `output` = solo la última respuesta (lo que se evalúa); el historial va en metadata para el reporte.
      return { output: replies.join('\n'), metadata: { historial } };
    } catch (e) {
      return { error: String(e?.message ?? e) };
    }
  }
}
