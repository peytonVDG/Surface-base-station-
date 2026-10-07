import { sameDay } from './format';
import type { CalendarEvent } from './types';

/**
 * Today's events for the calendar card, at most `max` of them. On a busy day the
 * events that are already over are dropped first, so the rest of the day stays in view.
 */
export function todaysEvents(events: CalendarEvent[], now: Date, max = 5): CalendarEvent[] {
  const today = events.filter((e) => sameDay(new Date(e.start), now) || (e.all_day && new Date(e.start) <= now && now < new Date(e.end)));
  let extra = today.length - max;
  if (extra <= 0) return today;
  return today
    .filter((e) => {
      if (extra > 0 && !e.all_day && new Date(e.end) <= now) {
        extra--;
        return false;
      }
      return true;
    })
    .slice(0, max);
}
