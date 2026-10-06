import { demoApi } from './demo';
import type { Brief, Calendar, ClientConfig, DeepPartial, Settings, Todos, Weather } from './types';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} /api/${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

const serverApi = {
  config: () => call<ClientConfig>('GET', 'config'),
  weather: () => call<Weather>('GET', 'weather'),
  calendar: () => call<Calendar>('GET', 'calendar'),
  todos: () => call<Todos>('GET', 'todos'),
  setTodoDone: (id: string, done: boolean) => call<Todos>('PATCH', `todos/${encodeURIComponent(id)}`, { done }),
  brief: () => call<Brief>('GET', 'brief'),
  settings: () => call<Settings>('GET', 'settings'),
  patchSettings: (patch: DeepPartial<Settings>) => call<Settings>('PATCH', 'settings', patch),
  backlight: (percent: number) => call<{ hardware: boolean }>('PUT', 'backlight', { percent }),
};

// The demo build (npm run build:demo) runs with no backend, on sample data.
export const api: typeof serverApi = import.meta.env.VITE_DEMO ? demoApi : serverApi;

/** Calls `load` now and every `minutes`, keeping the last good value if a call fails. */
export function poll<T>(load: () => Promise<T>, minutes: number, onData: (value: T) => void): () => void {
  let stopped = false;
  const run = () =>
    load()
      .then((v) => !stopped && onData(v))
      .catch((e) => console.warn(e));
  run();
  const id = setInterval(run, minutes * 60_000);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}
