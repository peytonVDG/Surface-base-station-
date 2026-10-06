<!--
  Foreground: grass, doghouse and the placeholder beagle and bird from the mockup.
  The real build swaps the hand-drawn characters for official Peanuts art; the
  props (puddle, snow cap, pumpkin) are already per-state so new poses slot in.
-->
<script lang="ts">
  import type { Phase } from '../lib/sky/palette';
  import type { Condition } from '../lib/types';

  let { phase, condition, month }: { phase: Phase; condition: Condition; month: number } = $props();

  const asleep = $derived(phase === 'night');
  const wet = $derived(condition === 'rain' || condition === 'storm');
</script>

<svg class="scene" viewBox="0 0 1368 912" aria-hidden="true">
  <path class="g-back" d="M0 770 Q 360 720 760 790 T 1368 780 V912 H0 Z" />
  <path class="g-front" d="M0 792 Q 300 760 620 800 T 1368 812 V912 H0 Z" />
  {#if wet}<ellipse cx="300" cy="838" rx="70" ry="10" fill="#8fb3d6" opacity=".55" />{/if}

  <!-- doghouse -->
  <rect class="house ink" x="92" y="662" width="176" height="132" />
  <path class="house-trim" d="M95 664 h170 v12 h-170z" />
  <path d="M148 794 V740 a32 32 0 0 1 64 0 V794 Z" fill="#141414" />
  <path class="house ink" d="M66 676 L180 562 L294 676 Z" />
  <path class="ink" d="M80 676 h200" fill="none" />
  {#if condition === 'snow'}
    <polyline points="70,668 180,558 290,668" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
  {/if}

  <!-- beagle napping on the roof (placeholder art) -->
  <g class="ink" fill="#ffffff">
    <path d="M112 548 q-14 -6 -20 -18" fill="none" />
    <ellipse cx="150" cy="526" rx="9" ry="15" transform="rotate(-12 150 526)" />
    <ellipse cx="186" cy="522" rx="9" ry="15" transform="rotate(10 186 522)" />
    <ellipse cx="172" cy="545" rx="60" ry="21" />
    <ellipse cx="238" cy="534" rx="27" ry="21" />
    <ellipse cx="262" cy="530" rx="20" ry="13" />
  </g>
  <path d="M226 524 q-12 28 4 46 q14 -6 10 -36 z" fill="#1b1b1b" />
  <ellipse cx="281" cy="526" rx="8" ry="7" fill="#1b1b1b" />
  <path d="M241 524 q5 4 10 0" fill="none" stroke="#1b1b1b" stroke-width="3" stroke-linecap="round" />

  <!-- little yellow bird: on the ground by day, on the beagle's belly at night -->
  <g transform={asleep ? 'translate(78 -122)' : undefined}>
    <g class="ink" style="stroke-width:2.5">
      <ellipse cx="92" cy="652" rx="13" ry="10" fill="#f5c518" />
      <circle cx="101" cy="639" r="8.5" fill="#f5c518" />
      <path d="M99 631 l-3 -9 M103 631 l1 -10 M106 633 l5 -8" fill="none" />
    </g>
    <path d="M109 639 l7 2 -7 3z" fill="#f08a00" />
    <circle cx="103" cy="638" r="1.8" fill="#1b1b1b" />
  </g>

  <!-- seasonal prop: October pumpkin -->
  {#if month === 9}
    <g class="ink" style="stroke-width:3">
      <ellipse cx="36" cy="806" rx="26" ry="20" fill="#e8792b" />
      <path d="M36 786 q-9 20 0 40 M36 786 q9 20 0 40" fill="none" />
      <path d="M36 787 q2 -12 9 -14" fill="none" style="stroke:#3d6b2a;stroke-width:5" />
    </g>
  {/if}

  {#if asleep}
    <text x="292" y="540" font-family="Patrick Hand, cursive" font-size="30" fill="#f4f1de"
      >z<tspan dx="6" dy="-10" font-size="38">Z</tspan><tspan dx="6" dy="-12" font-size="46">Z</tspan></text
    >
  {/if}
</svg>

<style>
  .scene {
    position: absolute;
    inset: 0;
    width: 1368px;
    height: 912px;
    pointer-events: none;
  }
  .g-back { fill: var(--grass2); }
  .g-front { fill: var(--grass); }
  .house { fill: var(--house); }
  .house-trim { fill: var(--house2); }
  .ink {
    stroke: #1b1b1b;
    stroke-width: 3.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
</style>
