<!--
  Timers on every screen: running ones as small chips along the top, and a big
  takeover with a Dismiss button when one rings (with a beep until it's dismissed).
-->
<script lang="ts">
  import { ring } from '../lib/alarm';
  import { app } from '../lib/store.svelte';
  import { clock, remaining } from '../lib/timers';
  import { dismissTimer, extendTimer, timers } from '../lib/timers.svelte';
  import Icon from './Icon.svelte';

  const now = $derived(app.now.getTime());
  const running = $derived(timers.list.filter((t) => !t.ringing));
  const ringing = $derived(timers.list.filter((t) => t.ringing));

  // Beep every 2.5 seconds while anything rings. Re-runs each second via app.now.
  let lastBeep = 0;
  $effect(() => {
    if (!ringing.length) {
      lastBeep = 0;
      return;
    }
    const t = now;
    if (t - lastBeep >= 2500) {
      lastBeep = t;
      ring(app.settings.volume);
    }
  });
</script>

{#if running.length}
  <div class="chips" aria-label="Running timers">
    {#each running as t (t.id)}
      {@const left = remaining(t, now)}
      <div class="chip" class:soon={left <= 60} role="timer" aria-label="{t.label}, {clock(left)} left">
        <Icon name="timer" />
        <b>{clock(left)}</b>
        <span>{t.label}</span>
        <i style:width="{(left / t.total) * 100}%"></i>
      </div>
    {/each}
  </div>
{/if}

{#if ringing.length}
  <div class="ring" role="alertdialog" aria-label="Timer finished">
    {#each ringing as t (t.id)}
      <div class="row">
        <Icon name="timer" />
        <div class="what">
          <b>{t.label}</b>
          <span>is done{t.recipe ? ` · ${t.recipe}` : ''}</span>
        </div>
        <button type="button" class="pill" onclick={() => extendTimer(t.id, 60, now)}>+1 min</button>
        <button type="button" class="pill solid big" onclick={() => dismissTimer(t.id)}>Dismiss</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .chips {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    z-index: 24;
    max-width: 1100px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .chip {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--ink);
    color: var(--paper);
    border-radius: 999px;
    padding: 6px 16px 8px 12px;
    box-shadow: 0 5px 14px rgba(0, 0, 0, 0.3);
    font-size: 19px;
  }
  .chip :global(.ic) {
    width: 22px;
    height: 22px;
  }
  .chip b {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
  .chip span {
    font-weight: 700;
    opacity: 0.85;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip i {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 4px;
    background: var(--yellow);
    transition: width 1s linear;
  }
  .chip.soon i {
    background: #ff6b5a;
  }
  .ring {
    position: absolute;
    left: 28px;
    right: 28px;
    top: 24px;
    z-index: 26;
    display: grid;
    gap: 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 18px;
    background: var(--red);
    color: #fff;
    border: 3px solid var(--ink);
    border-radius: 16px;
    padding: 16px 22px;
    box-shadow: 6px 7px 0 var(--shadow);
    animation: shake 0.9s ease-in-out infinite;
  }
  .row > :global(.ic) {
    width: 52px;
    height: 52px;
  }
  .what {
    flex: 1;
    min-width: 0;
  }
  .what b {
    display: block;
    font-family: var(--f-hand);
    font-weight: 400;
    font-size: 40px;
    line-height: 1.05;
  }
  .what span {
    font-size: 20px;
    font-weight: 700;
  }
  .pill {
    font-size: 22px;
    padding: 12px 22px;
    color: var(--ink);
  }
  .pill.solid {
    background: var(--ink);
    color: #fff;
  }
  .pill.big {
    font-size: 28px;
    padding: 14px 34px;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-2px); }
    80% { transform: translateX(2px); }
  }
</style>
