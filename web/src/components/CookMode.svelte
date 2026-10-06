<!-- Cook mode: one step at a time in big type, ingredients that scale, one-tap timers. -->
<script lang="ts">
  import { formatMinutes, scaleIngredient, type Recipe } from '../lib/recipes';
  import { app, markCooked } from '../lib/store.svelte';
  import { clock, remaining } from '../lib/timers';
  import { startTimer, timers } from '../lib/timers.svelte';
  import Icon from './Icon.svelte';
  import Stars from './Stars.svelte';

  let { recipe, onback, onclose }: { recipe: Recipe; onback: () => void; onclose: () => void } = $props();

  let step = $state(0);
  // svelte-ignore state_referenced_locally (cook mode is remounted for each recipe)
  let servings = $state(recipe.servings);
  let checked: Record<number, boolean> = $state({});
  let message = $state('');

  const now = $derived(app.now.getTime());
  const factor = $derived(servings / recipe.servings);
  const cur = $derived(recipe.steps[step]);
  const last = $derived(step >= recipe.steps.length - 1);

  const timerLabel = (i: number, t: { label: string }) => `${recipe.title} · step ${i + 1} (${t.label})`;
  const running = (i: number, t: { label: string }) => timers.list.find((x) => x.label === timerLabel(i, t) && !x.ringing);

  /** The step's words, with the time phrases picked out so they stand out. */
  const parts = $derived.by(() => {
    if (!cur) return [];
    const labels = cur.timers.map((t) => t.label).sort((a, b) => b.length - a.length);
    if (!labels.length) return [{ text: cur.text, hit: false }];
    const re = new RegExp(`(${labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return cur.text.split(re).map((text, i) => ({ text, hit: i % 2 === 1 }));
  });

  function setTimer(i: number, t: { seconds: number; label: string }) {
    if (running(i, t)) return;
    if (!startTimer(t.seconds, timerLabel(i, t), now, recipe.title)) message = 'That is the most timers at once.';
  }

  async function cooked() {
    try {
      await markCooked(recipe.id);
      message = 'Logged. Nice cooking!';
      setTimeout(onback, 1500);
    } catch {
      message = "Couldn't save that. Try again in a moment.";
    }
  }
</script>

<section class="cook" class:has-timers={timers.list.some((t) => !t.ringing)} aria-label="Cooking {recipe.title}">
  <aside>
    <button type="button" class="pill" onclick={onback}><Icon name="back" /> Cookbook</button>
    <div class="head">
      <h2>{recipe.title}</h2>
      <div class="meta">
        {#if recipe.rating}<Stars rating={recipe.rating} />{/if}
        {#if recipe.minutes !== null}<span><Icon name="clock" />{formatMinutes(recipe.minutes)}</span>{/if}
      </div>
    </div>

    <div class="serv">
      <span>Servings</span>
      <button type="button" aria-label="Fewer servings" onclick={() => (servings = Math.max(1, servings - 1))}><Icon name="minus" /></button>
      <b>{servings}</b>
      <button type="button" aria-label="More servings" onclick={() => (servings = Math.min(99, servings + 1))}><Icon name="plus" /></button>
      {#if servings !== recipe.servings}<button type="button" class="reset" onclick={() => (servings = recipe.servings)}>Reset</button>{/if}
    </div>

    <ul class="ings">
      {#each recipe.ingredients as ing, i (i)}
        <li>
          <button type="button" class:got={checked[i]} onclick={() => (checked[i] = !checked[i])}>
            <span class="box"><Icon name="check" /></span>
            <span class="txt">{scaleIngredient(ing, factor)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </aside>

  <main>
    <div class="top">
      <div class="n">{recipe.steps.length ? `Step ${step + 1} of ${recipe.steps.length}` : 'No steps in this note'}</div>
      <button type="button" class="pill" onclick={onclose}><Icon name="close" /> Close</button>
    </div>
    <div class="bar" aria-hidden="true">
      {#each recipe.steps as _, i (i)}<i class:done={i <= step}></i>{/each}
    </div>

    {#if cur}
      <p class="text">{#each parts as p, i (i)}{#if p.hit}<mark>{p.text}</mark>{:else}{p.text}{/if}{/each}</p>

      {#if cur.timers.length}
        <div class="timers">
          {#each cur.timers as t (t.label)}
            {@const r = running(step, t)}
            <button type="button" class="tbtn" class:on={!!r} onclick={() => setTimer(step, t)}>
              <Icon name="timer" />
              {r ? `${clock(remaining(r, now))} left` : `Start ${t.label} timer`}
            </button>
          {/each}
        </div>
      {/if}
      {#if last && recipe.notes}<p class="notes"><b>Notes</b> {recipe.notes}</p>{/if}
    {/if}

    {#if message}<p class="msg" role="status">{message}</p>{/if}

    <div class="nav">
      <button type="button" class="go back" disabled={step === 0} onclick={() => (step -= 1)}><Icon name="back" /> Back</button>
      {#if last || !recipe.steps.length}
        <button type="button" class="go next done" onclick={cooked}><Icon name="check" /> Cooked it!</button>
      {:else}
        <button type="button" class="go next" onclick={() => (step += 1)}>Next <Icon name="next" /></button>
      {/if}
    </div>
  </main>
</section>

<style>
  .cook {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: var(--paper2);
    padding: 24px 28px 28px;
    display: grid;
    grid-template-columns: 430px 1fr;
    gap: 28px;
    box-sizing: border-box;
  }
  .cook.has-timers {
    padding-top: 62px; /* room for the running-timer chips */
  }
  aside {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
  }
  aside .pill,
  main .pill {
    align-self: flex-start;
    font-size: 19px;
    padding: 8px 18px;
  }
  h2 {
    font-family: var(--f-hand);
    font-weight: 400;
    font-size: 42px;
    line-height: 1.05;
    margin: 0 0 6px;
  }
  .meta {
    display: flex;
    gap: 16px;
    align-items: center;
    font-weight: 700;
    font-size: 18px;
    color: var(--ink2);
  }
  .meta span {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  .serv {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--paper);
    border: 3px solid var(--border);
    border-radius: 14px;
    padding: 8px 14px;
    font-size: 22px;
    font-weight: 800;
  }
  .serv span {
    flex: 1;
  }
  .serv b {
    min-width: 40px;
    text-align: center;
    font-size: 32px;
  }
  .serv button:not(.reset) {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 3px solid var(--border);
    background: var(--paper2);
    display: grid;
    place-items: center;
  }
  .serv button :global(.ic) {
    width: 26px;
    height: 26px;
  }
  .reset {
    border: 0;
    background: none;
    text-decoration: underline;
    font-size: 16px;
    font-weight: 800;
    color: var(--ink2);
  }
  .ings {
    list-style: none;
    margin: 0;
    padding: 4px 12px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: var(--paper);
    border: 3px solid var(--border);
    border-radius: 14px;
  }
  .ings li + li {
    border-top: 1px solid var(--line2);
  }
  .ings button {
    display: flex;
    gap: 12px;
    align-items: center;
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
    padding: 9px 0;
    font-size: 21px;
    font-weight: 600;
    line-height: 1.2;
  }
  .box {
    width: 26px;
    height: 26px;
    flex: none;
    border: 2.5px solid var(--border);
    border-radius: 7px;
    display: grid;
    place-items: center;
  }
  .box :global(.ic) {
    width: 18px;
    height: 18px;
    stroke-width: 3.2;
    opacity: 0;
  }
  .got .box {
    background: var(--green);
    border-color: var(--green);
    color: #fff;
  }
  .got .box :global(.ic) {
    opacity: 1;
  }
  .got .txt {
    text-decoration: line-through;
    color: var(--ink2);
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    min-height: 0;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .n {
    font-size: 26px;
    font-weight: 800;
    color: var(--ink2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .bar {
    display: flex;
    gap: 6px;
  }
  .bar i {
    flex: 1;
    height: 10px;
    border-radius: 5px;
    background: var(--line2);
  }
  .bar i.done {
    background: var(--red);
  }
  .text {
    font-size: 46px;
    line-height: 1.28;
    font-weight: 700;
    margin: 18px 0 0;
    flex: 1;
    overflow-y: auto;
  }
  mark {
    background: #fde9a2;
    color: inherit;
    border-radius: 8px;
    padding: 0 6px;
  }
  .timers {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }
  .tbtn {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    border: 3px solid var(--border);
    background: var(--yellow);
    border-radius: 16px;
    padding: 16px 26px;
    font-size: 28px;
    font-weight: 800;
    box-shadow: 4px 5px 0 var(--shadow);
  }
  .tbtn :global(.ic) {
    width: 34px;
    height: 34px;
  }
  .tbtn.on {
    background: var(--ink);
    color: var(--paper);
    font-variant-numeric: tabular-nums;
  }
  .notes {
    font-size: 22px;
    font-weight: 600;
    color: var(--ink2);
    margin: 0;
  }
  .msg {
    font-size: 24px;
    font-weight: 800;
    margin: 0;
    color: var(--green);
  }
  .nav {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 16px;
  }
  .go {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
    border: 3px solid var(--border);
    background: var(--paper);
    border-radius: 18px;
    padding: 24px;
    font-size: 36px;
    font-weight: 800;
    box-shadow: 5px 6px 0 var(--shadow);
  }
  .go :global(.ic) {
    width: 38px;
    height: 38px;
    stroke-width: 2.6;
  }
  .go:disabled {
    opacity: 0.35;
    box-shadow: none;
  }
  .go.next {
    background: var(--ink);
    color: var(--paper);
  }
  .go.done {
    background: var(--green);
    border-color: var(--green);
    color: #fff;
  }
</style>
