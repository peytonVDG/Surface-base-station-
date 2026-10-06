import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';

// Build label like "PR #4 · 4e8b1f6 · Oct 6", so Peyton can tell which build is on screen.
function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}
function buildLabel(): string {
  const log = git('log -200 --format=%s');
  const pr = /Merge pull request #(\d+)|\(#(\d+)\)\s*$/m.exec(log);
  const num = pr?.[1] ?? pr?.[2];
  const hash = git('rev-parse --short HEAD');
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Detroit' });
  return [num ? `PR #${num}` : 'dev', hash, date].filter(Boolean).join(' · ');
}

// In dev, the page runs on Vite (5173) and /api goes to the Python backend (8787).
// In production the backend serves the built files itself, so there's one origin.
export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  define: { __BUILD_LABEL__: JSON.stringify(buildLabel()) },
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
