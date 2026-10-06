<!-- Links to the scheduled Claude daily brief artifact. Never shows its text. -->
<script lang="ts">
  import { sameDay, timeOfDay } from '../lib/format';
  import type { Brief } from '../lib/types';
  import Icon from './Icon.svelte';

  let { brief, now, h24 }: { brief: Brief | null; now: Date; h24: boolean } = $props();

  const updated = $derived(brief?.updated_at ? new Date(brief.updated_at) : null);
  const subtitle = $derived(
    !brief?.url
      ? 'Add the brief link to config.toml'
      : updated
        ? `Updated ${sameDay(updated, now) ? 'today' : updated.toLocaleDateString('en-US', { weekday: 'long' })} at ${timeOfDay(updated, h24)}`
        : "Today's brief",
  );

  function open() {
    // In the kiosk this becomes a separate signed-in window with a "Back to kitchen" button.
    if (brief?.url) window.open(brief.url, 'kitchen-brief');
  }
</script>

<section class="panel brief" aria-label="Claude daily brief">
  <div class="ph"><h2>Daily brief</h2></div>
  <button type="button" class="bopen" onclick={open} disabled={!brief?.url}>
    <span class="bthumb" aria-hidden="true"><i class="h"></i><i></i><i></i><i class="s"></i><i></i><i class="s"></i><i></i></span>
    <span class="binfo">
      <b>{brief?.url ? 'Ready for you' : 'Not linked yet'}</b>
      <span>{subtitle}</span>
      <span class="pill solid"><Icon name="open" />Open brief</span>
    </span>
  </button>
</section>

<style>
  .brief {
    position: relative;
    padding-top: 34px;
    overflow: hidden;
  }
  /* Charlie Brown zigzag stripe */
  .brief::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 20px;
    border-bottom: 3px solid var(--border);
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20'%3E%3Crect width='40' height='20' fill='%23f5c518'/%3E%3Cpolyline points='0,13 10,5 20,13 30,5 40,13' fill='none' stroke='%231b1b1b' stroke-width='3'/%3E%3C/svg%3E")
      repeat-x;
  }
  .bopen {
    display: flex;
    gap: 16px;
    align-items: center;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 0;
  }
  .bopen:disabled {
    cursor: default;
  }
  .bopen:disabled .pill {
    opacity: 0.4;
  }
  .bthumb {
    width: 112px;
    height: 140px;
    flex: none;
    border: 2.5px solid var(--border);
    border-radius: 8px;
    background: #fffdf5;
    padding: 10px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transform: rotate(-3deg);
    box-shadow: 3px 4px 0 var(--shadow);
  }
  .bthumb i {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: #d9d3c3;
  }
  .bthumb i.h {
    height: 12px;
    width: 70%;
    background: #c8102e;
  }
  .bthumb i.s {
    width: 60%;
  }
  .binfo b {
    display: block;
    font-size: 20px;
    line-height: 1.2;
  }
  .binfo > span {
    display: block;
    font-size: 15px;
    color: var(--ink2);
    font-weight: 700;
    margin-top: 2px;
  }
  .binfo .pill {
    display: inline-flex;
    margin-top: 12px;
    font-size: 18px;
    padding: 9px 18px;
    color: var(--paper);
  }
  .pill :global(.ic) {
    width: 20px;
    height: 20px;
  }
</style>
