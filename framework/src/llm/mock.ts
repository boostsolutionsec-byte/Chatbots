import type { LLMCompleteArgs, LLMProvider, LLMResponse, ToolCall } from '../types.js';
import { Gazetteer } from '../locator/gazetteer.js';
import { normalize } from '../locator/normalize.js';

/**
 * Proveedor determinista, sin red, para pruebas unitarias, CI y para probar el simulador sin IA.
 * Imita a un bot razonable con reglas simples:
 *  - ubicación (texto o GPS) → buscar_tienda; producto → buscar_producto; humano/reclamo/mayorista → derivar;
 *  - tras una herramienta, responde con el campo `sugerencia` del resultado (lo arma el motor con datos reales);
 *  - si nada aplica, hace la pregunta del campo pendiente que el motor pone en <estado> del sistema.
 * También acepta un guion fijo (`script`) para pruebas que necesitan respuestas exactas.
 */
export class MockProvider implements LLMProvider {
  name = 'mock';
  calls: LLMCompleteArgs[] = [];
  private gazetteer = new Gazetteer();

  constructor(private script?: LLMResponse[]) {}

  async complete(args: LLMCompleteArgs): Promise<LLMResponse> {
    this.calls.push(args);
    if (this.script) {
      const next = this.script.shift();
      if (!next) throw new Error('MockProvider: guion agotado');
      return next;
    }
    return this.rules(args);
  }

  private rules(args: LLMCompleteArgs): LLMResponse {
    const last = args.messages[args.messages.length - 1];
    const toolNames = new Set((args.tools ?? []).map((t) => t.name));
    const call = (name: string, input: Record<string, unknown>): LLMResponse | undefined =>
      toolNames.has(name) ? { text: '', toolCalls: [{ id: `mock_${name}_${this.calls.length}`, name, input } as ToolCall] } : undefined;

    if (last?.toolResults?.length) {
      const parts = last.toolResults.map((r) => {
        try {
          const j = JSON.parse(r.content) as { sugerencia?: string; error?: string };
          return j.sugerencia ?? j.error ?? '';
        } catch {
          return '';
        }
      });
      const text = parts.filter(Boolean).join('\n\n');
      return { text: text || 'Listo. ¿Te ayudo con algo más?' };
    }

    const raw = last?.content ?? '';
    const t = normalize(raw);
    const pending = args.system.match(/pregunta_pendiente:\s*(.+)/)?.[1]?.trim();

    const gps = raw.match(/ubicaci[oó]n compartida[^-\d]*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
    if (gps) return call('buscar_tienda', { lat: Number(gps[1]), lng: Number(gps[2]) }) ?? { text: 'Gracias por tu ubicación.' };

    if (/\b(persona|humano|asesor|asesora|alguien real|hablar con alguien|operador)\b/.test(t)) {
      return call('derivar', { motivo: 'cliente pide hablar con una persona' }) ?? { text: 'Te comunico con un asesor.' };
    }
    if (/\b(reclamo|queja|danad|defectuos|garantia|estafa|molest|pesimo|devolucion|no sirve|no funciona)/.test(t)) {
      return call('derivar', { motivo: 'reclamo o cliente molesto', prioridad: 'alta' }) ?? { text: 'Lamento lo ocurrido.' };
    }
    if (
      /\b(distribuidor|distribuir|punto de venta|al por mayor|mayorista|mayoreo|revender|colegio|empresa|cotizacion|proforma|unidad educativa|institucion)\b/.test(t) ||
      /\b(tengo|tenemos) (una|un) (papeleria|libreria|bazar|tienda|negocio)\b/.test(t) ||
      /\b(quiero|quisiera|queremos) (vender|revender|distribuir)\b/.test(t) ||
      /\b\d{2,}\s*(marcadores|unidades|cajas|docenas)\b/.test(t)
    ) {
      return call('derivar', { motivo: 'quiere ser punto de venta, mayorista o compra institucional' }) ?? { text: 'Te paso con ventas.' };
    }
    if (/\b(horario|a que hora|abren|atienden|cierran)\b/.test(t)) {
      return call('consultar_horario', {}) ?? { text: 'Te confirmo el horario en un momento.' };
    }
    if (/\b(precio|precios|cuanto cuesta|cuanto vale|cuanto sale|valor|costo)\b|\$/.test(t)) {
      return {
        text: 'Los precios los maneja cada tienda, así que no te puedo dar un valor exacto 🙏' + (pending ? ` ${pending}` : ' ¿En qué ciudad estás? Te digo dónde comprar.'),
      };
    }
    const place = this.gazetteer.resolve(raw);
    if (place) return call('buscar_tienda', { ubicacion: raw }) ?? { text: `Anotado: ${place.place.name}.` };
    if (/\b(posca|marcador|marcadores|punta|zapat|tela|vidrio|madera|taza|lienzo|ceramica|uniball|uni ball|jetstream|signo|kuru|portaminas|boligrafo|esfero|lapiz)/.test(t)) {
      return call('buscar_producto', { consulta: raw }) ?? { text: 'Tenemos varias opciones.' };
    }
    if (/^(hola|holi|buen|buenas|hey|saludos|ola)/.test(t) || t === '') {
      return { text: `¡Hola! 👋 ${pending ?? '¿En qué te puedo ayudar?'}` };
    }
    return { text: pending ? `Para ayudarte mejor: ${pending}` : '¿Me cuentas un poco más para ayudarte?' };
  }
}
