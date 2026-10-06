<script lang="ts">
  import { timeOfDay } from '../lib/format';
  import { ringColour, type LeaveInfo } from '../lib/leave';

  let { info, h24 }: { info: LeaveInfo; h24: boolean } = $props();

  const short = (d: Date) => timeOfDay(d, h24).replace(/ [AP]M$/, '');
  // On the work countdown the card follows the ring's smooth colour; otherwise the level colours.
  const colour = $derived(info.kind === 'work' ? ringColour(info.fraction) : null);
</script>

<section class="panel leave {info.level}" class:work={info.kind === 'work'} aria-live="polite" style:--c={colour}>
  <div class="ph">
    <h2>{info.title}</h2>
    {#if info.kind === 'work'}<span class="meta">Weekdays</span>{:else if info.target}<span class="meta">{timeOfDay(info.target, h24)}</span>{/if}
  </div>
  {#if info.kind === 'none'}
    <div class="big-n">—</div>
    <div class="sub">Calendar is clear</div>
  {:else}
    <div class="big-n">{Math.max(0, Math.ceil(info.minutes))}<small>min</small></div>
    <div class="sub">{info.kind === 'work' ? 'Leave by' : 'Starts at'} {timeOfDay(info.target!, h24)}</div>
    <div class="ltrack"><i style:width="{Math.min(100, info.fraction * 100)}%"></i></div>
    <div class="lends">
      <span>{info.start ? `Up ${short(info.start)}` : ''}</span>
      <span>{info.kind === 'work' ? 'Out' : 'At'} {short(info.target!)}</span>
    </div>
  {/if}
</section>

<style>
  .leave {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ph h2 {
    font-size: 30px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .ph .meta {
    white-space: nowrap;
  }
  .big-n {
    font-family: var(--f-round);
    font-weight: 500;
    font-size: 72px;
    line-height: 0.95;
    font-variant-numeric: tabular-nums;
  }
  .big-n small {
    font-size: 28px;
    margin-left: 6px;
  }
  .sub {
    font-size: 18px;
    font-weight: 800;
    color: var(--ink2);
  }
  .ltrack {
    position: relative;
    height: 14px;
    border-radius: 7px;
    background: var(--line2);
    margin-top: auto;
    overflow: hidden;
  }
  .ltrack i {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--green);
    border-radius: 7px;
    transition: width 1s linear;
  }
  .lends {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 800;
    color: var(--ink2);
  }
  .soon .big-n,
  .soon h2 { color: var(--amber); }
  .soon .ltrack i { background: var(--amber); }
  .late .big-n,
  .late h2 { color: var(--red); }
  .late .ltrack i { background: var(--red); }
  .late { animation: pulse 1.6s ease-in-out infinite; }
  .work .big-n { color: var(--c); }
  .work .ltrack i { background: var(--c); }
</style>
