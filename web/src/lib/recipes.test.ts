import { describe, expect, it } from 'vitest';
import { allTags, filterRecipes, findTimers, formatQty, parseIngredient, parseMinutes, parseRecipe, scaleIngredient } from './recipes';

const note = (markdown: string, id = 'Soup') => parseRecipe({ id, markdown, photo: null, cooked: [] });

describe('ingredients', () => {
  it('reads whole, fraction, mixed and unicode quantities', () => {
    expect(parseIngredient('2 cups flour').qty).toBe(2);
    expect(parseIngredient('1/2 cup milk').qty).toBe(0.5);
    expect(parseIngredient('1 1/2 teaspoons salt').qty).toBe(1.5);
    expect(parseIngredient('1½ cups sugar')).toMatchObject({ qty: 1.5, rest: 'cups sugar' });
    expect(parseIngredient('½ onion').qty).toBe(0.5);
    expect(parseIngredient('salt to taste').qty).toBeNull();
  });
  it('reads ranges', () => {
    expect(parseIngredient('2-3 carrots')).toMatchObject({ qty: 2, qtyMax: 3, rest: 'carrots' });
  });
  it('scales and prints friendly fractions', () => {
    expect(scaleIngredient(parseIngredient('1 1/2 teaspoons cumin'), 2)).toBe('3 teaspoons cumin');
    expect(scaleIngredient(parseIngredient('1 cup rice'), 0.5)).toBe('½ cup rice');
    expect(scaleIngredient(parseIngredient('1 cup rice'), 1 / 3)).toBe('⅓ cup rice');
    expect(scaleIngredient(parseIngredient('2-3 carrots'), 2)).toBe('4–6 carrots');
    expect(scaleIngredient(parseIngredient('a pinch of salt'), 4)).toBe('a pinch of salt');
    expect(scaleIngredient(parseIngredient('1 can (14 oz) tomatoes'), 2)).toBe('2 can (14 oz) tomatoes');
    expect(formatQty(0.99)).toBe('1');
    expect(formatQty(24)).toBe('24');
  });
});

describe('timers', () => {
  it('finds minutes, hours, seconds and ranges', () => {
    expect(findTimers('Simmer for 20 minutes.')).toEqual([{ seconds: 1200, label: '20 minutes' }]);
    expect(findTimers('Bake 8-10 min')[0].seconds).toBe(600);
    expect(findTimers('Roast 1 hour 30 minutes')[0].seconds).toBe(5400);
    expect(findTimers('Rest 30 seconds')[0].seconds).toBe(30);
    expect(findTimers('Chill for half an hour')[0].seconds).toBe(1800);
  });
  it('ignores steps without a time and amounts that are not times', () => {
    expect(findTimers('Stir in 2 cups of broth')).toEqual([]);
    expect(findTimers('Mix well')).toEqual([]);
  });
  it('finds several in one step', () => {
    expect(findTimers('Cook 5 minutes, then 2 minutes more').map((t) => t.seconds)).toEqual([300, 120]);
  });
});

describe('parseRecipe', () => {
  const md = `---
title: "Tortilla Soup"
servings: 6
time: 1 hr 15 min
rating: 4.5
tags: [Soup, "Chicken"]
---
# Ignored heading
![[soup.jpg]]
## Ingredients
- 2 cups [[Chicken broth|broth]]
- **1** onion
## Directions
1. Chop.
2. Simmer for 20 minutes.
## Notes
Freezes well.
`;
  it('reads front matter, sections and Obsidian syntax', () => {
    const r = note(md);
    expect(r).toMatchObject({ title: 'Tortilla Soup', servings: 6, minutes: 75, rating: 4.5, tags: ['soup', 'chicken'], notes: 'Freezes well.' });
    expect(r.ingredients.map((i) => i.raw)).toEqual(['2 cups broth', '1 onion']);
    expect(r.steps.map((s) => s.timers.length)).toEqual([0, 1]);
  });
  it('copes with a bare note: heading title, defaults, block tag lists', () => {
    const r = note('---\ntags:\n  - dinner\n  - quick\n---\n# Plain Pasta\n## Ingredients\n- pasta\n## Steps\nBoil it.\n\nDrain it.\n', 'Dinner/plain-pasta');
    expect(r).toMatchObject({ title: 'Plain Pasta', servings: 4, tags: ['dinner', 'quick'], minutes: null });
    expect(r.steps.map((s) => s.text)).toEqual(['Boil it.', 'Drain it.']);
    expect(note('nothing here', 'Dinner/my-recipe').title).toBe('my recipe');
  });
  it('reads minutes in several shapes', () => {
    expect(parseMinutes('45')).toBe(45);
    expect(parseMinutes('1:30')).toBe(90);
    expect(parseMinutes('20 min')).toBe(20);
    expect(parseMinutes('')).toBeNull();
  });
});

describe('cookbook search', () => {
  const a = note('---\ntitle: Chicken Soup\ntime: 40\nrating: 4\ntags: [soup]\n---\n## Ingredients\n- 1 chicken\n', 'a');
  const b = note('---\ntitle: Brownies\ntime: 25\nrating: 5\ntags: [dessert]\n---\n## Ingredients\n- 1 cup cocoa\n', 'b');
  const base = { query: '', tag: null, sort: 'name' as const };
  it('searches names, tags and ingredients', () => {
    expect(filterRecipes([a, b], { ...base, query: 'cocoa' }).map((r) => r.id)).toEqual(['b']);
    expect(filterRecipes([a, b], { ...base, query: 'soup chicken' }).map((r) => r.id)).toEqual(['a']);
    expect(filterRecipes([a, b], { ...base, tag: 'dessert' }).map((r) => r.id)).toEqual(['b']);
  });
  it('sorts', () => {
    expect(filterRecipes([a, b], { ...base, sort: 'rating' }).map((r) => r.id)).toEqual(['b', 'a']);
    expect(filterRecipes([a, b], { ...base, sort: 'time' }).map((r) => r.id)).toEqual(['b', 'a']);
    expect(allTags([a, b])).toEqual(['dessert', 'soup']);
  });
});
