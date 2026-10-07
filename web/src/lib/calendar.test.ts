import { describe, expect, it } from 'vitest';
import { todaysEvents } from './calendar';
import type { CalendarEvent } from './types';

const ev = (id: string, start: string, end: string, all_day = false): CalendarEvent => ({
  id, title: id, start, end, all_day, color: '#000', location: '',
});

const busyDay = [
  ev('holiday', '2026-10-07T00:00:00', '2026-10-08T00:00:00', true),
  ...[8, 9, 10, 11, 13, 15, 17].map((h) => ev(`at${h}`, `2026-10-07T${String(h).padStart(2, '0')}:00:00`, `2026-10-07T${String(h).padStart(2, '0')}:30:00`)),
  ev('tomorrow', '2026-10-08T09:00:00', '2026-10-08T10:00:00'),
];

describe('todaysEvents', () => {
  it('shows every event of a light day, past ones included', () => {
    const day = busyDay.slice(0, 4);
    expect(todaysEvents(day, new Date('2026-10-07T12:00:00')).map((e) => e.id)).toEqual(['holiday', 'at8', 'at9', 'at10']);
  });

  it('drops finished events first on a busy afternoon so upcoming ones stay visible', () => {
    const ids = todaysEvents(busyDay, new Date('2026-10-07T14:00:00')).map((e) => e.id);
    expect(ids).toEqual(['holiday', 'at11', 'at13', 'at15', 'at17']);
  });

  it('keeps the earliest events in the morning', () => {
    const ids = todaysEvents(busyDay, new Date('2026-10-07T06:00:00')).map((e) => e.id);
    expect(ids).toEqual(['holiday', 'at8', 'at9', 'at10', 'at11']);
  });

  it('includes an all-day event that started yesterday', () => {
    const trip = ev('trip', '2026-10-06T00:00:00', '2026-10-09T00:00:00', true);
    expect(todaysEvents([trip], new Date('2026-10-07T12:00:00')).map((e) => e.id)).toEqual(['trip']);
  });
});
