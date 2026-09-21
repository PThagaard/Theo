// Checks the web version installs its service worker, then still loads with the network cut off.
// Usage: node scripts/e2e/offline.mjs
import { OUT, check, openPhone, serveDist, waitForGame } from './lib.mjs';

const server = await serveDist();
const url = server.url;
let requests = server.requests;
const { browser, context, page, problems } = await openPhone();

await page.goto(url);
await waitForGame(page);
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  // Wait until the worker is active and has finished precaching.
  for (let i = 0; i < 100 && !(reg.active && reg.active.state === 'activated'); i++) await new Promise((r) => setTimeout(r, 100));
  const keys = await caches.keys();
  const cache = await caches.open(keys[0]);
  const entries = (await cache.keys()).map((r) => new URL(r.url).pathname);
  return { state: reg.active?.state, caches: keys, entries };
});
console.log('service worker:', swState.state, 'caches:', swState.caches);
console.log('cached entries:', swState.entries.length, swState.entries.filter((e) => e.includes('/assets/')));
check(swState.state === 'activated', 'service worker not activated');
if (!swState.entries.some((e) => e.endsWith('.js')) || !swState.entries.some((e) => e.endsWith('.css'))) throw new Error('assets not precached');

// Manifest is reachable and valid.
const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
console.log('manifest:', manifest.name, manifest.display, manifest.icons.length, 'icons');

// Now cut the network and reload: the game must still come up.
await context.setOffline(true);
const before = requests();
await page.reload();
await waitForGame(page);
await page.waitForTimeout(800);
const balloons = await page.evaluate(() => window.__theo.game.balloons.length);
console.log('offline reload OK, balloons on screen:', balloons, '| server requests during offline reload:', requests() - before);
await page.screenshot({ path: `${OUT}/offline.png` });
// Pop something offline to be sure the whole game runs.
const b = await page.evaluate(() => { const b = window.__theo.game.balloons.find((b) => b.y > 100 && b.y < 700); return b ? [b.x, b.y] : null; });
if (b) { await page.touchscreen.tap(b[0], b[1]); console.log('offline pop:', await page.evaluate(() => window.__theo.game.pops)); }
console.log('console problems:', problems.length ? problems : 'none');
await browser.close(); server.close();
if (problems.length) process.exitCode = 1; else console.log('OFFLINE OK');
