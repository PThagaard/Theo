// Smoke test: serves dist/, drives the game in headless Chromium, takes screenshots,
// and renders the synthesised audio offline to check every sound actually makes sound.
// Usage: node scripts/e2e/smoke.mjs [phone|tablet]
import { OUT, VIEWPORTS, check, openPhone, serveDist, waitForGame } from './lib.mjs';

const server = await serveDist();
const url = server.url;
const tag = process.argv[2] === 'tablet' ? 'tablet' : 'phone';
const viewport = VIEWPORTS[tag];
const { browser, page, problems } = await openPhone(viewport);

await page.goto(url);
await waitForGame(page);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/${tag}-01-start.png` });

const state = () => page.evaluate(() => {
  const g = window.__theo.game;
  return { balloons: g.balloons.map((b) => ({ x: b.x, y: b.y, r: b.r, kind: b.kind, scale: b.scale })), pops: g.pops, particles: g.particles.length, size: [g.width, g.height], unit: g.unit };
});

let s = await state();
console.log('start:', s.balloons.length, 'balloons, unit', s.unit.toFixed(2), 'size', s.size);

// Tap a balloon (only ones fully on screen).
const target = s.balloons.find((b) => b.y > 100 && b.y < viewport.height - 100 && b.scale > 0.9);
check(target, 'no balloon on screen to tap');
await page.touchscreen.tap(target.x, target.y);
await page.waitForTimeout(140);
s = await state();
console.log('after tap: pops', s.pops, 'particles', s.particles);
if (s.pops !== 1) throw new Error('tap did not pop');
await page.screenshot({ path: `${OUT}/${tag}-02-pop.png` });

// Touch empty sky -> a balloon inflates there.
const empty = await page.evaluate((f) => {
  const g = window.__theo.game;
  // Look for a spot with a wide margin, so a balloon drifting a few pixels can't slide under the tap.
  const clear = (x, y) => !g.findBalloonAt(x, y, f) && !g.findCloudAt(x, y) && !g.isOnSun(x, y) && !g.findFlowerAt(x, y);
  for (let y = 120; y < g.height - 120; y += 10) {
    for (let x = 60; x < g.width - 60; x += 10) {
      if (clear(x, y) && clear(x - 30, y - 30) && clear(x + 30, y + 30) && clear(x - 30, y + 30) && clear(x + 30, y - 30)) return [x, y];
    }
  }
  return null;
}, 2.2);
const before = s.balloons.length;
await page.touchscreen.tap(empty[0], empty[1]);
await page.waitForTimeout(220);
s = await state();
console.log('after empty tap: balloons', before, '->', s.balloons.length);
const spawned = await page.evaluate(([x, y]) => {
  const g = window.__theo.game;
  // The new balloon has already started rising and swaying, more so on big screens.
  return g.balloons.some((b) => b.tapped && Math.hypot(b.x - x, b.y - y) < 60 * g.unit);
}, empty);
if (!spawned) throw new Error('empty tap did not spawn a balloon under the finger');
await page.screenshot({ path: `${OUT}/${tag}-03-inflate.png` });

// Swipe with the mouse (pointer events) straight through a balloon that is on screen.
await page.waitForTimeout(600);
s = await state();
const popsBefore = s.pops;
const swipeTarget = s.balloons.find((b) => b.y > 100 && b.y < viewport.height - 100 && b.scale > 0.9) ?? { y: viewport.height / 2 };
await page.mouse.move(10, swipeTarget.y);
await page.mouse.down();
await page.mouse.move(viewport.width - 10, swipeTarget.y, { steps: 40 });
await page.mouse.up();
s = await state();
console.log('after swipe: pops', popsBefore, '->', s.pops);
if (s.pops <= popsBefore) throw new Error('swipe did not pop the balloon it crossed');

// A slow swipe, photographed midway so the ribbon is visible.
await page.mouse.move(40, viewport.height * 0.35);
await page.mouse.down();
await page.mouse.move(viewport.width * 0.6, viewport.height * 0.3, { steps: 25 });
await page.screenshot({ path: `${OUT}/${tag}-03b-ribbon.png` });
await page.mouse.move(viewport.width - 40, viewport.height * 0.5, { steps: 25 });
await page.mouse.up();
const glideCount = await page.evaluate(() => new Promise((resolve) => {
  // Count harp notes produced by a scripted swipe straight through the game API.
  const g = window.__theo.game; let n = 0; const off = g.onEvent((e) => { if (e.type === 'glide') n++; });
  g.press(77, 30, g.height - 150); for (let i = 1; i <= 40; i++) { g.drag(77, 30 + ((g.width - 60) * i) / 40, g.height - 150); g.update(1 / 120); } g.release(77);
  resolve(n);
}));
console.log('harp notes from a scripted swipe:', glideCount);
if (glideCount < 5) throw new Error('no harp notes from swiping');

// Touch the sun and a cloud.
const sun = await page.evaluate(() => {
  const g = window.__theo.game;
  // Balloons and clouds in front of the sun would (correctly) be hit first; move them out of the way.
  for (const b of g.balloons) if (Math.hypot(b.x - g.sun.x, b.y - g.sun.y) < g.sun.r * 2 + b.r * 2) { b.baseX = g.width / 2; b.y += 320; }
  for (const c of g.clouds) if (Math.abs(c.y - g.sun.y) < 200) c.y = g.sun.y + 260;
  g.update(1 / 60);
  return g.sun;
});
await page.touchscreen.tap(sun.x, sun.y);
await page.waitForTimeout(120);
const sunHit = await page.evaluate(() => window.__theo.game.sunHit);
console.log('sun touched, sunHit =', sunHit.toFixed(2));
if (!(sunHit < 0.5)) throw new Error('sun did not react');
await page.screenshot({ path: `${OUT}/${tag}-03c-sun.png`, clip: { x: viewport.width - 160, y: 0, width: 160, height: 160 } });
const cloud = await page.evaluate(() => {
  const g = window.__theo.game;
  // A visitor (bird, butterfly) flying in front of the cloud would take the touch instead; clear the sky first,
  // and keep away from the corner button, which would swallow the tap.
  g.visitors = [];
  g.visitorTimer = 30;
  const c = g.clouds.find((c) => c.x > 150 && c.x < g.width - 60 && c.y > 60 && !g.findBalloonAt(c.x, c.y, 1.6));
  return c ? [c.x, c.y] : null;
});
if (cloud) {
  await page.touchscreen.tap(cloud[0], cloud[1]);
  await page.waitForTimeout(150);
  const drops = await page.evaluate(() => window.__theo.game.particles.filter((p) => p.shape === 'drop').length);
  console.log('cloud touched, raindrops:', drops);
  if (drops < 3) throw new Error('cloud did not rain');
  await page.screenshot({ path: `${OUT}/${tag}-03d-cloud.png` });
} else console.log('no reachable cloud to tap (skipped)');

// Shake: synthetic motion events through the real DeviceMotion path.
const shook = await page.evaluate(() => {
  const g = window.__theo.game; const before = g.particles.length; g.sunHit = 5;
  const fire = (x, y, z) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z } }));
  fire(0, 9.8, 0); fire(18, -12, 6);
  return { reacted: g.sunHit === 0, particles: g.particles.length - before };
});
console.log('shake via DeviceMotion:', JSON.stringify(shook));
if (!shook.reacted) throw new Error('shake was not detected');

// Visitors: bring every creature in at once, photograph them, and poke the dog and the elephant.
const visitors = await page.evaluate(() => {
  const g = window.__theo.game;
  g.visitors = [];
  for (const b of g.balloons) { b.baseX = g.width / 2; b.y = -200; }
  const made = {};
  for (const kind of ['dog', 'elephant', 'bird', 'butterfly', 'snail', 'star', 'tractor']) made[kind] = g.spawnVisitor(kind).id;
  const dog = g.visitors.find((v) => v.kind === 'dog'); dog.x = g.width * 0.22; dog.dir = 1; dog.vx = Math.abs(dog.vx);
  const elephant = g.visitors.find((v) => v.kind === 'elephant'); elephant.x = g.width * 0.62; elephant.y = g.ground(elephant.x);
  const snail = g.visitors.find((v) => v.kind === 'snail'); snail.x = g.width * 0.75;
  const bird = g.visitors.find((v) => v.kind === 'bird'); bird.x = g.width * 0.5; bird.y = g.height * 0.3;
  const star = g.visitors.find((v) => v.kind === 'star'); star.x = g.width * 0.55; star.y = g.height * 0.12;
  return made;
});
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/${tag}-11-visitors.png` });
const poked = await page.evaluate(() => new Promise((resolve) => {
  const g = window.__theo.game; const events = []; g.onEvent((e) => { if (e.type === 'visitor' && e.what === 'poke') events.push(e.kind); });
  // A balloon drifting in front of a visitor would take the touch instead (balloons are in front); clear them first.
  g.balloons = [];
  g.spawnTimer = 5;
  const before = g.visitors.map((v) => `${v.kind}:${v.state}@${Math.round(v.x)},${Math.round(v.y)}`).join(' ');
  for (const kind of ['dog', 'elephant', 'tractor']) {
    const v = g.visitors.find((v) => v.kind === kind);
    if (!v) { events.push(`${kind} missing`); continue; }
    const hit = g.visitorHit(v);
    const balloon = g.findBalloonAt(hit.x, hit.y, 1.6);
    if (balloon) events.push(`${kind} covered by balloon`);
    g.press(90, hit.x, hit.y); g.release(90);
  }
  resolve({ events, before });
}));
console.log('visitors before poke:', poked.before);
console.log('visitors poked:', poked.events.join(', '));
poked.splice?.(0);
const pokedKinds = poked.events;
check(pokedKinds.includes('dog') && pokedKinds.includes('elephant') && pokedKinds.includes('tractor'), 'dog, elephant or tractor did not react to a touch');
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/${tag}-12-visitors-poked.png` });
await page.evaluate(() => { window.__theo.game.visitors = []; });

// Storm: bring the dark cloud in over the dog and the elephant, strike it, and photograph the transformations.
const struck = await page.evaluate(() => {
  const g = window.__theo.game;
  g.visitors = [];
  for (const b of g.balloons) { b.baseX = g.width / 2; b.y = -200; }
  const storm = g.spawnVisitor('storm'); storm.x = g.width * 0.5; storm.dir = 1; storm.vx = Math.abs(storm.vx);
  const dog = g.spawnVisitor('dog'); dog.x = g.width * 0.42; dog.vx = 0;
  const elephant = g.spawnVisitor('elephant'); elephant.x = g.width * 0.6;
  return true;
});
await page.waitForTimeout(1600);
const stormHit = await page.evaluate(() => window.__theo.game.visitorHit(window.__theo.game.storm));
await page.touchscreen.tap(stormHit.x, stormHit.y);
await page.waitForTimeout(60);
await page.screenshot({ path: `${OUT}/${tag}-14-lightning.png` });
await page.waitForTimeout(500);
const forms = await page.evaluate(() => window.__theo.game.visitors.map((v) => `${v.kind}:${v.form ?? '-'}`).join(' '));
console.log('after lightning:', forms);
check(forms.includes('dog:hotdog') && forms.includes('elephant:mouse'), 'lightning did not transform the animals');
await page.screenshot({ path: `${OUT}/${tag}-15-storm.png` });
// The storm cloud can be grabbed and swiped around the sky.
const stormPos = await page.evaluate(() => { const s = window.__theo.game.storm; return [s.x, s.y]; });
await page.mouse.move(stormPos[0], stormPos[1]);
await page.mouse.down();
await page.mouse.move(stormPos[0] - 120, stormPos[1] + 30, { steps: 12 });
await page.mouse.up();
const stormMoved = await page.evaluate(() => { const s = window.__theo.game.storm; return s ? [Math.round(s.x), Math.round(s.y)] : null; });
console.log('storm dragged from', stormPos.map(Math.round), 'to', stormMoved);
check(stormMoved && stormPos[0] - stormMoved[0] > 80, 'the storm cloud could not be dragged');
await page.evaluate(() => { window.__theo.game.visitors = []; });

// A balloon made right above the dog lifts it; popping the balloon lets it parachute down.
const lifted = await page.evaluate(() => {
  const g = window.__theo.game;
  g.visitors = [];
  for (const b of g.balloons) { b.baseX = g.width / 2; b.y = -200; }
  for (const c of g.clouds) c.y = -500; // no cloud may sit where the finger will make the balloon
  const dog = g.spawnVisitor('dog'); dog.x = g.width * 0.5; dog.vx = 0;
  g.update(1 / 60);
  const hit = g.visitorHit(dog);
  return { x: hit.x, y: hit.y - 100 * g.unit };
});
await page.touchscreen.tap(lifted.x, lifted.y);
// The string hangs slack until the balloon has risen enough to lift the dog off the ground.
await page.waitForFunction(() => { const g = window.__theo.game; const dog = g.visitors.find((v) => v.kind === 'dog'); return dog.state === 'carried' && dog.y < g.ground(dog.x) - 55 * g.unit; }, null, { timeout: 10000 }).catch(() => undefined);
const carried = await page.evaluate(() => { const g = window.__theo.game; const dog = g.visitors.find((v) => v.kind === 'dog'); const b = g.balloons.find((b) => b.carrying === dog.id); return { state: dog.state, height: Math.round(g.ground(dog.x) - dog.y), balloon: b ? [b.x, b.y] : null }; });
console.log('dog lifted by balloon:', carried.state, 'height', carried.height);
check(carried.state === 'carried' && carried.balloon && carried.height > 40, 'the balloon did not lift the dog');
await page.screenshot({ path: `${OUT}/${tag}-16-lifted.png` });
await page.touchscreen.tap(carried.balloon[0], carried.balloon[1]);
const falling = await page.waitForFunction(() => window.__theo.game.visitors.find((v) => v.kind === 'dog').state === 'falling', null, { timeout: 1500 }).then(() => 'falling').catch(() => 'not falling');
console.log('after popping:', falling);
check(falling === 'falling', 'the dog did not parachute down');
await page.screenshot({ path: `${OUT}/${tag}-17-parachute.png` });
await page.waitForFunction(() => { const dog = window.__theo.game.visitors.find((v) => v.kind === 'dog'); return dog.state !== 'falling'; }, null, { timeout: 8000 });
check(await page.evaluate(() => window.__theo.game.visitors.find((v) => v.kind === 'dog').state === 'idle'), 'the dog did not land and walk on');
await page.evaluate(() => { window.__theo.game.visitors = []; });

// Holding a finger still on a white cloud darkens it and turns it into the storm cloud, right there.
const heldCloud = await page.evaluate(() => {
  const g = window.__theo.game;
  g.visitors = [];
  for (const b of g.balloons) { b.baseX = g.width / 2; b.y = -200; }
  const c = g.clouds[0];
  c.x = g.width / 2; c.y = g.height * 0.3; c.vx = 0;
  g.update(1 / 60);
  return [c.x, c.y];
});
await page.mouse.move(heldCloud[0], heldCloud[1]);
await page.mouse.down();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/${tag}-18-darkcloud.png` });
const darkening = await page.evaluate(() => window.__theo.game.clouds[0].dark);
await page.waitForFunction(() => !!window.__theo.game.storm, null, { timeout: 4000 }).catch(() => undefined);
await page.mouse.up();
const summoned = await page.evaluate(() => !!window.__theo.game.storm);
console.log('held cloud: dark', darkening.toFixed(2), 'storm summoned', summoned);
check(darkening > 0.3 && summoned, 'holding a cloud did not make the storm cloud');
await page.evaluate(() => { window.__theo.game.visitors = []; });

// Holding on empty sky keeps the new balloon growing until it bursts.
const heldSpot = await page.evaluate(() => {
  const g = window.__theo.game;
  g.balloons = [];
  g.spawnTimer = 30;
  for (const c of g.clouds) c.y = -500;
  return [g.width / 2, g.height * 0.45];
});
await page.mouse.move(heldSpot[0], heldSpot[1]);
await page.mouse.down();
await page.waitForTimeout(1700);
const big = await page.evaluate(() => Math.max(0, ...window.__theo.game.balloons.map((b) => b.scale)));
await page.screenshot({ path: `${OUT}/${tag}-19-bigballoon.png` });
await page.waitForFunction(() => (window.__theo.stats.snapshot.today.bursts ?? 0) > 0, null, { timeout: 4000 }).catch(() => undefined);
await page.mouse.up();
const bursts = await page.evaluate(() => window.__theo.stats.snapshot.today.bursts ?? 0);
console.log('held balloon grew to', big.toFixed(2), 'bursts', bursts);
check(big > 1.1 && bursts > 0, 'the held balloon did not grow and burst');

// Holding the sun charges a sunburst.
const sunSpot = await page.evaluate(() => { const g = window.__theo.game; for (const b of g.balloons) { b.baseX = g.width / 2; b.y = g.height * 0.6; } return [g.sun.x, g.sun.y]; });
await page.mouse.move(sunSpot[0], sunSpot[1]);
await page.mouse.down();
await page.waitForFunction(() => (window.__theo.stats.snapshot.today.sunbursts ?? 0) > 0, null, { timeout: 4000 }).catch(() => undefined);
await page.screenshot({ path: `${OUT}/${tag}-20-sunburst.png` });
await page.mouse.up();
const sunbursts = await page.evaluate(() => window.__theo.stats.snapshot.today.sunbursts ?? 0);
console.log('sunbursts', sunbursts);
check(sunbursts > 0, 'holding the sun did not make a sunburst');

// Activity #2, "Titte-bøh og Ord". 8–12 months: the family and a few animals hide behind the bush; touch the
// bush and the thing comes out with its sound and its name.
await page.evaluate(() => window.__theo.startActivity('ord'));
await page.waitForTimeout(1200);
check((await page.evaluate(() => window.__theo.activity.id)) === 'ord', 'the Ord activity did not start');
const ordHit = await page.evaluate(() => { const g = window.__theo.game; g.setAge('8-12'); g.hide(); return g.hit; });
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/${tag}-23-ord-bush.png` });
await page.touchscreen.tap(ordHit.x, ordHit.y);
await page.waitForTimeout(400);
check(await page.evaluate(() => { const g = window.__theo.game; return !g.hidden && g.deckThings.every((t) => t.kind === 'photo' || ['hund', 'elefant', 'ko', 'kat'].includes(t.key)); }), 'the youngest should get the family and a few animals, out of the bush after one touch');
await page.touchscreen.tap(ordHit.x, ordHit.y);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/${tag}-22-ord.png` });
await page.mouse.move(viewport.width * 0.75, viewport.height * 0.4);
await page.mouse.down();
await page.mouse.move(viewport.width * 0.2, viewport.height * 0.4, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1500);
// For 2+ the bush rustles on the first touch and opens on the second.
const ordRustle = await page.evaluate(() => { const g = window.__theo.game; g.setAge('2+'); g.hide(); return g.hit; });
await page.touchscreen.tap(ordRustle.x, ordRustle.y);
await page.waitForTimeout(120);
await page.screenshot({ path: `${OUT}/${tag}-23b-ord-rustle.png` });
check(await page.evaluate(() => window.__theo.game.hidden && window.__theo.game.rustle > 0), 'the bush should rustle, not open, on the first touch for 2+');
await page.waitForTimeout(700);
await page.touchscreen.tap(ordRustle.x, ordRustle.y);
await page.waitForTimeout(300);
check(await page.evaluate(() => !window.__theo.game.hidden), 'the bush should open on the second touch');
// From 1 year: "Hvor er …?" rounds. Everything touched answers with its name; the asked-for thing celebrates.
const ordRound = await page.evaluate(() => { const g = window.__theo.game; g.setAge('1-2'); g.round = null; g.ask(); const r = g.round; return { asked: r.asked, keys: r.things.map((t) => t.key), hits: r.things.map((_, i) => g.hitFor(i)) }; });
console.log('hvor er:', JSON.stringify(ordRound));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/${tag}-26-ord-hvor-er.png` });
const ordOther = ordRound.asked === 0 ? 1 : 0;
await page.touchscreen.tap(ordRound.hits[ordOther].x, ordRound.hits[ordOther].y);
await page.waitForTimeout(300);
check(await page.evaluate(() => window.__theo.game.round && !window.__theo.game.round.found), 'touching another thing must not end the round (and is never wrong)');
await page.touchscreen.tap(ordRound.hits[ordRound.asked].x, ordRound.hits[ordRound.asked].y);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/${tag}-27-ord-found.png` });
check(await page.evaluate(() => window.__theo.game.round && window.__theo.game.round.found), 'touching the asked-for thing should celebrate');
await page.waitForTimeout(2600);
check(await page.evaluate(() => window.__theo.game.round === null), 'after the celebration the next thing should come');
// Ord's own figures: the cow, the cat and the car, each touched once.
for (const kind of ['cow', 'cat', 'car']) {
  await page.evaluate((k) => { const g = window.__theo.game; g.setAge('8-12'); g.round = null; g.hidden = false; g.bushOpen = 1; g.state = 'idle'; g.stateAge = 0; g.x = g.centerX; g.current = g.things.find((t) => t.kind === k); }, kind);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(ordHit.x, ordHit.y);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${tag}-25-ord-${kind}.png` });
}
const ordStats = await page.evaluate(() => { const s = window.__theo.stats.snapshot.today; return { touched: s.ordTouched ?? 0, next: s.ordNext ?? 0, peeks: s.ordPeeks ?? 0, asked: s.ordAsked ?? 0, found: s.ordFound ?? 0, key: window.__theo.game.current.key }; });
console.log('ord:', JSON.stringify(ordStats));
check(ordStats.touched >= 4 && ordStats.next >= 1 && ordStats.peeks >= 2 && ordStats.asked >= 1 && ordStats.found >= 1, 'Ord did not react to touch, swipe, peek-a-boo and the hvor-er round');
// Activity #3, "Bobler": the bath. Pop, splash, ducks, swipe, hold and shake, everything answering at once.
await page.evaluate(() => window.__theo.startActivity('bobler'));
await page.waitForTimeout(800);
check((await page.evaluate(() => window.__theo.activity.id)) === 'bobler', 'the Bobler activity did not start');
const bath = await page.evaluate(() => {
  const g = window.__theo.game;
  g.setAge('2+');
  g.bubbles = [];
  const b = g.spawnBubble({ x: g.width * 0.5, y: g.height * 0.35, r: g.baseR, kind: 'plain' });
  g.spawnBubble({ x: g.width * 0.25, y: g.height * 0.5, r: g.baseR * 1.2, kind: 'star' });
  const duck = g.ducks[0];
  return { bubble: { x: b.x, y: b.y }, duck: { x: duck.x, y: g.duckY(duck) - g.duckSize * 0.5 }, water: { x: g.width * 0.7, y: g.height * 0.85 }, w: g.width, h: g.height };
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/${tag}-30-bobler.png` });
await page.touchscreen.tap(bath.bubble.x, bath.bubble.y);
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/${tag}-31-bobler-pop.png` });
await page.touchscreen.tap(bath.water.x, bath.water.y);
await page.waitForTimeout(150);
await page.touchscreen.tap(bath.duck.x, bath.duck.y);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/${tag}-32-bobler-splash.png` });
check((await page.evaluate(() => window.__theo.game.ducks[0].color)) === 1, 'touching the duck should give it its next colour');
// A long press on the duck: rainbow colours and a dash across the bath.
const duckNow = await page.evaluate(() => { const g = window.__theo.game; const d = g.ducks[0]; return { x: d.x, y: g.duckY(d) - g.duckSize * 0.5 }; });
await page.mouse.move(duckNow.x, duckNow.y);
await page.mouse.down();
await page.waitForTimeout(700);
await page.mouse.up();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/${tag}-32b-bobler-rainbow-duck.png` });
check(await page.evaluate(() => window.__theo.game.ducks[0].rainbow > 0), 'a long press should send the duck on a rainbow dash');
// Tilting the phone (synthetic motion readings, right side down, enough of them for the smoothing to follow):
// the water climbs the right side.
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: -5, y: 8.4, z: 0 } })));
  await page.waitForTimeout(45);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/${tag}-32c-bobler-tilt.png` });
check(await page.evaluate(() => { const g = window.__theo.game; return g.tilt > 0.05 && g.surfaceY(g.width * 0.9) < g.surfaceY(g.width * 0.1); }), 'tilting the phone should tilt the water');
await page.evaluate(() => { window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 } })); window.__theo.game.setTilt(0); });
await page.waitForTimeout(800);
// A swipe across the wall pops what it crosses and leaves a trail of tiny bubbles.
await page.evaluate(() => { const g = window.__theo.game; for (const f of [0.3, 0.5, 0.7]) g.spawnBubble({ x: g.width * f, y: g.height * 0.3, r: g.baseR, kind: 'plain' }); });
await page.waitForTimeout(400);
await page.mouse.move(bath.w * 0.1, bath.h * 0.3);
await page.mouse.down();
await page.mouse.move(bath.w * 0.9, bath.h * 0.3, { steps: 24 });
await page.mouse.up();
await page.waitForTimeout(200);
// Hold still on the water (the ducks are moved aside): a bubble grows under the finger and floats off when let go.
await page.evaluate(() => { const g = window.__theo.game; g.ducks.forEach((d, i) => { d.rainbow = 0; d.vx = 0; d.x = g.width * (i === 0 ? 0.12 : 0.88); }); });
await page.mouse.move(bath.w * 0.5, bath.h * 0.82);
await page.mouse.down();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/${tag}-33-bobler-hold.png` });
await page.mouse.up();
await page.waitForTimeout(200);
// Shake through the DeviceMotion path.
const bathShook = await page.evaluate(() => {
  const g = window.__theo.game; const before = g.shakes;
  const fire = (x, y, z) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z } }));
  fire(0, 9.8, 0); fire(18, -12, 6);
  return g.shakes - before;
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/${tag}-34-bobler-shake.png` });
// Guests: the whale surfaces and spouts when touched, the cow in the speedboat moos, the shower sprays from above.
await page.evaluate(() => {
  const g = window.__theo.game; g.guests = []; g.spawnTimer = 30;
  // One bubble parked in the top corner keeps the "never empty" rule from dropping a new one onto the whale.
  g.bubbles = []; g.spawnBubble({ x: 40, y: 80, r: 18, kind: 'plain' });
  g.spawnGuest('whale');
  const boat = g.spawnGuest('boat'); boat.dir = -1; boat.vx = -Math.abs(boat.vx); boat.x = g.width * 0.85;
  g.spawnGuest('shower');
});
await page.waitForTimeout(1600);
const whaleHit = await page.evaluate(() => { const w = window.__theo.game.guests.find((g) => g.kind === 'whale'); return w ? { x: w.x, y: w.y - w.size * 0.3 } : null; });
check(whaleHit, 'the whale did not stay at the surface');
await page.touchscreen.tap(whaleHit.x, whaleHit.y);
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/${tag}-35-bobler-guests.png` });
const boatHit = await page.evaluate(() => { const b = window.__theo.game.guests.find((g) => g.kind === 'boat'); return b ? { x: b.x, y: b.y - b.size * 0.3 } : null; });
if (boatHit && boatHit.x > 10 && boatHit.x < bath.w - 10) await page.touchscreen.tap(boatHit.x, boatHit.y);
await page.waitForTimeout(300);
await page.evaluate(() => {
  const g = window.__theo.game; g.guests = [];
  const fish = g.spawnGuest('fish'); fish.x = g.width * 0.3;
  const ski = g.spawnGuest('jetski'); ski.dir = 1; ski.vx = Math.abs(ski.vx); ski.x = g.width * 0.15;
});
await page.waitForTimeout(1300);
await page.screenshot({ path: `${OUT}/${tag}-36-bobler-fish.png` });
const guestStats = await page.evaluate(() => { const s = window.__theo.stats.snapshot.today; return { seen: s.bathGuests ?? 0, poked: s.bathGuestsPoked ?? 0, whale: s['guest:whale'] ?? 0 }; });
console.log('guests:', JSON.stringify(guestStats));
check(guestStats.seen >= 5 && guestStats.whale >= 1, 'the bath guests did not appear or answer');
await page.evaluate(() => { window.__theo.game.guests = []; window.__theo.audio()?.stopRain(); });
const bathStats = await page.evaluate(() => { const s = window.__theo.stats.snapshot.today; return { popped: s.bubblesPopped ?? 0, splashes: s.splashes ?? 0, quacks: s.quacks ?? 0, blown: s.bubblesBlown ?? 0, swipes: s.bubbleSwipes ?? 0, shakes: s.bubbleShakes ?? 0, bubbles: window.__theo.game.bubbles.length }; });
console.log('bobler:', JSON.stringify(bathStats), 'shook', bathShook);
check(bathStats.popped >= 3 && bathStats.splashes >= 1 && bathStats.quacks >= 1 && bathStats.blown >= 1 && bathStats.swipes >= 1 && bathShook >= 1, 'Bobler did not answer tap, splash, duck, swipe, hold and shake');
await page.evaluate(() => window.__theo.startActivity('balloner'));
await page.waitForTimeout(500);
check((await page.evaluate(() => window.__theo.activity.id)) === 'balloner', 'could not switch back to the balloons');
// The start page is reachable again through the menu, and a tile starts a game.
await page.evaluate(() => window.__theo.startActivity('ord'));
await page.waitForTimeout(300);
const startBtn = await page.locator('#parent-button').boundingBox();
await page.mouse.move(startBtn.x + startBtn.width / 2, startBtn.y + startBtn.height / 2);
await page.mouse.down();
await page.waitForTimeout(2300);
await page.mouse.up();
await page.waitForFunction(() => !document.getElementById('parent-panel').hidden, null, { timeout: 5000 });
check(await page.evaluate(() => document.getElementById('activity-name').textContent.includes('Ord') && document.getElementById('tempo-row').hidden), 'the menu should name Ord without Tempo');
await page.click('#tab-leg');
await page.click('#switch-game');
await page.waitForFunction(() => !document.getElementById('start-page').hidden && document.getElementById('parent-panel').hidden, null, { timeout: 5000 });
await page.screenshot({ path: `${OUT}/${tag}-24-start.png` });
check((await page.evaluate(() => window.__theo.activity)) === null, 'the start page should have no running game');
await page.click('#start-page button[data-activity="balloner"]');
await page.waitForFunction(() => document.getElementById('start-page').hidden && window.__theo.activity && window.__theo.activity.id === 'balloner', null, { timeout: 5000 });

// The pause: the world falls asleep (sun sets, night veil, moon), touches only twinkle, and a parent wakes it.
await page.evaluate(() => window.__theo.game.sleep());
await page.waitForTimeout(2500);
const asleep = await page.evaluate(() => { const g = window.__theo.game; const n = g.balloons.length; g.press(77, g.width / 2, g.height * 0.45); g.release(77); return { dusk: g.dusk, spawned: g.balloons.length - n }; });
console.log('asleep: dusk', asleep.dusk.toFixed(2), 'balloons made by a touch', asleep.spawned);
check(asleep.dusk > 0.2 && asleep.spawned === 0, 'the world did not go to sleep properly');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/${tag}-21-sleep.png` });
await page.evaluate(() => window.__theo.game.wake());
await page.waitForTimeout(3000);
check((await page.evaluate(() => window.__theo.game.dusk)) === 0, 'the world did not wake up');

// Flowers: tap one (spin + rainbow), then swipe along the flower bed (pluck) and photograph the flight.
const flowerTap = await page.evaluate(() => {
  const g = window.__theo.game;
  // A visitor on the ground (the tractor, the dog) takes a sliding finger before the flowers do; clear them.
  g.visitors = [];
  g.visitorTimer = 30;
  // Balloons drifting through the flower bed would take the swipe first (the next step spawns new ones).
  g.balloons = [];
  g.spawnTimer = 30;
  // The storm may have boosted or plucked some flowers just before; start from a whole, calm flower bed.
  for (const f of g.flowers) { f.boost = 0; f.growth = 1; f.regrow = 0; f.flying = null; }
  const f = g.flowers[Math.floor(g.flowers.length / 2)];
  return g.flowerHead(f);
});
await page.touchscreen.tap(flowerTap.x, flowerTap.y);
await page.waitForTimeout(120);
const spun = await page.evaluate(() => window.__theo.game.flowers.filter((f) => f.rainbow > 0).length);
console.log('flowers spinning after tap:', spun);
check(spun >= 1, 'tapping a flower did not make it spin');
// Swipe through every flower head in turn (the hills put them at different heights on a wide screen).
const flowerHeads = await page.evaluate(() => window.__theo.game.flowers.map((f) => window.__theo.game.flowerHead(f)).sort((a, b) => a.x - b.x));
await page.mouse.move(8, flowerHeads[0].y);
await page.mouse.down();
for (const head of flowerHeads) {
  // Paced like a real swipe: the input layer hands the game one position per frame, so a burst of
  // synthetic moves would skip most heads on a wide screen.
  await page.mouse.move(head.x, head.y, { steps: 4 });
  await page.waitForTimeout(25);
}
await page.mouse.move(viewport.width - 8, flowerHeads[flowerHeads.length - 1].y, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(250);
// A plucked head flies briefly and then regrows, so count the flowers that are still growing back too.
const plucked = await page.evaluate(() => window.__theo.game.flowers.filter((f) => f.flying || f.growth < 1).length);
console.log('flowers plucked by a swipe:', plucked);
check(plucked >= 3, 'swiping over the flowers did not pluck them');
await page.screenshot({ path: `${OUT}/${tag}-13-flowers.png` });

// Pop until a celebration happens (every tenth pop; earlier steps have already popped some, so count from
// the live number, and make sure balloons keep coming).
await page.evaluate(() => { window.__theo.game.spawnTimer = 0; });
s = await state();
let guard = 0;
const celebrationAt = Math.ceil((s.pops + 1) / 10) * 10;
while (s.pops < celebrationAt && guard++ < 200) {
  const b = s.balloons.find((b) => b.y > 60 && b.y < viewport.height - 60 && b.scale > 0.9);
  if (b) await page.touchscreen.tap(b.x, b.y);
  else await page.evaluate(() => { window.__theo.game.spawnBalloon(); });
  await page.waitForTimeout(150);
  s = await state();
}
console.log('pops now', s.pops);
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/${tag}-04-celebration.png` });
const since = await page.evaluate(() => window.__theo.game.sinceCelebration);
if (!(since < 5)) throw new Error('no celebration after 10 pops: ' + since);

// Frame rate over 2 seconds.
const fps = await page.evaluate(() => new Promise((resolve) => {
  let frames = 0; const start = performance.now();
  const tick = () => { frames++; if (performance.now() - start < 2000) requestAnimationFrame(tick); else resolve(frames / 2); };
  requestAnimationFrame(tick);
}));
console.log('fps', fps.toFixed(1));

// Parent menu: hold the corner button for 2.2 s.
const btn = await page.locator('#parent-button').boundingBox();
await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
await page.mouse.down();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/${tag}-05-hold.png`, clip: { x: 0, y: 0, width: 120, height: 120 } });
await page.waitForTimeout(1300);
await page.mouse.up();
const open = await page.evaluate(() => !document.getElementById('parent-panel').hidden);
console.log('parent panel open after hold:', open);
if (!open) throw new Error('parent panel did not open');
await page.screenshot({ path: `${OUT}/${tag}-06-parent.png` });
await page.click('#tab-leg');
// The youngest profile is the default; parents can move up as the child grows.
check(await page.evaluate(() => window.__theo.game.currentAge) === '8-12', 'the youngest age profile should be the default');
await page.click('#age-options button[data-age="2+"]');
check(await page.evaluate(() => window.__theo.game.currentAge) === '2+', 'the age setting did not reach the game');
await page.click('#pause-options button[data-pause="5"]');
await page.click('label:has(#opt-music)');
await page.click('#tempo-options button[data-tempo="vild"]');
// The pages of the menu: "Leg", "Musik", "Familie" and "Theos leg" show on the web (no lock or update there).
const tabsShown = await page.evaluate(() => Array.from(document.querySelectorAll('#parent-tabs button')).filter((b) => !b.hidden).map((b) => b.dataset.tab));
console.log('menu pages:', tabsShown.join(', '));
check(tabsShown.join(',') === 'leg,musik,familie,theo', 'unexpected menu pages on the web');
await page.click('#tab-theo');
check(await page.evaluate(() => !document.querySelector('.tab-page[data-tab="theo"]').hidden && document.querySelector('.tab-page[data-tab="leg"]').hidden), 'the Theos leg page did not open');
await page.click('#tab-leg');
// The Musik page: every song has a switch, Baby Shark first; a song can be switched off, and the speed changed.
await page.click('#tab-musik');
const songRows = await page.evaluate(() => Array.from(document.querySelectorAll('#song-list input[data-song]')).map((i) => i.dataset.song));
console.log('songs:', songRows.join(', '));
check(songRows.length >= 7 && songRows[0] === 'baby-shark', 'the song list should start with Baby Shark');
await page.click('#song-list label:has(input[data-song="mary"])');
await page.click('#music-speed-options button[data-speed="hurtig"]');
await page.waitForTimeout(150);
const musicSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('theos-balloner.settings')));
check(musicSettings.songsOff.includes('mary') && musicSettings.musicSpeed === 'hurtig', 'switching a song off or changing the speed was not saved');
await page.click('#music-speed-options button[data-speed="normal"]');
await page.click('#song-list label:has(input[data-song="mary"])');
await page.screenshot({ path: `${OUT}/${tag}-06c-music.png` });
await page.click('#tab-leg');
const stored = await page.evaluate(() => localStorage.getItem('theos-balloner.settings'));
console.log('stored settings:', stored);
check(JSON.parse(stored).tempo === 'vild', 'tempo was not stored');
check(JSON.parse(stored).age === '2+' && JSON.parse(stored).pauseAfter === 5, 'age or pause was not stored');
// The menu names the running game, offers "Skift spil", shows Tempo only for the balloons, and tells when the
// world will sleep.
console.log('menu game line:', await page.evaluate(() => document.getElementById('activity-name').textContent));
check(await page.evaluate(() => document.getElementById('activity-name').textContent.includes('Theos Balloner') && !document.getElementById('switch-game').hidden && !document.getElementById('tempo-row').hidden), 'the menu should name Theos Balloner with Skift spil and Tempo');
console.log('pause line:', await page.evaluate(() => document.getElementById('pause-status').textContent));
check((await page.evaluate(() => document.getElementById('pause-status').textContent)).includes('søvn'), 'the pause line is missing');
check(await page.evaluate(() => window.__theo.game.currentTempo) === 'vild', 'tempo did not reach the game');
check(await page.evaluate(() => document.getElementById('update-section').hidden), 'update section should be hidden on the web');
await page.click('#parent-close');
const closed = await page.evaluate(() => document.getElementById('parent-panel').hidden);
console.log('closed:', closed);

// A short tap must not open the menu.
await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up();
const openAfterShort = await page.evaluate(() => !document.getElementById('parent-panel').hidden);
console.log('open after short tap (should be false):', openAfterShort);

// Statistics: the menu shows what has been played so far, and the numbers survive a reload.
const statsShown = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('#stats-body tr')).map((tr) => Array.from(tr.children).map((td) => td.textContent));
  return { rows, footer: document.getElementById('stats-footer').textContent, pops: window.__theo.stats.snapshot.total.pops };
});
console.log('stats rows:', statsShown.rows.length, '| pops:', statsShown.pops, '|', statsShown.footer.slice(0, 40));
check(statsShown.pops >= 10, 'pops were not counted');
check(statsShown.rows.some((r) => r[0] === 'Balloner poppet' && Number(r[2]) >= 10), 'stats table does not show pops');
check(statsShown.rows.some((r) => r[0] === 'Swipes' && Number(r[2]) >= 1), 'stats table does not show swipes');
await page.screenshot({ path: `${OUT}/${tag}-06b-stats.png` });

// Family photos: add a generated picture through the parent menu, then check photo balloons appear.
await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
await page.mouse.down();
await page.waitForTimeout(2300);
await page.mouse.up();
check(await page.evaluate(() => !document.getElementById('parent-panel').hidden), 'parent panel did not reopen');
const png = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d');
  x.fillStyle = '#ffe0b3'; x.fillRect(0, 0, 400, 300);
  x.fillStyle = '#3b2a4a'; x.beginPath(); x.arc(160, 130, 14, 0, 7); x.arc(240, 130, 14, 0, 7); x.fill();
  x.strokeStyle = '#3b2a4a'; x.lineWidth = 10; x.beginPath(); x.arc(200, 160, 60, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  return c.toDataURL('image/png').split(',')[1];
});
await page.click('#tab-familie');
await page.setInputFiles('#photo-pick', { name: 'far.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await page.waitForFunction(() => !document.getElementById('crop-dialog').hidden, null, { timeout: 10000 });
// Frame the face: drag the picture a little and zoom in, then save.
const crop = await page.locator('#crop-canvas').boundingBox();
await page.mouse.move(crop.x + crop.width / 2, crop.y + crop.height / 2);
await page.mouse.down();
await page.mouse.move(crop.x + crop.width / 2 - 20, crop.y + crop.height / 2 + 10, { steps: 5 });
await page.mouse.up();
await page.locator('#crop-zoom').fill('1.6');
await page.screenshot({ path: `${OUT}/${tag}-08a-cropper.png` });
await page.click('#crop-save');
await page.waitForFunction(() => document.querySelectorAll('#photo-list .photo-item img').length === 1, null, { timeout: 10000 });
check(await page.evaluate(() => !document.getElementById('crop-again').hidden), 'cropper did not offer another face');
await page.click('#crop-cancel');
// Switching family balloons off empties the game's photo list; on again brings them back.
await page.click('label:has(#opt-family)');
check((await page.evaluate(() => { const g = window.__theo.game; g.balloons = []; for (let i = 0; i < 30; i++) g.spawnBalloon(); const none = g.balloons.every((b) => b.kind !== 'photo'); g.balloons = []; return none; })), 'family balloons still appear when switched off');
await page.click('label:has(#opt-family)');
console.log('photo added:', await page.evaluate(() => document.getElementById('photo-status').textContent));
// The parents' voices belong to Titte-bøh og Ord only: hidden while Balloner runs, shown while Ord runs.
check(await page.evaluate(() => document.getElementById('voice-section').hidden), 'the voices section should be hidden while Balloner runs');
await page.click('#parent-close');
await page.evaluate(() => window.__theo.startActivity('ord'));
await page.waitForTimeout(400);
const cornerForVoices = await page.locator('#parent-button').boundingBox();
await page.mouse.move(cornerForVoices.x + cornerForVoices.width / 2, cornerForVoices.y + cornerForVoices.height / 2);
await page.mouse.down();
await page.waitForTimeout(2300);
await page.mouse.up();
await page.waitForFunction(() => !document.getElementById('parent-panel').hidden, null, { timeout: 5000 });
await page.click('#tab-familie');
check(await page.evaluate(() => !document.getElementById('voice-section').hidden), 'the voices section should show while Ord runs');
// Hold the "Hund" button, say the word (a fake microphone here), release; then the dog in Ord says it.
const voiceRows = await page.evaluate(() => document.querySelectorAll('#voice-list .voice-row').length);
check(voiceRows >= 13, `expected a voice row per word and per photo, got ${voiceRows}`);
const recordButton = await page.locator('#voice-list .voice-record[data-key="hund"]').boundingBox();
await page.mouse.move(recordButton.x + recordButton.width / 2, recordButton.y + recordButton.height / 2);
await page.mouse.down();
await page.waitForTimeout(900);
await page.mouse.up();
await page.waitForFunction(() => { const b = document.querySelector('#voice-list .voice-play[data-key="hund"]'); return b && !b.hidden; }, null, { timeout: 10000 });
console.log('voice recorded:', await page.evaluate(() => document.getElementById('voice-status').textContent));
await page.waitForFunction(() => window.__theo.audio()?.hasVoice('hund'), null, { timeout: 10000 });
await page.click('#voice-list .voice-play[data-key="hund"]');
await page.waitForTimeout(2200); // each word is said at most every two seconds, and ▶ just said it
await page.screenshot({ path: `${OUT}/${tag}-08-photos-menu.png` });
await page.click('#parent-close');
const said = await page.evaluate(() => {
  const g = window.__theo.game; const a = window.__theo.audio(); const before = a.voicesSaid;
  g.round = null; g.hidden = false; g.bushOpen = 1; g.state = 'idle'; g.stateAge = 0; g.x = g.centerX;
  g.current = g.things.find((t) => t.key === 'hund');
  const hit = g.hit; g.press(91, hit.x, hit.y); g.release(91);
  return a.voicesSaid - before;
});
console.log('words said when the dog was touched in Ord:', said);
check(said >= 1, 'touching the dog in Ord did not say the recorded word');
// With a pause set (5 min above), a small countdown sits in the corner while a game runs and the menu is closed.
await page.waitForTimeout(300);
const countdownText = await page.evaluate(() => { const c = document.getElementById('pause-countdown'); return c.hidden ? null : c.textContent; });
console.log('pause countdown:', countdownText);
check(countdownText && /^\d+:\d\d$/.test(countdownText), 'the pause countdown should show m:ss in the corner');
// Back to the balloons for the rest of the checks (the photo added above follows along).
await page.evaluate(() => window.__theo.startActivity('balloner'));
await page.waitForTimeout(600);
const photoBalloon = await page.evaluate(() => {
  const g = window.__theo.game;
  // Spawn until a photo balloon shows up, in the middle of the screen so it can be tapped.
  for (let i = 0; i < 40; i++) {
    g.balloons = g.balloons.filter((b) => b.kind !== 'photo');
    const b = g.spawnBalloon({ x: g.width / 2, y: g.height * 0.5 });
    if (b && b.kind === 'photo') { for (const o of g.balloons) if (o !== b && Math.hypot(o.x - b.x, o.y - b.y) < b.r * 4) { o.baseX = 60; o.y = g.height - 60; } g.update(1 / 60); return [b.x, b.y, b.photoId]; }
    if (b) g.balloons.pop();
  }
  return null;
});
check(photoBalloon, 'no photo balloon could be made');
await page.evaluate(() => {
  // One balloon per family member, side by side, for the screenshot.
  const g = window.__theo.game;
  const ids = [...new Set(g.balloons.filter((b) => b.photoId).map((b) => b.photoId))];
  const all = ids.length ? ids : [];
  let column = 0;
  for (let i = 0; i < 60 && column < 4; i++) {
    const b = g.spawnBalloon({ x: g.width * (0.2 + column * 0.2), y: g.height * 0.3 });
    if (!b) break;
    if (b.kind === 'photo' && !all.includes(b.photoId)) { all.push(b.photoId); column++; } else g.balloons.pop();
  }
  g.update(1 / 60);
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/${tag}-09-photo-balloon.png` });
await page.touchscreen.tap(photoBalloon[0], photoBalloon[1]);
await page.waitForTimeout(500);
const card = await page.evaluate(() => window.__theo.game.particles.filter((p) => p.shape === 'photo').length);
console.log('photo card shown after pop:', card);
check(card === 1, 'photo did not jump out of the balloon');
await page.screenshot({ path: `${OUT}/${tag}-10-photo-pop.png` });
// Storage survives a reload.
await page.reload();
await waitForGame(page);
const storedPhotos = await page.evaluate(async () => (await new Promise((resolve) => { const r = indexedDB.open('theos-legeplads', 1); r.onsuccess = () => { const db = r.result; const q = db.transaction('photos').objectStore('photos').getAll(); q.onsuccess = () => resolve(q.result.length); }; })));
console.log('photos in IndexedDB after reload:', storedPhotos);
check(storedPhotos === 1, 'photo was not stored');
const popsAfterReload = await page.evaluate(() => window.__theo.stats.snapshot.total.pops);
console.log('pops remembered after reload:', popsAfterReload);
check(popsAfterReload >= 10, 'statistics were not saved');

// Live audio state.
const audioState = await page.evaluate(() => { const a = window.__theo.audio(); return a ? { state: a.state, song: a.currentSongName } : null; });
console.log('live audio:', audioState);

// Offline render of every sound + a bit of music.
const audio = await page.evaluate(async () => {
  const { AudioEngine } = window.__theo;
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, sr * 30, sr);
  const engine = new AudioEngine(ctx);
  await engine.ready;
  const marks = [
    ['pop big', 0.2, () => engine.pop(1, 0.2)],
    ['pop small', 0.8, () => engine.pop(0, 0.8)],
    ['sparkle', 1.4, () => engine.sparkle(1.4)],
    ['inflate', 2.0, () => engine.inflate(2.0)],
    ['fanfare', 2.6, () => engine.fanfare(2.6)],
    ['boing', 4.2, () => engine.boing(4.2)],
    ['chime', 5.0, () => engine.chime(5.0)],
    ['glide', 5.6, () => { engine.glide(0, 5.6); engine.glide(4, 5.7); engine.glide(7, 5.8); }],
    ['wee', 6.0, () => engine.wee(6.0)],
    ['rain', 6.6, () => engine.rain(6.6)],
    ['rattle', 7.2, () => engine.rattle(7.2)],
    ['tada', 7.7, () => engine.tada(7.7)],
    ['bark', 8.6, () => engine.bark(8.6)],
    ['trumpet', 9.3, () => engine.trumpet(9.3)],
    ['chirp', 11.3, () => { engine.chirp(11.3); engine.flutter(11.55); engine.blub(11.7); engine.rumble(11.75); }],
    ['twirl', 12.5, () => { engine.twirl(12.5); engine.pluck(12.9); }],
    ['thunder', 13.3, () => { engine.thunder(13.3); engine.zap(14.7); engine.squeak(15.4); engine.sizzle(15.8); engine.clearing(16.6); }],
    ['help', 17.4, () => { engine.help('dog', 17.4); engine.help('elephant', 17.8); engine.land(18.5); }],
    ['honk', 18.8, () => { engine.honk(18.8); engine.putter(19.3); }],
    ['moo', 19.8, () => engine.moo(19.8)],
    ['meow', 21.2, () => engine.meow(21.2)],
    ['beep', 22.0, () => engine.beep(22.0)],
    ['rustle', 22.7, () => engine.rustle(22.7)],
    ['question', 23.3, () => engine.question(23.3)],
    ['plop', 23.9, () => { engine.plop(0.2, 23.9); engine.plop(0.9, 24.15); }],
    ['splash', 24.6, () => { engine.splash(false, 24.6); engine.splash(true, 25.0); }],
    ['quack', 25.6, () => engine.quack(25.6)],
    ['gurgle', 26.2, () => engine.gurgle(26.2)],
    ['whale', 26.9, () => { engine.whaleCall(26.9); engine.spout(28.0); }],
    ['squawk', 28.9, () => engine.squawk(28.9)],
    ['whine', 29.3, () => engine.whine(29.3)],
  ];
  for (const [, , fn] of marks) fn();
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  const stats = (from, to) => {
    let peak = 0, sum = 0, n = 0, nan = 0;
    for (let i = Math.floor(from * sr); i < Math.min(data.length, Math.floor(to * sr)); i++) {
      const v = data[i]; if (Number.isNaN(v)) { nan++; continue; }
      peak = Math.max(peak, Math.abs(v)); sum += v * v; n++;
    }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), nan };
  };
  const out = {};
  for (let i = 0; i < marks.length; i++) {
    const [name, t] = marks[i];
    const end = i + 1 < marks.length ? marks[i + 1][1] : 30;
    out[name] = stats(t, end);
    // How long the sound is audible (envelope above 10 % of its peak), in seconds.
    let first = -1, last = -1;
    const peak = out[name].peak;
    for (let s = Math.floor(t * sr); s < Math.min(data.length, Math.floor(end * sr)); s += 220) {
      let m = 0; for (let k = s; k < s + 220 && k < data.length; k++) m = Math.max(m, Math.abs(data[k]));
      if (m > peak * 0.1) { if (first < 0) first = s; last = s; }
    }
    out[name].seconds = first < 0 ? 0 : +((last - first) / sr).toFixed(2);
  }
  out.silence_before = stats(0, 0.19);
  out.total = stats(0, 30);
  out.recordings = engine.loadedSamples;
  // WAV export for inspection
  const wav = new DataView(new ArrayBuffer(44 + data.length * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); wav.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, sr, true);
  wav.setUint32(28, sr * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); str(36, 'data'); wav.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  out.wavBase64 = btoa(String.fromCharCode(...new Uint8Array(wav.buffer.slice(0, 44))));
  return out;
});
console.log('audio stats:', JSON.stringify(audio, null, 1));
for (const [name, v] of Object.entries(audio)) {
  if (typeof v !== 'object' || name === 'silence_before' || name === 'total' || name === 'wavBase64' || name === 'recordings') continue;
  if (!(v.rms > 0.005)) throw new Error(`sound "${name}" is silent (rms ${v.rms})`);
  if (v.nan) throw new Error(`sound "${name}" produced NaN`);
  if (v.peak > 1.0) throw new Error(`sound "${name}" clips (peak ${v.peak})`);
}
check(audio.recordings.includes('elefant') && audio.recordings.includes('hund'), `recordings not loaded: ${audio.recordings.join(', ')}`);
check(audio.trumpet.seconds >= 0.8, `the elephant trumpet is too short (${audio.trumpet.seconds} s)`);
check(audio.bark.seconds >= 0.35, `the bark is too short (${audio.bark.seconds} s)`);
check(audio.moo.seconds >= 0.7, `the moo is too short (${audio.moo.seconds} s)`);
check(audio.meow.seconds >= 0.3, `the meow is too short (${audio.meow.seconds} s)`);

await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/${tag}-07-later.png` });

await browser.close();
server.close();
if (problems.length) {
  console.log('console problems:', problems);
  console.log('SMOKE FAILED: the page logged errors or warnings');
  process.exit(1);
}
console.log('console problems: none');
console.log('SMOKE OK');
