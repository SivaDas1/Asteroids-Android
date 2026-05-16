import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    minify: 'terser',
    chunkSizeWarningLimit: 1600,
  },
});
