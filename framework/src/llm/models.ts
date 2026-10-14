// Alias de modelos de bot.yaml → id real por proveedor. Se puede forzar con LLM_MODEL_RAPIDO / LLM_MODEL_EXPERTO.

const ANTHROPIC: Record<string, string> = {
  'claude-haiku': 'claude-haiku-5-5',
  haiku: 'claude-haiku-5-5',
  'claude-sonnet': 'claude-sonnet-5-5',
  sonnet: 'claude-sonnet-5-5',
  'claude-opus': 'claude-opus-5-5',
  opus: 'claude-opus-5-5',
};

const CLAUDE_CLI: Record<string, string> = {
  'claude-haiku': 'haiku',
  'claude-sonnet': 'sonnet',
  'claude-opus': 'opus',
};

const DEEPSEEK: Record<string, string> = {
  'claude-haiku': 'deepseek-chat',
  'claude-sonnet': 'deepseek-chat',
  'claude-opus': 'deepseek-reasoner',
  'deepseek': 'deepseek-chat',
};

export function resolveModel(provider: string, alias: string): string {
  const table = provider === 'anthropic' ? ANTHROPIC : provider === 'claude-cli' ? CLAUDE_CLI : provider === 'deepseek' ? DEEPSEEK : {};
  return table[alias] ?? alias;
}
