import { describe, expect, it } from 'vitest';
import { isDayOff, morningCountdown, scheduledMode } from './schedule';
import type { Schedule } from './types';

const S: Schedule = {
  weekday_wake: '04:30',
  leave_for_work: '06:10',
  back_from_work: '15:00',
  sleep_at: '00:00',
  weekend_wake: '07:00',
  workdays: [1, 2, 3, 4, 5],
  sleep_during_work: true,
  nap_minutes: 2,
};

// 2026-10-06 is a Tuesday, 2026-10-10 a Saturday.
const tue = (hm: string) => new Date(`2026-10-06T${hm}:00`);
const sat = (hm: string) => new Date(`2026-10-10T${hm}:00`);

describe('scheduledMode', () => {
  it('follows the weekday day', () => {
    expect(scheduledMode(tue('00:10'), S)).toBe('sleep');
    expect(scheduledMode(tue('04:29'), S)).toBe('sleep');
    expect(scheduledMode(tue('04:30'), S)).toBe('awake');
    expect(scheduledMode(tue('06:09'), S)).toBe('awake');
    expect(scheduledMode(tue('06:10'), S)).toBe('sleep');
    expect(scheduledMode(tue('14:59'), S)).toBe('sleep');
    expect(scheduledMode(tue('15:00'), S)).toBe('awake');
    expect(scheduledMode(tue('23:59'), S)).toBe('awake');
  });

  it('wakes later and stays up on weekends', () => {
    expect(scheduledMode(sat('06:00'), S)).toBe('sleep');
    expect(scheduledMode(sat('07:00'), S)).toBe('awake');
    expect(scheduledMode(sat('10:00'), S)).toBe('awake');
  });

  it('treats a day off like a weekend', () => {
    expect(scheduledMode(tue('10:00'), S, true)).toBe('awake');
    expect(scheduledMode(tue('05:00'), S, true)).toBe('sleep');
  });

  it('respects turning off the daytime sleep', () => {
    expect(scheduledMode(tue('10:00'), { ...S, sleep_during_work: false })).toBe('awake');
  });

  it('handles a bedtime before midnight', () => {
    const early = { ...S, sleep_at: '22:30' };
    expect(scheduledMode(tue('22:29'), early)).toBe('awake');
    expect(scheduledMode(tue('22:30'), early)).toBe('sleep');
    expect(scheduledMode(tue('02:00'), early)).toBe('sleep');
  });
});

describe('morningCountdown', () => {
  it('runs from wake to leave on workdays', () => {
    expect(morningCountdown(tue('04:29'), S)).toBeNull();
    const c = morningCountdown(tue('05:20'), S)!;
    expect(c.fraction).toBeCloseTo(0.5);
    expect(c.minutesLeft).toBeCloseTo(50);
    expect(morningCountdown(tue('06:10'), S)).toBeNull();
    expect(morningCountdown(sat('05:20'), S)).toBeNull();
    expect(morningCountdown(tue('05:20'), S, true)).toBeNull();
  });
});

describe('isDayOff', () => {
  it('spots an all-day PTO event today', () => {
    const ev = (title: string, all_day = true) => ({
      id: '1', title, all_day, color: '', location: '',
      start: '2026-10-06T00:00:00', end: '2026-10-07T00:00:00',
    });
    expect(isDayOff([ev('PTO')], tue('09:00'))).toBe(true);
    expect(isDayOff([ev('Day off')], tue('09:00'))).toBe(true);
    expect(isDayOff([ev('Office party')], tue('09:00'))).toBe(false);
    expect(isDayOff([ev('PTO', false)], tue('09:00'))).toBe(false);
  });
});
