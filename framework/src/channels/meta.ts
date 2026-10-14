import { createHmac, timingSafeEqual } from 'node:crypto';
import type { OutgoingMessage, WebhookRequest } from '../types.js';

// Utilidades comunes a WhatsApp Cloud API e Instagram Messaging (plataforma de Meta).
// ⚠️ Meta NO se conecta todavía: los adaptadores construyen los payloads, pero el envío real pasa por un
// `MetaTransport` que por defecto NO llama a la red (DisabledTransport). Ver framework/README.md.

/** Verifica X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(appSecret, cuerpo crudo). */
export function verifyMetaSignature(req: WebhookRequest, appSecret: string | undefined): boolean {
  if (!appSecret) return false;
  const header = req.headers['x-hub-signature-256'];
  if (!header || !header.startsWith('sha256=') || req.rawBody === undefined) return false;
  const expected = createHmac('sha256', appSecret).update(req.rawBody, 'utf8').digest('hex');
  const got = header.slice('sha256='.length);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
}

/** Handshake GET de Meta: devuelve hub.challenge si el token coincide, si no undefined. */
export function metaVerificationChallenge(query: Record<string, string | undefined>, verifyToken: string | undefined): string | undefined {
  if (!verifyToken) return undefined;
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === verifyToken) return query['hub.challenge'] ?? '';
  return undefined;
}

export interface MetaTransport {
  post(path: string, payload: unknown): Promise<unknown>;
}

/** Transporte por defecto: no envía nada (regla del repo: no llamar APIs de Meta todavía). */
export class DisabledTransport implements MetaTransport {
  sent: { path: string; payload: unknown }[] = [];
  async post(path: string, payload: unknown): Promise<unknown> {
    this.sent.push({ path, payload });
    throw new Error('Envío a Meta deshabilitado: falta conectar Meta (ver PASOS-HUMANOS.md, Fase 2)');
  }
}

/** Transporte que guarda los payloads (pruebas con mocks). */
export class RecordingTransport implements MetaTransport {
  sent: { path: string; payload: unknown }[] = [];
  async post(path: string, payload: unknown): Promise<unknown> {
    this.sent.push({ path, payload });
    return { ok: true };
  }
}

/**
 * Transporte real a la Graph API. NO se usa esta noche. Para activarlo mañana:
 * META_ENABLE_SEND=true + tokens (ver .env.example). Lo crea `createMetaTransport`.
 */
export class GraphApiTransport implements MetaTransport {
  /** `host`: graph.facebook.com (WhatsApp, Instagram vía página de Facebook) o graph.instagram.com (Instagram con inicio de sesión de Instagram, G-13). */
  constructor(private token: string, private version = 'v21.0', private fetchImpl: typeof fetch = fetch, private host = 'graph.facebook.com') {}
  async post(path: string, payload: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`https://${this.host}/${this.version}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Graph API ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    return json;
  }
}

export function createMetaTransport(token: string | undefined, env: NodeJS.ProcessEnv = process.env, host?: string): MetaTransport {
  if (env.META_ENABLE_SEND === 'true' && token) return new GraphApiTransport(token, env.META_GRAPH_VERSION || undefined, fetch, host || undefined);
  return new DisabledTransport();
}

export const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

/** Fuera de la ventana de 24 h desde el último mensaje del cliente solo se puede enviar una plantilla aprobada. */
export function canSendFreeForm(lastUserAt: number | undefined, now = Date.now()): boolean {
  return lastUserAt !== undefined && now - lastUserAt < WINDOW_24H_MS;
}

export function needsTemplate(msg: OutgoingMessage, lastUserAt: number | undefined, now = Date.now()): boolean {
  return !msg.template && !canSendFreeForm(lastUserAt, now);
}
