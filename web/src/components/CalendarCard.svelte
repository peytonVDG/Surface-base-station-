<script lang="ts">
  import { sameDay, timeOfDay } from '../lib/format';
  import type { Calendar } from '../lib/types';

  let { calendar, now, h24 }: { calendar: Calendar | null; now: Date; h24: boolean } = $props();

  const tomorrowDate = $derived(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const events = $derived(calendar?.events ?? []);
  const today = $derived(events.filter((e) => sameDay(new Date(e.start), now) || (e.all_day && new Date(e.start) <= now && now < new Date(e.end))));
  const tomorrow = $derived(events.filter((e) => sameDay(new Date(e.start), tomorrowDate)));
  // Red highlight on whatever is happening now, else the next thing up.
  const focusId = $derived(
    (today.find((e) => !e.all_day && new Date(e.start) <= now && now < new Date(e.end)) ??
      today.find((e) => !e.all_day && new Date(e.start) > now))?.id,
  );
  const shortTime = (iso: string) => timeOfDay(new Date(iso), h24).replace(':00', '');
</script>

<section class="panel" aria-label="Calendar">
  <div class="ph">
    <h2>Today</h2>
    {#if calendar?.status === 'sample'}<span class="tag">Sample</span>{:else if calendar?.status === 'stale'}<span class="tag">Offline</span>{/if}
  </div>
  {#if today.length}
    <ul class="events">
      {#each today.slice(0, 5) as e (e.id)}
        <li class:now={e.id === focusId} class:past={!e.all_day && new Date(e.end) <= now}>
          <span class="tm">{e.all_day ? 'All day' : timeOfDay(new Date(e.start), h24)}</span>
          <span class="ev"><i style:background={e.color}></i>{e.title}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">{calendar ? 'Nothing on the calendar' : 'Loading…'}</p>
  {/if}
  {#if tomorrow.length}
    <div class="tmrw">
      Tomorrow: {tomorrow
        .slice(0, 3)
        .map((e) => (e.all_day ? e.title : `${shortTime(e.start)} ${e.title}`))
        .join(' · ')}
    </div>
  {/if}
</section>

<style>
  section {
    overflow: hidden;
  }
  .events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .events li {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 2px dashed var(--line2);
    align-items: baseline;
  }
  .tm {
    font-weight: 800;
    font-size: 17px;
    color: var(--ink2);
    font-variant-numeric: tabular-nums;
  }
  .ev {
    font-size: 21px;
    font-weight: 700;
    line-height: 1.2;
    display: flex;
    gap: 9px;
    align-items: baseline;
    min-width: 0;
  }
  .ev i {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex: none;
    transform: translateY(-1px);
  }
  li.now .tm { color: var(--red); }
  li.past { opacity: 0.5; }
  .tmrw {
    margin-top: 12px;
    font-size: 16px;
    color: var(--ink2);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    font-size: 20px;
    color: var(--ink2);
    font-weight: 700;
    margin: 12px 0;
  }
</style>
