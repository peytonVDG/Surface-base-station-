import { describe, expect, it } from 'vitest';
import { addTime, clock, newTimer, parseStored, remaining, tickTimers } from './timers';

describe('timers', () => {
  const t0 = 1_000_000;
  it('counts down and rings when time is up', () => {
    const t = newTimer(90, 'Rice', t0);
    expect(remaining(t, t0)).toBe(90);
    expect(remaining(t, t0 + 89_100)).toBe(1);
    const [done] = tickTimers([t], t0 + 90_000);
    expect(done.ringing).toBe(true);
    expect(remaining(done, t0 + 95_000)).toBe(0);
  });
  it('leaves the list alone when nothing is due', () => {
    const list = [newTimer(60, 'a', t0)];
    expect(tickTimers(list, t0 + 1000)).toBe(list);
  });
  it('adding a minute to a ringing timer restarts it from now', () => {
    const [ringing] = tickTimers([newTimer(60, 'a', t0)], t0 + 70_000);
    const [again] = addTime([ringing], ringing.id, 60, t0 + 70_000);
    expect(again.ringing).toBe(false);
    expect(remaining(again, t0 + 70_000)).toBe(60);
  });
  it('adding a minute to a running timer extends it', () => {
    const t = newTimer(60, 'a', t0);
    expect(remaining(addTime([t], t.id, 60, t0 + 10_000)[0], t0 + 10_000)).toBe(110);
  });
  it('formats clocks and survives bad storage', () => {
    expect(clock(272)).toBe('4:32');
    expect(clock(3900)).toBe('1:05:00');
    expect(parseStored('nonsense')).toEqual([]);
    expect(parseStored('[{"id":"x"},{"id":"y","endsAt":1,"total":2}]')).toHaveLength(1);
  });
});
