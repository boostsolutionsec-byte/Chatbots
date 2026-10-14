import { spawn } from 'node:child_process';

/** LLM mínimo para cliente simulado y juez (no es el LLMProvider del framework: el validador no depende del motor). */
export interface SimLLM {
  name: string;
  complete(system: string, user: string, opts?: { model?: 'rapido' | 'experto'; maxTokens?: number }): Promise<string>;
}

/** Llama a `claude -p` (CLI de Claude Code). Solo desarrollo: usa los créditos del dueño → con moderación. */
export class ClaudeCliLLM implements SimLLM {
  name = 'claude-cli';
  constructor(
    private models = { rapido: process.env.SIM_MODELO_RAPIDO ?? 'haiku', experto: process.env.SIM_MODELO_EXPERTO ?? 'sonnet' },
    private timeoutMs = 120_000,
  ) {}

  complete(system: string, user: string, opts?: { model?: 'rapido' | 'experto' }): Promise<string> {
    const model = this.models[opts?.model ?? 'rapido'];
    const args = ['-p', '--model', model, '--tools', '', '--no-session-persistence', '--system-prompt', system];
    return new Promise((resolve, reject) => {
      const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`claude -p timeout (${this.timeoutMs} ms)`)); }, this.timeoutMs);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) => { clearTimeout(timer); reject(e); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out.trim());
        else reject(new Error(`claude -p salió con ${code}: ${err.slice(0, 300)}`));
      });
      child.stdin.end(user);
    });
  }
}

/** API de Anthropic por fetch (sin SDK) cuando hay ANTHROPIC_API_KEY. */
export class AnthropicLLM implements SimLLM {
  name = 'anthropic';
  constructor(
    private apiKey: string,
    private models = {
      rapido: process.env.SIM_MODELO_RAPIDO ?? 'claude-haiku-5-5',
      experto: process.env.SIM_MODELO_EXPERTO ?? 'claude-sonnet-5-5',
    },
  ) {}

  async complete(system: string, user: string, opts?: { model?: 'rapido' | 'experto'; maxTokens?: number }): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.models[opts?.model ?? 'rapido'],
        max_tokens: opts?.maxTokens ?? 800,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { content: { type: string; text?: string }[] };
    return json.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  }
}

/** Selección automática: ANTHROPIC_API_KEY → API; si no, `claude` CLI. */
export function autoLLM(): SimLLM {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return new AnthropicLLM(key);
  return new ClaudeCliLLM();
}

/** Extrae el primer objeto JSON de un texto (los LLM a veces lo envuelven en ```json). */
export function extractJson<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
