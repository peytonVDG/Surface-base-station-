<!--
  Weekday-morning ring around the whole screen. It drains clockwise from top
  centre between wake-up and leave time, fading green to red, and pulses in the
  last 5 minutes. Readable from across the kitchen without reading numbers.
-->
<script lang="ts">
  import { ringColour } from '../lib/leave';

  let { fraction, minutesLeft }: { fraction: number; minutesLeft: number } = $props();

  const d = 'M684 9 H1347 a12 12 0 0 1 12 12 V891 a12 12 0 0 1 -12 12 H21 a12 12 0 0 1 -12 -12 V21 a12 12 0 0 1 12 -12 Z';
  const colour = $derived(ringColour(fraction));
  const remaining = $derived((1 - fraction) * 1000);
</script>

<svg class="ring" class:pulse={minutesLeft <= 5} viewBox="0 0 1368 912" aria-hidden="true">
  <path class="trk" pathLength="1000" {d} />
  <path
    class="bar"
    pathLength="1000"
    {d}
    style:stroke={colour}
    style:color={colour}
    style:stroke-dasharray="{remaining} 1000"
    style:stroke-dashoffset={-fraction * 1000}
  />
</svg>

<style>
  .ring {
    position: absolute;
    inset: 0;
    width: 1368px;
    height: 912px;
    z-index: 6;
    pointer-events: none;
  }
  path {
    fill: none;
    stroke-width: 14;
    stroke-linecap: round;
  }
  .trk {
    stroke: rgba(0, 0, 0, 0.35);
  }
  .bar {
    transition:
      stroke-dasharray 1s linear,
      stroke-dashoffset 1s linear,
      stroke 0.8s;
    filter: drop-shadow(0 0 6px currentColor);
  }
  .pulse .bar {
    animation: pulse 1.2s ease-in-out infinite;
  }
</style>
