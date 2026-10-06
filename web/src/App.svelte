<script lang="ts">
  import { onMount } from 'svelte';
  import BriefCard from './components/BriefCard.svelte';
  import CalendarCard from './components/CalendarCard.svelte';
  import ConnectionsPanel from './components/ConnectionsPanel.svelte';
  import CountdownRing from './components/CountdownRing.svelte';
  import Dock from './components/Dock.svelte';
  import Hero from './components/Hero.svelte';
  import LeaveCard from './components/LeaveCard.svelte';
  import QuickSettings from './components/QuickSettings.svelte';
  import Scene from './components/Scene.svelte';
  import Sky from './components/Sky.svelte';
  import SleepScreen from './components/SleepScreen.svelte';
  import TodoCard from './components/TodoCard.svelte';
  import { api } from './lib/api';
  import { leaveInfo } from './lib/leave';
  import { isDayOff, scheduledMode, type ScreenMode } from './lib/schedule';
  import { astroAt, guessPlace } from './lib/sky/astro';
  import { phaseFor } from './lib/sky/palette';
  import type { SkyState } from './lib/sky/renderer';
  import { app, forcedCondition, startStore } from './lib/store.svelte';
  import type { Condition } from './lib/types';

  onMount(startStore);
  let connectionsOpen = $state(false);

  // Fit the fixed 1368x912 stage to the window (exact on the Surface at 200%).
  let vw = $state(1368);
  let vh = $state(912);
  const scale = $derived(Math.min(vw / 1368, vh / 912));
  const offsetX = $derived((vw - 1368 * scale) / 2);
  const offsetY = $derived((vh - 912 * scale) / 2);

  const s = $derived(app.settings);
  const minute = $derived(Math.floor(app.now.getTime() / 60_000));

  // --- sky -----------------------------------------------------------------
  const place = $derived(
    app.config?.latitude != null && app.config.longitude != null
      ? { lat: app.config.latitude, lon: app.config.longitude }
      : guessPlace(),
  );
  const astro = $derived.by(() => {
    void minute; // the sun moves slowly; once a minute is plenty
    return astroAt(app.now, place);
  });
  const FORCED_COVER: Record<string, number> = { clear: 5, partly: 40, cloudy: 90, fog: 100, rain: 95, storm: 100, snow: 90 };
  const condition = $derived((forcedCondition ?? app.weather?.current.condition ?? 'clear') as Condition);
  const sky: SkyState = $derived({
    astro,
    condition,
    cloudCover: forcedCondition ? FORCED_COVER[forcedCondition] ?? 50 : (app.weather?.current.cloud_cover ?? 10),
    precipMm: forcedCondition ? 2 : (app.weather?.current.precip_mm ?? 0),
  });
  const phase = $derived(s.look === 'day' ? 'day' : s.look === 'night' ? 'night' : phaseFor(astro.sunAlt, astro.rising));
  const dark = $derived(phase === 'night');

  // --- sleep / wake ----------------------------------------------------------
  const events = $derived(app.calendar?.events ?? []);
  const dayOff = $derived(isDayOff(events, app.now));
  const scheduled: ScreenMode = $derived(scheduledMode(app.now, s.schedule, dayOff));

  // "Sleep now" and "Dim now" hold until the schedule's next change.
  let manualSleep = $state(false);
  let dimNow = $state(false);
  let lastScheduled: ScreenMode | null = null;
  $effect(() => {
    if (lastScheduled !== null && scheduled !== lastScheduled) {
      manualSleep = false;
      dimNow = false;
      napUntil = 0;
    }
    lastScheduled = scheduled;
  });

  // A tap in sleep mode wakes the screen until nap_minutes pass without a touch.
  let napUntil = $state(0);
  const napping = $derived(app.now.getTime() < napUntil);
  const sleeping = $derived((scheduled === 'sleep' || manualSleep) && !napping);

  function touched() {
    if (napUntil) napUntil = app.now.getTime() + s.schedule.nap_minutes * 60_000;
  }
  function wake() {
    napUntil = app.now.getTime() + s.schedule.nap_minutes * 60_000;
  }
  function sleepNow() {
    manualSleep = true;
    napUntil = 0;
  }

  // --- brightness ------------------------------------------------------------
  const brightness = $derived(sleeping ? 1 : dimNow ? Math.min(30, s.brightness) : s.brightness);
  let backlightTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const b = brightness;
    if (!app.config?.hardware_backlight) return;
    clearTimeout(backlightTimer);
    backlightTimer = setTimeout(() => api.backlight(b).catch(console.warn), 150);
  });
  // No hardware backlight (dev machine): fake it with a black overlay.
  const overlay = $derived(app.config?.hardware_backlight ? 0 : ((100 - brightness) / 100) * 0.8);

  // --- cards -----------------------------------------------------------------
  const leave = $derived(leaveInfo(app.now, s, events, dayOff));
  const ringOn = $derived(s.countdown_ring && leave.kind === 'work' && !sleeping);

  let shadeOpen = $state(false);
  let toast = $state('');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function say(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 3500);
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div
  class="stage {phase}"
  class:dark
  class:wet={condition === 'rain' || condition === 'storm'}
  class:snowy={condition === 'snow'}
  class:still={s.animations === 'off'}
  class:ring-on={ringOn}
  style:transform="translate({offsetX}px, {offsetY}px) scale({scale})"
  onpointerdowncapture={touched}
  role="application"
>
  <Sky {sky} motion={s.animations} running={!sleeping} />
  <Scene {phase} {condition} month={app.now.getMonth()} />

  <div class="screen">
    <div class="home">
      <Hero now={app.now} weather={app.weather} settings={s} night={astro.sunAlt < -4} onhold={() => (shadeOpen = true)} />
      <div class="col">
        <div class="top2">
          <BriefCard brief={app.brief} now={app.now} h24={s.clock_24h} />
          <LeaveCard info={leave} h24={s.clock_24h} />
        </div>
        <div class="pair">
          <CalendarCard calendar={app.calendar} now={app.now} h24={s.clock_24h} />
          <TodoCard todos={app.todos} />
        </div>
        <Dock micMuted={s.mic_muted} onsoon={(what) => say(`${what} comes in a later build.`)} />
      </div>
    </div>
  </div>

  {#if ringOn}<CountdownRing fraction={leave.fraction} minutesLeft={leave.minutes} />{/if}

  <QuickSettings
    bind:open={shadeOpen}
    {scale}
    dimmed={dimNow}
    ondim={() => (dimNow = !dimNow)}
    onsleep={sleepNow}
    onallsettings={() => ((shadeOpen = false), (connectionsOpen = true))}
  />

  {#if connectionsOpen}<ConnectionsPanel onclose={() => (connectionsOpen = false)} />{/if}

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
  {#if app.offline}<div class="offline" role="status">Can't reach the kitchen server. Showing the last data.</div>{/if}

  {#if sleeping}<SleepScreen now={app.now} h24={s.clock_24h} onwake={wake} />{/if}
  {#if overlay > 0.01}<div class="dim" style:opacity={overlay}></div>{/if}
</div>

<style>
  .screen {
    position: absolute;
    inset: 0;
    transition: transform 0.6s ease;
  }
  .ring-on .screen {
    transform: scale(0.982);
  }
  .home {
    position: absolute;
    inset: 28px;
    display: grid;
    grid-template-columns: 560px 1fr;
    gap: 36px;
  }
  .col {
    display: grid;
    grid-template-rows: 252px minmax(0, 1fr) 112px;
    gap: 20px;
    min-width: 0;
  }
  .top2,
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    min-height: 0;
  }
  .toast {
    position: absolute;
    left: 50%;
    bottom: 36px;
    transform: translateX(-50%);
    background: #1b1b1b;
    color: #fffdf5;
    border-radius: 14px;
    padding: 14px 22px;
    font-size: 20px;
    font-weight: 700;
    max-width: 820px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    z-index: 15;
  }
  .offline {
    position: absolute;
    left: 28px;
    bottom: 12px;
    font-size: 15px;
    font-weight: 800;
    color: #fff;
    background: rgba(200, 16, 46, 0.85);
    border-radius: 8px;
    padding: 4px 10px;
    z-index: 15;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: #000;
    pointer-events: none;
    z-index: 30;
  }
</style>
