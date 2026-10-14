import { spawn, spawnSync } from 'node:child_process';
import type { LLMCompleteArgs, LLMProvider, LLMResponse } from '../types.js';
import { parseTextProtocol, renderTranscript, toolInstructions } from './text-protocol.js';

/**
 * SOLO DESARROLLO. Usa la CLI de Claude Code (`claude -p`) con los créditos de la sesión en la nube
 * para que el bot, los clientes simulados y el juez usen IA real sin ANTHROPIC_API_KEY.
 * Herramientas: protocolo JSON por texto (ver text-protocol.ts). Sin herramientas propias de Claude Code
 * (--tools ""), sin MCP, sin persistir sesión.
 *
 * Controles de gasto: máximo de llamadas por proceso (CLAUDE_CLI_MAX_CALLS, defecto 400), concurrencia
 * (CLAUDE_CLI_CONCURRENCY, defecto 2) y timeout (CLAUDE_CLI_TIMEOUT_MS, defecto 120000).
 */
export class ClaudeCliProvider implements LLMProvider {
  name = 'claude-cli';
  calls = 0;
  private running = 0;
  private queue: (() => void)[] = [];
  private maxCalls: number;
  private concurrency: number;
  private timeoutMs: number;

  constructor(
    private opts: { bin?: string; env?: NodeJS.ProcessEnv } = {},
  ) {
    const env = opts.env ?? process.env;
    this.maxCalls = Number(env.CLAUDE_CLI_MAX_CALLS ?? 400);
    this.concurrency = Math.max(1, Number(env.CLAUDE_CLI_CONCURRENCY ?? 2));
    this.timeoutMs = Number(env.CLAUDE_CLI_TIMEOUT_MS ?? 120000);
  }

  static available(bin = 'claude'): boolean {
    try {
      const r = spawnSync(bin, ['--version'], { timeout: 10000, encoding: 'utf8' });
      return r.status === 0;
    } catch {
      return false;
    }
  }

  async complete(args: LLMCompleteArgs): Promise<LLMResponse> {
    if (this.calls >= this.maxCalls) {
      throw new Error(`ClaudeCliProvider: se alcanzó CLAUDE_CLI_MAX_CALLS=${this.maxCalls} (protección contra bucles)`);
    }
    this.calls++;
    await this.acquire();
    try {
      const tools = args.tools ?? [];
      const system = `${args.system}\n\n${toolInstructions(tools)}`;
      const prompt = renderTranscript(args.messages);
      const raw = await this.run(system, prompt, args.model);
      return parseTextProtocol(raw, tools);
    } finally {
      this.release();
    }
  }

  /** Llamada simple de texto (para clientes simulados y jueces). */
  async text(system: string, prompt: string, model = 'haiku'): Promise<string> {
    if (this.calls >= this.maxCalls) throw new Error(`ClaudeCliProvider: límite de llamadas alcanzado`);
    this.calls++;
    await this.acquire();
    try {
      return await this.run(system, prompt, model);
    } finally {
      this.release();
    }
  }

  private run(system: string, prompt: string, model: string): Promise<string> {
    const bin = this.opts.bin ?? 'claude';
    const cliArgs = [
      '-p',
      '--model', model,
      '--output-format', 'json',
      '--tools', '',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--setting-sources', '',
      '--system-prompt', system,
    ];
    return new Promise((resolve, reject) => {
      const child = spawn(bin, cliArgs, { env: this.opts.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`claude -p superó ${this.timeoutMs} ms`));
      }, this.timeoutMs);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(out) as { result?: string; is_error?: boolean };
          if (parsed.is_error) return reject(new Error(`claude -p error: ${parsed.result ?? err}`));
          resolve(parsed.result ?? '');
        } catch {
          if (code === 0 && out.trim()) resolve(out.trim());
          else reject(new Error(`claude -p salió con código ${code}: ${err.slice(0, 500)}`));
        }
      });
      child.stdin.end(prompt);
    });
  }

  private acquire(): Promise<void> {
    if (this.running < this.concurrency) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((r) => this.queue.push(() => {
      this.running++;
      r();
    }));
  }

  private release() {
    this.running--;
    this.queue.shift()?.();
  }
}
