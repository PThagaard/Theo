import { defineConfig } from 'vitest/config';

// `base: './'` gør at appen kan indlæses fra Capacitors lokale server
// (capacitor://localhost på iOS, https://localhost på Android) og fra en
// almindelig mappe uden en webserver.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
