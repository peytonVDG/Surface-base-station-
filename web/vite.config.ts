import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// In dev, the page runs on Vite (5173) and /api goes to the Python backend (8787).
// In production the backend serves the built files itself, so there's one origin.
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
