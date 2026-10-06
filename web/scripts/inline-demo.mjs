// Folds the demo build's JS and CSS into dist-demo/demo.html so it's a single
// self-contained page (fonts are already inlined as data URIs by Vite).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../dist-demo/', import.meta.url).pathname;
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const js = html.match(/<script type="module" crossorigin src="\/(assets\/[^"]+\.js)"><\/script>/);
const css = html.match(/<link rel="stylesheet" crossorigin href="\/(assets\/[^"]+\.css)">/);
if (!js || !css) throw new Error('Unexpected Vite output; update scripts/inline-demo.mjs');
const read = (p) => readFileSync(join(dir, p), 'utf8');

// The page body only: the host page supplies doctype/html/head/body.
const out = [
  '<title>Kitchen Display</title>',
  `<style>${read(css[1])}</style>`,
  '<div id="app"></div>',
  `<script type="module">${read(js[1]).replaceAll('</script', '<\\/script')}</script>`,
].join('\n');
writeFileSync(join(dir, 'demo.html'), out);
console.log(`dist-demo/demo.html: ${(out.length / 1024).toFixed(0)} KB`);
