import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { botConfigSchema, type BotConfig } from './schema.js';
import { parseCsv } from './csv.js';
import type { Producto, Tienda } from '../types.js';
import type { LugarExtra } from '../locator/locator.js';

export interface KnowledgeDoc {
  file: string;
  content: string;
}

export interface LoadedBot {
  id: string;
  dir: string;
  config: BotConfig;
  /** Prompt de sistema con {{variables}} ya resueltas. */
  systemPrompt: string;
  knowledge: KnowledgeDoc[];
  tiendas: Tienda[];
  catalogo: Producto[];
  /** Lugares propios del bot (localizador.lugares). */
  lugares: LugarExtra[];
  evalsDir: string;
  /** Avisos no fatales (variables de entorno faltantes, filas inválidas…). */
  warnings: string[];
}

const here = dirname(fileURLToPath(import.meta.url));

/** Carpeta de bots: $BOTS_DIR o `<repo>/bots`. */
export function botsDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.BOTS_DIR) return resolve(env.BOTS_DIR);
  return resolve(here, '..', '..', '..', 'bots');
}

export function listBots(dir = botsDir()): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, 'bot.yaml')))
    .sort();
}

/** Reemplaza ${VAR} por process.env.VAR. Las faltantes quedan vacías y se reportan. */
export function resolveEnvVars(value: unknown, env: NodeJS.ProcessEnv, missing: Set<string>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_m, name: string, def?: string) => {
      const v = env[name];
      if (v !== undefined && v !== '') return v;
      if (def !== undefined) return def;
      missing.add(name);
      return '';
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveEnvVars(v, env, missing));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveEnvVars(v, env, missing);
    return out;
  }
  return value;
}

/** Reemplaza {{a.b}} con valores de un objeto. Listas → "a, b". Desconocidas quedan intactas. */
export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, path: string) => {
    let cur: unknown = vars;
    for (const part of path.split('.')) {
      if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else return m;
    }
    if (Array.isArray(cur)) return cur.join(', ');
    if (cur && typeof cur === 'object') return JSON.stringify(cur);
    return String(cur ?? '');
  });
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Intenta sacar lat/lng de un link de Google Maps (…@-2.17,-79.9… o …q=-2.17,-79.9…). */
export function coordsFromMapsUrl(url?: string): { lat: number; lng: number } | undefined {
  if (!url) return undefined;
  const m = url.match(/(?:@|q=|ll=|query=)(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  if (!m) return undefined;
  return { lat: Number(m[1]), lng: Number(m[2]) };
}

function truthy(v?: string): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  return /^(s[ií]|true|1|yes|x)$/i.test(v.trim());
}

export function parseTiendas(csv: string, warnings: string[] = []): Tienda[] {
  const out: Tienda[] = [];
  parseCsv(csv).forEach((r, i) => {
    if (!r.id || !r.nombre) {
      warnings.push(`tiendas.csv fila ${i + 2}: falta id o nombre; se ignora`);
      return;
    }
    let lat = num(r.lat);
    let lng = num(r.lng);
    if (lat === undefined || lng === undefined) {
      const c = coordsFromMapsUrl(r.maps_url);
      if (c) ({ lat, lng } = c);
    }
    if (lat === undefined || lng === undefined) {
      warnings.push(`tiendas.csv fila ${i + 2} (${r.id}): sin coordenadas; solo se encontrará por ciudad/provincia`);
    }
    const { id, nombre, ciudad, provincia, direccion, maps_url, whatsapp, telefono, horario, marcas, vende_online, web, ...extra } = r;
    out.push({
      ...extra,
      id,
      nombre,
      ciudad: ciudad ?? '',
      provincia: provincia ?? '',
      direccion: direccion ?? '',
      lat,
      lng,
      maps_url: maps_url || undefined,
      whatsapp: whatsapp || undefined,
      telefono: telefono || undefined,
      horario: horario || undefined,
      marcas: (marcas ?? '')
        .split(/[;|/]/)
        .map((m) => m.trim())
        .filter(Boolean),
      vende_online: truthy(vende_online),
      web: web || undefined,
    });
  });
  return out;
}

export function parseLugares(csv: string, warnings: string[] = []): LugarExtra[] {
  const out: LugarExtra[] = [];
  parseCsv(csv).forEach((r, i) => {
    if (!r.nombre) {
      warnings.push(`lugares.csv fila ${i + 2}: falta nombre; se ignora`);
      return;
    }
    out.push({
      nombre: r.nombre,
      alias: (r.alias ?? '').split(/[;|]/).map((a) => a.trim()).filter(Boolean),
      tipo: r.tipo || undefined,
      ciudad: r.ciudad || undefined,
      provincia: r.provincia || undefined,
      lat: num(r.lat),
      lng: num(r.lng),
    });
  });
  return out;
}

export function parseCatalogo(csv: string, warnings: string[] = []): Producto[] {
  const out: Producto[] = [];
  parseCsv(csv).forEach((r, i) => {
    if (!r.sku || !r.nombre) {
      warnings.push(`catalogo.csv fila ${i + 2}: falta sku o nombre; se ignora`);
      return;
    }
    out.push({ ...r, sku: r.sku, marca: r.marca ?? '', linea: r.linea ?? '', nombre: r.nombre } as Producto);
  });
  return out;
}

function readKnowledge(dir: string): KnowledgeDoc[] {
  if (!existsSync(dir)) return [];
  const docs: KnowledgeDoc[] = [];
  const walk = (d: string, prefix: string) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p, `${prefix}${f}/`);
      else if (/\.(md|txt)$/i.test(f)) docs.push({ file: `${prefix}${f}`, content: readFileSync(p, 'utf8') });
    }
  };
  walk(dir, '');
  return docs;
}

const DEFAULT_SYSTEM = `Eres {{persona.nombre}}, asistente de {{marca}}. Tono: {{persona.tono}}.
Responde en mensajes cortos, una pregunta a la vez. Usa solo la información del conocimiento y de las herramientas.`;

export class BotConfigError extends Error {}

export function loadBot(idOrDir: string, opts: { env?: NodeJS.ProcessEnv; botsDir?: string } = {}): LoadedBot {
  const env = opts.env ?? process.env;
  const dir = existsSync(join(idOrDir, 'bot.yaml')) ? resolve(idOrDir) : join(opts.botsDir ?? botsDir(env), idOrDir);
  const yamlPath = join(dir, 'bot.yaml');
  if (!existsSync(yamlPath)) throw new BotConfigError(`No existe ${yamlPath}`);
  const warnings: string[] = [];

  let raw: unknown;
  try {
    raw = YAML.parse(readFileSync(yamlPath, 'utf8'));
  } catch (e) {
    throw new BotConfigError(`bot.yaml no es YAML válido: ${(e as Error).message}`);
  }
  const missing = new Set<string>();
  const resolved = resolveEnvVars(raw, env, missing);
  const parsed = botConfigSchema.safeParse(resolved);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n');
    throw new BotConfigError(`bot.yaml inválido (${dir}):\n${msg}`);
  }
  const config = parsed.data;
  if (config.id !== basename(dir)) warnings.push(`bot.yaml: id "${config.id}" no coincide con la carpeta "${basename(dir)}"`);
  for (const m of missing) warnings.push(`variable de entorno sin valor: ${m}`);

  // P-8: en WhatsApp/Instagram los seguimientos libres deben caer dentro de la ventana de 24 h.
  if (config.canales.some((c) => c === 'whatsapp' || c === 'instagram')) {
    for (const sg of config.seguimiento) {
      const m = sg.despues_de.match(/^(\d+)(m|h|d)$/);
      const hours = m ? Number(m[1]) * (m[2] === 'm' ? 1 / 60 : m[2] === 'h' ? 1 : 24) : 0;
      if (hours > 23 && !sg.mensaje.startsWith('plantilla:')) warnings.push(`seguimiento "${sg.despues_de}": pasa la ventana de 24 h de WhatsApp/Instagram; usa una plantilla aprobada (plantilla:<nombre>)`);
    }
  }
  // Validaciones cruzadas
  const destinoIds = new Set(config.destinos.map((d) => d.id));
  for (const r of config.reglas_derivacion) {
    if (!destinoIds.has(r.ir_a)) warnings.push(`reglas_derivacion: destino "${r.ir_a}" no existe en destinos`);
  }

  const tiendasFile = join(dir, config.localizador?.archivo ?? 'tiendas.csv');
  const tiendas = existsSync(tiendasFile) ? parseTiendas(readFileSync(tiendasFile, 'utf8'), warnings) : [];
  const lugaresName = (config.localizador as { lugares?: string } | undefined)?.lugares;
  const lugaresFile = lugaresName ? join(dir, lugaresName) : undefined;
  if (lugaresFile && !existsSync(lugaresFile)) warnings.push(`localizador.lugares: no existe ${lugaresName}`);
  const lugares = lugaresFile && existsSync(lugaresFile) ? parseLugares(readFileSync(lugaresFile, 'utf8'), warnings) : [];
  const catalogoFile = join(dir, 'catalogo.csv');
  const catalogo = existsSync(catalogoFile) ? parseCatalogo(readFileSync(catalogoFile, 'utf8'), warnings) : [];

  const promptFile = join(dir, 'prompts', 'sistema.md');
  const tpl = existsSync(promptFile) ? readFileSync(promptFile, 'utf8') : DEFAULT_SYSTEM;
  const systemPrompt = renderTemplate(tpl, { ...(config as Record<string, unknown>), ...config.variables });
  const unresolved = [...new Set([...systemPrompt.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
  if (unresolved.length) warnings.push(`prompts/sistema.md: variables sin valor: ${unresolved.join(', ')}`);

  return {
    id: config.id,
    dir,
    config,
    systemPrompt,
    knowledge: readKnowledge(join(dir, 'conocimiento')),
    tiendas,
    catalogo,
    lugares,
    evalsDir: join(dir, 'evals'),
    warnings,
  };
}
