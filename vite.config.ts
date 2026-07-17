import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages project sites.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    minify: 'esbuild',
  },
});
