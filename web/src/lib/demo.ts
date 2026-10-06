// Backend-free stand-in for the API, used by the phone/browser builds
// (`npm run build:demo`, `npm run build:pages`). Same sample data as
// server/kitchen/providers/samples.py, with settings kept in memory (and
// localStorage when allowed). The Pages build fetches live weather straight
// from Open-Meteo, which allows calls from any web page and needs no key.

import { DEFAULT_SETTINGS } from './defaults';
import type { Brief, Calendar, ClientConfig, Connections, Photo, Condition, DeepPartial, Settings, Todos, Weather } from './types';

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

/** Same collapse of WMO codes as server/kitchen/providers/weather.py. */
export function conditionFor(code: number): Condition {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloudy';
}

let lastLive: Weather | null = null;

async function liveWeather(): Promise<Weather> {
  const q = new URLSearchParams({
    latitude: String(MIDDLEVILLE.latitude),
    longitude: String(MIDDLEVILLE.longitude),
    current: 'temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '2',
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const d = await res.json();
    const iso = (s: number) => new Date(s * 1000).toISOString();
    const now = Date.now() / 1000;
    const hourly = (d.hourly.time as number[])
      .map((t, i) => ({
        time: iso(t),
        temp_c: d.hourly.temperature_2m[i],
        condition: conditionFor(d.hourly.weather_code[i]),
        precip_prob: d.hourly.precipitation_probability[i],
        t,
      }))
      .filter((h) => h.t > now)
      .slice(0, 12)
      .map(({ t: _t, ...h }) => h);
    lastLive = {
      status: 'live',
      updated_at: new Date().toISOString(),
      location_name: MIDDLEVILLE.location_name,
      current: {
        temp_c: d.current.temperature_2m,
        condition: conditionFor(d.current.weather_code),
        code: d.current.weather_code,
        cloud_cover: d.current.cloud_cover,
        precip_mm: d.current.precipitation,
        wind_kph: d.current.wind_speed_10m,
        is_day: Boolean(d.current.is_day),
      },
      today: {
        high_c: d.daily.temperature_2m_max[0],
        low_c: d.daily.temperature_2m_min[0],
        sunrise: iso(d.daily.sunrise[0]),
        sunset: iso(d.daily.sunset[0]),
      },
      hourly,
    };
    return lastLive;
  } catch (e) {
    console.warn(e);
    return lastLive ? { ...lastLive, status: 'stale' } : weather();
  }
}

function calendar(): Calendar {
  const rows: [string, string, number, number, number, string, string, number][] = [
    ['standup', 'Team standup', 8, 30, 15, '#039be5', '', 0],
    ['lunch', 'Lunch with Sam', 12, 0, 60, '#33b679', 'Cafe Rio', 0],
    ['dentist', 'Dentist', 15, 30, 45, '#d50000', 'Bright Smiles Dental', 0],
    ['soccer', 'Soccer pickup', 18, 30, 30, '#f6bf26', 'Riverside Park', 0],
    ['car', 'Car service', 9, 0, 60, '#8e24aa', 'Main St Auto', 1],
    ['book', 'Book club', 19, 0, 90, '#039be5', '', 1],
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
    { id: '1', title: 'Take the trash out', due: todayAt(20), overdue: false, done: false, priority: 3 },
    { id: '2', title: 'Pick up limes', due: null, overdue: false, done: false, priority: 4 },
    { id: '3', title: 'Call the vet', due: todayAt(9, 0, -1), overdue: true, done: false, priority: 1 },
    { id: '4', title: 'Flu shots', due: null, overdue: false, done: true, priority: 4 },
    { id: '5', title: 'Water the plants', due: null, overdue: false, done: false, priority: 2 },
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
  weather: () => (import.meta.env.VITE_LIVE_WEATHER ? liveWeather() : ok(weather())),
  calendar: () => ok(calendar()),
  todos: () => ok(todos),
  setTodoDone: (id: string, done: boolean) => {
    todos = { ...todos, items: todos.items.map((t) => (t.id === id ? { ...t, done } : t)) };
    return ok(todos);
  },
  brief: () => ok<Brief>({ status: 'sample', url: '', updated_at: null }),
  photos: () => ok<{ photos: Photo[] }>({ photos: [] }),
  // The public builds never hold anyone's accounts: sign-in only exists on the device.
  connections: () => ok<Connections>({ todoist: { connected: false }, google: { connected: false, ready: false } }),
  connectTodoist: () => Promise.reject(new Error('Sign-in only works on the display itself')),
  disconnectTodoist: () => demoApi.connections(),
  setGoogleClient: () => Promise.reject(new Error('Sign-in only works on the display itself')),
  disconnectGoogle: () => demoApi.connections(),
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
