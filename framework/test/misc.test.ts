import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine.js';
import { MockProvider } from '../src/llm/mock.js';
import { loadEvals, runAll, renderReport, LLMJudge, checkTurn, parseJudge, userInput } from '../src/evals/runner.js';
import { loadBot, parseTiendas, renderTemplate, resolveEnvVars, coordsFromMapsUrl, BotConfigError } from '../src/config/loader.js';
import { parseCsv } from '../src/config/csv.js';
import { parseTextProtocol, extractJson, renderTranscript, toolInstructions } from '../src/llm/text-protocol.js';
import { toAnthropicMessages } from '../src/llm/anthropic.js';
import { DeepSeekProvider, toOpenAiMessages } from '../src/llm/deepseek.js';
import { createProvider, resolveModel } from '../src/llm/index.js';
import { SupabaseStore } from '../src/store/supabase.js';
import { dueFollowups } from '../src/followups/index.js';
import { isOpen, parseDuration } from '../src/engine/time.js';
import { chunkKnowledge, selectKnowledge } from '../src/engine/knowledge.js';
import { WebhookNotifier, CompositeNotifier } from '../src/handoff/index.js';
import { TOOL_DEFINITIONS, searchCatalog } from '../src/engine/tools.js';
import { newConversation } from '../src/types.js';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BOTS = new URL('../../bots', import.meta.url).pathname;
const env = { BOTS_DIR: BOTS } as NodeJS.ProcessEnv;

describe('config', () => {
  it('CSV con comillas, comas y saltos de línea', () => {
    const rows = parseCsv('a,b\n"x, y","línea1\nlínea2"\n# comentario\n\n1,2\n');
    expect(rows).toEqual([{ a: 'x, y', b: 'línea1\nlínea2' }, { a: '1', b: '2' }]);
  });
  it('variables de entorno con valor por defecto', () => {
    const missing = new Set<string>();
    expect(resolveEnvVars({ a: '${X}', b: ['${Y:-def}'], c: '${Z}' }, { X: '1' }, missing)).toEqual({ a: '1', b: ['def'], c: '' });
    expect([...missing]).toEqual(['Z']);
  });
  it('plantillas {{}}', () => {
    expect(renderTemplate('Soy {{persona.nombre}} de {{marca}} {{x.y}} [{{lista}}]', { persona: { nombre: 'Ana' }, marca: 'M', lista: ['a', 'b'] })).toBe('Soy Ana de M {{x.y}} [a, b]');
  });
  it('coordenadas desde links de Maps', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/X/@-2.1709,-79.9223,17z')).toEqual({ lat: -2.1709, lng: -79.9223 });
    expect(coordsFromMapsUrl('https://maps.google.com/?q=-1.67,-78.65')).toEqual({ lat: -1.67, lng: -78.65 });
    expect(coordsFromMapsUrl('https://maps.app.goo.gl/abc')).toBeUndefined();
  });
  it('tiendas: marcas, vende_online, filas inválidas', () => {
    const w: string[] = [];
    const t = parseTiendas('id,nombre,ciudad,provincia,direccion,lat,lng,marcas,vende_online,extra\na,A,Quito,Pichincha,x,-0.2,-78.5,uni-ball;POSCA,sí,foo\n,SinId,,,,,,,,\n', w);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ marcas: ['uni-ball', 'POSCA'], vende_online: true, extra: 'foo', lat: -0.2 });
    expect(w[0]).toMatch(/falta id/);
  });
  it('carga la plantilla', () => {
    const b = loadBot('_plantilla', { env });
    expect(b.config.persona.nombre).toBe('Ana');
    expect(b.systemPrompt).toContain('Ana');
    expect(b.systemPrompt).not.toContain('{{');
    expect(b.tiendas.length).toBeGreaterThan(5);
    expect(b.config.destinos[0].valor).toBe('+593990000000');
  });
  it('errores claros en bot.yaml inválido', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bot-'));
    mkdirSync(join(dir, 'malo'));
    writeFileSync(join(dir, 'malo', 'bot.yaml'), 'id: "con espacios"\nlimites: {max_mensajes_sin_avance: 0}\n');
    expect(() => loadBot('malo', { botsDir: dir })).toThrow(BotConfigError);
    expect(() => loadBot('no-existe', { botsDir: dir })).toThrow(/No existe/);
  });
});

describe('protocolo de texto (ClaudeCli)', () => {
  const tools = TOOL_DEFINITIONS;
  it('parsea llamadas a herramientas y respuestas', () => {
    expect(parseTextProtocol('{"tool_calls":[{"name":"buscar_tienda","input":{"ubicacion":"quito"}}]}', tools).toolCalls?.[0]).toMatchObject({ name: 'buscar_tienda', input: { ubicacion: 'quito' } });
    expect(parseTextProtocol('```json\n{"respuesta":"Hola"}\n```', tools)).toEqual({ text: 'Hola' });
    expect(parseTextProtocol('texto suelto', tools)).toEqual({ text: 'texto suelto' });
    expect(parseTextProtocol('{"tool_calls":[{"name":"rm_rf","input":{}}],"respuesta":"x"}', tools)).toEqual({ text: 'x' });
  });
  it('extractJson con llaves dentro de strings', () => {
    expect(extractJson('bla {"a":"}{","b":{"c":1}} fin')).toEqual({ a: '}{', b: { c: 1 } });
  });
  it('transcript e instrucciones', () => {
    const t = renderTranscript([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: '', toolCalls: [{ name: 'buscar_tienda', input: {} }] },
      { role: 'user', content: '', toolResults: [{ name: 'buscar_tienda', content: '{}' }] },
    ]);
    expect(t).toContain('CLIENTE: hola');
    expect(t).toContain('[LLAMADA buscar_tienda]');
    expect(t).toContain('[RESULTADO buscar_tienda]');
    expect(toolInstructions(tools)).toContain('buscar_producto');
  });
});

describe('proveedores', () => {
  it('mensajes para Anthropic: tool_use/tool_result y roles alternados', () => {
    const m = toAnthropicMessages([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: '', toolCalls: [{ id: 't1', name: 'x', input: {} }] },
      { role: 'user', content: '', toolResults: [{ id: 't1', name: 'x', content: '{}' }] },
    ]);
    expect(m.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect(JSON.stringify(m[2])).toContain('tool_result');
  });
  it('mensajes OpenAI-compatibles y DeepSeek con fetch simulado', async () => {
    expect(toOpenAiMessages([{ role: 'user', content: '', toolResults: [{ id: 'a', name: 'x', content: '1' }] }])).toEqual([{ role: 'tool', tool_call_id: 'a', content: '1' }]);
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'c', function: { name: 'buscar_tienda', arguments: '{"ubicacion":"loja"}' } }] } }] }))) as unknown as typeof fetch;
    const r = await new DeepSeekProvider('k', 'https://x', fetchImpl).complete({ system: 's', messages: [{ role: 'user', content: 'hola' }], model: 'deepseek-chat', tools: TOOL_DEFINITIONS });
    expect(r.toolCalls?.[0]).toMatchObject({ name: 'buscar_tienda', input: { ubicacion: 'loja' } });
  });
  it('selección de proveedor y modelos', () => {
    expect(createProvider({ LLM_PROVIDER: 'mock' }).name).toBe('mock');
    expect(createProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'x' }).name).toBe('anthropic');
    expect(createProvider({ ANTHROPIC_API_KEY: 'x' }).name).toBe('anthropic');
    expect(() => createProvider({ LLM_PROVIDER: 'deepseek' })).toThrow(/DEEPSEEK_API_KEY/);
    expect(resolveModel('anthropic', 'claude-haiku')).toBe('claude-haiku-5-5');
    expect(resolveModel('claude-cli', 'claude-sonnet')).toBe('sonnet');
    expect(resolveModel('mock', 'claude-haiku')).toBe('claude-haiku');
  });
});

describe('evals', () => {
  it('la plantilla pasa todas sus evals con Mock', async () => {
    const engine = new Engine({ provider: new MockProvider(), env, pauseOnHandoff: false });
    const { cases, errors } = loadEvals(engine.runtime('_plantilla').bot.evalsDir);
    expect(errors).toEqual([]);
    expect(cases.length).toBeGreaterThanOrEqual(8);
    const results = await runAll(engine, '_plantilla', cases, { concurrency: 3 });
    const failed = results.filter((r) => !r.paso);
    expect(failed.map((f) => f.nombre)).toEqual([]);
    expect(renderReport('_plantilla', 'mock', results)).toContain(`${cases.length}/${cases.length}`);
  });
  it('variantes de usuario: ráfaga, audio, imagen, ubicación', () => {
    expect(userInput({ usuario: ['hola', 'soy de quito'] }).text).toBe('hola\nsoy de quito');
    expect(userInput({ usuario: { audio_transcrito: 'hola' } }).text).toContain('nota de voz');
    expect(userInput({ usuario: { imagen_descrita: 'un posca' } }).text).toContain('imagen');
    expect(userInput({ usuario: { ubicacion: { lat: 1, lng: 2 } } }).location).toEqual({ lat: 1, lng: 2 });
    expect(userInput({ usuario: 123 }).text).toBe('123');
  });
  it('reloj simulado y seguimientos (esperar)', async () => {
    const engine = new Engine({ provider: new MockProvider(), env, pauseOnHandoff: false });
    const [r] = await runAll(engine, '_plantilla', [
      { nombre: 'seg', archivo: 's.yaml', canal: 'telegram', hora_simulada: '2026-10-12T15:00:00Z', turnos: [{ usuario: 'hola' }, { esperar: '23h', espera: { seguimientos_enviados: 1 } }, { esperar: '23h', espera: { seguimientos_enviados: 0 } }] },
    ]);
    expect(r.turnos[1].respuesta).toContain('¿Pudiste encontrar la tienda?');
    expect(r.paso).toBe(true);
  });
  it('YAML con claves duplicadas se acepta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ev-'));
    writeFileSync(join(dir, 'a.yaml'), 'nombre: x\nturnos:\n  - usuario: hola\n    espera:\n      contiene: [a]\n      contiene: [b]\n');
    const { cases, errors } = loadEvals(dir);
    expect(errors).toEqual([]);
    expect(cases[0].turnos[0].espera).toEqual({ contiene: ['b'] });
  });
  it('un eval que falla se reporta con detalle', async () => {
    const engine = new Engine({ provider: new MockProvider(), env, pauseOnHandoff: false });
    const results = await runAll(engine, '_plantilla', [{ nombre: 'falla', archivo: 'x.yaml', canal: 'web', turnos: [{ usuario: 'soy de quito', espera: { tienda_en: ['cuenca'] } }] }]);
    expect(results[0].paso).toBe(false);
    expect(renderReport('_plantilla', 'mock', results)).toContain('❌ tienda_en');
  });
  it('juez LLM parsea la nota', async () => {
    const j = new LLMJudge(new MockProvider([{ text: '{"nota": 8, "razon": "bien"}' }]), 'm');
    expect(await j.grade('c', 't')).toEqual({ nota: 8, razon: 'bien' });
    const j2 = new LLMJudge(new MockProvider([{ text: '{"respuesta":"{\\"nota\\":7,\\"razon\\":\\"ok\\"}"}' }]), 'm');
    expect((await j2.grade('c', 't')).nota).toBe(7);
    expect(parseJudge('Le doy 9/10 porque sí').nota).toBe(9);
  });
  it('checkTurn: no_contiene y max_caracteres', () => {
    const engine = new Engine({ provider: new MockProvider(), env });
    const gz = engine.runtime('_plantilla').locator.gazetteer;
    const r = { replies: [{ text: 'Cuesta $5? y 0991234567?' }], toolCalls: [], actions: [], tiendas: [], motivos: [], state: { fields: {}, paused: false, turnsWithoutProgress: 0 } };
    const { checks, paraJuez } = checkTurn({ no_contiene: ['$'], max_caracteres: 3, pregunta_unica: true, contiene_alguno: ['hola', 'chao'], max_palabras: 2, no_inventa_tiendas: true, rara: 1 }, r, gz);
    expect(checks.map((x) => x.ok)).toEqual([false, false, false, false, false, false]);
    expect(paraJuez).toEqual(['rara: 1']);
  });
});

describe('store Supabase (fetch simulado)', () => {
  it('lee, guarda conversación + mensajes nuevos, leads y derivaciones', async () => {
    const calls: { url: string; method: string; body?: unknown }[] = [];
    let stored: unknown = null;
    const fetchImpl = (async (url: string, init: { method?: string; body?: string }) => {
      calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
      if ((init.method ?? 'GET') === 'GET') return new Response(JSON.stringify(stored ? [stored] : []));
      if (url.includes('/conversations')) {
        const b = JSON.parse(init.body!);
        stored = { data: b.data, message_count: b.message_count };
      }
      return new Response('');
    }) as unknown as typeof fetch;
    const s = new SupabaseStore('https://p.supabase.co', 'key', { fetchImpl });
    const c = await s.getConversation('b', 'u');
    c.messages.push({ role: 'user', text: 'hola', at: 1 }, { role: 'assistant', text: 'hey', at: 2 });
    await s.saveConversation(c);
    const c2 = await s.getConversation('b', 'u');
    expect(c2.messages).toHaveLength(2);
    c2.messages.push({ role: 'user', text: 'otra', at: 3 });
    await s.saveConversation(c2);
    const inserts = calls.filter((x) => x.url.includes('/messages') && x.method === 'POST');
    expect((inserts[0].body as unknown[]).length).toBe(2);
    expect((inserts[1].body as { text: string }[]).map((m) => m.text)).toEqual(['otra']);
    await s.saveOrder({ id: 'o', botId: 'b', userId: 'u', data: {}, createdAt: 1 });
    await s.saveHandoff({ id: 'h', botId: 'b', userId: 'u', destino: 'd', motivo: 'm', createdAt: 1 });
    expect(calls.some((x) => x.url.endsWith('/leads'))).toBe(true);
    expect(calls.every((x) => x.url.startsWith('https://p.supabase.co/rest/v1/'))).toBe(true);
  });
});

describe('seguimientos, horario, conocimiento, derivación', () => {
  const bot = loadBot('_plantilla', { env });
  it('dueFollowups según tiempo y condición', () => {
    const c = newConversation('_plantilla', 'u');
    c.channel = 'telegram';
    c.lastUserAt = 0;
    expect(dueFollowups(bot, c, 22 * 3600_000)).toEqual([]);
    expect(dueFollowups(bot, c, 23.5 * 3600_000)).toHaveLength(1);
    c.fields.ubicacion = 'Quito';
    c.lead = { ubicacion: 'Quito' };
    expect(dueFollowups(bot, c, 23.5 * 3600_000)).toEqual([]); // flujo completo
    c.paused = true;
    expect(dueFollowups(bot, c, 23.5 * 3600_000)).toEqual([]);
  });
  it('horario y duraciones', () => {
    const h = { zona: 'America/Guayaquil', dias: ['lun'], desde: '09:00', hasta: '17:00' };
    expect(isOpen(h, new Date('2026-10-12T15:00:00Z'))).toBe(true); // lunes 10:00 local
    expect(isOpen(h, new Date('2026-10-12T23:00:00Z'))).toBe(false); // lunes 18:00 local
    expect(parseDuration('23h')).toBe(23 * 3600_000);
    expect(() => parseDuration('1 semana')).toThrow();
  });
  it('selección de conocimiento por relevancia', () => {
    const chunks = chunkKnowledge([{ file: 'a.md', content: '# Envíos\nHacemos envíos a todo el país\n# Garantía\nCambio por defecto de fábrica' }]);
    expect(chunks).toHaveLength(2);
    expect(selectKnowledge(chunks, 'tienen garantía?', 40)[0].heading).toBe('Garantía');
  });
  it('catálogo por superficie', () => {
    expect(searchCatalog(bot.catalogo, 'algo para pintar pared')[0].sku).toBe('EJ-003');
    expect(searchCatalog(bot.catalogo, 'xyz')).toEqual([]);
  });
  it('notificadores: webhook y compuesto tolerante a fallos', async () => {
    const bodies: unknown[] = [];
    const ok = new WebhookNotifier('https://n8n.ejemplo.invalid/hook', (async (_u: string, i: { body: string }) => {
      bodies.push(JSON.parse(i.body));
      return new Response('ok');
    }) as unknown as typeof fetch);
    const bad = { name: 'bad', notify: async () => { throw new Error('x'); } };
    const errs: string[] = [];
    const comp = new CompositeNotifier([bad, ok], (_e, n) => errs.push(n));
    const conversation = newConversation('b', 'u');
    await comp.notify({ handoff: { id: 'h', botId: 'b', userId: 'u', destino: 'd', motivo: 'm', createdAt: 1 }, destino: { id: 'd', tipo: 'humano', valor: '' }, conversation, transcript: '' });
    expect(errs).toEqual(['bad']);
    expect(bodies[0]).toMatchObject({ tipo: 'derivacion', motivo: 'm' });
  });
});

describe('P-7 / P-8', () => {
  const bot = loadBot('_plantilla', { env });
  it('etiquetas y resumen de derivación', async () => {
    const store = new (await import('../src/store/memory.js')).MemoryStore();
    const engine = new Engine({ provider: new MockProvider(), env, store });
    await engine.handle('_plantilla', { channel: 'telegram', userId: 'x', text: 'soy de quito', timestamp: Date.now() });
    await engine.resume('_plantilla', 'x');
    await engine.handle('_plantilla', { channel: 'telegram', userId: 'x', text: 'tengo un reclamo', timestamp: Date.now() });
    const c = await store.getConversation('_plantilla', 'x');
    expect(c.tags).toEqual(expect.arrayContaining(['canal:telegram', 'ciudad:quito', 'intencion:donde_comprar', 'resultado:derivado_servicio_cliente']));
    expect(store.handoffs[0].resumen).toContain('ubicacion: Quito');
  });
  it('seguimientos: no de noche y máximo uno sin respuesta', () => {
    const c = newConversation('_plantilla', 'u');
    c.channel = 'telegram';
    const base = Date.parse('2026-10-12T15:00:00Z'); // 10:00 en Guayaquil
    c.lastUserAt = base;
    expect(dueFollowups(bot, c, base + 23 * 3600_000)).toHaveLength(1); // 09:00 del día siguiente
    expect(dueFollowups(bot, c, base + 23 * 3600_000 + 12 * 3600_000)).toHaveLength(0); // 21:00 → no (y además pasado el doble)
    c.lastFollowupAt = base + 23 * 3600_000;
    expect(dueFollowups(bot, c, base + 24 * 3600_000)).toHaveLength(0);
  });
  it('aviso si un seguimiento libre pasa la ventana de 24 h en WhatsApp', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bot-'));
    mkdirSync(join(dir, 'wa'));
    writeFileSync(join(dir, 'wa', 'bot.yaml'), 'id: wa\ncanales: [whatsapp]\nseguimiento:\n  - {despues_de: 2d, mensaje: "hola"}\n');
    expect(loadBot('wa', { botsDir: dir }).warnings.join(' ')).toMatch(/ventana de 24 h/);
  });
});

describe('formatDias', () => {
  it('rangos y sueltos', async () => {
    const { formatDias } = await import('../src/engine/time.js');
    expect(formatDias(['lun', 'mar', 'mie', 'jue', 'vie'])).toBe('lunes a viernes');
    expect(formatDias(['lun', 'mie', 'vie'])).toBe('lunes, miércoles y viernes');
    expect(formatDias(['sab'])).toBe('sábado');
  });
});

describe('ClaudeCliProvider', () => {
  it('envía prompt del bot + conocimiento + reglas + herramientas, y parsea la respuesta', async () => {
    const { ClaudeCliProvider } = await import('../src/llm/claude-cli.js');
    const p = new ClaudeCliProvider({ env: {} });
    let seen = '';
    p.runner = async (system) => {
      seen = system;
      return '{"tool_calls":[{"name":"buscar_tienda","input":{"ubicacion":"loja"}}]}';
    };
    const r = await p.complete({ system: 'REGLAS', cacheableSystemPrefix: 'Soy Sofi + conocimiento', messages: [{ role: 'user', content: 'hola' }], tools: TOOL_DEFINITIONS, model: 'haiku' });
    expect(seen).toContain('Soy Sofi + conocimiento');
    expect(seen).toContain('REGLAS');
    expect(seen).toContain('buscar_tienda');
    expect(r.toolCalls?.[0].name).toBe('buscar_tienda');
  });
  it('respeta el máximo de llamadas', async () => {
    const { ClaudeCliProvider } = await import('../src/llm/claude-cli.js');
    const p = new ClaudeCliProvider({ env: { CLAUDE_CLI_MAX_CALLS: '1' } });
    p.runner = async () => '{"respuesta":"ok"}';
    await p.complete({ system: '', messages: [{ role: 'user', content: 'a' }], model: 'haiku' });
    await expect(p.complete({ system: '', messages: [{ role: 'user', content: 'a' }], model: 'haiku' })).rejects.toThrow(/CLAUDE_CLI_MAX_CALLS/);
  });
});

describe('Anthropic: caché de conversación', () => {
  it('marca solo el último bloque', async () => {
    const { withConversationCache, AnthropicProvider } = await import('../src/llm/anthropic.js');
    const m = withConversationCache(toAnthropicMessages([{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'hey' }, { role: 'user', content: 'soy de loja' }]));
    expect(JSON.stringify(m[2])).toContain('cache_control');
    expect(JSON.stringify(m[0])).not.toContain('cache_control');
    // Cliente simulado: verifica system con caché y parseo de tool_use
    let req: Record<string, unknown> = {};
    const fake = { messages: { create: async (r: Record<string, unknown>) => { req = r; return { content: [{ type: 'tool_use', id: 'x', name: 'buscar_tienda', input: { ubicacion: 'loja' } }], usage: { input_tokens: 1, output_tokens: 1 } }; } } };
    const p = new AnthropicProvider('k', fake as never);
    const r = await p.complete({ system: 'dyn', cacheableSystemPrefix: 'bot', messages: [{ role: 'user', content: 'hola' }], tools: TOOL_DEFINITIONS, model: 'claude-haiku-5-5' });
    expect(JSON.stringify(req.system)).toContain('ephemeral');
    expect(r.toolCalls?.[0]).toMatchObject({ id: 'x', name: 'buscar_tienda' });
  });
});
