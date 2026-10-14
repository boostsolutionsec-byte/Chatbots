import Anthropic from '@anthropic-ai/sdk';
import type { LLMCompleteArgs, LLMMessage, LLMProvider, LLMResponse, ToolCall } from '../types.js';

/**
 * Proveedor oficial (producción). Prompt caching: la parte estable del sistema (persona + conocimiento)
 * va en un bloque con cache_control para no pagarla en cada mensaje.
 */
export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey });
  }

  async complete(args: LLMCompleteArgs): Promise<LLMResponse> {
    const system: Anthropic.TextBlockParam[] = [];
    if (args.cacheableSystemPrefix) {
      system.push({ type: 'text', text: args.cacheableSystemPrefix, cache_control: { type: 'ephemeral' } });
    }
    system.push({ type: 'text', text: args.system });

    const res = await this.client.messages.create({
      model: args.model,
      max_tokens: args.maxTokens ?? 1024,
      system,
      messages: withConversationCache(toAnthropicMessages(args.messages)),
      tools: args.tools?.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as Anthropic.Tool.InputSchema })),
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const toolCalls: ToolCall[] = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
    return {
      text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: {
        inputTokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0),
        outputTokens: res.usage.output_tokens,
        cachedInputTokens: res.usage.cache_read_input_tokens ?? 0,
      },
    };
  }
}

export function toAnthropicMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const c of m.toolCalls ?? []) content.push({ type: 'tool_use', id: c.id ?? c.name, name: c.name, input: c.input });
      if (content.length) out.push({ role: 'assistant', content });
    } else {
      const content: Anthropic.ContentBlockParam[] = [];
      for (const r of m.toolResults ?? []) content.push({ type: 'tool_result', tool_use_id: r.id ?? r.name, content: r.content });
      if (m.content) content.push({ type: 'text', text: m.content });
      if (content.length) {
        // La API exige alternar roles: fusiona usuarios consecutivos.
        const prev = out[out.length - 1];
        if (prev?.role === 'user' && Array.isArray(prev.content)) prev.content.push(...content);
        else out.push({ role: 'user', content });
      }
    }
  }
  return out;
}

/** Marca el último bloque de la conversación con cache_control: cada turno reutiliza el historial ya cacheado. */
export function withConversationCache(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (!messages.length) return messages;
  const out = messages.map((m) => ({ ...m, content: typeof m.content === 'string' ? [{ type: 'text' as const, text: m.content }] : [...m.content] }));
  const last = out[out.length - 1];
  const blocks = last.content as Anthropic.ContentBlockParam[];
  const i = blocks.length - 1;
  if (i >= 0 && (blocks[i].type === 'text' || blocks[i].type === 'tool_result')) {
    blocks[i] = { ...blocks[i], cache_control: { type: 'ephemeral' } } as Anthropic.ContentBlockParam;
  }
  return out;
}
