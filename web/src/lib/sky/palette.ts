// Sky colours as a smooth function of the sun's real height and the weather.
// Keyframes are indexed by solar altitude in degrees, so dawn and dusk land at
// the real times and drift with the seasons. "Rising" picks the cooler dawn or
// warmer dusk variant around the horizon.

import type { Condition } from '../types';

type RGB = [number, number, number];
type Stops = [string, string, string]; // top, middle, horizon
type Frame = [alt: number, rising: Stops, setting: Stops];

const CLEAR: Frame[] = [
  [-18, ['#060a1d', '#121d44', '#22305c'], ['#060a1d', '#121d44', '#22305c']],
  [-10, ['#0a1130', '#1d2756', '#3f3d6b'], ['#0b1030', '#22265a', '#4a3a68']],
  [-4, ['#2c3570', '#8a6a96', '#e59a8a'], ['#28295c', '#b0547a', '#f39858']],
  [2, ['#4b5a8f', '#e7a0a6', '#ffd2a0'], ['#3e4f8c', '#d9808a', '#ffb377']],
  [10, ['#3a7dc8', '#8cbde6', '#e2eef5'], ['#3a7dc8', '#9cc2e2', '#f2e2c8']],
  [25, ['#3a8bd6', '#86c3ee', '#d6ecf9'], ['#3a8bd6', '#86c3ee', '#d6ecf9']],
];

const OVERCAST: Frame[] = [
  [-18, ['#0c0f17', '#161a25', '#212737'], ['#0c0f17', '#161a25', '#212737']],
  [-4, ['#2f3245', '#5a5668', '#7e7178'], ['#3c3f55', '#746c7c', '#9c8786']],
  [2, ['#666c80', '#a29ca6', '#c8beb8'], ['#5e6478', '#958c98', '#bfa9a2']],
  [10, ['#7b8796', '#a8b2be', '#cbd3db'], ['#7b8796', '#a8b2be', '#cbd3db']],
];

const CLOUD_CLEAR: [number, string][] = [[-18, '#2f3858'], [-6, '#4a4f72'], [-2, '#f3b2a4'], [3, '#ffd9c9'], [12, '#ffffff']];
const CLOUD_OVERCAST: [number, string][] = [[-18, '#1d2231'], [-4, '#5e5b6b'], [3, '#8c909b'], [12, '#a9b1bc']];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function rgb(c: RGB): string {
  return `rgb(${c.map(Math.round).join(',')})`;
}

/** Piecewise-linear blend between keyframes indexed by altitude. */
function sample(alts: number[], values: RGB[][], alt: number): RGB[] {
  if (alt <= alts[0]) return values[0];
  for (let i = 1; i < alts.length; i++) {
    if (alt <= alts[i]) {
      const t = (alt - alts[i - 1]) / (alts[i] - alts[i - 1]);
      return values[i - 1].map((c, k) => mixRgb(c, values[i][k], t));
    }
  }
  return values[values.length - 1];
}

function stopsAt(frames: Frame[], alt: number, rising: boolean): RGB[] {
  return sample(
    frames.map((f) => f[0]),
    frames.map((f) => (rising ? f[1] : f[2]).map(hexToRgb)),
    alt,
  );
}

function colourAt(frames: [number, string][], alt: number): RGB {
  return sample(
    frames.map((f) => f[0]),
    frames.map((f) => [hexToRgb(f[1])]),
    alt,
  )[0];
}

/** How grey the sky is, 0 (clear) to 1 (heavy overcast), from cloud cover and condition. */
export function heaviness(cloudCover: number, condition: Condition): number {
  const base = Math.min(1, Math.max(0, cloudCover / 100)) * 0.7;
  const floor = { clear: 0, partly: 0, cloudy: 0.6, fog: 0.8, rain: 0.85, storm: 0.95, snow: 0.7 }[condition];
  return Math.max(base, floor);
}

export interface SkyColours {
  stops: [string, string, string];
  cloud: string;
}

export function skyColours(sunAlt: number, rising: boolean, cloudCover: number, condition: Condition): SkyColours {
  const h = heaviness(cloudCover, condition);
  const clear = stopsAt(CLEAR, sunAlt, rising);
  const over = stopsAt(OVERCAST, sunAlt, rising);
  let stops = clear.map((c, i) => mixRgb(c, over[i], h));
  if (condition === 'storm') stops = stops.map((c) => mixRgb(c, [27, 30, 40], 0.3));
  const cloud = mixRgb(colourAt(CLOUD_CLEAR, sunAlt), colourAt(CLOUD_OVERCAST, sunAlt), h);
  return { stops: stops.map(rgb) as [string, string, string], cloud: rgb(cloud) };
}

export type Phase = 'night' | 'dawn' | 'day' | 'dusk';

/** Coarse phase for things that switch rather than blend (grass tint, Snoopy asleep, dark cards). */
export function phaseFor(sunAlt: number, rising: boolean): Phase {
  if (sunAlt < -6) return 'night';
  if (sunAlt < 8) return rising ? 'dawn' : 'dusk';
  return 'day';
}
