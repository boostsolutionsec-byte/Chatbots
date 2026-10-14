import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Persona, Tienda } from './types.js';

/** CSV mínimo con comillas dobles (RFC 4180 básico). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  const lines = rows.filter((r) => !r[0]?.trim().startsWith('#'));
  const [header, ...body] = lines;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export function loadTiendas(path: string): Tienda[] {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  return rows
    .map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }) as unknown as Tienda)
    .filter((t) => t.nombre);
}

export function loadPersonas(dir: string): Persona[] {
  const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort();
  const out: Persona[] = [];
  for (const f of files) {
    const doc = parseYaml(readFileSync(join(dir, f), 'utf8'));
    const list = Array.isArray(doc) ? doc : doc?.personas;
    if (!Array.isArray(list)) continue;
    out.push(...(list as Persona[]));
  }
  return out;
}

/** Devuelve la lista de errores de formato de una persona (vacía si está bien). */
export function validatePersona(p: Persona): string[] {
  const e: string[] = [];
  if (!/^p\d{2}-/.test(p.id ?? '')) e.push('id debe ser pNN-...');
  if (!p.nombre) e.push('falta nombre');
  if (!p.ubicacion?.ciudad || !p.ubicacion?.provincia) e.push('falta ubicacion.ciudad/provincia');
  if (typeof p.ubicacion?.lat !== 'number' || typeof p.ubicacion?.lng !== 'number') e.push('lat/lng numéricos');
  else if (p.ubicacion.lat < -5.1 || p.ubicacion.lat > 1.7 || p.ubicacion.lng < -92.1 || p.ubicacion.lng > -75.1)
    e.push('coordenadas fuera de Ecuador');
  if (!Array.isArray(p.guion) || p.guion.length === 0) e.push('guion vacío');
  if (!['tienda_mas_cercana', 'asesoria', 'humano', 'rechazo'].includes(p.espera?.destino)) e.push('espera.destino inválido');
  if (!(p.espera?.max_mensajes_bot > 0)) e.push('espera.max_mensajes_bot > 0');
  if (p.guion?.includes('[UBICACION]') && !p.comparte_ubicacion) e.push('[UBICACION] sin comparte_ubicacion');
  return e;
}

/** Busca tiendas.csv del bot; si no existe, usa el fixture de prueba. */
export function resolveTiendasPath(repoRoot: string, botId: string, override?: string): { path: string; esMock: boolean } {
  if (override) return { path: override, esMock: false };
  const real = join(repoRoot, 'bots', botId, 'tiendas.csv');
  if (existsSync(real)) return { path: real, esMock: false };
  return { path: join(repoRoot, 'validacion', 'simulador', 'fixtures', 'tiendas-mock.csv'), esMock: true };
}

/** Resumen de bot.yaml (horario humano, destinos, web, límites) para darle contexto al juez. */
export function botContext(botYamlPath: string): string {
  if (!existsSync(botYamlPath)) return '';
  try {
    const b = parseYaml(readFileSync(botYamlPath, 'utf8')) ?? {};
    const lines: string[] = [];
    if (b.persona) lines.push(`persona: ${JSON.stringify(b.persona)}`);
    if (b.horario_humano) lines.push(`horario_humano: ${JSON.stringify(b.horario_humano)}`);
    if (Array.isArray(b.destinos)) lines.push(...b.destinos.map((d: Record<string, unknown>) => `destino ${d.id} (${d.tipo}): ${d.descripcion ?? ''} ${String(d.valor ?? '').startsWith('${') ? '' : d.valor ?? ''}`));
    if (b.variables) lines.push(`variables: ${JSON.stringify(b.variables)}`);
    if (b.limites?.nunca) lines.push(`limites.nunca: ${JSON.stringify(b.limites.nunca)}`);
    return lines.join('\n');
  } catch {
    return '';
  }
}
