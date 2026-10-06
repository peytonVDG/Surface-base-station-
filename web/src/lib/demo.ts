// Backend-free stand-in for the API, used by the phone/browser demo build
// (`npm run build:demo`). Same sample data as server/kitchen/providers/samples.py,
// with settings kept in memory (and localStorage when allowed).

import { DEFAULT_SETTINGS } from './defaults';
import type { Brief, Calendar, ClientConfig, Condition, DeepPartial, Settings, Todos, Weather } from './types';

const MIDDLEVILLE = { latitude: 42.71, longitude: -85.46, location_name: 'Middleville' };

function todayAt(h: number, m = 0, days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function weather(): Weather {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  const temps = [14.5, 15, 15.5, 15, 14, 13, 12, 11.5, 11, 10.5, 10, 9.5];
  const conds: Condition[] = ['partly', 'partly', 'cloudy', 'cloudy', 'rain', 'rain', 'cloudy', 'partly', 'clear', 'clear', 'clear', 'clear'];
  return {
    status: 'sample',
    updated_at: new Date().toISOString(),
    location_name: MIDDLEVILLE.location_name,
    current: { temp_c: 14, condition: 'partly', code: 2, cloud_cover: 45, precip_mm: 0, wind_kph: 9, is_day: true },
    today: { high_c: 17, low_c: 8, sunrise: todayAt(7, 45), sunset: todayAt(19, 10) },
    hourly: temps.map((t, i) => ({
      time: new Date(base.getTime() + (i + 1) * 3_600_000).toISOString(),
      temp_c: t,
      condition: conds[i],
      precip_prob: conds[i] === 'rain' ? 60 : 10,
    })),
  };
}

function calendar(): Calendar {
  const rows: [string, string, number, number, number, string, string, number][] = [
    ['standup', 'Team standup', 8, 30, 15, '#2f6db5', '', 0],
    ['lunch', 'Lunch with Sam', 12, 0, 60, '#3f8f4f', 'Cafe Rio', 0],
    ['dentist', 'Dentist', 15, 30, 45, '#c8102e', 'Bright Smiles Dental', 0],
    ['soccer', 'Soccer pickup', 18, 30, 30, '#e3a400', 'Riverside Park', 0],
    ['car', 'Car service', 9, 0, 60, '#7e57c2', 'Main St Auto', 1],
    ['book', 'Book club', 19, 0, 90, '#2f6db5', '', 1],
  ];
  return {
    status: 'sample',
    events: rows.map(([id, title, h, m, dur, color, location, days]) => {
      const start = todayAt(h, m, days);
      return { id, title, start, end: new Date(Date.parse(start) + dur * 60_000).toISOString(), all_day: false, color, location };
    }),
  };
}

let todos: Todos = {
  status: 'sample',
  items: [
    { id: '1', title: 'Take the trash out', due: todayAt(20), overdue: false, done: false },
    { id: '2', title: 'Pick up limes', due: null, overdue: false, done: false },
    { id: '3', title: 'Call the vet', due: todayAt(9, 0, -1), overdue: true, done: false },
    { id: '4', title: 'Flu shots', due: null, overdue: false, done: true },
    { id: '5', title: 'Water the plants', due: null, overdue: false, done: false },
  ],
};

const KEY = 'kitchen-demo-settings';
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(structuredClone(DEFAULT_SETTINGS), JSON.parse(raw));
  } catch {
    /* storage blocked: use defaults */
  }
  return structuredClone(DEFAULT_SETTINGS);
}
let settings = loadSettings();

function merge<T extends object>(base: T, patch: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' ? merge(cur as object, v as object) : v;
  }
  return out as T;
}

const ok = <T>(v: T) => Promise.resolve(structuredClone(v));

export const demoApi = {
  config: () => ok<ClientConfig>({ ...MIDDLEVILLE, hardware_backlight: false }),
  weather: () => ok(weather()),
  calendar: () => ok(calendar()),
  todos: () => ok(todos),
  setTodoDone: (id: string, done: boolean) => {
    todos = { ...todos, items: todos.items.map((t) => (t.id === id ? { ...t, done } : t)) };
    return ok(todos);
  },
  brief: () => ok<Brief>({ status: 'sample', url: '', updated_at: null }),
  settings: () => ok(settings),
  patchSettings: (patch: DeepPartial<Settings>) => {
    settings = merge(settings, patch);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* fine: settings just won't survive a reload */
    }
    return ok(settings);
  },
  backlight: () => ok({ hardware: false }),
};
