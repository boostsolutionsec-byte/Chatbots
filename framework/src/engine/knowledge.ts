import type { KnowledgeDoc } from '../config/loader.js';
import { STOPWORDS, tokens } from '../locator/normalize.js';

export interface Chunk {
  file: string;
  heading: string;
  text: string;
}

/** Corta cada .md por encabezados (#, ##, ###) para recuperar solo lo relevante. */
export function chunkKnowledge(docs: KnowledgeDoc[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const d of docs) {
    let heading = d.file;
    let buf: string[] = [];
    const flush = () => {
      const text = buf.join('\n').trim();
      if (text) chunks.push({ file: d.file, heading, text });
      buf = [];
    };
    for (const line of d.content.split('\n')) {
      const m = line.match(/^#{1,3}\s+(.*)/);
      if (m) {
        flush();
        heading = m[1].trim();
      }
      buf.push(line);
    }
    flush();
  }
  return chunks;
}

/** Puntaje simple por palabras compartidas (sin dependencias ni embeddings). */
export function selectKnowledge(chunks: Chunk[], query: string, maxChars: number): Chunk[] {
  const q = new Set(tokens(query).filter((t) => t.length > 2 && !STOPWORDS.has(t)));
  const scored = chunks.map((c, i) => {
    const words = tokens(`${c.heading} ${c.text}`);
    let score = 0;
    for (const w of words) if (q.has(w)) score++;
    for (const w of tokens(c.heading)) if (q.has(w)) score += 3;
    return { c, i, score: score / Math.sqrt(words.length + 1) };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const out: Chunk[] = [];
  let used = 0;
  for (const s of scored) {
    if (used + s.c.text.length > maxChars) continue;
    out.push(s.c);
    used += s.c.text.length;
  }
  return out.sort((a, b) => chunks.indexOf(a) - chunks.indexOf(b));
}

export function renderKnowledge(chunks: Chunk[]): string {
  let lastFile = '';
  const parts: string[] = [];
  for (const c of chunks) {
    if (c.file !== lastFile) {
      parts.push(`\n<documento nombre="${c.file}">`);
      if (lastFile) parts.splice(parts.length - 1, 0, '</documento>');
      lastFile = c.file;
    }
    parts.push(c.text);
  }
  if (lastFile) parts.push('</documento>');
  return parts.join('\n').trim();
}
