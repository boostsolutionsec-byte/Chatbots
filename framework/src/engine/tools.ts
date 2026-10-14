import type { LoadedBot } from '../config/loader.js';
import type { Destino, ReglaDerivacion } from '../config/schema.js';
import type { HandoffNotifier } from '../handoff/index.js';
import { transcriptOf } from '../handoff/index.js';
import type { Locator, LocateResult } from '../locator/locator.js';
import { STOPWORDS, normalize, tokens } from '../locator/normalize.js';
import type { Conversation, OutgoingMessage, Producto, Store, Tienda, ToolDefinition } from '../types.js';
import { formatDias, isOpen, localTime } from './time.js';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'buscar_tienda',
    description: 'Tiendas más cercanas al cliente (única fuente de tiendas y contactos).',
    input_schema: {
      type: 'object',
      properties: {
        ubicacion: { type: 'string', description: 'Lo que dijo el cliente: ciudad, sector o provincia.' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        producto: { type: 'string', description: 'Marca buscada (opcional).' },
      },
    },
  },
  {
    name: 'buscar_producto',
    description: 'Busca en el catálogo (única fuente de modelos).',
    input_schema: { type: 'object', properties: { consulta: { type: 'string' } }, required: ['consulta'] },
  },
  {
    name: 'registrar_campo',
    description: 'Guarda un dato del cliente que pide un flujo.',
    input_schema: {
      type: 'object',
      properties: { campo: { type: 'string' }, valor: { type: 'string' }, flujo: { type: 'string' } },
      required: ['campo', 'valor'],
    },
  },
  {
    name: 'guardar_lead',
    description: 'Guarda al cliente interesado.',
    input_schema: { type: 'object', properties: { nota: { type: 'string' } } },
  },
  {
    name: 'derivar',
    description: 'Pasa a un destino según las reglas de derivación (humano, tienda propia o link).',
    input_schema: {
      type: 'object',
      properties: { destino: { type: 'string' }, motivo: { type: 'string' }, prioridad: { type: 'string', enum: ['normal', 'alta'] }, resumen: { type: 'string' } },
      required: ['motivo'],
    },
  },
  {
    name: 'consultar_horario',
    description: 'Horario del equipo humano y si atiende ahora.',
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
  /** Motivo del localizador para cada tienda mostrada. */
  motivos: string[];
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
  let r: LocateResult = ctx.locator.locate({ text, lat, lng, producto });
  // "por el sur" en un mensaje y "gye" en el siguiente → Sur de Guayaquil.
  if (text && r.lugar && (r.lugar.kind === 'capital' || r.lugar.kind === 'canton') && !/\b(norte|sur|centro)\b/i.test(text)) {
    const recent = ctx.conversation.messages.filter((m) => m.role === 'user').slice(-3).map((m) => m.text).join(' ');
    const dir = recent.match(/\b(norte|sur|centro)\b/i)?.[1];
    if (dir) {
      const again = ctx.locator.locate({ text: `${text} ${dir}`, producto });
      if (again.lugar && again.lugar.kind === 'sector') r = again;
    }
  }
  if (r.lugar) {
    // Si algún flujo pide "ubicacion", queda registrada.
    ctx.conversation.fields.ubicacion = r.lugar.matched === 'ubicacion_compartida' ? `${r.lugar.city} (GPS)` : (r.lugar.city || r.lugar.name);
  }
  if (r.lugar && r.lugar.kind !== 'provincia' && r.resultados[0]?.motivo !== 'misma_ciudad') {
    ctx.actions.push(`sin_cobertura:${r.lugar.city || r.lugar.name}`);
  }
  const repeated = r.resultados.length > 0 && r.resultados.every((x) => ctx.tiendasMostradas.some((t) => t.id === x.tienda.id));
  if (r.resultados.length && !repeated) {
    ctx.actions.push('buscar_tienda');
    ctx.tiendasMostradas.push(...r.resultados.map((x) => x.tienda));
    ctx.motivos.push(...r.resultados.map((x) => x.motivo));
    const first = r.resultados[0].tienda;
    if (first.lat !== undefined && first.lng !== undefined) {
      ctx.extras.push({ location: { lat: first.lat, lng: first.lng, name: first.nombre, address: first.direccion } });
    }
  } else if (r.derivar) {
    ctx.actions.push('buscar_tienda_sin_resultado');
  }

  const online = onlineOffer(ctx, r);
  let sugerencia: string | undefined;
  if (r.resultados.length) {
    const intro =
      r.resultados[0].motivo === 'misma_ciudad'
        ? `¡Genial! En ${r.lugar?.city || r.lugar?.name} puedes encontrarnos aquí 👇`
        : r.lugar?.kind === 'provincia'
          ? `En ${r.lugar.province} te queda así 👇`
          : `En ${r.lugar?.city || r.lugar?.name} todavía no tenemos punto de venta 😕 Lo más cercano es:`;
    const body = r.resultados.map((x) => formatTienda(x.tienda, x.distanciaKm) + (x.nota ? `\n_(${x.nota})_` : '')).join('\n\n');
    if (online?.primero) sugerencia = `${online.texto}\n\nSi prefieres ir en persona, lo más cercano es:\n\n${body}`;
    else sugerencia = `${intro}\n\n${body}${online ? `\n\n${online.texto}` : ''}`;
  } else if (r.derivar) {
    sugerencia = undefined;
  } else if (!r.lugar) {
    sugerencia = '¿En qué ciudad o sector estás? Así te digo la tienda más cercana 📍';
  } else if (online) {
    sugerencia = online.texto;
  }
  return {
    lugar_entendido: r.lugar ? { nombre: r.lugar.name, ciudad: r.lugar.city, provincia: r.lugar.province, tipo: r.lugar.kind } : null,
    tiendas: r.resultados.map((x) => ({ ...publicTienda(x.tienda), distancia_km: x.distanciaKm, motivo: x.motivo, nota: x.nota })),
    compra_online: online ? { link: online.link, descripcion: online.descripcion, ofrecer_primero: online.primero } : null,
    aviso: r.aviso,
    derivar_a: r.derivar,
    sugerencia,
  };
}

/**
 * Opción de compra en línea cuando la tienda física queda lejos:
 *  - con `localizador.ofrecer_ademas: <destino link>` se ofrece ese destino (p. ej. la tienda online del distribuidor);
 *  - sin él, la web de alguna tienda con vende_online (solo si existe).
 * Desde `distancia_lejana_km` se ofrece además; desde `distancia_muy_lejana_km` (o sin tiendas) se ofrece primero.
 */
function onlineOffer(ctx: ToolContext, r: LocateResult): { texto: string; link?: string; descripcion?: string; primero: boolean } | undefined {
  const loc = ctx.bot.config.localizador;
  const lejana = loc?.distancia_lejana_km ?? 60;
  const muyLejana = loc?.distancia_muy_lejana_km ?? 300;
  const first = r.resultados[0];
  if (first?.motivo === 'misma_ciudad') return undefined;
  if (!r.lugar) return undefined;
  const d = first?.distanciaKm;
  if (first && (d === undefined || d < lejana)) return undefined;
  const primero = !first || (d !== undefined && d >= muyLejana);
  if (loc?.ofrecer_ademas) {
    const dest = ctx.bot.config.destinos.find((x) => x.id === loc.ofrecer_ademas);
    if (dest?.valor) {
      return { texto: `También puedes comprar en línea con envío: ${dest.valor}`, link: dest.valor, descripcion: dest.descripcion, primero };
    }
    return undefined;
  }
  const web = r.online.find((t) => t.web)?.web;
  return web ? { texto: `También puedes comprar en línea: ${web}`, link: web, primero } : undefined;
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
  let valor = String(input.valor ?? '').trim();
  if (!campo || !valor) return { error: 'campo y valor son obligatorios' };
  if (campo === 'ubicacion') {
    // Solo se guarda una ubicación que el localizador entiende (evita "sur", "acá", "cerca").
    const place = ctx.locator.gazetteer.resolve(valor);
    if (!place) return { error: `No reconozco "${valor}" como ciudad o sector de Ecuador. Pregunta la ciudad (una sola vez).`, sugerencia: missingQuestion(ctx, 'ubicacion') };
    valor = place.place.city || place.place.name;
  }
  const flows = flowFields(ctx.bot).filter(([, f]) => f.campos.some((c) => c.id === campo));
  const explicit = typeof input.flujo === 'string' && ctx.bot.config.flujos[input.flujo] ? input.flujo : undefined;
  ctx.conversation.fields[campo] = valor;
  ctx.actions.push(`registrar_campo:${campo}`);
  if (explicit) ctx.conversation.activeFlow = explicit;
  else if (!ctx.conversation.activeFlow && flows.length === 1) ctx.conversation.activeFlow = flows[0][0];
  const flowId = ctx.conversation.activeFlow;
  const faltan = flowId ? missingFields(ctx.bot, ctx.conversation, flowId) : [];
  const result: ToolResult = { ok: true, campos: ctx.conversation.fields, flujo: flowId ?? null, faltan };
  // Las acciones al_completar solo corren si el flujo es inequívoco (explícito o único con ese campo).
  if (flowId && !faltan.length) {
    const flujo = ctx.bot.config.flujos[flowId];
    result.flujo_completo = flowId;
    for (const action of flujo?.al_completar ?? []) {
      if (action === 'buscar_tienda' && ctx.conversation.fields.ubicacion && !ctx.actions.includes('buscar_tienda')) {
        const r = await buscarTienda({ ubicacion: ctx.conversation.fields.ubicacion, producto: ctx.conversation.fields.producto_interes }, ctx);
        result.buscar_tienda = r;
        result.sugerencia = [result.sugerencia, r.sugerencia].filter(Boolean).join('\n\n') || undefined;
      } else if ((action === 'recomendar_producto' || action === 'buscar_producto') && !ctx.actions.includes('buscar_producto')) {
        const consulta = Object.entries(ctx.conversation.fields).filter(([k]) => k !== 'ubicacion').map(([, v]) => v).join(' ');
        const r = await buscarProducto({ consulta }, ctx);
        result.buscar_producto = r;
        result.sugerencia = [r.sugerencia, result.sugerencia].filter(Boolean).join('\n\n') || undefined;
      } else if (action === 'guardar_lead' && !ctx.actions.includes('guardar_lead')) {
        await guardarLead({}, ctx);
      } else if (action.startsWith('derivar:') && !ctx.actions.some((a) => a.startsWith('derivar'))) {
        const r = await derivar({ destino: action.slice('derivar:'.length), motivo: `flujo ${flowId} completo` }, ctx);
        result.derivar = r;
        result.sugerencia = [result.sugerencia, r.sugerencia].filter(Boolean).join('\n\n') || undefined;
      }
    }
  } else if (faltan[0]?.pregunta) {
    result.sugerencia = faltan[0].pregunta;
  }
  return result;
}

function missingQuestion(ctx: ToolContext, campo: string): string | undefined {
  for (const f of Object.values(ctx.bot.config.flujos)) {
    const c = f.campos.find((x) => x.id === campo && x.pregunta);
    if (c) return c.pregunta;
  }
  return undefined;
}

async function guardarLead(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const c = ctx.conversation;
  const data = { ...c.fields, nota: input.nota, canal: c.channel };
  if (ctx.actions.includes('guardar_lead') || (c.lead && JSON.stringify({ ...c.lead, nota: undefined }) === JSON.stringify({ ...data, nota: undefined }))) {
    return { ok: true, ya_guardado: true };
  }
  c.lead = data;
  await ctx.store.saveOrder({ id: `lead_${c.botId}_${c.userId}_${Date.now()}`, botId: c.botId, userId: c.userId, data, createdAt: Date.now() });
  ctx.actions.push('guardar_lead');
  return { ok: true, guardado: data };
}

// ───────────────────────── derivar

export function pickDestino(
  bot: LoadedBot,
  destinoId: string | undefined,
  motivo: string,
): { destino?: Destino; prioridad: 'normal' | 'alta'; regla?: ReglaDerivacion } {
  const destinos = bot.config.destinos;
  const m = new Set(tokens(motivo).filter((t) => t.length > 3 && !STOPWORDS.has(t)));
  const score = (r: ReglaDerivacion) => tokens(`${r.si} ${(r.palabras ?? []).join(' ')}`).filter((w) => m.has(w)).length;
  if (destinoId) {
    const d = destinos.find((x) => x.id === destinoId);
    // Entre las reglas de ese destino, la que más se parece al motivo.
    const reglas = bot.config.reglas_derivacion.filter((r) => r.ir_a === destinoId);
    const regla = reglas.sort((a, b) => score(b) - score(a))[0];
    if (d) return { destino: d, prioridad: regla?.prioridad ?? 'normal', regla };
  }
  // Busca la regla cuyo texto se parezca más al motivo (empate → la primera, como dice el contrato).
  let best: { s: number; r: ReglaDerivacion } | undefined;
  for (const r of bot.config.reglas_derivacion) {
    const s = score(r);
    if (!best || s > best.s) best = { s, r };
  }
  const d = best ? destinos.find((x) => x.id === best!.r.ir_a) : undefined;
  return { destino: d ?? destinos.find((x) => x.tipo === 'humano') ?? destinos[0], prioridad: best?.r.prioridad ?? 'normal', regla: d ? best?.r : undefined };
}

async function derivar(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const motivo = String(input.motivo ?? 'sin motivo');
  const { destino, prioridad: p0, regla } = pickDestino(ctx.bot, typeof input.destino === 'string' ? input.destino : undefined, motivo);
  const prioridad = input.prioridad === 'alta' ? 'alta' : p0;
  // Una sola derivación al mismo destino por turno (el modelo a veces la repite).
  if (destino && destino.tipo !== 'sucursal' && ctx.actions.includes(`derivar:${destino.id}`)) {
    return { ok: true, destino: destino.id, ya_derivado: true, bot_pausado: !!ctx.conversation.paused };
  }
  if (!destino) return { error: 'No hay destinos configurados en bot.yaml; no prometas que alguien escribirá. Pide disculpas y da la información que tengas.' };
  const c = ctx.conversation;
  const handoff = {
    id: `h_${c.botId}_${c.userId}_${Date.now()}`,
    botId: c.botId,
    userId: c.userId,
    destino: destino.id,
    motivo,
    prioridad,
    resumen: typeof input.resumen === 'string' && input.resumen.trim() ? input.resumen : resumenCorto(c, motivo),
    createdAt: Date.now(),
  } as const;
  if (destino.tipo !== 'sucursal') {
    await ctx.store.saveHandoff({ ...handoff });
    ctx.actions.push(`derivar:${destino.id}`);
  }

  const abierto = isOpen(ctx.bot.config.horario_humano, ctx.now());
  const h = ctx.bot.config.horario_humano;
  const horarioTxt = h ? `de ${formatDias(h.dias)}, de ${h.desde} a ${h.hasta}` : undefined;

  if (destino.tipo === 'sucursal') {
    // Tienda propia: se muestra como una tienda más (id en tiendas.csv), sin pausar el bot ni avisar a nadie.
    const t = ctx.bot.tiendas.find((x) => x.id === destino.valor);
    if (!t) return { error: `El destino ${destino.id} apunta a la tienda "${destino.valor}" que no está en tiendas.csv. No inventes la dirección.` };
    ctx.actions.push('buscar_tienda');
    ctx.tiendasMostradas.push(t);
    ctx.motivos.push('misma_ciudad');
    if (t.lat !== undefined && t.lng !== undefined) ctx.extras.push({ location: { lat: t.lat, lng: t.lng, name: t.nombre, address: t.direccion } });
    return { ok: true, destino: destino.id, tipo: 'sucursal', tienda: publicTienda(t), sugerencia: formatTienda(t) };
  }
  if (destino.tipo === 'link') {
    const link = destino.valor || '(link no configurado)';
    return { ok: true, destino: destino.id, tipo: 'link', link, sugerencia: `Aquí puedes continuar: ${link}` };
  }
  if (destino.tipo === 'humano' || destino.tipo === 'webhook') {
    await ctx.notifier.notify({ handoff: { ...handoff }, destino, conversation: c, transcript: transcriptOf(c) });
    if (ctx.pauseOnHandoff) {
      c.paused = true;
      c.pausedAt = ctx.now().getTime();
      c.pausedReason = `derivado a ${destino.id}: ${motivo}`;
    }
  }
  const quien = destino.descripcion?.split(':')[0]?.trim();
  const fuera = abierto === false ? (h?.fuera_de_horario ?? (horarioTxt ? `Nuestro equipo atiende ${horarioTxt}; te escribirán apenas estén disponibles.` : undefined)) : undefined;
  const base = regla?.mensaje ?? (quien ? `Te comunico con nuestro equipo (${quien}) 🙌` : 'Te comunico con una persona de nuestro equipo 🙌');
  const cuando = fuera ? ` ${fuera}` : regla?.mensaje ? '' : ' En breve te escriben por aquí.';
  return {
    ok: true,
    destino: destino.id,
    tipo: destino.tipo,
    prioridad,
    equipo_disponible_ahora: abierto,
    horario: horarioTxt,
    bot_pausado: !!c.paused,
    sugerencia: `${base}${cuando}`,
  };
}

/** Resumen de 2–3 líneas para el humano que recibe la derivación (P-7). */
export function resumenCorto(c: Conversation, motivo: string): string {
  const datos = Object.entries(c.fields).map(([k, v]) => `${k}: ${v}`).join(' · ');
  const ultimos = c.messages.filter((m) => m.role === 'user').slice(-2).map((m) => `"${m.text.slice(0, 120)}"`).join(' / ');
  return [`Motivo: ${motivo}`, datos ? `Datos: ${datos}` : undefined, ultimos ? `Último del cliente: ${ultimos}` : undefined].filter(Boolean).join('\n');
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
    sugerencia: `Nuestro equipo atiende de ${formatDias(h.dias)}, de ${h.desde} a ${h.hasta}. ${abierto ? 'Ahora mismo estamos atendiendo 🙂' : 'Ahora estamos fuera de horario, pero te respondemos apenas abramos.'}`,
  };
}
