<!--
  Styled after Google Calendar's day view so it's recognisable at a glance: white
  card, Google blue date badge, rounded colour chips for events. (Google's own embed
  only works for public calendars and can't be signed in on a kiosk, so this is drawn
  natively from the same data.) No Google logos are used.
-->
<script lang="ts">
  import { sameDay, timeOfDay } from '../lib/format';
  import type { Calendar } from '../lib/types';

  let { calendar, now, h24 }: { calendar: Calendar | null; now: Date; h24: boolean } = $props();

  const tomorrowDate = $derived(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const events = $derived(calendar?.events ?? []);
  const today = $derived(events.filter((e) => sameDay(new Date(e.start), now) || (e.all_day && new Date(e.start) <= now && now < new Date(e.end))));
  const tomorrow = $derived(events.filter((e) => sameDay(new Date(e.start), tomorrowDate)));
  const focusId = $derived(
    (today.find((e) => !e.all_day && new Date(e.start) <= now && now < new Date(e.end)) ??
      today.find((e) => !e.all_day && new Date(e.start) > now))?.id,
  );
  const shortTime = (iso: string) => timeOfDay(new Date(iso), h24).replace(':00', '');
  const range = (e: { start: string; end: string }) => `${shortTime(e.start)} – ${shortTime(e.end)}`;
</script>

<section class="gcal" aria-label="Calendar">
  <header>
    <span class="badge"><small>{now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</small>{now.getDate()}</span>
    <div class="title">
      <b>{now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
      <span>
        Calendar
        {#if calendar?.status === 'sample'}<em>Sample</em>{:else if calendar?.status === 'stale'}<em>Offline</em>{/if}
      </span>
    </div>
  </header>
  {#if today.length}
    <ul>
      {#each today.slice(0, 5) as e (e.id)}
        <li class:past={!e.all_day && new Date(e.end) <= now}>
          <span class="chip" class:focus={e.id === focusId} style:--c={e.color}>
            <b>{e.title}</b>
            <small>{e.all_day ? 'All day' : range(e)}{#if e.location} · {e.location}{/if}</small>
          </span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">{calendar ? 'Nothing on the calendar' : 'Loading…'}</p>
  {/if}
  {#if tomorrow.length}
    <div class="tmrw">
      Tomorrow · {tomorrow
        .slice(0, 3)
        .map((e) => (e.all_day ? e.title : `${shortTime(e.start)} ${e.title}`))
        .join(' · ')}
    </div>
  {/if}
</section>

<style>
  .gcal {
    --g-ink: #202124;
    --g-sub: #5f6368;
    --g-line: #dadce0;
    --g-blue: #1a73e8;
    background: #fff;
    color: var(--g-ink);
    border: 1px solid var(--g-line);
    border-radius: 18px;
    box-shadow: 0 2px 6px rgba(60, 64, 67, 0.3), 0 8px 24px rgba(60, 64, 67, 0.15);
    padding: 16px 18px;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    font-family: 'Google Sans', Roboto, 'Nunito', system-ui, sans-serif;
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }
  .badge {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: var(--g-blue);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    flex: none;
  }
  .badge small {
    font-size: 11px;
    letter-spacing: 0.08em;
    margin-bottom: 2px;
    opacity: 0.9;
  }
  .title {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title b {
    font-size: 22px;
    font-weight: 500;
  }
  .title span {
    font-size: 15px;
    color: var(--g-sub);
    font-weight: 600;
  }
  em {
    font-style: normal;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: #f1f3f4;
    border-radius: 6px;
    padding: 1px 7px;
    margin-left: 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .chip {
    display: block;
    border-radius: 8px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--c) 16%, #fff);
    border-left: 5px solid var(--c);
    min-width: 0;
  }
  .chip b {
    display: block;
    font-size: 19px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip small {
    display: block;
    font-size: 14px;
    color: var(--g-sub);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip.focus {
    background: var(--c);
    border-left-color: var(--c);
  }
  .chip.focus b,
  .chip.focus small {
    color: #fff;
  }
  li.past {
    opacity: 0.5;
  }
  .tmrw {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--g-line);
    font-size: 15px;
    color: var(--g-sub);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    font-size: 19px;
    color: var(--g-sub);
    font-weight: 600;
    margin: 12px 0;
  }
</style>
