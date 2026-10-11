import { demoApi } from './demo';
import type { Brief, FolderListing, RecipeFile, RecipeFolders, Recipes, Calendar, ClientConfig, Connections, DeepPartial, Settings, Todos, Weather } from './types';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    // The backend explains what went wrong in plain words (a 400): show those.
    const detail = res.status === 400 ? await res.json().then((j) => j.detail, () => null) : null;
    throw new Error(typeof detail === 'string' ? detail : `${method} /api/${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const serverApi = {
  config: () => call<ClientConfig>('GET', 'config'),
  weather: () => call<Weather>('GET', 'weather'),
  calendar: () => call<Calendar>('GET', 'calendar'),
  todos: () => call<Todos>('GET', 'todos'),
  setTodoDone: (id: string, done: boolean) => call<Todos>('PATCH', `todos/${encodeURIComponent(id)}`, { done }),
  brief: () => call<Brief>('GET', 'brief'),
  recipes: () => call<Recipes>('GET', 'recipes'),
  markCooked: (id: string) => call<string[]>('POST', `recipes/cooked?id=${encodeURIComponent(id)}`),
  saveRecipe: (id: string, markdown: string) => call<RecipeFile>('PUT', `recipes?id=${encodeURIComponent(id)}`, { markdown }),
  createRecipe: (title: string, folder?: string) => call<RecipeFile>('POST', 'recipes', { title, folder }),
  deleteRecipe: (id: string) => call<Recipes>('DELETE', `recipes?id=${encodeURIComponent(id)}`),
  recipeFolders: () => call<RecipeFolders>('GET', 'recipes/folders'),
  addRecipeFolder: (path: string, create = false) => call<RecipeFolders>('POST', 'recipes/folders', { path, create }),
  removeRecipeFolder: (path: string) => call<RecipeFolders>('DELETE', `recipes/folders?path=${encodeURIComponent(path)}`),
  browseFolders: (path = '') => call<FolderListing>('GET', `folders?path=${encodeURIComponent(path)}`),
  connections: () => call<Connections>('GET', 'connections'),
  connectTodoist: (token: string) => call<Connections>('PUT', 'connections/todoist', { token }),
  disconnectTodoist: () => call<Connections>('DELETE', 'connections/todoist'),
  setGoogleClient: (client_id: string, client_secret: string) =>
    call<Connections>('PUT', 'connections/google/client', { client_id, client_secret }),
  disconnectGoogle: () => call<Connections>('DELETE', 'connections/google'),
  pickKeepList: (link: string, name: string) => call<Connections>('PUT', 'connections/keep', { link, name }),
  forgetKeepList: () => call<Connections>('DELETE', 'connections/keep'),
  /** Where the Groceries button goes: the backend redirects to the picked Keep list. */
  groceriesUrl: '/api/groceries/open',
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
