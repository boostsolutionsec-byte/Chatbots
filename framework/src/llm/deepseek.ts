import type { LLMCompleteArgs, LLMMessage, LLMProvider, LLMResponse, ToolCall } from '../types.js';

/** DeepSeek (API compatible con OpenAI). Sirve también para cualquier endpoint OpenAI-compatible vía baseUrl. */
export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek';
  constructor(
    private apiKey: string,
    private baseUrl = 'https://api.deepseek.com',
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(args: LLMCompleteArgs): Promise<LLMResponse> {
    const system = [args.cacheableSystemPrefix, args.system].filter(Boolean).join('\n\n');
    const body = {
      model: args.model,
      max_tokens: args.maxTokens ?? 1024,
      messages: [{ role: 'system', content: system }, ...toOpenAiMessages(args.messages)],
      tools: args.tools?.length
        ? args.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }))
        : undefined,
    };
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as {
      choices: { message: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const msg = json.choices[0]?.message ?? {};
    const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((c) => {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(c.function.arguments || '{}');
      } catch {
        /* argumentos inválidos → vacío */
      }
      return { id: c.id, name: c.function.name, input };
    });
    return {
      text: (msg.content ?? '').trim(),
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: { inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens },
    };
  }
}

export function toOpenAiMessages(messages: LLMMessage[]): unknown[] {
  const out: unknown[] = [];
  for (const m of messages) {
    if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls?.length
          ? m.toolCalls.map((c) => ({ id: c.id ?? c.name, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } }))
          : undefined,
      });
    } else {
      for (const r of m.toolResults ?? []) out.push({ role: 'tool', tool_call_id: r.id ?? r.name, content: r.content });
      if (m.content) out.push({ role: 'user', content: m.content });
    }
  }
  return out;
}
