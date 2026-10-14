import type { LLMProvider } from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import { ClaudeCliProvider } from './claude-cli.js';
import { DeepSeekProvider } from './deepseek.js';
import { MockProvider } from './mock.js';

export { AnthropicProvider, ClaudeCliProvider, DeepSeekProvider, MockProvider };
export { resolveModel } from './models.js';

/**
 * Selección automática del proveedor:
 *  1. LLM_PROVIDER explícito: anthropic | deepseek | claude-cli | mock
 *  2. DEEPSEEK_API_KEY → DeepSeek (proveedor por defecto de producción: más barato)
 *  3. ANTHROPIC_API_KEY → Anthropic (opcional)
 *  4. `claude` instalado (sesión de Claude Code) → ClaudeCli (solo desarrollo)
 *  5. Mock
 */
export function createProvider(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase();
  const pick = explicit || (env.DEEPSEEK_API_KEY ? 'deepseek' : env.ANTHROPIC_API_KEY ? 'anthropic' : ClaudeCliProvider.available() ? 'claude-cli' : 'mock');
  switch (pick) {
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY) throw new Error('LLM_PROVIDER=anthropic pero falta ANTHROPIC_API_KEY');
      return new AnthropicProvider(env.ANTHROPIC_API_KEY);
    case 'deepseek':
      if (!env.DEEPSEEK_API_KEY) throw new Error('LLM_PROVIDER=deepseek pero falta DEEPSEEK_API_KEY');
      return new DeepSeekProvider(env.DEEPSEEK_API_KEY, env.DEEPSEEK_BASE_URL || undefined);
    case 'claude-cli':
      return new ClaudeCliProvider({ env });
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`LLM_PROVIDER desconocido: ${pick}`);
  }
}
