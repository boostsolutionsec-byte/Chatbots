// Punto de entrada que se empaqueta en framework/n8n/localizador.js (un solo archivo, sin dependencias) para un nodo Code de n8n.
import { Locator } from '../locator/locator.js';
import type { LugarExtra } from '../locator/locator.js';
import type { Tienda } from '../types.js';

export interface N8nConfig {
  maxResultados?: number;
  /** Link de la tienda online a ofrecer si la tienda física queda lejos. */
  webTienda?: string;
  distanciaLejanaKm?: number;
  alias?: Record<string, string>;
}

function linea(t: Tienda, km?: number): string {
  const out = [`📍 *${t.nombre}* — ${[t.direccion, t.ciudad].filter(Boolean).join(', ')}`];
  const extra = [t.maps_url ? `🗺️ ${t.maps_url}` : '', t.whatsapp ? `📲 ${t.whatsapp}` : t.telefono ? `📞 ${t.telefono}` : '', t.horario ? `🕒 ${t.horario}` : ''].filter(Boolean);
  if (extra.length) out.push(extra.join(' · '));
  if (km !== undefined && km >= 3) out.push(`(a unos ${Math.round(km)} km)`);
  return out.join('\n');
}

const OTRA_INTENCION = /\b(precio|precios|cuesta|vale|costo|dolares|reclamo|queja|danad|defect|garantia|distribu|mayor|colegio|empresa|persona|asesor|humano|horario|envio|envios|para (pintar|dibujar)|zapat\w*|tazas?|tela|lienzo|madera|vidrio|piedras?|mural|que (posca|punta|modelo|marcador|color)|cual|como|sirve|diferencia|recomienda|stock)\b/;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Decide si se puede responder sin IA.
 * - atajo=true → `respuesta` lista para enviar (no llamar al LLM).
 * - atajo=false → llamar al LLM con `contexto` (2–3 tiendas más cercanas si se entendió el lugar; nunca el CSV entero).
 */
export function responder(args: { texto?: string; lat?: number; lng?: number; tiendas: Tienda[]; lugares?: LugarExtra[]; config?: N8nConfig }) {
  const cfg = args.config ?? {};
  const loc = new Locator(args.tiendas, { maxResults: cfg.maxResultados ?? 2, alias: cfg.alias, lugares: args.lugares });
  const texto = args.texto ?? '';
  const t = norm(texto);
  const hasGps = typeof args.lat === 'number' && typeof args.lng === 'number';
  if (!hasGps && /^(hola+|holi|ola|buenas?|buenos dias|buenas tardes|buenas noches|hey|saludos)$/.test(t)) {
    return { atajo: true, intencion: 'saludo', respuesta: '¡Hola! 👋 ¿En qué ciudad o sector estás? Así te digo dónde comprar 📍 (también puedes enviarme tu ubicación).' };
  }
  const r = loc.locate(hasGps ? { lat: args.lat, lng: args.lng } : { text: texto });
  const tiendas = r.resultados.map((x) => ({ ...x.tienda, distancia_km: x.distanciaKm, motivo: x.motivo, nota: x.nota }));
  const contexto = r.lugar
    ? `Lugar del cliente: ${r.lugar.name}${r.lugar.city && r.lugar.city !== r.lugar.name ? ` (${r.lugar.city})` : ''}, ${r.lugar.province}.\nTiendas (usa SOLO estas):\n` +
      r.resultados.map((x) => linea(x.tienda, x.distanciaKm) + (x.nota ? ` (${x.nota})` : '')).join('\n') + (r.aviso ? `\nAviso: ${r.aviso}` : '')
    : '';
  const claro = r.lugar && !r.ambiguo?.length && r.lugar.kind !== 'provincia' && (hasGps || !OTRA_INTENCION.test(t));
  if (!claro || !r.resultados.length) return { atajo: false, intencion: 'llm', lugar: r.lugar?.name ?? null, tiendas, contexto };
  const first = r.resultados[0];
  const ciudad = r.lugar!.city || r.lugar!.name;
  let respuesta: string;
  if (first.motivo === 'misma_ciudad') {
    respuesta = `En ${ciudad} puedes comprar en:\n${r.resultados.map((x) => linea(x.tienda, x.distanciaKm)).join('\n\n')}\nTe recomiendo escribirles antes para confirmar colores.`;
  } else {
    respuesta = `En ${ciudad} aún no tenemos punto de venta 😕 Lo más cercano está en ${first.tienda.ciudad}:\n${linea(first.tienda, first.distanciaKm)}`;
    if (cfg.webTienda && (first.distanciaKm ?? 0) >= (cfg.distanciaLejanaKm ?? 60)) respuesta += `\nTambién puedes pedir en línea con envío: ${cfg.webTienda}`;
  }
  return { atajo: true, intencion: 'donde_compro', lugar: r.lugar!.name, tiendas, respuesta };
}
