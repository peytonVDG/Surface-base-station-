<!-- Edit a recipe in the app: the note's Markdown, with quick fields for the front matter on top. -->
<script lang="ts">
  import { parseRecipe, setFrontMatter } from '../lib/recipes';
  import { app, deleteRecipe, saveRecipe } from '../lib/store.svelte';
  import Icon from './Icon.svelte';

  let { id, onclose, ondeleted }: { id: string; onclose: () => void; ondeleted: () => void } = $props();

  const file = $derived(app.recipes?.items.find((r) => r.id === id));
  // svelte-ignore state_referenced_locally (the editor is remounted for each recipe)
  let draft = $state(file?.markdown ?? '');
  // svelte-ignore state_referenced_locally
  const original = file?.markdown ?? '';

  const dirty = $derived(draft !== original);
  const parsed = $derived(parseRecipe({ id, markdown: draft, photo: null, cooked: [] }));
  const timerCount = $derived(parsed.steps.reduce((n, s) => n + s.timers.length, 0));

  let busy = $state(false);
  let error = $state('');
  let confirm: 'discard' | 'delete' | null = $state(null);

  const field = (key: string, value: string | string[]) => (draft = setFrontMatter(draft, key, value));
  const text = (e: Event) => (e.currentTarget as HTMLInputElement).value;

  async function save() {
    busy = true;
    error = '';
    try {
      await saveRecipe(id, draft);
      onclose();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    busy = true;
    error = '';
    try {
      await deleteRecipe(id);
      ondeleted();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      busy = false;
    }
  }
</script>

<section class="editor" aria-label="Edit {parsed.title}">
  <header>
    <h2>Edit recipe</h2>
    <span class="where">{file?.folder}</span>
    <span class="gap"></span>
    {#if confirm === 'discard'}
      <span class="ask">Throw away your changes?</span>
      <button type="button" class="pill" onclick={() => (confirm = null)}>Keep editing</button>
      <button type="button" class="pill danger" onclick={onclose}>Discard</button>
    {:else if confirm === 'delete'}
      <span class="ask">Delete this recipe? (It goes to the folder's .trash.)</span>
      <button type="button" class="pill" onclick={() => (confirm = null)}>No</button>
      <button type="button" class="pill danger" disabled={busy} onclick={remove}>Delete</button>
    {:else}
      <button type="button" class="pill" disabled={busy} onclick={() => (dirty ? (confirm = 'discard') : onclose())}><Icon name="close" /> Cancel</button>
      <button type="button" class="pill solid" disabled={busy || !dirty} onclick={save}><Icon name="check" /> Save</button>
    {/if}
  </header>

  <div class="fields">
    <label class="wide">Name<input value={parsed.title} onchange={(e) => field('title', text(e))} /></label>
    <label>Servings<input type="number" min="1" max="99" inputmode="numeric" value={parsed.servings} onchange={(e) => field('servings', text(e))} /></label>
    <label>Time<input placeholder="1 hr 15 min" value={parsed.timeText} onchange={(e) => field('time', text(e))} /></label>
    <label>Rating (1–5)<input type="number" min="0" max="5" step="0.5" inputmode="decimal" value={parsed.rating ?? ''} onchange={(e) => field('rating', text(e))} /></label>
    <label class="wide">Tags (commas)<input placeholder="dessert, baking" value={parsed.tags.join(', ')} onchange={(e) => field('tags', text(e).split(/[ ,]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean))} /></label>
  </div>

  <textarea spellcheck="true" aria-label="Recipe text" bind:value={draft}></textarea>

  <footer>
    <span class="sum">
      {parsed.ingredients.length} ingredient{parsed.ingredients.length === 1 ? '' : 's'} · {parsed.steps.length} step{parsed.steps.length === 1 ? '' : 's'} · {timerCount} timer{timerCount === 1 ? '' : 's'} found
    </span>
    <span class="help">Ingredients and Steps are lists under "## Ingredients" and "## Steps". Times like "20 minutes" in a step become timer buttons.</span>
    {#if error}<span class="err" role="alert">{error}</span>{/if}
    <span class="gap"></span>
    {#if !confirm}<button type="button" class="pill danger-text" disabled={busy} onclick={() => (confirm = 'delete')}>Delete recipe</button>{/if}
  </footer>
</section>

<style>
  .editor {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: var(--paper2);
    padding: 24px 28px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
  }
  header,
  footer {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  h2 {
    font-family: var(--f-hand);
    font-weight: 400;
    font-size: 42px;
    line-height: 1;
    margin: 0;
  }
  .where {
    font-weight: 800;
    font-size: 18px;
    color: var(--ink2);
  }
  .gap {
    flex: 1;
  }
  .pill {
    font-size: 20px;
    padding: 9px 20px;
  }
  .pill:disabled {
    opacity: 0.45;
  }
  .pill.danger {
    background: var(--red);
    border-color: var(--red);
    color: #fff;
  }
  .pill.danger-text {
    color: var(--red);
    border-color: var(--line2);
    font-size: 17px;
  }
  .ask {
    font-weight: 800;
    font-size: 19px;
  }
  .fields {
    display: grid;
    grid-template-columns: 2fr 0.8fr 1.2fr 1fr 2fr;
    gap: 12px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 15px;
    font-weight: 800;
    color: var(--ink2);
  }
  label.wide {
    min-width: 0;
  }
  input,
  textarea {
    font: inherit;
    font-weight: 700;
    color: var(--ink);
    background: var(--paper);
    border: 3px solid var(--border);
    border-radius: 12px;
    -webkit-user-select: text;
    user-select: text;
  }
  input {
    font-size: 21px;
    padding: 8px 12px;
    min-width: 0;
  }
  textarea {
    flex: 1;
    min-height: 0;
    resize: none;
    font-family: ui-monospace, 'DejaVu Sans Mono', monospace;
    font-size: 21px;
    line-height: 1.45;
    padding: 14px 16px;
    white-space: pre-wrap;
  }
  footer {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink2);
    min-height: 36px;
  }
  .sum {
    color: var(--ink);
    font-weight: 800;
  }
  .help {
    flex: 1;
  }
  .err {
    color: var(--red);
    font-weight: 800;
  }
</style>
