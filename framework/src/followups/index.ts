import type { LoadedBot } from '../config/loader.js';
import { listBots, botsDir } from '../config/loader.js';
import type { Engine } from '../engine/engine.js';
import { missingFields } from '../engine/tools.js';
import { localTime, parseDuration } from '../engine/time.js';
import type { ChannelAdapter, Conversation, OutgoingMessage } from '../types.js';
import { WINDOW_24H_MS } from '../channels/meta.js';

export interface DueFollowup {
  key: string; // identifica la regla (para no repetir)
  message: OutgoingMessage;
}

/**
 * Condiciones soportadas en `seguimiento[].si` (texto libre, se busca la intención):
 *  - "pedido incompleto" / "flujo incompleto" / "sin tienda": faltan campos requeridos o no se mostró tienda/lead.
 *  - "sin respuesta": el último mensaje fue del bot y el cliente no contestó.
 *  - "" (vacío) o "siempre": siempre.
 * Cualquier otro texto se trata como "pedido incompleto" (opción prudente).
 * `mensaje: "plantilla:<nombre>"` → plantilla de WhatsApp (requerida fuera de 24 h); en otros canales se usa
 * el campo opcional `texto` de la regla, o se omite.
 */
export function dueFollowups(bot: LoadedBot, conv: Conversation, now = Date.now()): DueFollowup[] {
  if (conv.paused || conv.lastUserAt === undefined) return [];
  // P-8: máximo un seguimiento sin respuesta; si el cliente no contestó al anterior, no se insiste.
  if (conv.lastFollowupAt !== undefined && conv.lastFollowupAt > conv.lastUserAt) return [];
  // P-8: solo entre 08h00 y 20h00 hora local del bot.
  const zona = bot.config.horario_humano?.zona ?? 'America/Guayaquil';
  const local = localTime(zona, new Date(now));
  if (local.minutes < 8 * 60 || local.minutes >= 20 * 60) return [];
  const out: DueFollowup[] = [];
  bot.config.seguimiento.forEach((rule, i) => {
    const key = `seg${i}:${rule.despues_de}`;
    if (conv.followupsSent.includes(key)) return;
    const elapsed = now - conv.lastUserAt!;
    const wait = parseDuration(rule.despues_de);
    if (elapsed < wait) return;
    // No insistir días después: si ya pasó el doble del tiempo, se descarta.
    if (elapsed > wait * 2 + 3_600_000) return;
    const cond = rule.si.toLowerCase();
    let applies: boolean;
    if (!cond || cond.includes('siempre')) applies = true;
    else if (cond.includes('sin respuesta')) applies = (conv.lastBotAt ?? 0) >= conv.lastUserAt!;
    else {
      const flow = conv.activeFlow ?? Object.keys(bot.config.flujos)[0];
      const incompleto = missingFields(bot, conv, flow).length > 0;
      const sinResultado = !conv.lead && !conv.messages.some((m) => m.toolCalls?.some((c) => c.name === 'buscar_tienda'));
      applies = incompleto || sinResultado;
    }
    if (!applies) return;
    const isTemplate = rule.mensaje.startsWith('plantilla:');
    let message: OutgoingMessage | undefined;
    if (conv.channel === 'whatsapp') {
      if (isTemplate) message = { template: { name: rule.mensaje.slice('plantilla:'.length).trim(), vars: [] } };
      else if (elapsed < WINDOW_24H_MS) message = { text: rule.mensaje };
    } else {
      const texto = (rule as { texto?: string }).texto;
      if (!isTemplate) message = { text: rule.mensaje };
      else if (texto) message = { text: texto };
    }
    if (message) out.push({ key, message });
  });
  return out.slice(0, 1);
}

/** Revisa periódicamente las conversaciones y envía seguimientos. Requiere un Store con listConversations. */
export function startFollowups(
  engine: Engine,
  adapters: (channel: string, botId: string) => ChannelAdapter | undefined,
  bots: string[] = listBots(botsDir()),
  intervalMs = Number(process.env.FOLLOWUPS_INTERVAL_MS ?? 5 * 60_000),
): () => void {
  const tick = async () => {
    for (const botId of bots) {
      const rt = engine.runtime(botId);
      const convs = (await engine.store.listConversations?.(botId)) ?? [];
      for (const c of convs) {
        for (const f of dueFollowups(rt.bot, c, Date.now())) {
          const adapter = c.channel ? adapters(c.channel, botId) : undefined;
          if (!adapter) continue;
          try {
            await adapter.send(c.userId, f.message);
            const fresh = await engine.store.getConversation(botId, c.userId);
            fresh.followupsSent.push(f.key);
            fresh.lastFollowupAt = Date.now();
            fresh.messages.push({ role: 'assistant', text: f.message.text ?? `[plantilla ${f.message.template?.name}]`, at: Date.now() });
            fresh.lastBotAt = Date.now();
            await engine.store.saveConversation(fresh);
          } catch (e) {
            console.error(`[seguimiento] ${botId}/${c.userId}: ${(e as Error).message}`);
          }
        }
      }
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(timer);
}
