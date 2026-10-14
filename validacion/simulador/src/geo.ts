import type { Persona, Tienda } from './types.js';

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** minúsculas, sin tildes, sin signos, espacios simples */
export function norm(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Esperado {
  /** tiendas que cuentan como "correctas" */
  correctas: Tienda[];
  /** la más cercana está en otra ciudad que la del cliente */
  otraCiudad: boolean;
  distanciaKm: number;
  motivo: 'misma_ciudad' | 'mas_cercana';
}

/**
 * Verdad de referencia independiente del bot:
 * - si hay tiendas en la misma ciudad (o alias) → todas las de esa ciudad son válidas;
 * - si no → la más cercana por distancia y cualquiera hasta +25 % / +20 km de esa distancia.
 */
export function tiendasEsperadas(p: Persona, tiendas: Tienda[]): Esperado | null {
  const valid = tiendas.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng));
  if (valid.length === 0) return null;
  const nombres = [p.ubicacion.ciudad, p.ubicacion.alias].filter(Boolean).map((s) => norm(s!));
  const misma = valid.filter((t) => nombres.includes(norm(t.ciudad)));
  const marca = marcaPedida(p);
  const conMarca = (t: Tienda) => !marca || !t.marcas || norm(t.marcas).includes(marca);
  if (misma.length > 0) {
    const d = Math.min(...misma.map((t) => haversineKm(p.ubicacion, t)));
    // Si pide una marca (POSCA) y ninguna tienda de su ciudad la tiene, también vale la más cercana que sí la tenga.
    const extra = misma.some(conMarca) ? [] : masCercanas(p, valid.filter((t) => conMarca(t) && !misma.includes(t)));
    return { correctas: [...misma, ...extra], otraCiudad: false, distanciaKm: d, motivo: 'misma_ciudad' };
  }
  const base = masCercanasEsperado(p, valid);
  base.correctas = [...new Set([...base.correctas, ...masCercanas(p, valid.filter(conMarca))])];
  return base;
}

/** Marca que pide la persona en su guion (solo POSCA importa para el filtro de marcas de tiendas.csv). */
export function marcaPedida(p: Persona): string | undefined {
  return /pos?[ck]a|pozca/i.test(p.guion.join(' ')) ? 'posca' : undefined;
}

function masCercanas(p: Persona, ts: Tienda[]): Tienda[] {
  if (!ts.length) return [];
  const conDist = ts.map((t) => ({ t, d: haversineKm(p.ubicacion, t) })).sort((a, b) => a.d - b.d);
  const umbral = Math.max(conDist[0].d * 1.25, conDist[0].d + 20);
  return conDist.filter((x) => x.d <= umbral).map((x) => x.t);
}

function masCercanasEsperado(p: Persona, valid: Tienda[]): Esperado {
  const conDist = valid.map((t) => ({ t, d: haversineKm(p.ubicacion, t) })).sort((a, b) => a.d - b.d);
  const min = conDist[0].d;
  const umbral = Math.max(min * 1.25, min + 20);
  return {
    correctas: conDist.filter((x) => x.d <= umbral).map((x) => x.t),
    otraCiudad: true,
    distanciaKm: min,
    motivo: 'mas_cercana',
  };
}

/**
 * ¿El texto menciona esta tienda? Por nombre (sin el prefijo EJEMPLO ni paréntesis), por link de Maps
 * o por WhatsApp/teléfono — esto último solo si el número es único entre `todas` (con datos de ejemplo
 * varias tiendas comparten el mismo número y no sirve para saber cuál recomendó el bot).
 */
export function mencionaTienda(texto: string, t: Tienda, todas?: Tienda[]): boolean {
  const n = norm(texto);
  const nombre = norm(t.nombre.replace(/^EJEMPLO\s*/i, '').replace(/\(.*?\)/g, ''));
  if (nombre.length >= 4 && n.includes(nombre)) return true;
  if (t.maps_url && texto.includes(t.maps_url)) return true;
  const digits = texto.replace(/\D/g, '');
  for (const tel of [t.whatsapp, t.telefono]) {
    const d = (tel ?? '').replace(/\D/g, '').slice(-9);
    if (d.length < 7) continue;
    const compartido = todas?.some((o) => o !== t && [o.whatsapp, o.telefono].some((x) => (x ?? '').replace(/\D/g, '').slice(-9) === d));
    if (!compartido && digits.includes(d)) return true;
  }
  return false;
}
