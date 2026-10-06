<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { SkyRenderer, type Motion, type SkyState } from '../lib/sky/renderer';

  let { sky, motion, running }: { sky: SkyState; motion: Motion; running: boolean } = $props();

  let canvas: HTMLCanvasElement;
  let renderer: SkyRenderer | null = $state(null);

  onMount(() => (renderer = new SkyRenderer(canvas)));
  onDestroy(() => renderer?.stop());

  $effect(() => renderer?.setMotion(motion));
  $effect(() => renderer?.setState(sky));
  $effect(() => {
    if (!renderer) return;
    if (running) renderer.start();
    else renderer.stop();
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 1368px;
    height: 912px;
  }
</style>
