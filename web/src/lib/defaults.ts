// Mirrors the defaults in server/kitchen/settings.py; used until the backend answers.

import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  brightness: 100,
  animations: 'full',
  look: 'auto',
  clock_24h: false,
  show_seconds: false,
  temp_unit: 'F',
  leave_warn_minutes: 20,
  countdown_ring: true,
  hold_clock_for_settings: true,
  volume: 60,
  mic_muted: false,
  schedule: {
    weekday_wake: '04:30',
    leave_for_work: '06:10',
    back_from_work: '15:00',
    sleep_at: '00:00',
    weekend_wake: '07:00',
    workdays: [1, 2, 3, 4, 5],
    sleep_during_work: true,
    nap_minutes: 2,
  },
};
