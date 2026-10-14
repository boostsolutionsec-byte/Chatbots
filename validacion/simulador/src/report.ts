import { CRITERIOS, type Criterio, type Resultado } from './types.js';

export interface Resumen {
  fecha: string;
  target: string;
  cliente: string;
  juez: string;
  tiendas: string;
  notaGlobal: number; // 0-10
  porCriterio: Record<Criterio, number | null>; // promedio 0-2
  n: number;
  errores: number;
  resultados: Resultado[];
}

export function resumir(resultados: Resultado[], meta: Omit<Resumen, 'notaGlobal' | 'porCriterio' | 'n' | 'errores' | 'resultados'>): Resumen {
  const porCriterio = {} as Record<Criterio, number | null>;
  for (const c of CRITERIOS) {
    const vals = resultados.map((r) => r.notas[c]).filter((v): v is number => typeof v === 'number');
    porCriterio[c] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
  }
  const notaGlobal = resultados.length
    ? Math.round((resultados.reduce((a, r) => a + r.notaPersona, 0) / resultados.length) * 10) / 10
    : 0;
  return { ...meta, notaGlobal, porCriterio, n: resultados.length, errores: resultados.filter((r) => r.error).length, resultados };
}

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : String(v));
const flecha = (a: number | null, b: number | null | undefined) =>
  a === null || b === null || b === undefined ? '' : a > b ? ` ▲ (+${Math.round((a - b) * 100) / 100})` : a < b ? ` ▼ (${Math.round((a - b) * 100) / 100})` : ' ＝';

export function toMarkdown(r: Resumen, anterior?: Resumen): string {
  const L: string[] = [];
  L.push(`# Corrida del simulador — ${r.fecha}`, '');
  L.push(`- **Bot:** \`${r.target}\``, `- **Cliente:** ${r.cliente} · **Juez:** ${r.juez}`, `- **Tiendas:** ${r.tiendas}`);
  L.push(`- **Personas:** ${r.n} · **Errores de ejecución:** ${r.errores}`, '');
  L.push(`## Nota global: **${r.notaGlobal} / 10**${anterior ? flecha(r.notaGlobal, anterior.notaGlobal) + ` (anterior ${anterior.notaGlobal}, ${anterior.fecha})` : ''}`, '');
  L.push('| Criterio (0–2) | Promedio | Tendencia |', '|---|---|---|');
  for (const c of CRITERIOS) L.push(`| ${c} | ${fmt(r.porCriterio[c])} | ${anterior ? flecha(r.porCriterio[c], anterior.porCriterio[c]) || '—' : '—'} |`);
  L.push('', '## Por persona', '', '| Persona | Destino | Nota | ' + CRITERIOS.map((c) => c.split('_')[0]).join(' | ') + ' | Observación |');
  L.push('|---|---|---|' + CRITERIOS.map(() => '---').join('|') + '|---|');
  for (const x of [...r.resultados].sort((a, b) => a.notaPersona - b.notaPersona)) {
    const obs = (x.error ? `ERROR: ${x.error}` : [x.juez, ...x.observaciones].filter(Boolean).join(' · ')).replace(/\|/g, '/').slice(0, 220);
    L.push(`| ${x.personaId} | ${x.destino} | ${x.notaPersona} | ${CRITERIOS.map((c) => fmt(x.notas[c])).join(' | ')} | ${obs} |`);
  }
  L.push('', '## Las 5 peores conversaciones', '');
  for (const x of [...r.resultados].sort((a, b) => a.notaPersona - b.notaPersona).slice(0, 5)) {
    L.push(`### ${x.personaId} — ${x.persona} (nota ${x.notaPersona})`, '');
    if (x.error) L.push(`**Error:** ${x.error}`, '');
    if (x.juez) L.push(`**Juez:** ${x.juez}`, '');
    for (const o of x.observaciones) L.push(`- ${o}`);
    L.push('', '```');
    for (const t of x.transcript) L.push(`${t.rol === 'cliente' ? '👤' : '🤖'} ${t.texto.replace(/```/g, "'''")}`);
    L.push('```', '');
  }
  return L.join('\n');
}
