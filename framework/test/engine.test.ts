import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine.js';
import { MockProvider } from '../src/llm/mock.js';
import { MemoryStore } from '../src/store/memory.js';
import type { IncomingMessage } from '../src/types.js';
import type { HandoffEvent, HandoffNotifier } from '../src/handoff/index.js';

const env = { BOTS_DIR: new URL('../../bots', import.meta.url).pathname } as NodeJS.ProcessEnv;

function msg(text: string, extra: Partial<IncomingMessage> = {}): IncomingMessage {
  return { channel: 'simulator', userId: 'u1', text, timestamp: Date.now(), ...extra };
}

class SpyNotifier implements HandoffNotifier {
  name = 'spy';
  events: HandoffEvent[] = [];
  async notify(e: HandoffEvent) {
    this.events.push(e);
  }
}

// Lunes 2026-10-12 15:00 en Guayaquil (20:00 UTC): dentro del horario humano de la plantilla.
const MONDAY_OPEN = () => new Date('2026-10-12T20:00:00Z');

describe('Engine con MockProvider y bots/_plantilla', () => {
  it('saluda y pide la ubicación (campo pendiente)', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    const r = await e.handle('_plantilla', msg('hola'));
    expect(r.replies[0].text).toMatch(/ciudad o sector/);
    expect(r.state.pendingField).toBe('ubicacion');
  });

  it('ubicación → buscar_tienda con tienda real del CSV', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    await e.handle('_plantilla', msg('hola donde consigo marcadores'));
    const r = await e.handle('_plantilla', msg('soy de rio bamba'));
    expect(r.actions).toContain('buscar_tienda');
    expect(r.tiendas[0].id).toBe('ej-rio-1');
    expect(r.replies[0].text).toContain('EJEMPLO Papelería Riobamba');
    expect(r.state.fields.ubicacion).toBe('Riobamba');
    expect(r.state.pendingField).toBeUndefined();
    expect(r.replies.some((x) => x.location)).toBe(true);
  });

  it('ubicación compartida', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    const r = await e.handle('_plantilla', msg('', { text: undefined, location: { lat: -0.287, lng: -78.544 } }));
    expect(r.tiendas[0].id).toBe('ej-uio-2');
  });

  it('regla con palabras clave deriva sin LLM y pausa el bot', async () => {
    const provider = new MockProvider();
    const notifier = new SpyNotifier();
    const store = new MemoryStore();
    const e = new Engine({ provider, env, notifier, store, now: MONDAY_OPEN });
    const r = await e.handle('_plantilla', msg('quiero hablar con una persona'));
    expect(provider.calls).toHaveLength(0);
    expect(r.actions).toContain('derivar:asesor_ventas');
    expect(r.state.paused).toBe(true);
    expect(notifier.events[0].destino.id).toBe('asesor_ventas');
    expect(store.handoffs).toHaveLength(1);
    // Pausado: no responde
    const r2 = await e.handle('_plantilla', msg('hola?'));
    expect(r2.skipped).toBe('paused');
    expect(r2.replies).toHaveLength(0);
    // Reactivar
    await e.resume('_plantilla', 'u1');
    const r3 = await e.handle('_plantilla', msg('hola'));
    expect(r3.replies[0].text).toBeTruthy();
  });

  it('reclamo → destino por regla con prioridad alta', async () => {
    const notifier = new SpyNotifier();
    const e = new Engine({ provider: new MockProvider(), env, notifier, now: MONDAY_OPEN });
    const r = await e.handle('_plantilla', msg('me llegó un marcador dañado, quiero poner un reclamo'));
    expect(r.actions).toContain('derivar:servicio_cliente');
    expect(notifier.events[0].handoff.prioridad).toBe('alta');
  });

  it('fuera de horario avisa cuándo atienden', async () => {
    const e = new Engine({ provider: new MockProvider(), env, now: () => new Date('2026-10-11T15:00:00Z') }); // domingo
    const r = await e.handle('_plantilla', msg('tengo un reclamo'));
    expect(r.replies[0].text).toMatch(/09:00 a 17:00/);
  });

  it('idempotencia por messageId', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    const a = await e.handle('_plantilla', msg('hola', { messageId: 'm1' }));
    const b = await e.handle('_plantilla', msg('hola', { messageId: 'm1' }));
    expect(a.replies).toHaveLength(1);
    expect(b.skipped).toBe('duplicate');
  });

  it('producto → catálogo', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    const r = await e.handle('_plantilla', msg('que marcador sirve para tela?'));
    expect(r.actions).toContain('buscar_producto');
    expect(r.replies[0].text).toContain('EJEMPLO Marcador');
  });

  it('anti-alucinación: borra teléfonos y links inventados por el LLM', async () => {
    const provider = new MockProvider([{ text: 'Llama al 0991234567 o entra a https://inventado.com/x' }]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('hola'));
    expect(r.replies[0].text).not.toContain('0991234567');
    expect(r.replies[0].text).not.toContain('inventado.com');
    expect(r.replies[0].text).toContain('[número no verificado]');
  });

  it('conserva teléfonos que sí vienen de herramientas', async () => {
    const provider = new MockProvider([
      { text: '', toolCalls: [{ id: 'a', name: 'buscar_tienda', input: { ubicacion: 'cuenca' } }] },
      { text: 'Ve a EJEMPLO Arte Cuenca, WhatsApp +593 99 000 0000 https://ejemplo.invalid/maps/ej-cue-1' },
    ]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('estoy en cuenca'));
    expect(r.replies[0].text).toContain('+593 99 000 0000');
    expect(r.replies[0].text).toContain('https://ejemplo.invalid/maps/ej-cue-1');
  });

  it('límite de mensajes sin avance → deriva', async () => {
    const e = new Engine({ provider: new MockProvider(), env, now: MONDAY_OPEN });
    let r;
    for (let i = 0; i < 6; i++) r = await e.handle('_plantilla', msg(`blablabla ${i}`));
    expect(r!.actions.some((a) => a.startsWith('derivar'))).toBe(true);
  });

  it('pasa el modelo resuelto y el conocimiento cacheable al proveedor', async () => {
    const provider = new MockProvider();
    const e = new Engine({ provider, env });
    await e.handle('_plantilla', msg('hola'));
    expect(provider.calls[0].model).toBe('claude-haiku');
    expect(provider.calls[0].cacheableSystemPrefix).toContain('Ana');
    expect(provider.calls[0].cacheableSystemPrefix).toContain('Preguntas frecuentes');
    expect(provider.calls[0].system).toContain('<estado>');
  });

  it('/reiniciar borra la conversación en el simulador', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    await e.handle('_plantilla', msg('soy de quito'));
    const r = await e.handle('_plantilla', msg('/reiniciar'));
    expect(r.state.fields).toEqual({});
  });
});

describe('guardas de salida', () => {
  it('precio prohibido → reintento sin precio', async () => {
    const provider = new MockProvider([{ text: 'El marcador cuesta $4,50 😊' }, { text: 'Los precios dependen de cada tienda 🙏' }]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('cuanto cuesta?'));
    expect(r.replies[0].text).toBe('Los precios dependen de cada tienda 🙏');
    expect(provider.calls).toHaveLength(2);
  });
  it('si el reintento insiste, se quitan las oraciones con montos', async () => {
    const provider = new MockProvider([{ text: 'Cuesta 5 dólares. ¿En qué ciudad estás?' }, { text: 'Vale $5.' }]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('precio?'));
    expect(r.replies[0].text).toBe('¿En qué ciudad estás?');
  });
  it('no confunde medidas con precios', async () => {
    const provider = new MockProvider([{ text: 'Punta fina 0.7 mm, ideal para detalles.' }]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('que punta?'));
    expect(provider.calls).toHaveLength(1);
    expect(r.replies[0].text).toContain('0.7 mm');
  });
});

describe('pausa con vencimiento y agrupación de ráfagas', () => {
  it('la pausa por derivación vence sola', async () => {
    let now = new Date('2026-10-12T20:00:00Z');
    const e = new Engine({ provider: new MockProvider(), env, pauseHours: 12, now: () => now });
    await e.handle('_plantilla', msg('quiero hablar con una persona'));
    now = new Date('2026-10-13T02:00:00Z');
    expect((await e.handle('_plantilla', msg('hola?'))).skipped).toBe('paused');
    now = new Date('2026-10-13T09:00:00Z');
    const r = await e.handle('_plantilla', msg('hola'));
    expect(r.skipped).toBeUndefined();
    expect(r.state.paused).toBe(false);
  });
  it('Debouncer agrupa mensajes y descarta repetidos', async () => {
    const { Debouncer } = await import('../src/channels/debounce.js');
    const out: IncomingMessage[] = [];
    const d = new Debouncer(30, (m) => {
      out.push(m);
    });
    d.push('u', msg('hola', { messageId: 'a' }));
    d.push('u', msg('una consulta', { messageId: 'b' }));
    d.push('u', msg('una consulta', { messageId: 'b' }));
    d.push('u', msg('', { text: undefined, location: { lat: 1, lng: 2 }, messageId: 'c' }));
    await new Promise((r) => setTimeout(r, 80));
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('hola\nuna consulta');
    expect(out[0].location).toEqual({ lat: 1, lng: 2 });
    expect(out[0].messageId).toBe('a+b+c');
  });
});

describe('H-13: ubicación detectada', () => {
  it('si el modelo vuelve a preguntar la ciudad, el motor busca la tienda', async () => {
    const provider = new MockProvider([{ text: '¿En qué ciudad estás?' }, { text: 'En Santo Domingo... ' }]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('buenas en sto domingo donde hay marcadores'));
    expect(r.toolCalls[0].name).toBe('buscar_tienda');
    expect(provider.calls[0].system).toContain('ubicacion_detectada_en_mensaje: Santo Domingo');
    expect(r.actions).toContain('buscar_tienda');
  });
});

describe('idioma, sucursal y validación de ubicación', () => {
  it('detecta inglés y quita la sugerencia en español', async () => {
    const { detectLanguage } = await import('../src/engine/engine.js');
    expect(detectLanguage("Hi! I'm visiting Cuenca, where can I buy markers?")).toBe('en');
    expect(detectLanguage('hola donde puedo comprar en cuenca')).toBe('es');
    expect(detectLanguage('ok')).toBe('es');
    const provider = new MockProvider([{ text: '', toolCalls: [{ id: 'a', name: 'buscar_tienda', input: { ubicacion: 'cuenca' } }] }, { text: 'You can buy at EJEMPLO Arte Cuenca' }]);
    const e = new Engine({ provider, env });
    await e.handle('_plantilla', msg("Hi! I'm visiting Cuenca, where can I buy markers?"));
    expect(provider.calls[0].system).toContain('idioma_cliente: inglés');
    const toolMsg = provider.calls[1].messages.at(-1)!.toolResults![0].content;
    expect(toolMsg).not.toContain('Genial');
    expect(toolMsg).toContain('inglés');
  });
  it('registrar_campo rechaza ubicaciones que no entiende', async () => {
    const provider = new MockProvider([{ text: '', toolCalls: [{ id: 'a', name: 'registrar_campo', input: { campo: 'ubicacion', valor: 'por el sur' } }] }, { text: '¿En qué ciudad?' }]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('donde venden por el sur'));
    expect(r.state.fields.ubicacion).toBeUndefined();
    expect((r.toolCalls[0].result as { error?: string }).error).toMatch(/No reconozco/);
  });
  it('"por el sur" y luego "quito" → tienda del sur de Quito', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    await e.handle('_plantilla', msg('donde venden por el sur'));
    const r = await e.handle('_plantilla', msg('quito'));
    expect(r.tiendas[0].id).toBe('ej-uio-2');
  });
});

describe('destino sucursal', () => {
  it('derivar a una sucursal muestra la tienda sin pausar', async () => {
    const provider = new MockProvider([{ text: '', toolCalls: [{ id: 'a', name: 'derivar', input: { destino: 'tienda_propia', motivo: 'pregunta dónde queda la tienda propia' } }] }, { text: '' }]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('donde queda su tienda?'));
    expect(r.tiendas[0].id).toBe('ej-gye-1');
    expect(r.state.paused).toBe(false);
    expect(r.replies[0].text).toContain('EJEMPLO Papelería Centro Guayaquil');
  });
});

describe('P-2 / P-3 en el motor', () => {
  it('pide ubicación con botón nativo mientras falta la ciudad', async () => {
    const e = new Engine({ provider: new MockProvider(), env });
    const r = await e.handle('_plantilla', msg('hola'));
    expect(r.replies[0].requestLocation).toBe(true);
    const r2 = await e.handle('_plantilla', msg('soy de quito'));
    expect(r2.replies[0].requestLocation).toBeUndefined();
  });
  it('nota de voz → pide que lo escriba', async () => {
    const provider = new MockProvider();
    const e = new Engine({ provider, env });
    await e.handle('_plantilla', msg('', { text: undefined, media: { type: 'audio', id: 'x' }, mediaUrl: 'telegram-file:x' }));
    expect(provider.calls[0].messages.at(-1)!.content).toContain('nota de voz');
  });
});

describe('G-5: nombres de tienda inventados', () => {
  it('detecta tiendas que no están en la lista', async () => {
    const { unknownStoreNames } = await import('../src/engine/engine.js');
    const { loadBot } = await import('../src/config/loader.js');
    const bot = loadBot('_plantilla', { env });
    expect(unknownStoreNames('Ve a 📍 *Papelería La Económica* en el centro', bot)).toEqual(['Papelería La Económica']);
    expect(unknownStoreNames('📍 *EJEMPLO Arte Cuenca*\nCalle Larga', bot)).toEqual([]);
    expect(unknownStoreNames('Te recomiendo el *EJEMPLO Marcador de pintura fino*', bot)).toEqual([]);
    expect(unknownStoreNames('*¡Genial!* gracias', bot)).toEqual([]);
  });
  it('si el reintento insiste, se reemplaza por el texto con datos reales', async () => {
    const provider = new MockProvider([
      { text: '', toolCalls: [{ id: 'a', name: 'buscar_tienda', input: { ubicacion: 'loja' } }] },
      { text: 'Ve a 📍 *Librería El Sol* en Loja' },
      { text: 'Ve a 📍 *Librería El Sol*, es la mejor' },
    ]);
    const e = new Engine({ provider, env });
    const r = await e.handle('_plantilla', msg('soy de loja'));
    expect(r.replies[0].text).toContain('EJEMPLO Arte Loja');
    expect(r.replies[0].text).not.toContain('El Sol');
  });
});

describe('respaldo si la IA falla', () => {
  it('usa reglas deterministas y no deja al cliente sin respuesta', async () => {
    const broken = { name: 'anthropic', complete: async () => { throw new Error('529 overloaded'); } };
    const logs: string[] = [];
    const e = new Engine({ provider: broken, env, log: (s) => logs.push(s) });
    const r = await e.handle('_plantilla', msg('soy de cuenca'));
    expect(r.tiendas[0].id).toBe('ej-cue-1');
    expect(logs.join(' ')).toMatch(/respuesta de respaldo/);
  });
});
