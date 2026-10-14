import type { LLMMessage, LLMResponse, ToolCall, ToolDefinition } from '../types.js';

// Protocolo de herramientas "por texto" para proveedores sin function calling nativo (ClaudeCliProvider).
// El modelo responde SIEMPRE con un objeto JSON:
//   {"tool_calls":[{"name":"buscar_tienda","input":{"ubicacion":"riobamba"}}]}   ← para usar herramientas
//   {"respuesta":"texto para el cliente"}                                          ← para contestar

export function toolInstructions(tools: ToolDefinition[]): string {
  if (!tools.length) return 'Responde solo con JSON: {"respuesta":"<texto para el cliente>"}';
  const list = tools
    .map((t) => `- ${t.name}: ${t.description}\n  argumentos (JSON Schema): ${JSON.stringify(t.input_schema)}`)
    .join('\n');
  return `## Formato de salida (obligatorio)
Responde SIEMPRE con un único objeto JSON, sin texto antes ni después, sin bloques de código:
- Para usar herramientas: {"tool_calls":[{"name":"<herramienta>","input":{...}}]}
- Para contestar al cliente: {"respuesta":"<texto para el cliente>"}
Después de usar una herramienta recibirás su resultado y entonces contestas con {"respuesta":...}.

## Herramientas disponibles
${list}`;
}

export function renderTranscript(messages: LLMMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.toolResults?.length) {
      for (const r of m.toolResults) lines.push(`[RESULTADO ${r.name}] ${r.content}`);
      if (m.content) lines.push(`CLIENTE: ${m.content}`);
      continue;
    }
    if (m.role === 'user') lines.push(`CLIENTE: ${m.content}`);
    else {
      if (m.content) lines.push(`ASISTENTE: ${m.content}`);
      for (const c of m.toolCalls ?? []) lines.push(`[LLAMADA ${c.name}] ${JSON.stringify(c.input)}`);
    }
  }
  lines.push('', 'Tu turno (solo JSON):');
  return lines.join('\n');
}

/** Extrae el primer objeto JSON balanceado de un texto. */
export function extractJson(text: string): unknown | undefined {
  const cleaned = text.replace(/```(?:json)?/g, '');
  for (let start = cleaned.indexOf('{'); start !== -1; start = cleaned.indexOf('{', start + 1)) {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inStr) {
        if (ch === '\\') i++;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return undefined;
}

export function parseTextProtocol(text: string, tools: ToolDefinition[] = []): LLMResponse {
  const obj = extractJson(text) as { tool_calls?: unknown; respuesta?: unknown; reply?: unknown } | undefined;
  if (obj && Array.isArray(obj.tool_calls)) {
    const names = new Set(tools.map((t) => t.name));
    const toolCalls: ToolCall[] = obj.tool_calls
      .filter((c): c is { name: string; input?: Record<string, unknown> } => !!c && typeof (c as { name?: unknown }).name === 'string')
      .filter((c) => names.size === 0 || names.has(c.name))
      .map((c, i) => ({ id: `t${Date.now()}_${i}`, name: c.name, input: c.input ?? {} }));
    const reply = typeof obj.respuesta === 'string' ? obj.respuesta : '';
    if (toolCalls.length) return { text: reply, toolCalls };
  }
  if (obj && typeof obj.respuesta === 'string') return { text: obj.respuesta };
  if (obj && typeof obj.reply === 'string') return { text: obj.reply };
  // El modelo no respetó el formato: usamos el texto tal cual (sin llaves sueltas).
  return { text: text.trim() };
}
