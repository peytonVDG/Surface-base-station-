<!--
  Quick settings shade. Swipe down from the top edge (an invisible strip) to
  pull it open; swipe up or tap outside to close. Holding the clock opens it too.
-->
<script lang="ts">
  import { app, updateSettings } from '../lib/store.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let {
    open = $bindable(false),
    scale,
    dimmed,
    ondim,
    onsleep,
    onallsettings,
  }: {
    open: boolean;
    scale: number;
    dimmed: boolean;
    ondim: () => void;
    onsleep: () => void;
    onallsettings: () => void;
  } = $props();

  let shade: HTMLElement | undefined = $state();
  let dragFrom: number | null = $state(null);
  let dragOffset = $state(0); // px of the shade showing while dragging
  let upFrom: number | null = null;

  const s = $derived(app.settings);
  const y = (e: PointerEvent) => e.clientY / scale;

  function pullStart(e: PointerEvent) {
    dragFrom = y(e);
    dragOffset = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function pullMove(e: PointerEvent) {
    if (dragFrom !== null) dragOffset = Math.max(0, Math.min(shade?.offsetHeight ?? 400, y(e) - dragFrom));
  }
  function pullEnd() {
    if (dragFrom === null) return;
    open = dragOffset > 60;
    dragFrom = null;
  }

  function shadeDown(e: PointerEvent) {
    if (!(e.target as HTMLElement).closest('input,button')) upFrom = y(e);
  }
  function shadeUp(e: PointerEvent) {
    if (upFrom !== null && upFrom - y(e) > 50) open = false;
    upFrom = null;
  }

  const transform = $derived(
    dragFrom !== null ? `translateY(${dragOffset - (shade?.offsetHeight ?? 0)}px)` : open ? 'none' : 'translateY(-105%)',
  );

  type Tile = { id: string; icon: IconName; label: string; on: boolean; act: () => void };
  const tiles: Tile[] = $derived([
    { id: 'dim', icon: 'moon', label: 'Dim now', on: dimmed, act: ondim },
    { id: 'sleep', icon: 'screen', label: 'Sleep now', on: false, act: () => ((open = false), onsleep()) },
    { id: 'h24', icon: 'clock', label: '24-hour', on: s.clock_24h, act: () => updateSettings({ clock_24h: !s.clock_24h }) },
    { id: 'night', icon: 'sun', label: 'Night look', on: s.look === 'night', act: () => updateSettings({ look: s.look === 'night' ? 'auto' : 'night' }) },
    { id: 'calm', icon: 'wave', label: 'Calm motion', on: s.animations !== 'full', act: () => updateSettings({ animations: s.animations === 'full' ? 'calm' : 'full' }) },
    { id: 'mic', icon: 'micOff', label: 'Mute mic', on: s.mic_muted, act: () => updateSettings({ mic_muted: !s.mic_muted }) },
  ]);
</script>

<div
  class="pull"
  aria-hidden="true"
  onpointerdown={pullStart}
  onpointermove={pullMove}
  onpointerup={pullEnd}
  onpointercancel={pullEnd}
></div>
{#if open || dragFrom !== null}
  <div class="shade-bg" role="presentation" onclick={() => (open = false)}></div>
{/if}
<section
  bind:this={shade}
  class="panel shade"
  class:drag={dragFrom !== null}
  style:transform
  aria-label="Quick settings"
  aria-hidden={!open}
  inert={!open}
  onpointerdown={shadeDown}
  onpointerup={shadeUp}
>
  <label class="qrow">
    <Icon name="brightness" />
    <input
      type="range"
      min="5"
      max="100"
      value={s.brightness}
      aria-label="Brightness"
      oninput={(e) => (app.settings.brightness = +e.currentTarget.value)}
      onchange={(e) => updateSettings({ brightness: +e.currentTarget.value })}
    />
    <output>{s.brightness}%</output>
  </label>
  <label class="qrow">
    <Icon name="volume" />
    <input
      type="range"
      min="0"
      max="100"
      value={s.volume}
      aria-label="Volume"
      oninput={(e) => (app.settings.volume = +e.currentTarget.value)}
      onchange={(e) => updateSettings({ volume: +e.currentTarget.value })}
    />
    <output>{s.volume}%</output>
  </label>
  <div class="qtiles">
    {#each tiles as t (t.id)}
      <button type="button" class="qt" aria-pressed={t.on} onclick={t.act}><Icon name={t.icon} />{t.label}</button>
    {/each}
  </div>
  <div class="qfoot">
    <span>Swipe up or tap outside to close</span>
    <div class="grab"></div>
    <button type="button" class="pill solid" onclick={onallsettings}><Icon name="settings" />All settings</button>
  </div>
</section>

<style>
  .pull {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 44px;
    z-index: 12;
    touch-action: none;
  }
  .shade-bg {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 13;
  }
  .shade {
    position: absolute;
    left: 150px;
    right: 150px;
    top: 0;
    z-index: 14;
    border-top: 0;
    border-radius: 0 0 20px 20px;
    padding: 24px 28px 14px;
    transition: transform 0.28s ease;
    display: flex;
    flex-direction: column;
    gap: 18px;
    touch-action: none;
  }
  .shade.drag {
    transition: none;
  }
  .qrow {
    display: grid;
    grid-template-columns: 44px 1fr 64px;
    gap: 16px;
    align-items: center;
    font-weight: 800;
    font-size: 18px;
  }
  .qrow :global(.ic) {
    width: 34px;
    height: 34px;
  }
  output {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 14px;
    border-radius: 7px;
    background: var(--line2);
    outline: none;
    margin: 0;
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--paper);
    border: 3px solid var(--border);
    box-shadow: 2px 3px 0 var(--shadow);
    cursor: pointer;
  }
  input[type='range']::-moz-range-thumb {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--paper);
    border: 3px solid var(--border);
    cursor: pointer;
  }
  .qtiles {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }
  .qt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 84px;
    justify-content: center;
    padding: 12px 6px;
    border: 2.5px solid var(--border);
    border-radius: 14px;
    background: var(--paper);
    font-weight: 800;
    font-size: 15px;
    line-height: 1.1;
    text-align: center;
  }
  .qt :global(.ic) {
    width: 30px;
    height: 30px;
  }
  .qt[aria-pressed='true'] {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }
  .qfoot {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .qfoot span {
    font-size: 14px;
    color: var(--ink2);
    font-weight: 700;
  }
  .grab {
    width: 90px;
    height: 6px;
    border-radius: 3px;
    background: var(--line2);
  }
  .qfoot .pill {
    font-size: 17px;
    padding: 10px 18px;
  }
  .qfoot .pill :global(.ic) {
    width: 20px;
    height: 20px;
  }
</style>
