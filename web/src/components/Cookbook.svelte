<!-- The cookbook: photo tiles with search, tag filters and sorting. A tap opens cook mode. -->
<script lang="ts">
  import { allTags, filterRecipes, formatMinutes, parseRecipe, type CookbookSort, type Recipe } from '../lib/recipes';
  import { app } from '../lib/store.svelte';
  import { timers } from '../lib/timers.svelte';
  import CookMode from './CookMode.svelte';
  import Icon from './Icon.svelte';
  import Stars from './Stars.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let query = $state('');
  let tag: string | null = $state(null);
  let sort: CookbookSort = $state('name');
  let openId: string | null = $state(null);

  const all: Recipe[] = $derived((app.recipes?.items ?? []).map(parseRecipe));
  const tags = $derived(allTags(all));
  const shown = $derived(filterRecipes(all, { query, tag, sort }));
  const opened = $derived(all.find((r) => r.id === openId) ?? null);

  const sorts: [CookbookSort, string][] = [
    ['name', 'A–Z'],
    ['rating', 'Top rated'],
    ['time', 'Quickest'],
    ['recent', 'Cooked lately'],
  ];
</script>

{#if opened}
  <CookMode recipe={opened} onback={() => (openId = null)} onclose={onclose} />
{:else}
  <section class="book" class:has-timers={timers.list.some((t) => !t.ringing)} aria-label="Cookbook">
    <header>
      <h2>Cookbook</h2>
      <label class="search">
        <Icon name="search" />
        <input type="search" placeholder="Search recipes or ingredients" bind:value={query} />
      </label>
      <button type="button" class="pill solid" onclick={onclose}><Icon name="close" /> Close</button>
    </header>

    <div class="filters">
      <button type="button" class="chip" class:on={tag === null} onclick={() => (tag = null)}>All</button>
      {#each tags as t (t)}
        <button type="button" class="chip" class:on={tag === t} onclick={() => (tag = tag === t ? null : t)}>{t}</button>
      {/each}
      <span class="gap"></span>
      {#each sorts as [key, label] (key)}
        <button type="button" class="chip sort" class:on={sort === key} onclick={() => (sort = key)}>{label}</button>
      {/each}
    </div>

    {#if !app.recipes}
      <p class="empty">Loading recipes...</p>
    {:else if all.length === 0}
      <p class="empty">No recipes yet. Add Markdown notes to the Recipes folder and they show up here.</p>
    {:else if shown.length === 0}
      <p class="empty">Nothing matches that. Try fewer words, or tap All.</p>
    {:else}
      <div class="grid">
        {#each shown as r (r.id)}
          <button type="button" class="tile" onclick={() => (openId = r.id)}>
            <div class="photo" class:art={/\.svg|image\/svg/.test(r.photo ?? '')}>
              {#if r.photo}<img src={r.photo} alt="" loading="lazy" />{:else}<Icon name="book" />{/if}
            </div>
            <div class="info">
              <b>{r.title}</b>
              <div class="line">
                {#if r.rating}<Stars rating={r.rating} />{/if}
                {#if r.minutes !== null}<span><Icon name="clock" />{formatMinutes(r.minutes)}</span>{/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
    {#if app.recipes?.status === 'sample'}<p class="foot">Sample recipes. Your own show up once the Recipes folder is connected.</p>{/if}
  </section>
{/if}

<style>
  .book {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: var(--paper2);
    padding: 24px 28px 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
  }
  .book.has-timers {
    padding-top: 62px; /* room for the running-timer chips */
  }
  header {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  h2 {
    font-family: var(--f-hand);
    font-weight: 400;
    font-size: 46px;
    line-height: 1;
    margin: 0;
  }
  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--paper);
    border: 3px solid var(--border);
    border-radius: 999px;
    padding: 8px 20px;
    font-size: 22px;
  }
  .search :global(.ic) {
    width: 26px;
    height: 26px;
  }
  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 700;
    color: inherit;
    outline: none;
    -webkit-user-select: text;
    user-select: text;
  }
  .pill {
    font-size: 20px;
    padding: 10px 20px;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .gap {
    flex: 1;
  }
  .chip {
    border: 2.5px solid var(--border);
    background: var(--paper);
    border-radius: 999px;
    padding: 6px 18px;
    font-size: 19px;
    font-weight: 800;
    text-transform: capitalize;
  }
  .chip.sort {
    border-color: var(--line2);
    text-transform: none;
  }
  .chip.on {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }
  .grid {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: max-content;
    gap: 20px;
    padding: 2px 6px 18px 2px;
  }
  .tile {
    text-align: left;
    background: var(--paper);
    border: 3px solid var(--border);
    border-radius: 14px;
    box-shadow: 5px 6px 0 var(--shadow);
    overflow: hidden;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .tile:active {
    transform: translate(2px, 3px);
    box-shadow: 3px 3px 0 var(--shadow);
  }
  .photo {
    position: relative;
    height: 180px;
    overflow: hidden;
    background: var(--paper2);
    display: grid;
    place-items: center;
    border-bottom: 3px solid var(--border);
  }
  .photo img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo.art {
    background: #fbe9b7;
  }
  .photo.art img {
    object-fit: contain;
    padding: 14px;
    box-sizing: border-box;
  }
  .photo :global(.ic) {
    width: 64px;
    height: 64px;
    color: var(--ink2);
  }
  .info {
    padding: 10px 14px 12px;
    display: grid;
    gap: 6px;
  }
  .info b {
    font-size: 23px;
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.3em;
  }
  .line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--ink2);
    font-weight: 700;
    font-size: 17px;
    min-height: 22px;
  }
  .line span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
  }
  .line :global(.ic) {
    width: 17px;
    height: 17px;
  }
  .empty {
    font-size: 24px;
    font-weight: 700;
    color: var(--ink2);
    text-align: center;
    margin: 80px 0;
  }
  .foot {
    margin: 0;
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: var(--ink2);
  }
</style>
