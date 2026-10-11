<!--
  Settings > Connections > Recipe folders: the folders of Markdown recipe notes the cookbook reads.
  Add one by browsing the display's own folders (or typing the path). Removing a folder here only
  stops showing it; its files are never deleted.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { FolderListing, RecipeFolders } from '../lib/types';
  import Icon from './Icon.svelte';

  const demo = !!import.meta.env.VITE_DEMO;
  let info: RecipeFolders | null = $state(null);
  let error = $state('');
  let busy = $state(false);
  let path = $state('');
  let listing: FolderListing | null = $state(null);

  onMount(() => {
    api.recipeFolders().then((f) => (info = f)).catch((e) => (error = String(e.message ?? e)));
  });

  async function run(job: () => Promise<RecipeFolders>) {
    busy = true;
    error = '';
    try {
      info = await job();
      return true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      busy = false;
    }
  }

  async function add(create = false) {
    if (await run(() => api.addRecipeFolder(path, create))) path = '';
  }

  async function browse(to = '') {
    error = '';
    try {
      listing = await api.browseFolders(to);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const here = (name: string) => `${listing!.path.replace(/\/$/, '')}/${name}`;
  const pick = () => {
    if (!listing) return;
    path = listing.path;
    listing = null;
  };
</script>

<div class="row">
  <div class="head">
    <h3>Recipe folders</h3>
    <span class="state" class:on={info && !info.sample}>{info?.sample ? 'Sample recipes' : `${info?.folders.length ?? 0} folder${info?.folders.length === 1 ? '' : 's'}`}</span>
  </div>

  {#if info && !info.sample}
    <ul class="list">
      {#each info.folders as f (f.path)}
        <li>
          <Icon name="folder" />
          <span class="nm"><b>{f.label}</b> <small>{f.exists ? `${f.count} recipe${f.count === 1 ? '' : 's'}` : 'folder not found'}</small><em>{f.path}</em></span>
          {#if f.removable}
            <button type="button" class="pill" disabled={busy} onclick={() => run(() => api.removeRecipeFolder(f.path))}>Remove</button>
          {:else}
            <small class="fixed">set in config.toml</small>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if demo}
    <p class="help">The public preview only has the sample recipes. Add your own folder on the Surface itself.</p>
  {:else}
    <p class="help">Each folder is Markdown notes (like your Obsidian Recipes folder). Edits made in the cookbook are saved straight back into these files.</p>
    <div class="form">
      <input placeholder="/home/you/Recipes" autocomplete="off" bind:value={path} />
      <button type="button" class="pill" disabled={busy} onclick={() => browse(path.trim())}><Icon name="folder" /> Browse</button>
      <button type="button" class="pill solid" disabled={busy || !path.trim()} onclick={() => add()}>Add folder</button>
    </div>
    {#if error.includes("doesn't exist")}
      <button type="button" class="pill" disabled={busy} onclick={() => add(true)}>Create that folder and add it</button>
    {/if}

    {#if listing}
      <div class="browser">
        <div class="where">
          <button type="button" class="pill" disabled={listing.path === listing.parent} onclick={() => browse(listing!.parent)}><Icon name="back" /> Up</button>
          <code>{listing.path}</code>
          <button type="button" class="pill solid" onclick={pick}>Use this folder</button>
          <button type="button" class="pill" onclick={() => (listing = null)}>Close</button>
        </div>
        <div class="dirs">
          {#each listing.dirs as d (d)}
            <button type="button" onclick={() => browse(here(d))}><Icon name="folder" />{d}</button>
          {:else}
            <p class="help">No folders in here.</p>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
</div>

<style>
  .row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 2px solid var(--line2);
    padding-top: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  h3 {
    margin: 0;
    font-family: var(--f-hand);
    font-size: 30px;
  }
  .state {
    font-weight: 800;
    font-size: 18px;
    color: var(--ink2);
  }
  .state.on {
    color: var(--green);
  }
  .help {
    margin: 0;
    font-size: 18px;
    color: var(--ink2);
    font-weight: 700;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
  }
  li :global(.ic) {
    width: 28px;
    height: 28px;
  }
  .nm {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .nm small,
  .fixed {
    font-weight: 700;
    color: var(--ink2);
    font-size: 16px;
  }
  .nm em {
    font-style: normal;
    font-size: 15px;
    color: var(--ink2);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .form {
    display: flex;
    gap: 12px;
  }
  input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 20px;
    padding: 12px 14px;
    border: 3px solid var(--border);
    border-radius: 12px;
    background: var(--paper2);
    color: var(--ink);
  }
  .browser {
    border: 3px solid var(--border);
    border-radius: 12px;
    background: var(--paper2);
    padding: 10px;
    display: grid;
    gap: 10px;
  }
  .where {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 800;
    font-size: 17px;
  }
  .dirs {
    max-height: 190px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .dirs button {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    font: inherit;
    font-weight: 800;
    font-size: 19px;
    border: 2.5px solid var(--line2);
    border-radius: 10px;
    background: var(--paper);
    padding: 8px 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .err {
    margin: 0;
    color: var(--red);
    font-weight: 800;
    font-size: 18px;
  }
</style>
