<script lang="ts">
  import { setTodoDone } from '../lib/store.svelte';
  import type { Todos } from '../lib/types';
  import Icon from './Icon.svelte';

  let { todos }: { todos: Todos | null } = $props();

  // Overdue first, then open, then today's finished ones (struck through).
  const items = $derived(
    [...(todos?.items ?? [])].sort((a, b) => Number(a.done) - Number(b.done) || Number(b.overdue) - Number(a.overdue)),
  );
  const left = $derived(items.filter((t) => !t.done).length);
</script>

<section class="panel" aria-label="To-do list">
  <div class="ph">
    <h2>To do</h2>
    <span class="meta">
      {#if todos?.status === 'sample'}<span class="tag">Sample</span>{/if}
      {left} left
    </span>
  </div>
  <ul class="tasks">
    {#each items.slice(0, 5) as t (t.id)}
      <li>
        <button type="button" class="task" class:done={t.done} aria-pressed={t.done} onclick={() => setTodoDone(t.id, !t.done)}>
          <span class="box"><Icon name="check" /></span>
          <span class="lbl">{t.title}{#if t.overdue && !t.done}<small>Overdue</small>{/if}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  section {
    overflow: hidden;
  }
  .meta {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  .tasks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .task {
    display: flex;
    gap: 14px;
    align-items: center;
    width: 100%;
    min-height: 56px;
    text-align: left;
    background: none;
    border: 0;
    padding: 6px 2px;
    font-size: 21px;
    font-weight: 700;
    line-height: 1.2;
  }
  .box {
    width: 34px;
    height: 34px;
    border: 3px solid var(--border);
    border-radius: 9px;
    flex: none;
    display: grid;
    place-items: center;
    background: var(--paper);
  }
  .box :global(.ic) {
    width: 22px;
    height: 22px;
    stroke-width: 3.4;
    opacity: 0;
  }
  .done .box {
    background: var(--green);
    border-color: var(--green);
  }
  .done .box :global(.ic) {
    opacity: 1;
    color: #fff;
  }
  .done .lbl {
    text-decoration: line-through;
    color: var(--ink2);
  }
  small {
    display: block;
    font-size: 14px;
    color: var(--red);
    font-weight: 800;
  }
</style>
