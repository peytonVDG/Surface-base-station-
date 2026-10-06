import { describe, expect, it } from 'vitest';
import { leaveInfo, levelFor } from './leave';
import { DEFAULT_SETTINGS } from './defaults';
import type { CalendarEvent } from './types';

const ev = (title: string, start: string, all_day = false): CalendarEvent => ({
  id: title, title, start, end: start, all_day, color: '#000', location: '',
});

describe('leaveInfo', () => {
  it('counts down to work on weekday mornings', () => {
    const info = leaveInfo(new Date('2026-10-06T05:50:00'), DEFAULT_SETTINGS, [], false);
    expect(info.kind).toBe('work');
    expect(info.minutes).toBeCloseTo(20);
    expect(info.level).toBe('soon');
  });

  it('falls back to the next timed event today', () => {
    const events = [
      ev('Past', '2026-10-06T09:00:00'),
      ev('All day', '2026-10-06T00:00:00', true),
      ev('Dentist', '2026-10-06T16:30:00'),
      ev('Tomorrow', '2026-10-07T08:00:00'),
    ];
    const info = leaveInfo(new Date('2026-10-06T15:30:00'), DEFAULT_SETTINGS, events, false);
    expect(info.kind).toBe('event');
    expect(info.title).toBe('Next: Dentist');
    expect(info.minutes).toBeCloseTo(60);
    expect(leaveInfo(new Date('2026-10-06T17:00:00'), DEFAULT_SETTINGS, events, false).kind).toBe('none');
  });
});

describe('levelFor', () => {
  it('goes amber at the warning and red in the last 10 minutes', () => {
    expect(levelFor(25, 20)).toBe('ok');
    expect(levelFor(20, 20)).toBe('soon');
    expect(levelFor(9, 20)).toBe('late');
  });
});
