// The top-right countdown card: "Leave for work" on weekday mornings, otherwise
// the next timed event today. Travel time per event comes later (the brief can
// work it out), so for now an event counts down to its start.

import { morningCountdown } from './schedule';
import type { CalendarEvent, Settings } from './types';

export type Level = 'ok' | 'soon' | 'late';

export interface LeaveInfo {
  kind: 'work' | 'event' | 'none';
  title: string;
  minutes: number;
  target: Date | null;
  /** Elapsed share of the countdown, 0..1, for the progress bar and ring. */
  fraction: number;
  start: Date | null;
  level: Level;
}

export function levelFor(minutes: number, warnAt: number): Level {
  if (minutes <= 10) return 'late';
  if (minutes <= warnAt) return 'soon';
  return 'ok';
}

const EVENT_WINDOW_MIN = 180; // an event's bar starts filling 3 hours out

export function leaveInfo(now: Date, settings: Settings, events: CalendarEvent[], dayOff: boolean): LeaveInfo {
  const cd = morningCountdown(now, settings.schedule, dayOff);
  if (cd) {
    return {
      kind: 'work',
      title: 'Leave for work',
      minutes: cd.minutesLeft,
      target: cd.end,
      fraction: cd.fraction,
      start: cd.start,
      level: levelFor(cd.minutesLeft, settings.leave_warn_minutes),
    };
  }
  const next = events
    .filter((e) => !e.all_day && new Date(e.start) > now && new Date(e.start).toDateString() === now.toDateString())
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  if (!next) {
    return { kind: 'none', title: 'Nothing else today', minutes: 0, target: null, fraction: 0, start: null, level: 'ok' };
  }
  const target = new Date(next.start);
  const minutes = (target.getTime() - now.getTime()) / 60_000;
  return {
    kind: 'event',
    title: `Next: ${next.title}`,
    minutes,
    target,
    fraction: Math.max(0, 1 - minutes / EVENT_WINDOW_MIN),
    start: null,
    level: levelFor(minutes, settings.leave_warn_minutes),
  };
}

/** Ring colour: green with plenty of time, through yellow, to red at zero. */
export function ringColour(fraction: number): string {
  return `hsl(${Math.round(120 * (1 - fraction))} 80% 48%)`;
}
