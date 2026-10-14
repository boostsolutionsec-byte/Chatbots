import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export interface Price {
  entrada: number;
  entrada_cache?: number;
  salida: number;
}

export interface TurnCost {
  llamadas: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  /** USD estimado con precios.yaml (undefined si el modelo no tiene precio). */
  usd?: number;
}

const here = dirname(fileURLToPath(import.meta.url));
let cache: Record<string, Price> | undefined;

/** Precios por millón de tokens desde framework/precios.yaml (o PRECIOS_FILE). */
export function loadPrices(file = process.env.PRECIOS_FILE || join(here, '..', '..', 'precios.yaml')): Record<string, Price> {
  if (cache && !process.env.PRECIOS_FILE) return cache;
  cache = existsSync(file) ? ((YAML.parse(readFileSync(file, 'utf8')) as Record<string, Price>) ?? {}) : {};
  return cache;
}

export function emptyCost(): TurnCost {
  return { llamadas: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
}

export function addUsage(c: TurnCost, model: string, u?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number }, prices = loadPrices()): void {
  c.llamadas++;
  if (!u) return;
  const inp = u.inputTokens ?? 0;
  const cached = Math.min(u.cachedInputTokens ?? 0, inp);
  const out = u.outputTokens ?? 0;
  c.inputTokens += inp;
  c.cachedInputTokens += cached;
  c.outputTokens += out;
  const p = prices[model];
  if (p) c.usd = (c.usd ?? 0) + ((inp - cached) * p.entrada + cached * (p.entrada_cache ?? p.entrada) + out * p.salida) / 1_000_000;
}
