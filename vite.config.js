import { defineConfig } from 'vite';

// Relative base so the built game works from any static host sub-path (GitHub Pages, itch.io, etc.).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  server: { host: true },
});
