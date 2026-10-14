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
