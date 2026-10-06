// The photo bank: built-in placeholder pictures (public/photos/manifest.json, drawn by
// scripts/make-stock-photos.mjs) plus anything in the device's photos folder.

import { api } from './api';
import type { Photo } from './types';

const base = import.meta.env.BASE_URL;

export async function loadPhotos(): Promise<Photo[]> {
  const [stock, mine] = await Promise.all([
    fetch(`${base}photos/manifest.json`)
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((m: { photos: (Photo & { file: string })[] }) => m.photos.map((p) => ({ ...p, url: `${base}photos/${p.file}` })))
      .catch(() => [] as Photo[]),
    api.photos().then((r) => r.photos).catch(() => [] as Photo[]),
  ]);
  return [...mine, ...stock];
}

/** Category names in first-seen order, with the device's own folders first. */
export function categories(photos: Photo[]): string[] {
  return [...new Set(photos.map((p) => p.category))];
}
