// When the screen sleeps and when the weekday leave countdown runs. Pure functions
// of the clock and settings so they're easy to test.
//
// Default day (from the design doc): awake 4:30-6:10, asleep 6:10-3:00 while at
// work, awake 3:00-midnight, asleep overnight. Weekends wake later and skip the
// daytime sleep, and so does a day off on the calendar.

import type { CalendarEvent, Schedule } from './types';

export type ScreenMode = 'awake' | 'sleep';

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function at(day: Date, hhmm: string): Date {
  const d = new Date(day);
  const m = minutesOf(hhmm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export function isWorkday(now: Date, s: Schedule, dayOff = false): boolean {
  return !dayOff && s.workdays.includes(now.getDay());
}

/** An all-day "Off", "PTO", "Vacation" or "Holiday" event today skips the work schedule. */
export function isDayOff(events: CalendarEvent[], now: Date): boolean {
  return events.some((e) => {
    if (!e.all_day) return false;
    const start = new Date(e.start);
    const end = new Date(e.end);
    return start <= now && now < end && /\b(off|pto|vacation|holiday)\b/i.test(e.title);
  });
}

export function scheduledMode(now: Date, s: Schedule, dayOff = false): ScreenMode {
  const m = now.getHours() * 60 + now.getMinutes();
  const work = isWorkday(now, s, dayOff);
  const wake = minutesOf(work ? s.weekday_wake : s.weekend_wake);
  const sleepAt = minutesOf(s.sleep_at);

  // Overnight: sleep_at may be after midnight (00:00, 01:00) or before it (22:30).
  const night = sleepAt < wake ? m >= sleepAt && m < wake : m >= sleepAt || m < wake;
  if (night) return 'sleep';

  if (work && s.sleep_during_work) {
    const leave = minutesOf(s.leave_for_work);
    const back = minutesOf(s.back_from_work);
    if (m >= leave && m < back) return 'sleep';
  }
  return 'awake';
}

export interface Countdown {
  start: Date;
  end: Date;
  /** 0 at wake-up, 1 at leave time. */
  fraction: number;
  minutesLeft: number;
}

/** The weekday-morning leave-for-work countdown, or null outside it. */
export function morningCountdown(now: Date, s: Schedule, dayOff = false): Countdown | null {
  if (!isWorkday(now, s, dayOff)) return null;
  const start = at(now, s.weekday_wake);
  const end = at(now, s.leave_for_work);
  if (now < start || now >= end) return null;
  const total = end.getTime() - start.getTime();
  return {
    start,
    end,
    fraction: (now.getTime() - start.getTime()) / total,
    minutesLeft: (end.getTime() - now.getTime()) / 60_000,
  };
}
