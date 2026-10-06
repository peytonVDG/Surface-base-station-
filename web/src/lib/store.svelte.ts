// App-wide reactive state. Data comes from the backend on a poll; settings are
// patched optimistically and saved through the API.

import { api, poll } from './api';
import { DEFAULT_SETTINGS } from './defaults';
import type { Brief, Calendar, ClientConfig, DeepPartial, Settings, Todos, Weather } from './types';

// Dev/testing overrides: ?at=2026-10-06T05:20 runs the clock from that moment,
// ?wx=rain forces the weather (clear, partly, cloudy, fog, rain, storm, snow).
const params = new URLSearchParams(location.search);
const atParam = params.get('at');
const clockOffset = atParam && !isNaN(Date.parse(atParam)) ? Date.parse(atParam) - Date.now() : 0;
export const forcedCondition = params.get('wx');
const clockNow = () => new Date(Date.now() + clockOffset);

export const app = $state({
  now: clockNow(),
  settings: structuredClone(DEFAULT_SETTINGS) as Settings,
  config: null as ClientConfig | null,
  weather: null as Weather | null,
  calendar: null as Calendar | null,
  todos: null as Todos | null,
  brief: null as Brief | null,
  offline: false,
});

function merge<T extends object>(base: T, patch: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' ? merge(cur as object, v as object) : v;
  }
  return out as T;
}

export async function updateSettings(patch: DeepPartial<Settings>): Promise<void> {
  const before = app.settings;
  app.settings = merge(before, patch);
  try {
    app.settings = await api.patchSettings(patch);
  } catch (e) {
    console.warn(e);
    app.settings = before;
  }
}

export async function setTodoDone(id: string, done: boolean): Promise<void> {
  if (!app.todos) return;
  const before = app.todos;
  app.todos = { ...before, items: before.items.map((t) => (t.id === id ? { ...t, done } : t)) };
  try {
    app.todos = await api.setTodoDone(id, done);
  } catch (e) {
    console.warn(e);
    app.todos = before;
  }
}

/** Start the clock and data polling. Returns a cleanup function. */
export function startStore(): () => void {
  const tick = setInterval(() => (app.now = clockNow()), 1000);
  const tracked = <T>(load: () => Promise<T>) => () =>
    load().then(
      (v) => ((app.offline = false), v),
      (e) => {
        app.offline = true;
        throw e;
      },
    );
  api.config().then((c) => (app.config = c)).catch(console.warn);
  api.settings().then((s) => (app.settings = s)).catch(console.warn);
  const stops = [
    poll(tracked(api.weather), 5, (w) => (app.weather = w)),
    poll(tracked(api.calendar), 5, (c) => (app.calendar = c)),
    poll(tracked(api.todos), 2, (t) => (app.todos = t)),
    poll(tracked(api.brief), 30, (b) => (app.brief = b)),
  ];
  return () => {
    clearInterval(tick);
    stops.forEach((s) => s());
  };
}
