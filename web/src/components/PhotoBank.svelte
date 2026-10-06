<!--
  The photo bank: browse pictures by category, tap one to see it large. Shows the
  built-in placeholder pictures plus whatever is in the device's photos folder.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { categories, loadPhotos } from '../lib/photos';
  import type { Photo } from '../lib/types';

  let { onclose }: { onclose: () => void } = $props();

  let photos: Photo[] = $state([]);
  let loaded = $state(false);
  let category = $state('All');
  let open: Photo | null = $state(null);

  onMount(() => {
    loadPhotos().then((p) => ((photos = p), (loaded = true)));
  });

  const cats = $derived(['All', ...categories(photos)]);
  const shown = $derived(category === 'All' ? photos : photos.filter((p) => p.category === category));
</script>

<div class="bg" role="presentation" onclick={onclose}></div>
<section class="panel sheet" aria-label="Photos">
  <div class="ph">
    <h2>Photos</h2>
    <button type="button" class="pill" onclick={onclose}>Done</button>
  </div>
  <div class="tabs" role="tablist">
    {#each cats as c (c)}
      <button type="button" role="tab" aria-selected={c === category} class="pill" class:solid={c === category} onclick={() => (category = c)}>{c}</button>
    {/each}
  </div>
  {#if shown.length}
    <ul>
      {#each shown as p (p.id)}
        <li>
          <button type="button" onclick={() => (open = p)}>
            <img src={p.url} alt={p.title} loading="lazy" />
            <span>{p.title}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else if loaded}
    <p class="empty">No photos here yet.</p>
  {/if}
  <p class="hint">Placeholder pictures for now. Add your own to the photos folder on the Surface, one folder per category.</p>
</section>

{#if open}
  <div class="big" role="presentation" onclick={() => (open = null)}>
    <img src={open.url} alt={open.title} />
    <b>{open.title}</b>
  </div>
{/if}

<style>
  .bg {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 20;
  }
  .sheet {
    position: absolute;
    z-index: 21;
    inset: 60px 150px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 26px;
    overflow: hidden;
  }
  .tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 4px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    overflow-y: auto;
    flex: 1;
    align-content: start;
  }
  li button {
    display: block;
    width: 100%;
    padding: 0;
    border: 3px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--paper2);
    font: inherit;
    color: inherit;
  }
  li img {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
  }
  li span {
    display: block;
    padding: 6px 10px;
    font-size: 17px;
    font-weight: 800;
    text-align: left;
  }
  .empty,
  .hint {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--ink2);
  }
  .big {
    position: absolute;
    inset: 0;
    z-index: 25;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: #fff;
    font-size: 26px;
  }
  .big img {
    max-width: 90%;
    max-height: 80%;
    border-radius: 12px;
  }
</style>
