import type { LocatorQuery, LocatorResult, MotivoTienda, StoreLocator, Tienda } from '../types.js';
import { Gazetteer, type ResolvedPlace } from './gazetteer.js';
import { haversineKm, normalize } from './normalize.js';

export interface LocatorOptions {
  maxResults?: number;
  /** 'mas_cercana_por_distancia' (defecto) o 'derivar:<destino>'. */
  fallback?: string;
  /** Alias propios del bot (bot.yaml → localizador.alias). */
  alias?: Record<string, string>;
  /** Distancia (km) bajo la cual una tienda por GPS cuenta como "misma ciudad". */
  sameCityKm?: number;
  /** Lugares propios del bot (localizador.lugares → lugares.csv). */
  lugares?: LugarExtra[];
}

export interface LugarExtra {
  nombre: string;
  alias?: string[];
  tipo?: string;
  ciudad?: string;
  provincia?: string;
  lat?: number;
  lng?: number;
}

export interface LocateResult {
  /** Lugar entendido del mensaje o de la ubicación compartida. */
  lugar?: ResolvedPlace;
  /** Otras ciudades con el mismo nombre (para preguntar "¿cuál?"). */
  ambiguo?: string[];
  resultados: LocatorResult[];
  /** Tiendas que venden en línea (útil si la más cercana está lejos). */
  online: Tienda[];
  /** Mensaje para el LLM: qué pasó y qué hacer. */
  aviso?: string;
  /** Si la config dice derivar cuando no hay tienda en la ciudad. */
  derivar?: string;
}

interface IndexedStore {
  tienda: Tienda;
  city: string; // normalizada canónica
  provinceCode?: string;
  lat?: number;
  lng?: number;
  marcas: string[];
}

export class Locator implements StoreLocator {
  readonly gazetteer: Gazetteer;
  /** Lugares del bot que no se pudieron registrar (sin provincia válida o sin coordenadas). */
  readonly ignoredLugares: string[];
  private stores: IndexedStore[];
  private opts: Required<Omit<LocatorOptions, 'alias' | 'lugares'>>;

  constructor(tiendas: Tienda[], opts: LocatorOptions = {}) {
    this.gazetteer = new Gazetteer();
    this.ignoredLugares = (opts.lugares ?? []).filter((l) => !this.gazetteer.addPlace(l)).map((l) => l.nombre);
    for (const [alias, target] of Object.entries(opts.alias ?? {})) this.gazetteer.addAlias(alias, target);
    this.opts = {
      maxResults: opts.maxResults ?? 2,
      fallback: opts.fallback ?? 'mas_cercana_por_distancia',
      sameCityKm: opts.sameCityKm ?? 12,
    };
    // Ciudades de tiendas que no están en el diccionario: se agregan con las coordenadas de la tienda.
    for (const t of tiendas) {
      const code = t.provincia ? this.gazetteer.provinceCode(t.provincia) : undefined;
      if (t.ciudad && code && t.lat !== undefined && t.lng !== undefined && !this.gazetteer.lookup(t.ciudad, code)) {
        this.gazetteer.addCity(t.ciudad, code, t.lat, t.lng);
      }
    }
    this.stores = tiendas.map((t) => {
      const code = t.provincia ? this.gazetteer.provinceCode(t.provincia) : undefined;
      const place = t.ciudad ? this.gazetteer.lookup(t.ciudad, code) : undefined;
      return {
        tienda: t,
        city: normalize(place?.city || place?.name || t.ciudad || ''),
        provinceCode: code ?? place?.provinceCode,
        lat: t.lat ?? place?.lat,
        lng: t.lng ?? place?.lng,
        marcas: t.marcas.map(normalize),
      };
    });
  }

  async find(q: LocatorQuery): Promise<LocatorResult[]> {
    return this.locate(q).resultados;
  }

  locate(q: LocatorQuery): LocateResult {
    const online = this.stores.filter((s) => s.tienda.vende_online).map((s) => s.tienda);
    let lugar: ResolvedPlace | undefined;
    let ambiguo: string[] | undefined;
    const hasCoords = typeof q.lat === 'number' && typeof q.lng === 'number' && Number.isFinite(q.lat) && Number.isFinite(q.lng);

    if (hasCoords) {
      lugar = { ...this.gazetteer.nearestCity(q.lat!, q.lng!, true), lat: q.lat!, lng: q.lng!, matched: 'ubicacion_compartida' };
    } else if (q.text) {
      const m = this.gazetteer.resolve(q.text);
      if (m) {
        lugar = m.place;
        if (m.alternatives.length) ambiguo = m.alternatives.map((a) => `${a.name} (${a.province})`);
      }
    }
    if (!lugar) {
      return {
        resultados: [],
        online,
        aviso: 'No reconocí la ubicación. Pide la ciudad o el sector (o que comparta su ubicación).',
      };
    }

    const { pool, productoAviso } = this.filterByProduct(q.producto);
    const point = { lat: lugar.lat, lng: lugar.lng };
    const withDist = pool.map((s) => ({
      s,
      d: s.lat !== undefined && s.lng !== undefined ? haversineKm(point, { lat: s.lat, lng: s.lng }) : undefined,
    }));
    const byDist = (a: { d?: number }, b: { d?: number }) => (a.d ?? 1e9) - (b.d ?? 1e9);
    const max = this.opts.maxResults;
    const toResult = (x: { s: IndexedStore; d?: number }, motivo: MotivoTienda): LocatorResult => ({
      tienda: x.s.tienda,
      distanciaKm: x.d === undefined ? undefined : Math.round(x.d * 10) / 10,
      motivo,
    });

    let resultados: LocatorResult[] = [];
    let aviso: string | undefined = productoAviso;
    let derivar: string | undefined;

    if (lugar.kind === 'provincia') {
      const inProv = withDist.filter((x) => x.s.provinceCode === lugar!.provinceCode).sort(byDist);
      if (inProv.length) resultados = inProv.slice(0, max).map((x) => toResult(x, 'misma_provincia'));
      else {
        resultados = withDist.sort(byDist).slice(0, max).map((x) => toResult(x, 'mas_cercana'));
        aviso = join(aviso, `No hay tiendas registradas en la provincia de ${lugar.province}; estas son las más cercanas.`);
      }
      aviso = join(aviso, 'Solo se dijo la provincia: si quieres afinar, pregunta la ciudad.');
    } else {
      const city = normalize(lugar.city || lugar.name);
      const sameCity = withDist.filter((x) => x.s.city === city || (hasCoords && x.d !== undefined && x.d <= this.opts.sameCityKm));
      if (sameCity.length) {
        resultados = sameCity.sort(byDist).slice(0, max).map((x) => toResult(x, 'misma_ciudad'));
      } else if (this.opts.fallback.startsWith('derivar:')) {
        derivar = this.opts.fallback.slice('derivar:'.length);
        aviso = join(aviso, `No hay tiendas en ${lugar.city || lugar.name}. La configuración pide derivar a "${derivar}".`);
      } else {
        // Fuera de su ciudad solo se ofrecen alternativas que no queden mucho más lejos que la primera.
        const sorted = withDist.sort(byDist);
        const d0 = sorted[0]?.d ?? 0;
        const nearest = sorted.slice(0, max).filter((x, i) => i === 0 || (x.d ?? Infinity) <= d0 * 1.5 + 10);
        resultados = nearest.map((x) => toResult(x, x.s.provinceCode === lugar!.provinceCode ? 'misma_provincia' : 'mas_cercana'));
        if (resultados.length) {
          aviso = join(
            aviso,
            `No hay tiendas en ${lugar.city || lugar.name}. Dile con claridad que la más cercana está en ${resultados[0].tienda.ciudad}` +
              (resultados[0].distanciaKm !== undefined ? ` (a unos ${Math.round(resultados[0].distanciaKm)} km)` : '') +
              '.',
          );
        }
      }
    }
    if (lugar.fuzzy) aviso = join(aviso, `Entendí "${lugar.matched}" como ${lugar.name}; si no es así, que lo corrija.`);
    if (ambiguo?.length) aviso = join(aviso, `Hay otros lugares con ese nombre: ${ambiguo.join(', ')}. Si hay duda, pregunta cuál.`);
    if (!resultados.length && !derivar) aviso = join(aviso, 'No hay tiendas registradas. No inventes ninguna; ofrece derivar a un asesor.');
    return { lugar, ambiguo, resultados, online, aviso, derivar };
  }

  private filterByProduct(producto?: string): { pool: IndexedStore[]; productoAviso?: string } {
    if (!producto) return { pool: this.stores };
    const p = normalize(producto);
    const allMarcas = new Set(this.stores.flatMap((s) => s.marcas));
    const wanted = [...allMarcas].filter((m) => m && (p.includes(m) || m.includes(p)));
    if (!wanted.length) return { pool: this.stores };
    const pool = this.stores.filter((s) => s.marcas.length === 0 || s.marcas.some((m) => wanted.includes(m)));
    if (!pool.length) return { pool: this.stores, productoAviso: `Ninguna tienda declara la marca "${producto}".` };
    return { pool };
  }
}

function join(a: string | undefined, b: string): string {
  return a ? `${a} ${b}` : b;
}
