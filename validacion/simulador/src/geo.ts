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
  if (misma.length > 0) {
    const d = Math.min(...misma.map((t) => haversineKm(p.ubicacion, t)));
    return { correctas: misma, otraCiudad: false, distanciaKm: d, motivo: 'misma_ciudad' };
  }
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

/** ¿El texto menciona esta tienda? (por nombre sin el prefijo EJEMPLO, por WhatsApp/teléfono o por link de Maps) */
export function mencionaTienda(texto: string, t: Tienda): boolean {
  const n = norm(texto);
  const nombre = norm(t.nombre.replace(/^EJEMPLO\s*/i, ''));
  if (nombre.length >= 4 && n.includes(nombre)) return true;
  const digits = texto.replace(/\D/g, '');
  for (const tel of [t.whatsapp, t.telefono]) {
    const d = (tel ?? '').replace(/\D/g, '');
    if (d.length >= 7 && digits.includes(d.slice(-9))) return true;
  }
  if (t.maps_url && texto.includes(t.maps_url)) return true;
  return false;
}
