// Parser CSV pequeño (RFC 4180: comillas, comas y saltos de línea dentro de comillas). Sin dependencias.

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^﻿/, ''));
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  // Ignora líneas de comentario que empiezan con '#'
  const data = nonEmpty.filter((r) => !r[0]?.trimStart().startsWith('#'));
  if (data.length === 0) return [];
  const header = data[0].map((h) => h.trim());
  return data.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
