import { PLACES, PROVINCES, type PlaceKind } from './ecuador.js';
import { LOCATION_CUES, STOPWORDS, WEAK_PLACE_KEYS, editDistance, haversineKm, normalize, tokens } from './normalize.js';

export interface ResolvedPlace {
  /** Nombre canónico del lugar reconocido (ej. "Mall del Sol"). */
  name: string;
  /** Ciudad canónica (para sectores es la ciudad que los contiene). Vacío si es una provincia. */
  city: string;
  provinceCode: string;
  province: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  /** Texto del mensaje que coincidió. */
  matched: string;
  /** true si se reconoció con corrección de ortografía. */
  fuzzy?: boolean;
}

export interface GazetteerMatch {
  place: ResolvedPlace;
  /** Otros lugares con el mismo nombre (ciudades homónimas). */
  alternatives: ResolvedPlace[];
}

const PRIORITY: Record<PlaceKind, number> = { sector: 5, capital: 4, canton: 3, parroquia: 2, provincia: 1 };

function stripParens(s: string): string {
  return s.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

export class Gazetteer {
  private index = new Map<string, ResolvedPlace[]>();
  private fuzzyKeys: string[] = [];

  constructor(extraAliases: Record<string, string> = {}) {
    for (const p of PROVINCES) {
      const cap = PLACES.find((x) => x.province === p.code && x.kind === 'capital');
      const place: ResolvedPlace = {
        name: p.name,
        city: '',
        provinceCode: p.code,
        province: p.name,
        // Para una provincia usamos la capital (donde suele haber más tiendas), no el centroide.
        lat: cap?.lat ?? p.lat,
        lng: cap?.lng ?? p.lng,
        kind: 'provincia',
        matched: '',
      };
      this.add(p.name, place);
      for (const a of p.aliases ?? []) this.add(a, place);
      this.add(`provincia de ${p.name}`, place);
      this.add(`provincia del ${p.name}`, place);
    }
    for (const x of PLACES) {
      const prov = PROVINCES.find((p) => p.code === x.province)!;
      const place: ResolvedPlace = {
        name: stripParens(x.name),
        city: stripParens(x.city ?? x.name),
        provinceCode: x.province,
        province: prov.name,
        lat: x.lat,
        lng: x.lng,
        kind: x.kind,
        matched: '',
      };
      this.add(x.name, place);
      if (x.name.includes('(')) this.add(stripParens(x.name), place);
      for (const a of x.aliases ?? []) this.add(a, place);
    }
    for (const [alias, target] of Object.entries(extraAliases)) this.addAlias(alias, target);
    this.fuzzyKeys = [...this.index.keys()].filter((k) => k.replace(/ /g, '').length >= 5);
  }

  private add(key: string, place: ResolvedPlace) {
    const k = normalize(key);
    if (!k) return;
    for (const variant of new Set([k, k.replace(/ /g, '')])) {
      const list = this.index.get(variant) ?? [];
      if (!list.some((p) => p.name === place.name && p.provinceCode === place.provinceCode && p.kind === place.kind)) list.push(place);
      this.index.set(variant, list);
    }
  }

  /** Alias de un bot: "mall x" → "guayaquil" (nombre de lugar existente) o "-2.1,-79.9" (coordenadas). */
  addAlias(alias: string, target: string) {
    const coords = target.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coords) {
      const lat = Number(coords[1]);
      const lng = Number(coords[2]);
      const near = this.nearestCity(lat, lng);
      this.add(alias, { ...near, name: alias, lat, lng, kind: 'sector', matched: '' });
      return;
    }
    const found = this.index.get(normalize(target));
    if (found?.length) for (const p of found) this.add(alias, p);
  }

  /** Registra una ciudad que no está en el diccionario (p. ej. la ciudad de una tienda). */
  addCity(name: string, provinceCode: string, lat: number, lng: number) {
    if (this.index.has(normalize(name))) return;
    const prov = PROVINCES.find((p) => p.code === provinceCode);
    if (!prov) return;
    this.add(name, { name, city: name, provinceCode, province: prov.name, lat, lng, kind: 'canton', matched: '' });
    this.fuzzyKeys = [...this.index.keys()].filter((k) => k.replace(/ /g, '').length >= 5);
  }

  provinceCode(name: string): string | undefined {
    const n = normalize(name);
    const direct = PROVINCES.find((p) => normalize(p.name) === n || normalize(p.code) === n || (p.aliases ?? []).some((a) => normalize(a) === n));
    if (direct) return direct.code;
    const hit = this.index.get(n) ?? this.index.get(n.replace(/ /g, ''));
    return hit?.[0]?.provinceCode;
  }

  /** Lugar exacto por nombre (sin heurísticas de mensaje). */
  lookup(name: string, provinceCode?: string): ResolvedPlace | undefined {
    const n = normalize(name);
    const list = this.index.get(n) ?? this.index.get(n.replace(/ /g, ''));
    if (!list?.length) return undefined;
    const pool = provinceCode ? list.filter((p) => p.provinceCode === provinceCode) : list;
    const chosen = (pool.length ? pool : list).filter((p) => p.kind !== 'provincia');
    return [...(chosen.length ? chosen : list)].sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind])[0];
  }

  /** Ciudad (no sector, no provincia) más cercana a unas coordenadas. */
  nearestCity(lat: number, lng: number): ResolvedPlace {
    let best: ResolvedPlace | undefined;
    let bestD = Infinity;
    for (const list of this.index.values()) {
      for (const p of list) {
        if (p.kind === 'provincia' || p.kind === 'sector') continue;
        const d = haversineKm({ lat, lng }, p);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    return { ...best!, city: best!.city || best!.name, matched: '' };
  }

  /** Busca un lugar dentro de un mensaje libre ("hola soy de rio bamba" → Riobamba). */
  resolve(text: string): GazetteerMatch | undefined {
    const toks = tokens(text);
    if (toks.length === 0) return undefined;
    type Hit = { start: number; len: number; key: string; places: ResolvedPlace[]; fuzzy: boolean };
    const hits: Hit[] = [];
    const used = new Array(toks.length).fill(false);
    const shortMsg = toks.length <= 2;

    for (let n = Math.min(6, toks.length); n >= 1; n--) {
      for (let i = 0; i + n <= toks.length; i++) {
        if (used.slice(i, i + n).some(Boolean)) continue;
        const gram = toks.slice(i, i + n).join(' ');
        if (n === 1 && STOPWORDS.has(gram) && !WEAK_PLACE_KEYS.has(gram)) continue;
        const places = this.index.get(gram) ?? (n > 1 ? this.index.get(gram.replace(/ /g, '')) : undefined);
        if (!places) continue;
        if (WEAK_PLACE_KEYS.has(gram)) {
          const prev = toks[i - 1];
          if (!(prev && LOCATION_CUES.has(prev)) && !shortMsg) continue;
        }
        hits.push({ start: i, len: n, key: gram, places, fuzzy: false });
        for (let j = i; j < i + n; j++) used[j] = true;
      }
    }

    if (hits.length === 0) {
      // Corrección de ortografía: unigramas y bigramas que no son palabras comunes.
      let best: { d: number; key: string; start: number; len: number } | undefined;
      for (let n = 1; n <= 3; n++) {
        for (let i = 0; i + n <= toks.length; i++) {
          const parts = toks.slice(i, i + n);
          if (parts.some((t) => STOPWORDS.has(t))) continue;
          const gram = parts.join('');
          if (gram.length < 5) continue;
          const max = gram.length >= 8 ? 2 : 1;
          for (const key of this.fuzzyKeys) {
            const k = key.replace(/ /g, '');
            if (Math.abs(k.length - gram.length) > max || k[0] !== gram[0]) continue;
            const d = editDistance(gram, k, max);
            if (d <= max && (!best || d < best.d || (d === best.d && n > best.len))) best = { d, key, start: i, len: n };
          }
        }
      }
      if (best) {
        const places = this.index.get(best.key)!;
        hits.push({ start: best.start, len: best.len, key: best.key, places, fuzzy: true });
      }
    }
    if (hits.length === 0) return undefined;

    // Si se menciona una provincia y una ciudad, la provincia desambigua la ciudad.
    const provinceHits = hits.filter((h) => h.places.every((p) => p.kind === 'provincia'));
    const placeHits = hits.filter((h) => h.places.some((p) => p.kind !== 'provincia'));
    const provCodes = new Set(provinceHits.flatMap((h) => h.places.map((p) => p.provinceCode)));
    // El último lugar mencionado gana ("soy de Quito pero vivo en Ambato" → Ambato).
    const pick = (placeHits.length ? placeHits : provinceHits).sort((a, b) => b.start - a.start)[0];
    let candidates = pick.places;
    if (provCodes.size && placeHits.length) {
      const filtered = candidates.filter((p) => provCodes.has(p.provinceCode));
      if (filtered.length) candidates = filtered;
    }
    // Para un nombre que es ciudad y provincia a la vez (Loja, Esmeraldas), gana la ciudad.
    const sorted = [...candidates].sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind]);
    const matched = toks.slice(pick.start, pick.start + pick.len).join(' ');
    const main = { ...sorted[0], matched, fuzzy: pick.fuzzy || undefined };
    const alternatives = sorted
      .slice(1)
      .filter((p) => p.kind !== 'provincia' && !(p.provinceCode === main.provinceCode && p.city === main.city))
      .map((p) => ({ ...p, matched }));
    return { place: main, alternatives };
  }
}
