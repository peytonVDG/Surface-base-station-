// Kitchen timers as plain data. A timer is just an end time, so it survives a page
// reload and keeps counting while the screen is asleep.

export interface Timer {
  id: string;
  label: string;
  total: number; // seconds, including any minutes added later
  endsAt: number; // ms since epoch
  ringing: boolean;
  recipe?: string;
}

export const MAX_TIMERS = 8;

export function newTimer(seconds: number, label: string, now: number, recipe?: string): Timer {
  const total = Math.max(1, Math.round(seconds));
  return { id: `${now}-${Math.random().toString(36).slice(2, 7)}`, label, total, endsAt: now + total * 1000, ringing: false, recipe };
}

/** Whole seconds left, rounded up so "0:00" only shows when it is really done. */
export function remaining(t: Timer, now: number): number {
  return Math.max(0, Math.ceil((t.endsAt - now) / 1000));
}

/** Marks timers whose time is up as ringing. Returns the same array when nothing changed. */
export function tickTimers(list: Timer[], now: number): Timer[] {
  return list.some((t) => !t.ringing && t.endsAt <= now) ? list.map((t) => (!t.ringing && t.endsAt <= now ? { ...t, ringing: true } : t)) : list;
}

export function addTime(list: Timer[], id: string, seconds: number, now: number): Timer[] {
  return list.map((t) =>
    t.id === id ? { ...t, ringing: false, total: t.total + seconds, endsAt: Math.max(t.ringing ? now : t.endsAt, now) + seconds * 1000 } : t,
  );
}

/** "4:32", "1:05:00". */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function parseStored(raw: string | null): Timer[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v)
      ? v.filter((t) => t && typeof t.id === 'string' && typeof t.endsAt === 'number' && typeof t.total === 'number').slice(0, MAX_TIMERS)
      : [];
  } catch {
    return [];
  }
}
