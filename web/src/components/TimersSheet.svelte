<!-- The Timers shortcut: start a timer in one tap, see and adjust the running ones. -->
<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { clock, remaining } from '../lib/timers';
  import { dismissTimer, extendTimer, startTimer, timers } from '../lib/timers.svelte';
  import Icon from './Icon.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const presets = [1, 3, 5, 10, 15, 20, 30, 45];
  let custom = $state(5);
  let full = $state(false);
  const now = $derived(app.now.getTime());

  function start(minutes: number) {
    full = !startTimer(minutes * 60, `${minutes} min timer`, now);
  }
</script>

<div class="bg" role="presentation" onclick={onclose}></div>
<section class="panel sheet" aria-label="Timers">
  <div class="ph">
    <h2>Timers</h2>
    <button type="button" class="pill" onclick={onclose}>Done</button>
  </div>

  <div class="presets">
    {#each presets as m (m)}
      <button type="button" class="pill big" onclick={() => start(m)}>{m} min</button>
    {/each}
  </div>

  <div class="custom">
    <button type="button" class="step" aria-label="Fewer minutes" onclick={() => (custom = Math.max(1, custom - 1))}><Icon name="minus" /></button>
    <b>{custom} min</b>
    <button type="button" class="step" aria-label="More minutes" onclick={() => (custom = Math.min(600, custom + 1))}><Icon name="plus" /></button>
    <button type="button" class="pill solid big" onclick={() => start(custom)}>Start</button>
  </div>
  {#if full}<p class="note">That's the most timers at once. Dismiss one first.</p>{/if}

  <h3>Running</h3>
  {#if timers.list.length === 0}
    <p class="note">Nothing running. Timers for recipe steps start from cook mode.</p>
  {:else}
    <ul>
      {#each timers.list as t (t.id)}
        <li>
          <Icon name="timer" />
          <span class="lbl">{t.label}</span>
          <b class:done={t.ringing}>{t.ringing ? 'Done' : clock(remaining(t, now))}</b>
          <button type="button" class="pill" onclick={() => extendTimer(t.id, 60, now)}>+1 min</button>
          <button type="button" class="pill" aria-label="Cancel {t.label}" onclick={() => dismissTimer(t.id)}><Icon name="close" /></button>
        </li>
      {/each}
    </ul>
  {/if}
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
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 760px;
    max-height: 820px;
    overflow: auto;
    z-index: 21;
    padding: 24px 30px 28px;
  }
  .presets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin: 12px 0 18px;
  }
  .big {
    font-size: 26px;
    padding: 14px 10px;
    justify-content: center;
  }
  .custom {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .custom b {
    font-size: 34px;
    min-width: 130px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .custom .solid {
    margin-left: auto;
    padding-inline: 40px;
  }
  .step {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 3px solid var(--border);
    background: var(--paper);
    display: grid;
    place-items: center;
  }
  .step :global(.ic) {
    width: 30px;
    height: 30px;
  }
  h3 {
    font-family: var(--f-hand);
    font-weight: 400;
    font-size: 28px;
    margin: 22px 0 4px;
  }
  .note {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink2);
    margin: 8px 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    font-size: 22px;
  }
  li + li {
    border-top: 1px solid var(--line2);
  }
  li > :global(.ic) {
    width: 28px;
    height: 28px;
  }
  .lbl {
    flex: 1;
    font-weight: 700;
  }
  li b {
    font-variant-numeric: tabular-nums;
    font-size: 28px;
  }
  li b.done {
    color: var(--red);
  }
</style>
