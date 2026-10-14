import type { Persona, Turno } from './types.js';
import type { SimLLM } from './llm.js';

export const FIN = '[FIN]';

export interface Customer {
  /** Siguientes mensajes del cliente (1..n; varios = mensaje partido). `[FIN]` = terminó. */
  next(transcript: Turno[], turnoIdx: number): Promise<string[]>;
}

/** Cliente sin IA: envía el guion tal cual y termina. Barato y determinista. */
export class ScriptedCustomer implements Customer {
  constructor(private p: Persona) {}
  async next(_t: Turno[], i: number): Promise<string[]> {
    return i < this.p.guion.length ? [this.p.guion[i]] : [FIN];
  }
}

export function customerSystemPrompt(p: Persona): string {
  const u = p.ubicacion;
  return [
    'Eres un CLIENTE SIMULADO que escribe por chat (WhatsApp/Telegram) a una marca de útiles de arte en Ecuador.',
    'Tu único trabajo es actuar como esta persona. NUNCA digas que eres una IA ni un cliente simulado.',
    '',
    `Persona: ${p.nombre} (${p.tipo}).`,
    `Vives en: ${u.sector ? u.sector + ', ' : ''}${u.ciudad}, provincia de ${u.provincia}.`,
    `Forma de escribir: ${p.estilo}.`,
    `Situación y objetivo: ${p.contexto}`,
    `Mensajes con los que empiezas (úsalos como guía, en este orden): ${p.guion.map((g) => JSON.stringify(g)).join(' · ')}`,
    '',
    'Reglas:',
    '- Escribe SOLO el/los siguiente(s) mensaje(s) del cliente, sin comillas ni explicaciones.',
    '- Mensajes cortos como en un chat real. Si tu estilo es partir mensajes, separa cada mensaje en una línea distinta (máx. 3).',
    '- Responde a lo que el bot te pregunte de forma coherente con tu persona. No reveles datos que no te pidan.',
    '- Mantente en tu objetivo; no inventes preguntas nuevas que no salgan de tu situación.',
    '- Habla con el bot en segunda persona ("¿y tú me...?"); nunca narres ("el bot me pasó...").',
    p.comparte_ubicacion ? '- Cuando te pidan la ubicación o la ciudad, escribe exactamente [UBICACION] (el sistema mandará tu ubicación GPS).' : '',
    `- Cuando ya obtuviste lo que buscabas, te despediste, o el bot te pasó con una persona, escribe exactamente ${FIN}.`,
    `- Si el bot da vueltas sin ayudarte después de varios intentos, escribe ${FIN}.`,
  ].filter(Boolean).join('\n');
}

/** Cliente con IA: un LLM hace de la persona. */
export class LLMCustomer implements Customer {
  constructor(private p: Persona, private llm: SimLLM) {}
  async next(transcript: Turno[], i: number): Promise<string[]> {
    if (i === 0) return [this.p.guion[0]]; // primer mensaje siempre del guion: ahorra una llamada y fija la intención
    const conv = transcript.map((t) => `${t.rol === 'cliente' ? 'TÚ' : 'BOT'}: ${t.texto}`).join('\n');
    const out = await this.llm.complete(customerSystemPrompt(this.p), `Conversación hasta ahora:\n${conv}\n\nEscribe tu siguiente mensaje:`, { model: 'rapido' });
    const lines = out.split('\n').map((l) => l.replace(/^(TÚ|TU|CLIENTE)\s*:\s*/i, '').trim()).filter(Boolean);
    const ended = lines.length === 0 || lines.some((l) => l.includes(FIN));
    const msgs = lines.map((l) => l.replace(FIN, '').trim()).filter(Boolean).slice(0, 3);
    return ended ? [...msgs, FIN] : msgs;
  }
}
