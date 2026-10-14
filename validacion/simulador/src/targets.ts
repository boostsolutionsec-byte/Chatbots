import type { Tienda } from './types.js';
import { haversineKm, norm } from './geo.js';

export interface BotInput { userId: string; text?: string; location?: { lat: number; lng: number } }

/** Lo que el simulador necesita del bot: mandar un mensaje y recibir 0..n mensajes de respuesta. */
export interface BotTarget {
  name: string;
  send(input: BotInput): Promise<string[]>;
}

/**
 * Normaliza la respuesta de `POST /sim/:botId`. El contrato no fija el cuerpo de respuesta,
 * así que aceptamos las formas razonables: string, string[], OutgoingMessage, OutgoingMessage[],
 * o un objeto con replies/messages/respuestas/outgoing/salida.
 */
export function normalizeReplies(body: unknown): string[] {
  if (body == null) return [];
  if (typeof body === 'string') return body.trim() ? [body] : [];
  if (Array.isArray(body)) return body.flatMap((b) => normalizeReplies(b));
  if (typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const k of ['replies', 'messages', 'respuestas', 'outgoing', 'salida', 'responses', 'reply', 'respuesta']) {
      if (k in o) return normalizeReplies(o[k]);
    }
    const parts: string[] = [];
    if (typeof o.text === 'string' && o.text.trim()) parts.push(o.text);
    if (Array.isArray(o.buttons) && o.buttons.length) {
      parts.push('[botones: ' + (o.buttons as { title?: string }[]).map((b) => b.title).join(' | ') + ']');
    }
    if (typeof o.mediaUrl === 'string') parts.push(`[media: ${o.mediaUrl}]`);
    return parts.length ? [parts.join('\n')] : [];
  }
  return [];
}

/** Bot real: servidor del framework (Agente 2) con `POST /sim/:botId`. */
export class HttpSimTarget implements BotTarget {
  name: string;
  constructor(private baseUrl: string, private botId: string, private timeoutMs = 180_000) {
    this.name = `http:${baseUrl}/sim/${botId}`;
  }
  async send(input: BotInput): Promise<string[]> {
    const body = {
      channel: 'simulator',
      userId: input.userId,
      text: input.text,
      location: input.location,
      timestamp: Date.now(),
    };
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/sim/${this.botId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`POST /sim/${this.botId} → ${res.status}: ${txt.slice(0, 300)}`);
    try { return normalizeReplies(JSON.parse(txt)); } catch { return normalizeReplies(txt); }
  }
}

// --- Bot de mentira (para probar el arnés mientras no existe el framework) ---

const MOCK_CIUDADES: Record<string, { lat: number; lng: number }> = {
  guayaquil: { lat: -2.1709, lng: -79.9224 }, guayaco: { lat: -2.1709, lng: -79.9224 }, urdesa: { lat: -2.17, lng: -79.91 },
  'mall del sol': { lat: -2.1548, lng: -79.8927 }, samborondon: { lat: -2.1333, lng: -79.8833 }, duran: { lat: -2.17, lng: -79.838 },
  quito: { lat: -0.1807, lng: -78.4678 }, capital: { lat: -0.1807, lng: -78.4678 }, cumbaya: { lat: -0.2025, lng: -78.43 },
  cuenca: { lat: -2.9001, lng: -79.0059 }, riobamba: { lat: -1.6636, lng: -78.6546 }, 'rio bamba': { lat: -1.6636, lng: -78.6546 },
  ambato: { lat: -1.2491, lng: -78.6168 }, loja: { lat: -3.9931, lng: -79.2042 }, manta: { lat: -0.9677, lng: -80.7089 },
  machala: { lat: -3.2581, lng: -79.9554 }, esmeraldas: { lat: 0.9682, lng: -79.6517 }, ibarra: { lat: 0.3517, lng: -78.1223 },
  'santo domingo': { lat: -0.253, lng: -79.1754 }, 'sto domingo': { lat: -0.253, lng: -79.1754 },
  portoviejo: { lat: -1.0546, lng: -80.4545 }, 'lago agrio': { lat: 0.0847, lng: -76.8828 },
  galapagos: { lat: -0.7432, lng: -90.3134 }, otavalo: { lat: 0.2341, lng: -78.2611 }, tena: { lat: -0.9938, lng: -77.8129 },
  macas: { lat: -2.3087, lng: -78.1114 }, zamora: { lat: -4.0692, lng: -78.9567 }, vilcabamba: { lat: -4.26, lng: -79.222 },
  montanita: { lat: -1.827, lng: -80.753 }, banos: { lat: -1.3964, lng: -78.4247 }, gualaceo: { lat: -2.892, lng: -78.777 },
  huaquillas: { lat: -3.4762, lng: -80.2308 }, guaranda: { lat: -1.5926, lng: -79.001 }, latacunga: { lat: -0.9352, lng: -78.6155 },
  salinas: { lat: -2.2145, lng: -80.952 },
};

/**
 * Bot de reglas, determinista y deliberadamente simple. NO es el bot de Mokalú:
 * solo sirve para comprobar que el arnés (cliente → bot → juez → reporte) funciona de punta a punta.
 */
export class MockBotTarget implements BotTarget {
  name = 'mock-reglas';
  private estado = new Map<string, { saludo: boolean }>();
  constructor(private tiendas: Tienda[]) {}

  async send(input: BotInput): Promise<string[]> {
    const st = this.estado.get(input.userId) ?? { saludo: false };
    this.estado.set(input.userId, st);
    const pre = st.saludo ? '' : '¡Hola! 😊 ';
    st.saludo = true;
    const t = norm(input.text ?? '');
    if (/(persona|humano|asesor|reclamo|secos?|cambi|distribuidor|cotiz|mayor|colegio|logo|factura|1000|300)/.test(t))
      return [`${pre}Te paso con un asesor de Mokalú para que te ayude con eso 🙌 Te escribe en horario de atención.`];
    if (/(ignora|prompt|system|whatsapp personal|lista de clientes|garantiza|descuento|tarea|votar|http)/.test(t))
      return [`${pre}Eso no lo puedo hacer 🙈 Te ayudo a encontrar dónde comprar uni-ball y POSCA. ¿En qué ciudad estás?`];
    if (/(cuanto|precio|dolar|cuesta)/.test(t))
      return [`${pre}Los precios varían según cada tienda, por eso no te puedo dar uno exacto. ¿En qué ciudad estás para decirte dónde preguntar?`];
    let pos = input.location;
    if (!pos) {
      const key = Object.keys(MOCK_CIUDADES).sort((a, b) => b.length - a.length).find((k) => t.includes(k));
      if (key) pos = MOCK_CIUDADES[key];
    }
    if (pos) {
      const best = [...this.tiendas].sort((a, b) => haversineKm(pos!, a) - haversineKm(pos!, b))[0];
      const d = haversineKm(pos, best);
      const aviso = d > 25 ? `No tenemos tienda en tu ciudad; la más cercana está en ${best.ciudad} (a unos ${Math.round(d)} km). ` : '';
      return [`${pre}${aviso}Puedes comprar en *${best.nombre}*, ${best.direccion}, ${best.ciudad}. WhatsApp: ${best.whatsapp} 📍 ${best.maps_url}`];
    }
    if (/(zapat|taza|ceramica|lettering|tela|tabla)/.test(t))
      return [`${pre}Para eso te va el POSCA PC-3M (punta fina) o PC-5M (media). En tela se fija con calor (plancha) y en cerámica con barniz. ¿En qué ciudad estás?`];
    return [`${pre}¿En qué ciudad o sector estás? Así te digo la tienda más cercana 📍`];
  }
}
