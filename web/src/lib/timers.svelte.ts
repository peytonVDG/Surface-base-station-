// Running timers, kept in localStorage so a reload (or the kiosk restarting) doesn't lose them.

import { addTime, MAX_TIMERS, newTimer, parseStored, tickTimers, type Timer } from './timers';

const KEY = 'kitchen.timers';

function load(): Timer[] {
  try {
    return parseStored(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

export const timers = $state({ list: load() });

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(timers.list));
  } catch {
    /* private window or blocked storage: timers still work, they just won't survive a reload */
  }
}

export function startTimer(seconds: number, label: string, now: number, recipe?: string): boolean {
  if (timers.list.length >= MAX_TIMERS) return false;
  timers.list = [...timers.list, newTimer(seconds, label, now, recipe)];
  save();
  return true;
}

export function dismissTimer(id: string) {
  timers.list = timers.list.filter((t) => t.id !== id);
  save();
}

export function extendTimer(id: string, seconds: number, now: number) {
  timers.list = addTime(timers.list, id, seconds, now);
  save();
}

/** Called every second with the current time. */
export function checkTimers(now: number) {
  const next = tickTimers(timers.list, now);
  if (next !== timers.list) {
    timers.list = next;
    save();
  }
}
