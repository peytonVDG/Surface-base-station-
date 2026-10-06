import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// In dev, the page runs on Vite (5173) and /api goes to the Python backend (8787).
// In production the backend serves the built files itself, so there's one origin.
export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  // The demo is one self-contained HTML file (fonts inlined) so it can be hosted anywhere.
  build: mode === 'demo' ? { outDir: 'dist-demo', assetsInlineLimit: Infinity, cssCodeSplit: false } : mode === 'pages' ? { outDir: 'dist-pages' } : undefined,
  // GitHub Pages serves the site from /<repo>/, so the Pages build uses relative asset paths.
  base: mode === 'pages' ? './' : '/',
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}));
