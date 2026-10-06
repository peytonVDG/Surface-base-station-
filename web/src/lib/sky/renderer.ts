// Canvas sky, back to front: gradient, stars, sun or moon, clouds, rain/snow, fog.
// Frame rate is capped (30 fps normally, lower at night and in calm mode) and
// the loop stops completely when the screen sleeps.

import type { Condition } from '../types';
import type { Astro } from './astro';
import { heaviness, skyColours } from './palette';

export const W = 1368;
export const H = 912;
const HORIZON = 790; // where the grass starts

export interface SkyState {
  astro: Astro;
  condition: Condition;
  cloudCover: number; // percent
  precipMm: number; // per hour
}

export type Motion = 'full' | 'calm' | 'off';

interface Star { x: number; y: number; r: number; p: number }
interface Cloud { x: number; y: number; s: number; v: number }
interface Drop { x: number; y: number; l: number; v: number }
interface Flake { x: number; y: number; r: number; v: number; p: number }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Map a body's azimuth/altitude into the open patch of sky between the weather
 * block and the grass, so the sun or moon never sits behind the clock text.
 */
function bodyXY(az: number, alt: number): [number, number] {
  const x = 330 + clamp((az - 90) / 180, 0, 1) * 230;
  const y = HORIZON - 20 - (clamp(alt, -12, 70) / 70) * 270;
  return [x, y];
}

export class SkyRenderer {
  private ctx: CanvasRenderingContext2D;
  private state: SkyState | null = null;
  private motion: Motion = 'full';
  private stars: Star[] = Array.from({ length: 140 }, () => ({ x: rnd(0, W), y: rnd(0, 700), r: rnd(0.6, 1.8), p: rnd(0, 6.3) }));
  private clouds: Cloud[] = [];
  private drops: Drop[] = [];
  private flakes: Flake[] = [];
  private raf = 0;
  private last = 0;
  private flashUntil = 0;
  private moonCanvas = document.createElement('canvas');

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.moonCanvas.width = this.moonCanvas.height = 120;
  }

  setState(next: SkyState): void {
    const prev = this.state;
    this.state = next;
    if (!prev || prev.condition !== next.condition || Math.abs(prev.cloudCover - next.cloudCover) > 10 || Math.abs(prev.precipMm - next.precipMm) > 0.5) {
      this.seed();
    }
    if (!this.raf) this.draw(performance.now(), 0);
  }

  setMotion(motion: Motion): void {
    this.motion = motion;
  }

  start(): void {
    if (this.raf) return;
    const loop = (ts: number) => {
      this.raf = requestAnimationFrame(loop);
      const fps = this.targetFps();
      if (ts - this.last < 1000 / fps) return;
      const dt = this.last ? Math.min(0.25, (ts - this.last) / 1000) : 0;
      this.last = ts;
      this.draw(ts, dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  private targetFps(): number {
    if (this.motion === 'off') return 1 / 30; // repaint every 30 s so the light still follows the sun
    if (this.motion === 'calm') return 6;
    return this.state && this.state.astro.sunAlt < -6 ? 15 : 30;
  }

  private seed(): void {
    const s = this.state!;
    const cover = s.cloudCover / 100;
    const n = Math.round(2 + cover * 9);
    const heavy = cover > 0.6;
    this.clouds = Array.from({ length: n }, () => ({
      x: rnd(-200, W),
      y: heavy ? rnd(30, 480) : rnd(80, 400),
      s: heavy ? rnd(1.4, 2.4) : rnd(0.8, 1.3),
      v: rnd(4, 10), // px per second
    }));
    const wet = s.condition === 'rain' || s.condition === 'storm';
    const dropCount = wet ? Math.round(clamp(80 + s.precipMm * 70, 80, 420)) : 0;
    this.drops = Array.from({ length: dropCount }, () => ({ x: rnd(0, W + 100), y: rnd(-H, H), l: rnd(14, 26), v: rnd(800, 1100) }));
    const flakeCount = s.condition === 'snow' ? Math.round(clamp(90 + s.precipMm * 60, 90, 260)) : 0;
    this.flakes = Array.from({ length: flakeCount }, () => ({ x: rnd(0, W), y: rnd(-H, H), r: rnd(1.4, 4), v: rnd(35, 90), p: rnd(0, 6.3) }));
  }

  private draw(ts: number, dt: number): void {
    const s = this.state;
    if (!s) return;
    const cx = this.ctx;
    const t = ts / 1000;
    const move = this.motion === 'off' ? 0 : dt;
    const { sunAlt, rising } = s.astro;
    const col = skyColours(sunAlt, rising, s.cloudCover, s.condition);
    const heavy = heaviness(s.cloudCover, s.condition);

    const g = cx.createLinearGradient(0, 0, 0, H * 0.86);
    g.addColorStop(0, col.stops[0]);
    g.addColorStop(0.55, col.stops[1]);
    g.addColorStop(1, col.stops[2]);
    cx.globalAlpha = 1;
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);

    // Stars fade in through nautical twilight and hide behind cloud.
    const starAlpha = clamp((-sunAlt - 4) / 8, 0, 1) * (1 - heavy);
    if (starAlpha > 0.02) {
      cx.fillStyle = '#fff';
      for (const st of this.stars) {
        cx.globalAlpha = starAlpha * 0.85 * (0.55 + 0.45 * Math.sin(t * 1.3 + st.p));
        cx.beginPath();
        cx.arc(st.x, st.y, st.r, 0, 7);
        cx.fill();
      }
    }

    const through = 1 - heavy * 0.9; // how much of the sun/moon shows through cloud
    if (sunAlt > -12 && through > 0.05) this.drawSun(s.astro, through);
    if (s.astro.moonAlt > -2 && sunAlt < 6 && through > 0.05) this.drawMoon(s.astro, through);

    cx.fillStyle = col.cloud;
    cx.globalAlpha = 0.92;
    for (const k of this.clouds) {
      this.cloud(k.x, k.y, k.s);
      k.x += k.v * move;
      if (k.x > W + 260) k.x = -260;
    }
    cx.globalAlpha = 1;

    if (this.drops.length) {
      cx.strokeStyle = sunAlt < -4 ? 'rgba(160,180,215,.5)' : 'rgba(220,232,245,.6)';
      cx.lineWidth = 1.6;
      cx.beginPath();
      for (const d of this.drops) {
        cx.moveTo(d.x, d.y);
        cx.lineTo(d.x - 4, d.y + d.l);
        d.y += d.v * move;
        d.x -= d.v * 0.2 * move;
        if (d.y > H) {
          d.y = rnd(-120, -10);
          d.x = rnd(0, W + 100);
        }
      }
      cx.stroke();
    }

    if (this.flakes.length) {
      cx.fillStyle = 'rgba(255,255,255,.92)';
      for (const f of this.flakes) {
        cx.beginPath();
        cx.arc(f.x + Math.sin(t + f.p) * 12, f.y, f.r, 0, 7);
        cx.fill();
        f.y += f.v * move;
        if (f.y > H) {
          f.y = -10;
          f.x = rnd(0, W);
        }
      }
    }

    if (s.condition === 'fog') {
      const fog = cx.createLinearGradient(0, 300, 0, H);
      fog.addColorStop(0, 'rgba(220,224,230,0)');
      fog.addColorStop(1, sunAlt < -4 ? 'rgba(70,76,90,.75)' : 'rgba(225,229,234,.8)');
      cx.fillStyle = fog;
      cx.fillRect(0, 0, W, H);
    }

    // A rare, soft lightning flash in storms. Never in calm or still mode.
    if (s.condition === 'storm' && this.motion === 'full') {
      if (ts > this.flashUntil + 9000 && Math.random() < dt * 0.08) this.flashUntil = ts + 120;
      if (ts < this.flashUntil) {
        cx.fillStyle = 'rgba(255,255,255,.22)';
        cx.fillRect(0, 0, W, H);
      }
    }
  }

  private glow(x: number, y: number, r: number, inner: string, outer: string): void {
    const cx = this.ctx;
    const g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    cx.fillStyle = g;
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
  }

  private drawSun(a: Astro, through: number): void {
    const cx = this.ctx;
    const [x, y] = bodyXY(a.sunAz, a.sunAlt);
    // Low sun is bigger, warmer and has a wider glow.
    const low = clamp(1 - a.sunAlt / 15, 0, 1);
    const core = low > 0.5 ? '#ffb070' : '#fff6c4';
    cx.globalAlpha = through;
    this.glow(x, y, 150 + low * 130, `rgba(255,${Math.round(240 - low * 70)},${Math.round(190 - low * 90)},.8)`, 'rgba(255,200,140,0)');
    if (a.sunAlt > -1) {
      cx.fillStyle = core;
      cx.beginPath();
      cx.arc(x, y, 46 + low * 12, 0, 7);
      cx.fill();
    }
    cx.globalAlpha = 1;
  }

  private drawMoon(a: Astro, through: number): void {
    const [x, y] = bodyXY(a.moonAz, a.moonAlt);
    const r = 40;
    const m = this.moonCanvas.getContext('2d')!;
    const c = 60;
    m.clearRect(0, 0, 120, 120);
    m.globalCompositeOperation = 'source-over';
    m.fillStyle = '#f3efd8';
    m.beginPath();
    m.arc(c, c, r, 0, 7);
    m.fill();
    m.fillStyle = 'rgba(180,176,150,.35)';
    for (const [dx, dy, rr] of [[-12, -10, 8], [12, 12, 6], [5, -12, 4]]) {
      m.beginPath();
      m.arc(c + dx, c + dy, rr, 0, 7);
      m.fill();
    }
    // Cut the unlit part away with an offset disc: no offset = new moon, 2r = full.
    m.globalCompositeOperation = 'destination-out';
    const off = 2 * r * a.moonFraction * (a.moonWaxing ? -1 : 1);
    m.beginPath();
    m.arc(c + off, c, r + 1, 0, 7);
    m.fill();

    const cx = this.ctx;
    cx.globalAlpha = through;
    this.glow(x, y, 120, 'rgba(240,236,210,.3)', 'rgba(240,236,210,0)');
    cx.fillStyle = 'rgba(243,239,216,.08)'; // earthshine on the dark side
    cx.beginPath();
    cx.arc(x, y, r, 0, 7);
    cx.fill();
    cx.drawImage(this.moonCanvas, x - c, y - c);
    cx.globalAlpha = 1;
  }

  private cloud(x: number, y: number, s: number): void {
    const cx = this.ctx;
    cx.beginPath();
    for (const [dx, dy, r] of [[0, 0, 30], [34, -18, 38], [74, -6, 30], [40, 8, 32], [-24, 8, 22], [100, 8, 22]]) {
      cx.moveTo(x + dx * s + r * s, y + dy * s);
      cx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    }
    cx.fill();
  }
}
