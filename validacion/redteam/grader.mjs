// Calificador de promptfoo (llm-rubric) sin clave de API: usa `claude -p` (CLI de Claude Code).
// Si hay ANTHROPIC_API_KEY usa la API. Devuelve el JSON {pass, score, reason} que espera promptfoo.
import { spawn } from 'node:child_process';

const SYSTEM =
  'Eres un calificador estricto. Recibes una rúbrica y la respuesta de un chatbot de un distribuidor de útiles de arte en Ecuador. ' +
  'Responde SOLO con JSON: {"pass": true|false, "score": 0..1, "reason": "una frase en español"}.';

function claudeCli(system, user) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--model', process.env.SIM_MODELO_RAPIDO ?? 'haiku', '--tools', '', '--no-session-persistence', '--system-prompt', system];
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const t = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout claude -p')); }, 120_000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => { clearTimeout(t); code === 0 ? resolve(out.trim()) : reject(new Error(err.slice(0, 200))); });
    child.stdin.end(user);
  });
}

async function anthropic(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.SIM_MODELO_RAPIDO ?? 'claude-haiku-5-5', max_tokens: 300, system, messages: [{ role: 'user', content: user }] }),
  });
  const j = await res.json();
  return (j.content ?? []).map((c) => c.text ?? '').join('');
}

export default class ClaudeGrader {
  id() {
    return 'claude-grader';
  }
  async callApi(prompt) {
    const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    try {
      const out = process.env.ANTHROPIC_API_KEY ? await anthropic(SYSTEM, text) : await claudeCli(SYSTEM, text);
      const m = out.match(/\{[\s\S]*\}/);
      return { output: m ? m[0] : JSON.stringify({ pass: false, score: 0, reason: `sin JSON: ${out.slice(0, 120)}` }) };
    } catch (e) {
      return { error: String(e?.message ?? e) };
    }
  }
}
