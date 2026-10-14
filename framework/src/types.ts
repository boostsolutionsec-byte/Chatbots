// Interfaces del contrato (docs/CONTRATO.md §3). Cualquier cambio aquí debe anotarse en "Cambios" del contrato.

export type ChannelName = 'web' | 'telegram' | 'whatsapp' | 'instagram' | 'simulator' | 'periskope';

export interface IncomingMessage {
  channel: ChannelName;
  userId: string;
  text?: string;
  mediaUrl?: string;
  location?: { lat: number; lng: number };
  /** Id del mensaje en el canal, para idempotencia. */
  messageId?: string;
  /** Id de botón pulsado (callback de Telegram, reply de WhatsApp). */
  buttonId?: string;
  timestamp: number;
  raw?: unknown;
}

export interface OutgoingMessage {
  text?: string;
  buttons?: { id: string; title: string }[];
  mediaUrl?: string;
  template?: { name: string; vars: string[] };
  /** Ubicación a enviar (pin de tienda). */
  location?: { lat: number; lng: number; name?: string; address?: string };
}

export interface ChannelAdapter {
  name: string;
  parseWebhook(req: WebhookRequest): IncomingMessage[];
  send(userId: string, msg: OutgoingMessage): Promise<void>;
  verifyWebhook?(req: WebhookRequest): boolean;
}

/** Petición HTTP mínima e independiente del framework web. */
export interface WebhookRequest {
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: unknown;
  rawBody?: string;
}

export interface Tienda {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
  direccion: string;
  lat?: number;
  lng?: number;
  maps_url?: string;
  whatsapp?: string;
  telefono?: string;
  horario?: string;
  marcas: string[];
  vende_online?: boolean;
  web?: string;
  [extra: string]: unknown;
}

export type MotivoTienda = 'misma_ciudad' | 'misma_provincia' | 'mas_cercana';

export interface LocatorQuery {
  text?: string;
  lat?: number;
  lng?: number;
  producto?: string;
}

export interface LocatorResult {
  tienda: Tienda;
  distanciaKm?: number;
  motivo: MotivoTienda;
}

export interface StoreLocator {
  find(q: LocatorQuery): Promise<LocatorResult[]>;
}

export interface Producto {
  sku: string;
  marca: string;
  linea: string;
  nombre: string;
  punta?: string;
  superficies?: string;
  descripcion?: string;
  imagen_url?: string;
  precio_ref?: string;
  [extra: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema de los argumentos. */
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface ToolCall {
  id?: string;
  name: string;
  input: Record<string, unknown>;
}

export type ChatRole = 'user' | 'assistant';

/** Mensaje de la conversación que ve el LLM. `tool` lleva resultados de herramientas. */
export interface LLMMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: { id?: string; name: string; content: string }[];
}

export interface LLMCompleteArgs {
  system: string;
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  model: string;
  maxTokens?: number;
  /** Parte estable del sistema (conocimiento) para prompt caching. */
  cacheableSystemPrefix?: string;
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCall[];
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface LLMProvider {
  name: string;
  complete(args: LLMCompleteArgs): Promise<LLMResponse>;
}

export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: number;
  toolCalls?: ToolCall[];
  channel?: ChannelName;
}

export interface Conversation {
  botId: string;
  userId: string;
  channel?: ChannelName;
  messages: StoredMessage[];
  /** Campos recolectados por flujo (registrar_campo). */
  fields: Record<string, string>;
  /** Flujo activo (clave de `flujos`). */
  activeFlow?: string;
  /** Bot en pausa porque un humano tomó la conversación. */
  paused?: boolean;
  pausedReason?: string;
  /** Turnos del bot seguidos sin avance (sin campo nuevo ni acción). */
  turnsWithoutProgress: number;
  lead?: Record<string, unknown>;
  lastUserAt?: number;
  lastBotAt?: number;
  followupsSent: string[];
  seenMessageIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Order {
  id: string;
  botId: string;
  userId: string;
  data: Record<string, unknown>;
  createdAt: number;
}

export interface Handoff {
  id: string;
  botId: string;
  userId: string;
  destino: string;
  motivo: string;
  prioridad?: 'normal' | 'alta';
  resumen?: string;
  createdAt: number;
}

export interface Store {
  getConversation(botId: string, userId: string): Promise<Conversation>;
  saveConversation(c: Conversation): Promise<void>;
  saveOrder(o: Order): Promise<void>;
  saveHandoff(h: Handoff): Promise<void>;
  listConversations?(botId: string): Promise<Conversation[]>;
}

export function newConversation(botId: string, userId: string, now = Date.now()): Conversation {
  return {
    botId,
    userId,
    messages: [],
    fields: {},
    turnsWithoutProgress: 0,
    followupsSent: [],
    seenMessageIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
