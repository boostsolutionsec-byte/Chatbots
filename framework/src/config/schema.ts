import { z } from 'zod';

// Esquema de bot.yaml v1 (docs/CONTRATO.md §2). Permisivo con campos extra (passthrough)
// para que el Agente 3 pueda añadir cosas sin romper el motor; estricto con lo que el motor usa.

const hhmm = z.string().regex(/^\d{1,2}:\d{2}$/, 'formato HH:MM');
const dia = z.enum(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']);

export const campoSchema = z
  .object({
    id: z.string().min(1),
    pregunta: z.string().optional(),
    requerido: z.boolean().default(false),
    descripcion: z.string().optional(),
  })
  .passthrough();

export const flujoSchema = z
  .object({
    descripcion: z.string().optional(),
    campos: z.array(campoSchema).default([]),
    al_completar: z.array(z.string()).default([]),
  })
  .passthrough();

export const destinoSchema = z
  .object({
    id: z.string().min(1),
    tipo: z.enum(['humano', 'link', 'sucursal', 'bot', 'webhook']),
    valor: z.string().default(''),
    descripcion: z.string().optional(),
  })
  .passthrough();

export const reglaDerivacionSchema = z
  .object({
    si: z.string().min(1),
    ir_a: z.string().min(1),
    prioridad: z.enum(['normal', 'alta']).default('normal'),
    /** Palabras clave opcionales que disparan la regla sin depender del LLM. */
    palabras: z.array(z.string()).optional(),
  })
  .passthrough();

export const botConfigSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]+$/i, 'solo letras, números, _ y -'),
    marca: z.string().default(''),
    objetivo: z.array(z.string()).default([]),
    idioma: z.string().default('es'),
    persona: z
      .object({ nombre: z.string().default('Asistente'), tono: z.string().default('cordial') })
      .passthrough()
      .default({ nombre: 'Asistente', tono: 'cordial' }),
    canales: z.array(z.string()).default(['web']),
    horario_humano: z
      .object({
        zona: z.string().default('America/Guayaquil'),
        dias: z.array(dia).default(['lun', 'mar', 'mie', 'jue', 'vie']),
        desde: hhmm.default('09:00'),
        hasta: hhmm.default('18:00'),
      })
      .passthrough()
      .optional(),
    modelo: z
      .object({ rapido: z.string().default('claude-haiku'), experto: z.string().default('claude-sonnet') })
      .passthrough()
      .default({ rapido: 'claude-haiku', experto: 'claude-sonnet' }),
    destinos: z.array(destinoSchema).default([]),
    reglas_derivacion: z.array(reglaDerivacionSchema).default([]),
    localizador: z
      .object({
        archivo: z.string().default('tiendas.csv'),
        acepta: z.array(z.string()).default(['ciudad', 'canton', 'provincia', 'sector', 'ubicacion_compartida']),
        max_resultados: z.number().int().min(1).max(10).default(2),
        si_no_hay_en_ciudad: z.string().default('mas_cercana_por_distancia'),
        /** Alias propios del bot: { "mall del sol": "guayaquil" } o { "sector x": "-2.1,-79.9" } */
        alias: z.record(z.string(), z.string()).optional(),
      })
      .passthrough()
      .optional(),
    flujos: z.record(z.string(), flujoSchema).default({}),
    limites: z
      .object({
        nunca: z.array(z.string()).default([]),
        max_mensajes_sin_avance: z.number().int().min(1).default(6),
        max_caracteres_respuesta: z.number().int().min(50).optional(),
      })
      .passthrough()
      .default({ nunca: [], max_mensajes_sin_avance: 6 }),
    seguimiento: z
      .array(
        z
          .object({
            despues_de: z.string().regex(/^\d+(m|h|d)$/, 'ej. 30m, 23h, 2d'),
            si: z.string().default(''),
            mensaje: z.string(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

export type BotConfig = z.infer<typeof botConfigSchema>;
export type Flujo = z.infer<typeof flujoSchema>;
export type Destino = z.infer<typeof destinoSchema>;
export type ReglaDerivacion = z.infer<typeof reglaDerivacionSchema>;
