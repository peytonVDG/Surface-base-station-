<!--
  Sleep mode: black screen with a dim white clock that moves to a new spot every
  minute (readable on a midnight trip downstairs, and kind to the panel).
  A tap anywhere wakes the display.
-->
<script lang="ts">
  import { clockParts } from '../lib/format';

  let { now, h24, onwake }: { now: Date; h24: boolean; onwake: () => void } = $props();

  const clock = $derived(clockParts(now, h24));
  const minute = $derived(Math.floor(now.getTime() / 60_000));

  let pos = $state({ x: 480, y: 360 });
  $effect(() => {
    void minute; // re-run once a minute
    pos = { x: Math.round(40 + Math.random() * (1368 - 460)), y: Math.round(40 + Math.random() * (912 - 220)) };
  });
</script>

<button type="button" class="sleep" aria-label="Sleep mode. Tap to wake" onclick={onwake}>
  <span style:left="{pos.x}px" style:top="{pos.y}px">{clock.time}</span>
  <small>Tap anywhere to wake</small>
</button>

<style>
  .sleep {
    position: absolute;
    inset: 0;
    background: #000;
    z-index: 20;
    border: 0;
    padding: 0;
    width: 100%;
  }
  span {
    position: absolute;
    font-family: var(--f-round);
    font-weight: 400;
    font-size: 120px;
    color: rgba(255, 255, 255, 0.32);
    font-variant-numeric: tabular-nums;
    transition:
      left 1.5s ease,
      top 1.5s ease;
    line-height: 1;
  }
  small {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 24px;
    text-align: center;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.14);
    font-weight: 700;
  }
</style>
