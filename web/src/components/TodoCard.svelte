<!--
  Styled after Todoist's Today view: white card, Todoist red header, round priority
  checkboxes (red / orange / blue / grey), due times in green or red. Todoist has no
  embeddable widget, so this is drawn natively from the same data. No Todoist logos.
-->
<script lang="ts">
  import { setTodoDone } from '../lib/store.svelte';
  import { timeOfDay } from '../lib/format';
  import type { Todos } from '../lib/types';
  import Icon from './Icon.svelte';

  let { todos, h24 = false }: { todos: Todos | null; h24?: boolean } = $props();

  // Overdue first, then open, then today's finished ones (struck through).
  const items = $derived(
    [...(todos?.items ?? [])].sort(
      (a, b) => Number(a.done) - Number(b.done) || Number(b.overdue) - Number(a.overdue) || a.priority - b.priority,
    ),
  );
  const left = $derived(items.filter((t) => !t.done).length);
  const due = (iso: string) => timeOfDay(new Date(iso), h24);
</script>

<section class="td" aria-label="To-do list">
  <header>
    <h2>Today</h2>
    <span class="meta">
      {#if todos?.status === 'sample'}<em>Sample</em>{:else if todos?.status === 'stale'}<em>Offline</em>{/if}
      <Icon name="check" />{left} left
    </span>
  </header>
  <ul>
    {#each items.slice(0, 5) as t (t.id)}
      <li>
        <button type="button" class="task p{t.priority}" class:done={t.done} aria-pressed={t.done} onclick={() => setTodoDone(t.id, !t.done)}>
          <span class="ring"><Icon name="check" /></span>
          <span class="lbl">
            {t.title}
            {#if t.overdue && !t.done}
              <small class="late">Overdue</small>
            {:else if t.due && !t.done}
              <small>{due(t.due)}</small>
            {/if}
          </span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .td {
    --t-red: #db4c3f;
    --t-ink: #202020;
    --t-sub: #808080;
    --t-line: #f0f0f0;
    background: #fff;
    color: var(--t-ink);
    border: 1px solid #e0e0e0;
    border-top: 6px solid var(--t-red);
    border-radius: 18px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 12px 18px 10px;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    font-family: -apple-system, 'Segoe UI', Roboto, 'Nunito', system-ui, sans-serif;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }
  h2 {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    color: var(--t-sub);
    font-weight: 600;
  }
  .meta :global(.ic) {
    width: 16px;
    height: 16px;
    stroke-width: 2.4;
  }
  em {
    font-style: normal;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: #f5f5f5;
    border-radius: 6px;
    padding: 1px 7px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li + li {
    border-top: 1px solid var(--t-line);
  }
  .task {
    --p: #b3b3b3;
    --pbg: #f5f5f5;
    display: flex;
    gap: 14px;
    align-items: center;
    width: 100%;
    min-height: 54px;
    text-align: left;
    background: none;
    border: 0;
    padding: 6px 2px;
    font: inherit;
    font-size: 20px;
    font-weight: 500;
    color: inherit;
  }
  .p1 { --p: #d1453b; --pbg: #fce9e7; }
  .p2 { --p: #eb8909; --pbg: #fdf0dc; }
  .p3 { --p: #246fe0; --pbg: #e3edfc; }
  .ring {
    width: 28px;
    height: 28px;
    border: 2.5px solid var(--p);
    background: var(--pbg);
    border-radius: 50%;
    flex: none;
    display: grid;
    place-items: center;
  }
  .ring :global(.ic) {
    width: 16px;
    height: 16px;
    stroke-width: 3.2;
    color: var(--p);
    opacity: 0;
  }
  .task:active .ring :global(.ic),
  .done .ring :global(.ic) {
    opacity: 1;
  }
  .done .ring {
    background: var(--p);
  }
  .done .ring :global(.ic) {
    color: #fff;
  }
  .done .lbl {
    text-decoration: line-through;
    color: var(--t-sub);
  }
  small {
    display: block;
    font-size: 14px;
    color: #058527;
    font-weight: 600;
  }
  small.late {
    color: #d1453b;
  }
</style>
