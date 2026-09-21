import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Files from public/ that the service worker should cache together with the built bundle. */
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

/** Writes dist/sw.js from src/sw.js with the list of files to cache and a version hash. */
function serviceWorker(): Plugin {
  return {
    name: 'theo-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((file) => file !== 'index.html')
        .map((file) => `./${file}`);
      const files = [...STATIC_FILES, ...built];
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8');
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// `base: './'` gør at appen kan indlæses fra Capacitors lokale server
// (capacitor://localhost på iOS, https://localhost på Android), fra en undermappe
// på et website og fra en almindelig mappe uden en webserver.
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
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
