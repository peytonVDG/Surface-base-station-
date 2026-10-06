<!-- Big shortcuts along the bottom. Cookbook and Timers work; the rest arrive in later builds. -->
<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  import { clock, remaining } from '../lib/timers';
  import { timers } from '../lib/timers.svelte';

  let { micMuted, now, onopen }: { micMuted: boolean; now: number; onopen: (what: string) => void } = $props();

  const timerSub = $derived.by(() => {
    if (!timers.list.length) return 'None set';
    const next = timers.list.map((t) => remaining(t, now)).sort((a, b) => a - b)[0];
    const n = timers.list.length;
    return `${n} running · ${next ? clock(next) : 'Done'}`;
  });

  const items: { id: string; icon: IconName; label: string; sub: string }[] = $derived([
    { id: 'Cookbook', icon: 'book', label: 'Cookbook', sub: 'Recipes' },
    { id: 'Timers', icon: 'timer', label: 'Timers', sub: timerSub },
    { id: 'Groceries', icon: 'cart', label: 'Groceries', sub: 'Keep list' },
    { id: 'Voice', icon: micMuted ? 'micOff' : 'mic', label: 'Hey Claude', sub: micMuted ? 'Mic muted' : 'Listening' },
  ]);
</script>

<nav class="dock" aria-label="Shortcuts">
  {#each items as it (it.id)}
    <button type="button" class="dk" class:book={it.id === 'Cookbook'} onclick={() => onopen(it.id)}>
      <Icon name={it.icon} />
      <div>
        <b>{it.label}</b>
        <span>{#if it.id === 'Voice' && !micMuted}<i class="dot"></i>{/if}{it.sub}</span>
      </div>
    </button>
  {/each}
</nav>

<style>
  .dock {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  .dk {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    padding: 8px 10px;
    background: var(--paper);
    border: 3px solid var(--border);
    border-radius: 14px;
    box-shadow: 5px 6px 0 var(--shadow);
  }
  .dk :global(.ic) {
    width: 36px;
    height: 36px;
    stroke-width: 2.2;
  }
  .dk.book :global(.ic) {
    color: var(--red);
  }
  b {
    display: block;
    font-size: 20px;
    line-height: 1.1;
    white-space: nowrap;
  }
  span {
    white-space: nowrap;
    font-size: 14px;
    color: var(--ink2);
    font-weight: 700;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--green);
    display: inline-block;
    margin-right: 6px;
    animation: pulse 2.2s ease-in-out infinite;
  }
</style>
