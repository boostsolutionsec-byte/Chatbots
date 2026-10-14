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
