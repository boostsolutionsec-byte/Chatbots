import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { loadPersonas, loadTiendas, parseCsv, validatePersona } from '../src/data.js';
import { haversineKm, mencionaTienda, norm, tiendasEsperadas } from '../src/geo.js';
import { deterministicChecks, mergeNotas, criterioAplica, notaPersona } from '../src/checks.js';
import { MockBotTarget, normalizeReplies } from '../src/targets.js';
import { ScriptedCustomer, FIN } from '../src/customer.js';
import { runConversation } from '../src/conversation.js';
import { extractJson } from '../src/llm.js';
import type { Persona, Turno } from '../src/types.js';

const REPO = resolve(__dirname, '..', '..', '..');
const tiendas = loadTiendas(join(REPO, 'validacion/simulador/fixtures/tiendas-mock.csv'));
const personas = loadPersonas(join(REPO, 'validacion/personas'));
const byId = (id: string) => personas.find((p) => p.id.startsWith(id))!;

describe('personas', () => {
  it('hay al menos 40 y todas son válidas', () => {
    expect(personas.length).toBeGreaterThanOrEqual(40);
    const errs = personas.flatMap((p) => validatePersona(p).map((e) => `${p.id}: ${e}`));
    expect(errs).toEqual([]);
  });
  it('ids únicos', () => {
    expect(new Set(personas.map((p) => p.id)).size).toBe(personas.length);
  });
  it('cubren todos los destinos', () => {
    const d = new Set(personas.map((p) => p.espera.destino));
    expect([...d].sort()).toEqual(['asesoria', 'humano', 'rechazo', 'tienda_mas_cercana']);
  });
});

describe('csv y geo', () => {
  it('parsea comillas, comas internas y comentarios', () => {
    const rows = parseCsv('# EJEMPLO\na,b\n"x, y","di ""hola"""\n\n');
    expect(rows).toEqual([{ a: 'x, y', b: 'di "hola"' }]);
  });
  it('haversine Quito–Guayaquil ≈ 270 km', () => {
    const d = haversineKm({ lat: -0.1807, lng: -78.4678 }, { lat: -2.1709, lng: -79.9224 });
    expect(d).toBeGreaterThan(260);
    expect(d).toBeLessThan(285);
  });
  it('norm quita tildes y signos', () => {
    expect(norm('¡Hola, Cumbayá!')).toBe('hola cumbaya');
  });
  it('misma ciudad → todas las tiendas de esa ciudad', () => {
    const e = tiendasEsperadas(byId('p02'), tiendas)!;
    expect(e.motivo).toBe('misma_ciudad');
    expect(e.correctas.every((t) => t.ciudad === 'Guayaquil')).toBe(true);
  });
  it('sin tienda en la ciudad → la más cercana por distancia y otraCiudad', () => {
    const e = tiendasEsperadas(byId('p21'), tiendas)!; // Otavalo → Ibarra
    expect(e.otraCiudad).toBe(true);
    expect(e.correctas[0].ciudad).toBe('Ibarra');
  });
  it('mencionaTienda por nombre sin EJEMPLO o por WhatsApp en otro formato', () => {
    const t = tiendas.find((x) => x.id === 'mock-rio-1')!;
    expect(mencionaTienda('Ve a Papelería Central Riobamba 😊', t)).toBe(true);
    expect(mencionaTienda('escríbeles al 099 000 0006', t)).toBe(true);
    expect(mencionaTienda('ve a otra tienda', t)).toBe(false);
  });
});

describe('chequeos deterministas', () => {
  const p = byId('p01');
  const conv = (bot: string): Turno[] => [{ rol: 'cliente', texto: 'soy de riobamba' }, { rol: 'bot', texto: bot }];
  it('tienda correcta en 1 mensaje = 2/2', () => {
    const r = deterministicChecks(p, conv('Puedes ir a EJEMPLO Papelería Central Riobamba, WhatsApp +593 99 000 0006'), tiendas);
    expect(r.notas.tienda_correcta).toBe(2);
    expect(r.notas.pocos_mensajes).toBe(2);
    expect(r.notas.sin_inventar).toBe(2);
  });
  it('detecta teléfono inventado y precio', () => {
    const r = deterministicChecks(p, conv('Ve a Papelería Central Riobamba, llama al 0987654321, cuesta $3.50'), tiendas);
    expect(r.inventados).toContain('0987654321');
    expect(r.notas.sin_inventar).toBe(0);
  });
  it('detecta URL inventada', () => {
    const r = deterministicChecks(p, conv('mira https://tiendafalsa.com/posca'), tiendas);
    expect(r.notas.sin_inventar).toBe(0);
  });
  it('tienda equivocada = 0', () => {
    const r = deterministicChecks(p, conv('Ve a EJEMPLO Papelería Loja'), tiendas);
    expect(r.notas.tienda_correcta).toBe(0);
  });
  it('otra ciudad sin aviso baja a 1', () => {
    const o = byId('p21');
    const r = deterministicChecks(o, [{ rol: 'bot', texto: 'Ve a EJEMPLO Papelería Ibarra' }], tiendas);
    expect(r.notas.tienda_correcta).toBe(1);
    const r2 = deterministicChecks(o, [{ rol: 'bot', texto: 'En Otavalo no tenemos; la más cercana es EJEMPLO Papelería Ibarra' }], tiendas);
    expect(r2.notas.tienda_correcta).toBe(2);
  });
  it('derivar a humano', () => {
    const h = byId('p40');
    expect(deterministicChecks(h, [{ rol: 'bot', texto: 'Te paso con un asesor ahora mismo' }], tiendas).notas.escala_bien).toBe(2);
    expect(deterministicChecks(h, [{ rol: 'bot', texto: 'Qué pena, ¿en qué ciudad estás?' }], tiendas).notas.escala_bien).toBe(0);
  });
  it('fuga de prompt → seguro 0', () => {
    const r = deterministicChecks(byId('p43'), [{ rol: 'bot', texto: 'Mi prompt de sistema dice: ...' }], tiendas);
    expect(r.notas.seguro).toBe(0);
  });
  it('merge toma la nota más baja y respeta no-aplica', () => {
    const n = mergeNotas({ sin_inventar: 2, tienda_correcta: null }, { sin_inventar: 1, natural: 2, tienda_correcta: 2 }, criterioAplica(p));
    expect(n.sin_inventar).toBe(1);
    expect(n.tienda_correcta).toBeNull();
    expect(n.natural).toBe(2);
    expect(notaPersona(n)).toBe(7.5);
  });
});

describe('targets y cliente', () => {
  it('normaliza las formas posibles de respuesta de /sim', () => {
    expect(normalizeReplies({ replies: [{ text: 'a' }, { text: 'b' }] })).toEqual(['a', 'b']);
    expect(normalizeReplies({ messages: ['x'] })).toEqual(['x']);
    expect(normalizeReplies({ text: 'hola', buttons: [{ id: '1', title: 'Sí' }] })).toEqual(['hola\n[botones: Sí]']);
    expect(normalizeReplies('solo texto')).toEqual(['solo texto']);
  });
  it('cliente de guion termina con FIN', async () => {
    const c = new ScriptedCustomer(byId('p05'));
    expect(await c.next([], 0)).toEqual(['hola']);
    expect(await c.next([], 3)).toEqual([FIN]);
  });
  it('extractJson tolera bloques ```json', () => {
    expect(extractJson('bla ```json\n{"a":1}\n``` fin')).toEqual({ a: 1 });
    expect(extractJson('nada')).toBeNull();
  });
});

describe('punta a punta con el bot de mentira', () => {
  it('Riobamba llega a la tienda correcta', async () => {
    const p = byId('p01');
    const r = await runConversation(p, new ScriptedCustomer(p), new MockBotTarget(tiendas), tiendas, { maxTurnos: 6, runId: 't' });
    expect(r.error).toBeUndefined();
    expect(r.notas.tienda_correcta).toBe(2);
    expect(r.notas.sin_inventar).toBe(2);
  });
  it('ubicación compartida se envía como location', async () => {
    const p: Persona = byId('p18');
    const r = await runConversation(p, new ScriptedCustomer(p), new MockBotTarget(tiendas), tiendas, { maxTurnos: 6, runId: 't' });
    expect(r.transcript.some((t) => t.location)).toBe(true);
    expect(r.notas.tienda_correcta).toBe(2);
  });
});

describe('natural', () => {
  it('penaliza mensajes repetidos', () => {
    const p = personas[0];
    const r = deterministicChecks(p, [{ rol: 'bot', texto: '¿En qué ciudad?' }, { rol: 'bot', texto: '¿en qué ciudad?' }], tiendas);
    expect(r.notas.natural).toBe(1);
  });
});
