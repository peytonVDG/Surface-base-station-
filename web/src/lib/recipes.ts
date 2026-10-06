// Turns a recipe note (Markdown with a little front matter, as written in Obsidian)
// into something cook mode can use: scalable ingredients and steps with timers.

export interface RecipeFile {
  id: string;
  markdown: string;
  photo: string | null;
  cooked: string[];
}

export interface Ingredient {
  raw: string;
  qty: number | null; // null: "a pinch", "to serve", headings...
  qtyMax: number | null; // top of a range like "2-3"
  rest: string; // everything after the number
}

export interface StepTimer {
  seconds: number;
  label: string; // the words that matched, e.g. "20 minutes"
}

export interface Step {
  text: string;
  timers: StepTimer[];
}

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  minutes: number | null;
  timeText: string;
  rating: number | null;
  tags: string[];
  photo: string | null;
  cooked: string[];
  ingredients: Ingredient[];
  steps: Step[];
  notes: string;
  ingredientText: string; // lowercased, for search
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

/** Reads one number: "2", "1.5", "1/2", "1 1/2", "1½", "½". Returns it and how much text it used. */
function readNumber(s: string): { value: number; len: number } | null {
  const F = '½⅓⅔¼¾⅛⅜⅝⅞';
  const m = new RegExp(`^(?:(\\d+)\\s+(\\d+)\\/(\\d+)|(\\d+)\\/(\\d+)|(\\d+(?:\\.\\d+)?)\\s?([${F}])?|([${F}]))`).exec(s);
  if (!m) return null;
  let value: number;
  if (m[1] !== undefined) value = Number(m[1]) + Number(m[2]) / Number(m[3]);
  else if (m[4] !== undefined) value = Number(m[4]) / Number(m[5]);
  else if (m[6] !== undefined) value = parseFloat(m[6]) + (m[7] ? FRACTIONS[m[7]] : 0);
  else value = FRACTIONS[m[8]];
  return Number.isFinite(value) ? { value, len: m[0].length } : null;
}

export function parseIngredient(raw: string): Ingredient {
  const text = raw.trim();
  const a = readNumber(text);
  if (!a) return { raw: text, qty: null, qtyMax: null, rest: text };
  let rest = text.slice(a.len);
  let qtyMax: number | null = null;
  const range = /^\s*(?:-|–|to)\s*/.exec(rest);
  if (range) {
    const b = readNumber(rest.slice(range[0].length));
    if (b && b.value > a.value) {
      qtyMax = b.value;
      rest = rest.slice(range[0].length + b.len);
    }
  }
  return { raw: text, qty: a.value, qtyMax, rest: rest.replace(/^\s+/, '') };
}

const NICE: [number, string][] = [
  [0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, ''],
];

/** 1.5 -> "1½", 0.33 -> "⅓", 12 -> "12". Quantities over 10 round to whole numbers. */
export function formatQty(n: number): string {
  if (n >= 10) return String(Math.round(n));
  let whole = Math.floor(n);
  const frac = n - whole;
  let best = NICE[0];
  for (const f of NICE) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  if (best[0] === 1) whole += 1;
  if (whole === 0 && best[1] === '') return String(Math.round(n * 100) / 100); // tiny amounts stay readable
  return `${whole || ''}${best[1]}`;
}

export function scaleIngredient(ing: Ingredient, factor: number): string {
  if (ing.qty === null) return ing.raw;
  const q = formatQty(ing.qty * factor);
  const range = ing.qtyMax !== null ? `–${formatQty(ing.qtyMax * factor)}` : '';
  return `${q}${range} ${ing.rest}`.trim();
}

const UNITS = { h: 3600, m: 60, s: 1 } as const;
const unitKey = (u: string) => (u[0].toLowerCase() as keyof typeof UNITS);

/** Finds "20 minutes", "1 hour 30 minutes", "8-10 min", "half an hour" in a step (a range uses its top). */
export function findTimers(text: string): StepTimer[] {
  const out: StepTimer[] = [];
  const re =
    /(half an hour)|(?:(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b(?:\s*(?:and\s*)?(\d+)\s*(minutes?|mins?)\b)?)/gi;
  for (const m of text.matchAll(re)) {
    if (m[1]) {
      out.push({ seconds: 1800, label: m[0] });
      continue;
    }
    const n = parseFloat(m[3] ?? m[2]);
    let seconds = n * UNITS[unitKey(m[4])];
    if (m[5]) seconds += Number(m[5]) * 60;
    if (seconds >= 1) out.push({ seconds: Math.round(seconds), label: m[0] });
  }
  return out;
}

export function describeSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h && `${h} hr`, m && `${m} min`, s && !h && `${s} sec`].filter(Boolean).join(' ') || '0 sec';
}

function frontMatter(md: string): { meta: Record<string, string | string[]>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(md);
  if (!m) return { meta: {}, body: md };
  const meta: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      (meta[listKey] as string[]).push(item[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = /^([A-Za-z_][\w -]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const val = kv[2].trim();
    if (val === '') {
      meta[key] = [];
      listKey = key;
    } else if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      listKey = null;
    } else {
      meta[key] = val.replace(/^["']|["']$/g, '');
      listKey = null;
    }
  }
  return { meta, body: md.slice(m[0].length) };
}

/** Obsidian leftovers: [[Link|shown]] -> shown, ![[photo.jpg]] removed, **bold** and `code` flattened. */
function clean(text: string): string {
  return text
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "45 min", "1 hr 15 min", "1:30", "45" (minutes) -> minutes. */
export function parseMinutes(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const colon = /^(\d+):(\d{2})$/.exec(t);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t));
  const timers = findTimers(t);
  if (!timers.length) return null;
  return Math.round(timers.reduce((a, x) => a + x.seconds, 0) / 60);
}

const HEADING = /^#{1,6}\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;

export function parseRecipe(file: RecipeFile): Recipe {
  const { meta, body } = frontMatter(file.markdown);
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : '');
  const sections: { name: string; lines: string[] }[] = [{ name: '', lines: [] }];
  let h1 = '';
  for (const line of body.split(/\r?\n/)) {
    const h = HEADING.exec(line);
    if (h && /^#{2,6}\s/.test(line)) sections.push({ name: h[1].toLowerCase(), lines: [] });
    else if (h && !h1) h1 = clean(h[1]);
    else sections[sections.length - 1].lines.push(line);
  }
  const find = (re: RegExp) => sections.find((s) => re.test(s.name));
  const items = (s?: { lines: string[] }) => (s?.lines ?? []).map((l) => BULLET.exec(l)?.[1]).filter((x): x is string => !!x).map(clean).filter(Boolean);

  const ingredients = items(find(/ingredient/)).map(parseIngredient);
  const stepSection = find(/^(steps?|directions?|instructions?|method|preparation)/);
  let stepTexts = items(stepSection);
  if (!stepTexts.length && stepSection) {
    // Steps written as plain paragraphs
    stepTexts = stepSection.lines.join('\n').split(/\n\s*\n/).map(clean).filter(Boolean);
  }
  const steps = stepTexts.map((text) => ({ text, timers: findTimers(text) }));
  const notes = clean((find(/^notes?/)?.lines ?? []).join(' '));

  const servings = parseInt(str('servings') || str('serves') || str('yield'), 10);
  const rating = parseFloat(str('rating'));
  const timeText = str('time') || str('total time') || str('total_time');
  const tags = (Array.isArray(meta.tags) ? meta.tags : str('tags').split(/[ ,]+/)).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);

  return {
    id: file.id,
    title: str('title') || h1 || file.id.split('/').pop()!.replace(/[-_]+/g, ' '),
    servings: servings > 0 ? servings : 4,
    minutes: parseMinutes(timeText),
    timeText,
    rating: rating > 0 ? Math.min(5, rating) : null,
    tags,
    photo: file.photo,
    cooked: file.cooked,
    ingredients,
    steps,
    notes,
    ingredientText: ingredients.map((i) => i.raw.toLowerCase()).join(' | '),
  };
}

export type CookbookSort = 'name' | 'rating' | 'time' | 'recent';

export interface CookbookFilter {
  query: string;
  tag: string | null; // null: all
  sort: CookbookSort;
}

/** Search matches the name, tags or any ingredient ("chicken" finds soups with chicken in them). */
export function filterRecipes(all: Recipe[], f: CookbookFilter): Recipe[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = all.filter(
    (r) =>
      (!f.tag || r.tags.includes(f.tag)) &&
      words.every((w) => r.title.toLowerCase().includes(w) || r.tags.some((t) => t.includes(w)) || r.ingredientText.includes(w)),
  );
  const last = (r: Recipe) => r.cooked.reduce((a, d) => (d > a ? d : a), '');
  const by: Record<CookbookSort, (a: Recipe, b: Recipe) => number> = {
    name: (a, b) => a.title.localeCompare(b.title),
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title),
    time: (a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999) || a.title.localeCompare(b.title),
    recent: (a, b) => last(b).localeCompare(last(a)) || a.title.localeCompare(b.title),
  };
  return out.sort(by[f.sort]);
}

export function allTags(all: Recipe[]): string[] {
  const count = new Map<string, number>();
  for (const r of all) for (const t of r.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export function formatMinutes(m: number | null, fallback = ''): string {
  if (m === null) return fallback;
  const h = Math.floor(m / 60);
  return h ? `${h} hr${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
}
