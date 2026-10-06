// A kitchen-timer beep made with WebAudio (no sound files). Chromium on the Surface
// runs with --autoplay-policy=no-user-gesture-required (see deploy/kiosk.sh) so it can
// ring with nobody touching the screen; elsewhere the browser may stay silent until
// the first tap, which is fine for the phone preview.

let ctx: AudioContext | null = null;

function beep(volume: number, at = 0, freq = 988) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume * 0.25, t + 0.01);
  gain.gain.linearRampToValueAtTime(0, t + 0.16);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Beep-beep-beep. Call once every couple of seconds while a timer is ringing. volume: 0-100. */
export function ring(volume: number) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const v = Math.max(0, Math.min(1, volume / 100));
    if (v === 0) return;
    beep(v, 0);
    beep(v, 0.22);
    beep(v, 0.44, 1318);
  } catch {
    /* no audio available */
  }
}
