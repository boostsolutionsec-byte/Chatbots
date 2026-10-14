const DAYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'] as const;

export interface LocalTime {
  day: (typeof DAYS)[number];
  minutes: number;
  label: string;
}

export function localTime(zone: string, now = new Date()): LocalTime {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const map: Record<string, (typeof DAYS)[number]> = { Sun: 'dom', Mon: 'lun', Tue: 'mar', Wed: 'mie', Thu: 'jue', Fri: 'vie', Sat: 'sab' };
  const h = Number(parts.hour) % 24;
  const m = Number(parts.minute);
  return { day: map[parts.weekday] ?? 'lun', minutes: h * 60 + m, label: `${parts.weekday} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function isOpen(h: { zona: string; dias: string[]; desde: string; hasta: string } | undefined, now = new Date()): boolean | undefined {
  if (!h) return undefined;
  const t = localTime(h.zona, now);
  return h.dias.includes(t.day) && t.minutes >= toMin(h.desde) && t.minutes < toMin(h.hasta);
}

/** "23h" → ms */
export function parseDuration(s: string): number {
  const m = s.match(/^(\d+)(m|h|d)$/);
  if (!m) throw new Error(`Duración inválida: ${s}`);
  const n = Number(m[1]);
  return n * (m[2] === 'm' ? 60_000 : m[2] === 'h' ? 3_600_000 : 86_400_000);
}

const NOMBRES: Record<string, string> = { lun: 'lunes', mar: 'martes', mie: 'miércoles', jue: 'jueves', vie: 'viernes', sab: 'sábado', dom: 'domingo' };
const ORDEN = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

/** ["lun","mar","mie","jue","vie"] → "lunes a viernes"; días sueltos → "lunes, miércoles y viernes". */
export function formatDias(dias: string[]): string {
  const idx = [...new Set(dias)].map((d) => ORDEN.indexOf(d)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (!idx.length) return '';
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (idx.length >= 3 && consecutive) return `${NOMBRES[ORDEN[idx[0]]]} a ${NOMBRES[ORDEN[idx[idx.length - 1]]]}`;
  const names = idx.map((i) => NOMBRES[ORDEN[i]]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
