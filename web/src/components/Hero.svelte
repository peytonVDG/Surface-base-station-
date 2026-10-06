<!-- The "look from across the room" side: big clock, date and weather. -->
<script lang="ts">
  import { CONDITION_LABEL, clockParts, hourLabel, longDate, temp } from '../lib/format';
  import type { Settings, Weather } from '../lib/types';
  import { weatherIcon } from '../lib/weatherIcon';
  import Icon from './Icon.svelte';

  let {
    now,
    weather,
    settings,
    night,
    onhold,
  }: { now: Date; weather: Weather | null; settings: Settings; night: boolean; onhold: () => void } = $props();

  const clock = $derived(clockParts(now, settings.clock_24h, settings.show_seconds));
  const hours = $derived((weather?.hourly ?? []).slice(0, 6));

  // Press and hold the clock: a backup way into quick settings.
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  function press() {
    if (!settings.hold_clock_for_settings) return;
    holdTimer = setTimeout(onhold, 700);
  }
  function release() {
    clearTimeout(holdTimer);
  }
</script>

<div class="hero">
  <div
    class="clock"
    role="timer"
    onpointerdown={press}
    onpointerup={release}
    onpointerleave={release}
    onpointercancel={release}
  >
    <span>{clock.time}</span>{#if clock.ampm}<span class="ampm">{clock.ampm}</span>{/if}
  </div>
  <div class="date">{longDate(now)}</div>

  {#if weather}
    <div class="wx">
      <div class="wx-now">
        <Icon name={weatherIcon(weather.current.condition, night)} />
        <span class="wx-temp">{temp(weather.current.temp_c, settings.temp_unit)}</span>
        <div>
          <div class="wx-cond">
            {CONDITION_LABEL[weather.current.condition]}
            {#if weather.status !== 'live'}<span class="wx-badge">{weather.status === 'sample' ? 'Sample' : 'Offline'}</span>{/if}
          </div>
          <div class="wx-hl">
            H {temp(weather.today.high_c, settings.temp_unit)} · L {temp(weather.today.low_c, settings.temp_unit)}
          </div>
        </div>
      </div>
      <div class="wx-hours">
        {#each hours as h (h.time)}
          {@const d = new Date(h.time)}
          {@const hr = d.getHours()}
          <div class="hr">
            <span class="t">{hourLabel(d, settings.clock_24h)}</span>
            <Icon name={weatherIcon(h.condition, hr < 6 || hr >= 20)} />
            <span>{temp(h.temp_c, settings.temp_unit)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .hero {
    color: var(--hero);
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 8px;
  }
  .clock {
    font-family: var(--f-round);
    font-weight: 500;
    font-size: 176px;
    line-height: 0.92;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    touch-action: none;
  }
  .ampm {
    font-size: 40px;
    margin-top: 22px;
    letter-spacing: 0.04em;
  }
  .date {
    font-family: var(--f-hand);
    font-size: 44px;
    line-height: 1.1;
  }
  .wx {
    margin-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .wx-now {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .wx-now :global(.ic) {
    width: 68px;
    height: 68px;
    stroke-width: 1.8;
  }
  .wx-temp {
    font-family: var(--f-round);
    font-size: 76px;
    font-weight: 500;
    line-height: 1;
  }
  .wx-cond {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .wx-badge {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1.5px solid rgba(255, 255, 255, 0.6);
    border-radius: 6px;
    padding: 1px 6px;
    text-shadow: none;
  }
  .wx-hl {
    font-size: 20px;
    font-weight: 700;
    opacity: 0.92;
  }
  .wx-hours {
    display: flex;
    gap: 8px;
  }
  .hr {
    width: 76px;
    border-radius: 12px;
    background: rgba(10, 18, 40, 0.24);
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    gap: 4px;
    font-weight: 800;
    font-size: 18px;
    text-shadow: none;
  }
  .hr :global(.ic) {
    width: 30px;
    height: 30px;
  }
  .hr .t {
    font-size: 14px;
    opacity: 0.9;
  }
</style>
