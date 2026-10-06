<!-- Five stars, filled to the rating (halves allowed). -->
<script lang="ts">
  import Icon from './Icon.svelte';

  let { rating }: { rating: number } = $props();
</script>

<span class="stars" role="img" aria-label="{rating} out of 5">
  {#each [0, 1, 2, 3, 4] as i (i)}
    <span class="s" style:--fill="{Math.max(0, Math.min(1, rating - i)) * 100}%"><Icon name="star" /></span>
  {/each}
</span>

<style>
  .stars {
    display: inline-flex;
    gap: 1px;
  }
  .s {
    position: relative;
    display: inline-block;
    width: 20px;
    height: 20px;
    color: var(--amber);
  }
  .s :global(.ic) {
    width: 20px;
    height: 20px;
    stroke-width: 1.8;
    opacity: 0.45;
  }
  .s::after {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    width: var(--fill);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z'/%3E%3C/svg%3E") left / 20px 20px no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z'/%3E%3C/svg%3E") left / 20px 20px no-repeat;
  }
</style>
