import type { Persona, Resultado, Tienda, Turno } from './types.js';
import type { BotTarget } from './targets.js';
import { FIN, type Customer } from './customer.js';
import type { SimLLM } from './llm.js';
import { criterioAplica, deterministicChecks, mergeNotas, notaPersona } from './checks.js';
import { llmJudge } from './judge.js';

export interface RunOpts {
  maxTurnos: number;
  runId: string;
  juez?: SimLLM; // sin juez = solo chequeos deterministas
  permitidos?: string[];
}

export async function runConversation(p: Persona, customer: Customer, bot: BotTarget, tiendas: Tienda[], o: RunOpts): Promise<Resultado> {
  const t0 = Date.now();
  const transcript: Turno[] = [];
  const userId = `sim-${o.runId}-${p.id}`;
  let error: string | undefined;
  try {
    for (let i = 0; i < o.maxTurnos; i++) {
      const msgs = await customer.next(transcript, i);
      let ended = false;
      for (const m of msgs) {
        if (m === FIN) { ended = true; break; }
        const isLoc = m.trim() === '[UBICACION]' && p.comparte_ubicacion;
        const location = isLoc ? { lat: p.ubicacion.lat, lng: p.ubicacion.lng } : undefined;
        transcript.push({ rol: 'cliente', texto: isLoc ? '[comparte ubicación]' : m, location });
        const replies = await bot.send({ userId, text: isLoc ? undefined : m, location });
        for (const r of replies) transcript.push({ rol: 'bot', texto: r });
      }
      if (ended) break;
    }
  } catch (e) {
    error = (e as Error).message;
  }
  const det = deterministicChecks(p, transcript, tiendas, o.permitidos);
  let juezNotas = {};
  let juez: string | undefined;
  if (o.juez && transcript.some((t) => t.rol === 'bot')) {
    try {
      const j = await llmJudge(o.juez, p, transcript, tiendas, det.obs);
      juezNotas = j.notas;
      juez = j.comentario;
    } catch (e) {
      juez = `error del juez: ${(e as Error).message}`;
    }
  }
  const notas = mergeNotas(det.notas, juezNotas, criterioAplica(p));
  if (error) for (const k of Object.keys(notas) as (keyof typeof notas)[]) if (notas[k] !== null) notas[k] = 0;
  return {
    personaId: p.id,
    persona: p.nombre,
    destino: p.espera.destino,
    transcript,
    notas,
    notaPersona: notaPersona(notas),
    observaciones: det.obs,
    juez,
    error,
    duracionMs: Date.now() - t0,
  };
}

/** Ejecuta tareas con concurrencia limitada (para no saturar `claude -p`). */
export async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>, onDone?: (r: R, i: number) => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        onDone?.(out[i], ++done);
      }
    }),
  );
  return out;
}
