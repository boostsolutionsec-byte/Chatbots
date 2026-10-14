import type { LoadedBot } from '../config/loader.js';
import type { Destino } from '../config/schema.js';
import type { HandoffNotifier } from '../handoff/index.js';
import { transcriptOf } from '../handoff/index.js';
import type { Locator, LocateResult } from '../locator/locator.js';
import { STOPWORDS, normalize, tokens } from '../locator/normalize.js';
import type { Conversation, OutgoingMessage, Producto, Store, Tienda, ToolDefinition } from '../types.js';
import { isOpen, localTime } from './time.js';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'buscar_tienda',
    description:
      'Busca las tiendas/puntos de venta más cercanos. ÚNICA fuente válida de nombres, direcciones, teléfonos y links de tiendas. ' +
      'Úsala apenas sepas la ciudad, sector, provincia o ubicación compartida del cliente.',
    input_schema: {
      type: 'object',
      properties: {
        ubicacion: { type: 'string', description: 'Lo que dijo el cliente sobre dónde está (ciudad, sector, provincia), tal cual.' },
        lat: { type: 'number', description: 'Latitud si el cliente compartió su ubicación.' },
        lng: { type: 'number', description: 'Longitud si el cliente compartió su ubicación.' },
        producto: { type: 'string', description: 'Marca o producto que busca (opcional, para filtrar tiendas).' },
      },
    },
  },
  {
    name: 'buscar_producto',
    description: 'Busca en el catálogo del bot. ÚNICA fuente válida de productos, modelos y características.',
    input_schema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Qué busca o para qué lo quiere (ej. "marcador para tela", "posca punta fina").' },
      },
      required: ['consulta'],
    },
  },
  {
    name: 'registrar_campo',
    description: 'Guarda un dato que dio el cliente y que el flujo necesita (ver <estado>).',
    input_schema: {
      type: 'object',
      properties: { campo: { type: 'string' }, valor: { type: 'string' } },
      required: ['campo', 'valor'],
    },
  },
  {
    name: 'guardar_lead',
    description: 'Guarda al cliente interesado con los datos recolectados (al completar un flujo o si deja sus datos).',
    input_schema: {
      type: 'object',
      properties: { nota: { type: 'string', description: 'Resumen breve del interés del cliente.' } },
    },
  },
  {
    name: 'derivar',
    description: 'Pasa la conversación a un humano u otro destino según las reglas de derivación. Úsala solo si una regla aplica.',
    input_schema: {
      type: 'object',
      properties: {
        destino: { type: 'string', description: 'id del destino (ver reglas de derivación).' },
        motivo: { type: 'string', description: 'Qué regla aplica y por qué.' },
        prioridad: { type: 'string', enum: ['normal', 'alta'] },
        resumen: { type: 'string', description: 'Resumen para el humano.' },
      },
      required: ['motivo'],
    },
  },
  {
    name: 'consultar_horario',
    description: 'Dice si el equipo humano está atendiendo ahora y su horario.',
    input_schema: { type: 'object', properties: {} },
  },
];

export interface ToolContext {
  bot: LoadedBot;
  locator: Locator;
  conversation: Conversation;
  store: Store;
  notifier: HandoffNotifier;
  /** Mensajes extra para el canal (pin de ubicación, foto de producto). */
  extras: OutgoingMessage[];
  /** Acciones realizadas en este turno (para medir avance y para las evals). */
  actions: string[];
  /** Tiendas mostradas en este turno (para evals: tienda_en). */
  tiendasMostradas: Tienda[];
  pauseOnHandoff: boolean;
  now: () => Date;
}

export type ToolResult = Record<string, unknown> & { sugerencia?: string; error?: string };

export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  switch (name) {
    case 'buscar_tienda':
      return buscarTienda(input, ctx);
    case 'buscar_producto':
      return buscarProducto(input, ctx);
    case 'registrar_campo':
      return registrarCampo(input, ctx);
    case 'guardar_lead':
      return guardarLead(input, ctx);
    case 'derivar':
      return derivar(input, ctx);
    case 'consultar_horario':
      return consultarHorario(ctx);
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

// ───────────────────────── buscar_tienda

export function formatTienda(t: Tienda, distanciaKm?: number): string {
  const lines = [`📍 *${t.nombre}*`];
  const dir = [t.direccion, t.ciudad].filter(Boolean).join(', ');
  if (dir) lines.push(dir);
  if (t.maps_url) lines.push(`🗺️ ${t.maps_url}`);
  if (t.whatsapp) lines.push(`📲 WhatsApp: ${t.whatsapp}`);
  else if (t.telefono) lines.push(`📞 ${t.telefono}`);
  if (t.horario) lines.push(`🕒 ${t.horario}`);
  if (distanciaKm !== undefined && distanciaKm >= 3) lines.push(`(a unos ${Math.round(distanciaKm)} km)`);
  return lines.join('\n');
}

function publicTienda(t: Tienda) {
  return {
    id: t.id,
    nombre: t.nombre,
    direccion: t.direccion,
    ciudad: t.ciudad,
    provincia: t.provincia,
    maps_url: t.maps_url,
    whatsapp: t.whatsapp,
    telefono: t.telefono,
    horario: t.horario,
    marcas: t.marcas,
    vende_online: t.vende_online,
    web: t.web,
  };
}

async function buscarTienda(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const lat = typeof input.lat === 'number' ? input.lat : undefined;
  const lng = typeof input.lng === 'number' ? input.lng : undefined;
  const text = typeof input.ubicacion === 'string' ? input.ubicacion : undefined;
  const producto = typeof input.producto === 'string' ? input.producto : undefined;
  if (!text && (lat === undefined || lng === undefined)) {
    return { error: 'Falta la ubicación: pide la ciudad o sector, o que comparta su ubicación.' };
  }
  const r: LocateResult = ctx.locator.locate({ text, lat, lng, producto });
  if (r.lugar) {
    // Si algún flujo pide "ubicacion", queda registrada.
    ctx.conversation.fields.ubicacion = r.lugar.matched === 'ubicacion_compartida' ? `${r.lugar.city} (GPS)` : (r.lugar.city || r.lugar.name);
  }
  if (r.resultados.length) {
    ctx.actions.push('buscar_tienda');
    ctx.tiendasMostradas.push(...r.resultados.map((x) => x.tienda));
    const first = r.resultados[0].tienda;
    if (first.lat !== undefined && first.lng !== undefined) {
      ctx.extras.push({ location: { lat: first.lat, lng: first.lng, name: first.nombre, address: first.direccion } });
    }
  } else if (r.derivar) {
    ctx.actions.push('buscar_tienda_sin_resultado');
  }

  const lejos = r.resultados[0]?.motivo !== 'misma_ciudad';
  const online = lejos ? r.online.slice(0, 2).map(publicTienda) : [];
  let sugerencia: string | undefined;
  if (r.resultados.length) {
    const intro =
      r.resultados[0].motivo === 'misma_ciudad'
        ? `¡Genial! En ${r.lugar?.city || r.lugar?.name} puedes encontrarnos aquí 👇`
        : r.lugar?.kind === 'provincia'
          ? `En ${r.lugar.province} te queda así 👇`
          : `En ${r.lugar?.city || r.lugar?.name} todavía no tenemos punto de venta 😕 Lo más cercano es:`;
    const body = r.resultados.map((x) => formatTienda(x.tienda, x.distanciaKm)).join('\n\n');
    const onl = online.length ? `\n\nTambién puedes comprar en línea: ${online.map((o) => o.web ?? o.nombre).join(' · ')}` : '';
    sugerencia = `${intro}\n\n${body}${onl}`;
  } else if (r.derivar) {
    sugerencia = undefined;
  } else if (!r.lugar) {
    sugerencia = '¿En qué ciudad o sector estás? Así te digo la tienda más cercana 📍';
  }
  return {
    lugar_entendido: r.lugar ? { nombre: r.lugar.name, ciudad: r.lugar.city, provincia: r.lugar.province, tipo: r.lugar.kind } : null,
    tiendas: r.resultados.map((x) => ({ ...publicTienda(x.tienda), distancia_km: x.distanciaKm, motivo: x.motivo })),
    compra_online: online,
    aviso: r.aviso,
    derivar_a: r.derivar,
    sugerencia,
  };
}

// ───────────────────────── buscar_producto

export function searchCatalog(catalogo: Producto[], consulta: string, max = 3): Producto[] {
  const q = tokens(consulta).filter((t) => t.length > 1 && !STOPWORDS.has(t) || /^(tela|vidrio|madera|papel|zapatos|zapatillas|taza|tazas|piedra|piedras|lienzo|pared)$/.test(t));
  if (!q.length) return [];
  const scored = catalogo.map((p) => {
    const hay = normalize([p.sku, p.marca, p.linea, p.nombre, p.punta, p.superficies, p.descripcion].filter(Boolean).join(' '));
    const hayTokens = new Set(hay.split(' '));
    let score = 0;
    for (const t of q) {
      if (hayTokens.has(t)) score += 2;
      else if (t.length >= 4 && hay.includes(t.slice(0, Math.max(4, t.length - 2)))) score += 1; // zapatillas ~ zapatos
    }
    if (normalize(p.sku) && normalize(consulta).includes(normalize(p.sku))) score += 5;
    return { p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.p);
}

async function buscarProducto(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const consulta = String(input.consulta ?? '');
  if (!ctx.bot.catalogo.length) return { productos: [], aviso: 'Este bot no tiene catálogo cargado; usa solo el conocimiento.' };
  const found = searchCatalog(ctx.bot.catalogo, consulta);
  ctx.actions.push('buscar_producto');
  if (!found.length) {
    return { productos: [], aviso: 'No hay productos que coincidan. No inventes modelos; pregunta para qué lo quiere o di que no lo manejamos.' };
  }
  const img = found.find((p) => p.imagen_url && /^https?:\/\//.test(p.imagen_url) && !p.imagen_url.includes('.invalid'));
  if (img) ctx.extras.push({ mediaUrl: img.imagen_url, text: img.nombre });
  const lines = found.map((p) => `• *${p.nombre}*${p.punta ? ` — punta ${p.punta}` : ''}${p.superficies ? ` · ${p.superficies}` : ''}`);
  const pending = !ctx.conversation.fields.ubicacion;
  return {
    productos: found.map(({ sku, marca, linea, nombre, punta, superficies, descripcion }) => ({ sku, marca, linea, nombre, punta, superficies, descripcion })),
    sugerencia: `Te recomiendo:\n${lines.join('\n')}${pending ? '\n\n¿En qué ciudad estás? Te digo dónde conseguirlo 📍' : ''}`,
  };
}

// ───────────────────────── registrar_campo / guardar_lead

function flowFields(bot: LoadedBot) {
  return Object.entries(bot.config.flujos);
}

export function missingFields(bot: LoadedBot, conv: Conversation, flowId?: string) {
  const flows = flowId ? flowFields(bot).filter(([id]) => id === flowId) : flowFields(bot);
  const out: { flujo: string; campo: string; pregunta?: string }[] = [];
  for (const [id, f] of flows) for (const c of f.campos) if (c.requerido && !conv.fields[c.id]) out.push({ flujo: id, campo: c.id, pregunta: c.pregunta });
  return out;
}

async function registrarCampo(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const campo = String(input.campo ?? '').trim();
  const valor = String(input.valor ?? '').trim();
  if (!campo || !valor) return { error: 'campo y valor son obligatorios' };
  const flows = flowFields(ctx.bot).filter(([, f]) => f.campos.some((c) => c.id === campo));
  ctx.conversation.fields[campo] = valor;
  ctx.actions.push(`registrar_campo:${campo}`);
  if (flows.length && !ctx.conversation.activeFlow) ctx.conversation.activeFlow = flows[0][0];
  const flowId = ctx.conversation.activeFlow;
  const faltan = flowId ? missingFields(ctx.bot, ctx.conversation, flowId) : [];
  const result: ToolResult = { ok: true, campos: ctx.conversation.fields, faltan };
  if (flowId && !faltan.length) {
    const flujo = ctx.bot.config.flujos[flowId];
    result.flujo_completo = flowId;
    for (const action of flujo?.al_completar ?? []) {
      if (action === 'buscar_tienda' && ctx.conversation.fields.ubicacion && !ctx.actions.includes('buscar_tienda')) {
        result.buscar_tienda = await buscarTienda({ ubicacion: ctx.conversation.fields.ubicacion, producto: ctx.conversation.fields.producto_interes }, ctx);
        result.sugerencia = (result.buscar_tienda as ToolResult).sugerencia;
      } else if (action === 'guardar_lead' && !ctx.actions.includes('guardar_lead')) {
        await guardarLead({}, ctx);
      }
    }
  } else if (faltan[0]?.pregunta) {
    result.sugerencia = faltan[0].pregunta;
  }
  return result;
}

async function guardarLead(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const c = ctx.conversation;
  const data = { ...c.fields, nota: input.nota, canal: c.channel };
  c.lead = data;
  await ctx.store.saveOrder({ id: `lead_${c.botId}_${c.userId}_${Date.now()}`, botId: c.botId, userId: c.userId, data, createdAt: Date.now() });
  ctx.actions.push('guardar_lead');
  return { ok: true, guardado: data };
}

// ───────────────────────── derivar

export function pickDestino(bot: LoadedBot, destinoId: string | undefined, motivo: string): { destino?: Destino; prioridad: 'normal' | 'alta' } {
  const destinos = bot.config.destinos;
  if (destinoId) {
    const d = destinos.find((x) => x.id === destinoId);
    const regla = bot.config.reglas_derivacion.find((r) => r.ir_a === destinoId);
    if (d) return { destino: d, prioridad: regla?.prioridad ?? 'normal' };
  }
  // Busca la regla cuyo texto se parezca más al motivo.
  const m = new Set(tokens(motivo).filter((t) => t.length > 3 && !STOPWORDS.has(t)));
  let best: { score: number; ir_a: string; prioridad: 'normal' | 'alta' } | undefined;
  for (const r of bot.config.reglas_derivacion) {
    const words = tokens(`${r.si} ${(r.palabras ?? []).join(' ')}`);
    const score = words.filter((w) => m.has(w)).length;
    if (!best || score > best.score) best = { score, ir_a: r.ir_a, prioridad: r.prioridad };
  }
  const d = best ? destinos.find((x) => x.id === best!.ir_a) : undefined;
  return { destino: d ?? destinos.find((x) => x.tipo === 'humano') ?? destinos[0], prioridad: best?.prioridad ?? 'normal' };
}

async function derivar(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const motivo = String(input.motivo ?? 'sin motivo');
  const { destino, prioridad: p0 } = pickDestino(ctx.bot, typeof input.destino === 'string' ? input.destino : undefined, motivo);
  const prioridad = input.prioridad === 'alta' ? 'alta' : p0;
  if (!destino) return { error: 'No hay destinos configurados en bot.yaml; no prometas que alguien escribirá. Pide disculpas y da la información que tengas.' };
  const c = ctx.conversation;
  const handoff = {
    id: `h_${c.botId}_${c.userId}_${Date.now()}`,
    botId: c.botId,
    userId: c.userId,
    destino: destino.id,
    motivo,
    prioridad,
    resumen: typeof input.resumen === 'string' ? input.resumen : undefined,
    createdAt: Date.now(),
  } as const;
  await ctx.store.saveHandoff({ ...handoff });
  ctx.actions.push(`derivar:${destino.id}`);

  const abierto = isOpen(ctx.bot.config.horario_humano, ctx.now());
  const h = ctx.bot.config.horario_humano;
  const horarioTxt = h ? `${h.dias.join(', ')} de ${h.desde} a ${h.hasta}` : undefined;

  if (destino.tipo === 'link') {
    const link = destino.valor || '(link no configurado)';
    return { ok: true, destino: destino.id, tipo: 'link', link, sugerencia: `Aquí puedes continuar: ${link}` };
  }
  if (destino.tipo === 'humano' || destino.tipo === 'webhook') {
    await ctx.notifier.notify({ handoff: { ...handoff }, destino, conversation: c, transcript: transcriptOf(c) });
    if (ctx.pauseOnHandoff) {
      c.paused = true;
      c.pausedReason = `derivado a ${destino.id}: ${motivo}`;
    }
  }
  const quien = destino.descripcion ?? 'un asesor';
  const cuando = abierto === false && horarioTxt ? ` Nuestro equipo atiende ${horarioTxt}; te escribirán apenas estén disponibles.` : ' En breve te escriben por aquí.';
  return {
    ok: true,
    destino: destino.id,
    tipo: destino.tipo,
    prioridad,
    equipo_disponible_ahora: abierto,
    horario: horarioTxt,
    bot_pausado: !!c.paused,
    sugerencia: `Te comunico con ${quien.charAt(0).toLowerCase()}${quien.slice(1)} 🙌${cuando}`,
  };
}

// ───────────────────────── consultar_horario

function consultarHorario(ctx: ToolContext): ToolResult {
  const h = ctx.bot.config.horario_humano;
  if (!h) return { aviso: 'El bot no tiene horario_humano configurado.' };
  const t = localTime(h.zona, ctx.now());
  const abierto = isOpen(h, ctx.now());
  return {
    zona: h.zona,
    ahora: t.label,
    dias: h.dias,
    desde: h.desde,
    hasta: h.hasta,
    abierto,
    nota: 'Este es el horario del equipo humano del bot; el de cada tienda viene en buscar_tienda.',
    sugerencia: `Nuestro equipo atiende ${h.dias.join(', ')} de ${h.desde} a ${h.hasta}. ${abierto ? 'Ahora mismo estamos atendiendo 🙂' : 'Ahora estamos fuera de horario, pero te respondemos apenas abramos.'}`,
  };
}
