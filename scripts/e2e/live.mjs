// Loads the live (published) site in a phone-sized Chromium and checks it plays and caches itself.
// Usage: node scripts/e2e/live.mjs [url]
import { chromium } from 'playwright';
import { OUT } from './lib.mjs';
const url = process.argv[2] ?? 'https://pthagaard.github.io/Theo/';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__theo && window.__theo.game.balloons.length > 0, null, { timeout: 30000 });
console.log('loaded and playing after', Date.now() - t0, 'ms');
const b = await page.evaluate(() => { const b = window.__theo.game.balloons.find((b) => b.y > 100 && b.y < 700); return b ? [b.x, b.y] : null; });
if (b) { await page.touchscreen.tap(b[0], b[1]); await page.waitForTimeout(150); console.log('pops after tap:', await page.evaluate(() => window.__theo.game.pops)); }
const sw = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; for (let i = 0; i < 100 && reg.active?.state !== 'activated'; i++) await new Promise((r) => setTimeout(r, 100)); const keys = await caches.keys(); const n = keys.length ? (await (await caches.open(keys[0])).keys()).length : 0; return { scope: reg.scope, state: reg.active?.state, caches: keys, cached: n }; });
console.log('service worker:', JSON.stringify(sw));
const manifest = await page.evaluate(async () => { const link = document.querySelector('link[rel=manifest]'); const m = await (await fetch(link.href)).json(); return { href: link.href, name: m.name, display: m.display, start: m.start_url }; });
console.log('manifest:', JSON.stringify(manifest));
await page.screenshot({ path: `${OUT}/live.png` });
console.log('console problems:', problems.length ? problems : 'none');
await browser.close();
if (problems.length) process.exitCode = 1; else console.log('LIVE OK');
