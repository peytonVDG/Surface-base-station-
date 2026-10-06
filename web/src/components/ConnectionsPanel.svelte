<!--
  Settings > Connections: sign in to Todoist and Google Calendar, and pick the Keep
  grocery list. Secrets are sent to the backend once and never come back; this panel
  only learns "connected or not".
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import type { Connections } from '../lib/types';

  let { onclose }: { onclose: () => void } = $props();

  const demo = !!import.meta.env.VITE_DEMO;
  let conn: Connections | null = $state(null);
  let error = $state('');
  let busy = $state(false);
  let token = $state('');
  let clientId = $state('');
  let clientSecret = $state('');
  let keepLink = $state('');
  let keepName = $state('');

  onMount(() => {
    api.connections().then((c) => (conn = c)).catch((e) => (error = String(e.message ?? e)));
  });

  async function run(job: () => Promise<Connections>) {
    busy = true;
    error = '';
    try {
      conn = await job();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  const saveToken = () => run(() => api.connectTodoist(token.trim()).then((c) => ((token = ''), c)));
  const saveClient = () =>
    run(() => api.setGoogleClient(clientId.trim(), clientSecret.trim()).then((c) => ((clientSecret = ''), c)));
  const saveKeep = () =>
    run(() => api.pickKeepList(keepLink.trim(), keepName.trim()).then((c) => ((keepLink = keepName = ''), c)));
  // Google's sign-in is a normal page navigation; the backend sends the browser back here when done.
  const signInGoogle = () => (location.href = '/api/connections/google/start');
</script>

<div class="bg" role="presentation" onclick={onclose}></div>
<section class="panel sheet" aria-label="Connections">
  <div class="ph">
    <h2>Connections</h2>
    <button type="button" class="pill" onclick={onclose}>Done</button>
  </div>

  {#if demo}
    <p class="note">This is the public preview, so it only ever shows sample data. Sign in to Todoist and Google on the Surface itself.</p>
  {/if}

  <div class="row">
    <div class="head">
      <h3>Todoist</h3>
      <span class="state" class:on={conn?.todoist.connected}>{conn?.todoist.connected ? 'Connected' : 'Not connected'}</span>
    </div>
    {#if conn?.todoist.connected}
      <button type="button" class="pill" disabled={busy} onclick={() => run(api.disconnectTodoist)}>Disconnect</button>
    {:else if !demo}
      <p class="help">In Todoist: Settings > Integrations > Developer > copy your API token, then paste it here.</p>
      <div class="form">
        <input type="password" placeholder="Paste Todoist API token" autocomplete="off" bind:value={token} />
        <button type="button" class="pill solid" disabled={busy || token.trim().length < 10} onclick={saveToken}>Connect</button>
      </div>
    {/if}
  </div>

  <div class="row">
    <div class="head">
      <h3>Google Calendar</h3>
      <span class="state" class:on={conn?.google.connected}>{conn?.google.connected ? 'Connected' : 'Not connected'}</span>
    </div>
    {#if conn?.google.connected}
      <p class="help">Read-only: the display can see your events but can't change them.</p>
      <button type="button" class="pill" disabled={busy} onclick={() => run(api.disconnectGoogle)}>Disconnect</button>
    {:else if !demo}
      {#if !conn?.google.ready}
        <p class="help">One-time setup: paste the client ID and secret from your Google Cloud project (steps are in the README).</p>
        <div class="form">
          <input placeholder="Client ID" autocomplete="off" bind:value={clientId} />
          <input type="password" placeholder="Client secret" autocomplete="off" bind:value={clientSecret} />
          <button type="button" class="pill solid" disabled={busy || clientId.length < 10 || clientSecret.length < 5} onclick={saveClient}>Save</button>
        </div>
      {:else}
        <button type="button" class="pill solid" disabled={busy} onclick={signInGoogle}>Sign in with Google</button>
      {/if}
    {/if}
  </div>

  <div class="row">
    <div class="head">
      <h3>Google Keep grocery list</h3>
      <span class="state" class:on={conn?.keep.connected}>{conn?.keep.connected ? conn.keep.name || 'Picked' : 'Not picked'}</span>
    </div>
    {#if conn?.keep.connected}
      <p class="help">The Groceries button opens this list. Sign in to Google in that window the first time.</p>
      <button type="button" class="pill" disabled={busy} onclick={() => run(api.forgetKeepList)}>Pick a different list</button>
    {:else if !demo}
      <p class="help">In Chrome, open keep.google.com, click your grocery list, then copy the link from the address bar (it looks like keep.google.com/#LIST/1a2b...) and paste it here.</p>
      <div class="form">
        <input placeholder="Paste the Keep list link" autocomplete="off" bind:value={keepLink} />
        <input class="short" placeholder="Name (optional)" autocomplete="off" maxlength="40" bind:value={keepName} />
        <button type="button" class="pill solid" disabled={busy || keepLink.trim().length < 10} onclick={saveKeep}>Save</button>
      </div>
    {/if}
  </div>

  {#if error}<p class="err" role="alert">{error}</p>{/if}
</section>

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
    left: 250px;
    right: 250px;
    top: 90px;
    padding: 22px 28px 26px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
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
  .help,
  .note {
    margin: 0;
    font-size: 18px;
    color: var(--ink2);
    font-weight: 700;
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
  input.short {
    flex: 0 0 190px;
  }
  .err {
    margin: 0;
    color: var(--red);
    font-weight: 800;
    font-size: 18px;
  }
</style>
