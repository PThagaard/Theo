// Shared helpers for the end-to-end checks: a tiny static server for dist/ and a phone-sized browser.
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DIST = path.join(ROOT, 'dist');
export const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/** Serves dist/ on a random localhost port. Returns { url, close, requests() }. */
export async function serveDist() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ mangler – kør `npm run build` først');
  let requests = 0;
  const server = http.createServer((req, res) => {
    requests++;
    let file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    if (file.endsWith('/')) file += 'index.html';
    if (!file.startsWith(DIST) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => server.close(),
    requests: () => requests,
  };
}

export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
};

/** Launches Chromium with a touch-enabled, phone-like context. Collects console errors in `problems`. */
export async function openPhone(viewport = VIEWPORTS.phone) {
  // A fake microphone, so the parents' voice recording can be exercised without a real device.
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return { browser, context, page, problems };
}

export const waitForGame = (page) =>
  page.waitForFunction(() => window.__theo && window.__theo.game.balloons.length > 0, null, { timeout: 30000 });

export function check(condition, message) {
  if (!condition) throw new Error(message);
}
