import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, GLIDE_NOTES, Game, TAP_HIT_FACTOR, TRAIL_LIFE, STORM_STAY } from '../src/activities/balloner/game';
import type { Balloon, GameEvent, Visitor } from '../src/activities/balloner/types';

const W = 390;
const H = 844;

function makeGame(seed = 42): { game: Game; events: GameEvent[] } {
  const game = new Game({}, seed);
  const events: GameEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  game.setAge('2+'); // the busiest profile: most tests were written against it; the youngest has its own tests
  return { game, events };
}

/** Finds a point on screen that is not near any balloon, the sun or a cloud. */
function emptySpot(game: Game): [number, number] {
  for (let y = 80; y < H - 80; y += 12) {
    for (let x = 40; x < W - 40; x += 12) {
      if (!game.findBalloonAt(x, y, TAP_HIT_FACTOR) && !game.isOnSun(x, y) && !game.findCloudAt(x, y) && !game.findFlowerAt(x, y)) {
        return [x, y];
      }
    }
  }
  throw new Error('Ingen ledig plads på skærmen');
}

function advance(game: Game, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

/** Runs the game until the condition holds, or fails after `maxSeconds`. */
function advanceUntil(game: Game, done: () => boolean, maxSeconds: number, step = 1 / 60): void {
  for (let t = 0; t < maxSeconds; t += step) {
    if (done()) return;
    game.update(step);
  }
  if (!done()) throw new Error(`Ventede ${maxSeconds} s forgæves`);
}

/** Slides a finger from one point to another in small steps. */
function swipe(game: Game, id: number, from: [number, number], to: [number, number], steps = 40): void {
  game.press(id, from[0], from[1]);
  for (let i = 1; i <= steps; i++) {
    game.drag(id, from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps);
    game.update(1 / 120);
  }
  game.release(id);
}

describe('Game', () => {
  it('starts with balloons and clouds already on screen', () => {
    const { game } = makeGame();
    expect(game.balloons.length).toBeGreaterThanOrEqual(4);
    expect(game.clouds.length).toBeGreaterThanOrEqual(4);
    for (const b of game.balloons) {
      expect(b.x).toBeGreaterThan(0);
      expect(b.x).toBeLessThan(W);
      expect(b.r).toBeGreaterThan(30);
    }
  });

  it('pops a balloon when tapped, even a bit outside its outline', () => {
    const { game, events } = makeGame();
    const balloon = game.balloons[0];
    const before = game.balloons.length;
    // Tap just outside the right edge; babies are not precise.
    game.press(1, balloon.x + balloon.r * 1.3, balloon.y);
    expect(game.balloons.length).toBe(before - 1);
    expect(game.balloons).not.toContain(balloon);
    const pop = events.find((e) => e.type === 'pop');
    expect(pop).toBeDefined();
    expect(game.particles.length).toBeGreaterThan(10);
    expect(game.pops).toBe(1);
  });

  it('makes a new inflating balloon and sparkles when touching empty sky', () => {
    const { game, events } = makeGame();
    const [x, y] = emptySpot(game);
    const before = game.balloons.length;
    game.press(1, x, y);
    expect(game.balloons.length).toBe(before + 1);
    const created = game.balloons[game.balloons.length - 1];
    expect(created.tapped).toBe(true);
    expect(created.x).toBeCloseTo(x, 5);
    expect(created.y).toBeCloseTo(y, 5);
    expect(created.scale).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['sparkle', 'spawn']);
    game.release(1); // a tap lets go; a finger that stays keeps the balloon growing (see "holding")

    advance(game, 0.6);
    expect(created.scale).toBeCloseTo(1, 2);
    expect(created.y).toBeLessThan(y);
  });

  it('never has more balloons than the cap, however much the screen is mashed', () => {
    const { game } = makeGame();
    for (let i = 0; i < 60; i++) {
      game.press(i, (i * 37) % W, 100 + ((i * 53) % (H - 200)));
      game.release(i);
      game.update(0.01);
      expect(game.balloons.length).toBeLessThanOrEqual(DEFAULT_CONFIG.maxBalloons);
    }
  });

  it('pops balloons a finger slides over', () => {
    const { game, events } = makeGame();
    advance(game, 0.5);
    const balloon = game.balloons[0];
    const [x, y] = emptySpot(game);
    swipe(game, 1, [x, y], [balloon.x, balloon.y]);
    expect(game.balloons).not.toContain(balloon);
    expect(events.some((e) => e.type === 'pop')).toBe(true);
  });

  it('pops a balloon a fast swipe crosses on a tablet, even though the wind pushes it', () => {
    const game = new Game({}, 7);
    game.resize(1024, 768);
    game.balloons = [];
    const balloon = game.spawnBalloon({ x: 600, y: 380 })!;
    advance(game, 0.5);
    // Big steps like a quick hand across a tablet: 25 px per sample at 120 Hz.
    swipe(game, 1, [10, balloon.y + balloon.r * 0.5], [1014, balloon.y + balloon.r * 0.5], 40);
    expect(game.balloons).not.toContain(balloon);
  });

  it('does not let the same touch pop the balloon it just created', () => {
    const { game } = makeGame();
    const [x, y] = emptySpot(game);
    game.press(1, x, y);
    const created = game.balloons[game.balloons.length - 1];
    game.drag(1, x + 2, y + 1);
    game.drag(1, x - 2, y - 1);
    expect(game.balloons).toContain(created);
  });

  it('counts a real swipe when the finger lifts, but not a tap', () => {
    const { game, events } = makeGame();
    game.balloons = [];
    game.press(1, 100, 400);
    game.release(1);
    expect(events.some((e) => e.type === 'swipe')).toBe(false);
    swipe(game, 2, [40, 400], [340, 400]);
    const swipeEvent = events.find((e): e is Extract<GameEvent, { type: 'swipe' }> => e.type === 'swipe');
    expect(swipeEvent).toBeDefined();
    expect(swipeEvent!.length).toBeGreaterThan(250);
  });

  it('counts each balloon blown by a swipe once per swipe', () => {
    // One balloon only: the cap of one keeps the touch from making another and blocks natural spawns.
    const game = new Game({ maxBalloons: 1, targetBalloons: 0 }, 42);
    const events: GameEvent[] = [];
    game.onEvent((event) => events.push(event));
    game.resize(W, H);
    game.balloons = [];
    const balloon = game.spawnBalloon({ x: 200, y: 400 })!;
    advance(game, 0.5);
    const gap = balloon.r * 1.6;
    swipe(game, 1, [balloon.x - gap, 600], [balloon.x - gap, 200]);
    expect(events.filter((e) => e.type === 'blow')).toHaveLength(1);
    balloon.baseX = 200;
    balloon.y = 400;
    balloon.vx = 0;
    balloon.vyImpulse = 0;
    advance(game, 0.1);
    swipe(game, 2, [balloon.x - gap, 600], [balloon.x - gap, 200]);
    expect(events.filter((e) => e.type === 'blow')).toHaveLength(2);
  });

  it('paints a ribbon behind a swiping finger that fades after the finger lifts', () => {
    const { game } = makeGame();
    game.balloons = [];
    swipe(game, 1, [40, 400], [350, 420]);
    expect(game.trails).toHaveLength(1);
    expect(game.trails[0].points.length).toBeGreaterThan(10);
    expect(game.trails[0].active).toBe(false);
    advance(game, TRAIL_LIFE + 0.2);
    expect(game.trails).toHaveLength(0);
  });

  it('plays harp notes along a swipe, higher notes higher up on the screen', () => {
    const { game, events } = makeGame();
    game.balloons = [];
    swipe(game, 1, [30, H - 120], [W - 30, H - 120]);
    const low = events.filter((e): e is Extract<GameEvent, { type: 'glide' }> => e.type === 'glide');
    expect(low.length).toBeGreaterThanOrEqual(5);
    events.length = 0;
    swipe(game, 2, [30, 120], [W - 30, 120]);
    const high = events.filter((e): e is Extract<GameEvent, { type: 'glide' }> => e.type === 'glide');
    expect(high.length).toBeGreaterThanOrEqual(5);
    const average = (notes: Array<{ note: number }>) => notes.reduce((sum, n) => sum + n.note, 0) / notes.length;
    expect(average(high)).toBeGreaterThan(average(low));
    for (const e of [...low, ...high]) {
      expect(e.note).toBeGreaterThanOrEqual(0);
      expect(e.note).toBeLessThan(GLIDE_NOTES);
    }
  });

  it('blows balloons near a swiping finger without popping them', () => {
    const { game, events } = makeGame();
    game.balloons = [];
    const balloon = game.spawnBalloon({ x: 200, y: 400 })!;
    advance(game, 0.5);
    const startX = balloon.baseX;
    // Swipe upwards, passing to the left of the balloon just outside its hit area.
    const gap = balloon.r * 1.6;
    swipe(game, 1, [balloon.x - gap, 600], [balloon.x - gap, 200]);
    expect(events.some((e) => e.type === 'pop')).toBe(false);
    expect(game.balloons).toContain(balloon);
    expect(Math.abs(balloon.vx) + Math.abs(balloon.vyImpulse)).toBeGreaterThan(20);
    advance(game, 0.5);
    expect(balloon.baseX).not.toBeCloseTo(startX, 0);
    // Pushes fade out again.
    advance(game, 3);
    expect(Math.abs(balloon.vx)).toBeLessThan(5);
  });

  it('keeps pushed balloons on the screen', () => {
    const { game } = makeGame();
    game.balloons = [];
    const balloon = game.spawnBalloon({ x: 60, y: 400 })!;
    advance(game, 0.5);
    balloon.vx = -2000;
    advance(game, 1);
    expect(balloon.baseX).toBeGreaterThanOrEqual(balloon.r);
    balloon.vx = 2000;
    advance(game, 1);
    expect(balloon.baseX).toBeLessThanOrEqual(W - balloon.r);
  });

  it('makes the sun spin and sparkle when touched', () => {
    const { game, events } = makeGame();
    game.balloons = [];
    // Clouds drift in front of the sun now and then; move them away so the touch reaches the sun.
    for (const c of game.clouds) c.y = H * 0.45;
    const sun = game.sun;
    game.press(1, sun.x, sun.y);
    expect(events.some((e) => e.type === 'sun')).toBe(true);
    expect(game.sunHit).toBe(0);
    expect(game.particles.length).toBeGreaterThan(5);
  });

  it('makes a cloud wobble and rain when touched', () => {
    const { game, events } = makeGame();
    game.balloons = [];
    const cloud = game.clouds[0];
    cloud.x = W / 2;
    cloud.y = 300;
    game.press(1, cloud.x, cloud.y);
    expect(events.some((e) => e.type === 'cloud')).toBe(true);
    expect(cloud.wobble).toBe(1);
    expect(game.particles.filter((p) => p.shape === 'drop').length).toBeGreaterThan(5);
  });

  it('throws everything about when the phone is shaken', () => {
    const { game, events } = makeGame();
    advance(game, 0.5);
    const impulses = () => game.balloons.reduce((sum, b) => sum + Math.abs(b.vx) + Math.abs(b.vyImpulse), 0);
    expect(impulses()).toBe(0);
    game.shake();
    expect(impulses()).toBeGreaterThan(100);
    expect(events.some((e) => e.type === 'shake')).toBe(true);
    expect(game.sunHit).toBe(0);
  });

  it('puts family photos on some balloons, taking turns between the photos', () => {
    const { game } = makeGame();
    game.balloons = [];
    game.setPhotos(['mor', 'far', 'theo']);
    const ids: string[] = [];
    for (let i = 0; i < 60; i++) {
      const b = game.spawnBalloon()!;
      if (b.kind === 'photo') {
        expect(b.photoId).toBeDefined();
        ids.push(b.photoId!);
      }
      game.balloons = [];
    }
    expect(ids.length).toBeGreaterThan(8);
    expect(new Set(ids)).toEqual(new Set(['mor', 'far', 'theo']));
    // They take turns, so every family member shows up about equally often.
    expect(ids.slice(0, 3).sort()).toEqual(['far', 'mor', 'theo']);
  });

  it('never makes photo balloons without photos', () => {
    const { game } = makeGame();
    for (let i = 0; i < 40; i++) {
      game.balloons = [];
      expect(game.spawnBalloon()!.kind).not.toBe('photo');
    }
  });

  it('shows the photo big with hearts when a photo balloon pops', () => {
    const { game, events } = makeGame();
    game.balloons = [];
    game.setPhotos(['theo']);
    let balloon = game.spawnBalloon({ x: 200, y: 400 })!;
    while (balloon.kind !== 'photo') {
      game.balloons = [];
      balloon = game.spawnBalloon({ x: 200, y: 400 })!;
    }
    game.press(1, balloon.x, balloon.y);
    const card = game.particles.find((p) => p.shape === 'photo');
    expect(card).toBeDefined();
    expect(card!.photoId).toBe('theo');
    expect(card!.x).toBeGreaterThan(card!.size * 0.5);
    expect(card!.y).toBeGreaterThan(card!.size * 0.5);
    expect(game.particles.filter((p) => p.shape === 'heart').length).toBeGreaterThanOrEqual(10);
    expect(events.find((e) => e.type === 'pop')).toMatchObject({ kind: 'photo' });
    // The photo stays on screen for a while even when lots of other particles are made.
    for (let i = 0; i < 30; i++) game.shake();
    expect(game.particles.some((p) => p.shape === 'photo')).toBe(true);
  });

  it('turns photo balloons back into ordinary balloons when their photo is removed', () => {
    const { game } = makeGame();
    game.balloons = [];
    game.setPhotos(['mor']);
    let balloon = game.spawnBalloon()!;
    while (balloon.kind !== 'photo') {
      game.balloons = [];
      balloon = game.spawnBalloon()!;
    }
    game.setPhotos([]);
    expect(balloon.kind).toBe('plain');
    expect(balloon.photoId).toBeUndefined();
  });

  it('lets parents pick a calmer or wilder sky', () => {
    const count = (tempo: 'rolig' | 'normal' | 'vild') => {
      const game = new Game({}, 3);
      game.resize(W, H);
      game.setTempo(tempo);
      let total = 0;
      let samples = 0;
      for (let t = 0; t < 40; t += 1 / 30) {
        game.update(1 / 30);
        if (t > 10) {
          total += game.balloons.length;
          samples++;
        }
      }
      const speed = game.balloons.reduce((sum, b) => sum + b.vy, 0) / Math.max(1, game.balloons.length);
      return { average: total / samples, speed };
    };
    const rolig = count('rolig');
    const normal = count('normal');
    const vild = count('vild');
    expect(rolig.average).toBeLessThan(normal.average);
    expect(normal.average).toBeLessThan(vild.average);
    expect(vild.average).toBeLessThanOrEqual(DEFAULT_CONFIG.maxBalloons);
    expect(rolig.speed).toBeLessThan(vild.speed);
  });

  it('changes the speed of balloons already on screen when the tempo changes', () => {
    const { game } = makeGame();
    const before = game.balloons.map((b) => b.vy);
    game.setTempo('vild');
    game.balloons.forEach((b, i) => expect(b.vy).toBeGreaterThan(before[i]));
    game.setTempo('normal');
    game.balloons.forEach((b, i) => expect(b.vy).toBeCloseTo(before[i], 6));
  });

  describe('flowers', () => {
    it('grow along the front hill', () => {
      const { game } = makeGame();
      expect(game.flowers.length).toBeGreaterThan(5);
      for (const f of game.flowers) {
        const head = game.flowerHead(f);
        expect(head.x).toBeGreaterThan(0);
        expect(head.x).toBeLessThan(W);
        expect(head.y).toBeLessThan(game.ground(head.x));
        expect(head.y).toBeGreaterThan(H * 0.7);
      }
    });

    it('spins and cycles colours for a few seconds when tapped', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const flower = game.flowers[2];
      const head = game.flowerHead(flower);
      game.press(1, head.x + 6, head.y - 4);
      game.release(1);
      expect(events.find((e) => e.type === 'flower')).toMatchObject({ what: 'spin' });
      expect(flower.rainbow).toBeGreaterThan(4);
      expect(flower.spin).not.toBe(0);
      advance(game, 1);
      expect(flower.angle).not.toBe(0);
      advance(game, 5);
      expect(flower.rainbow).toBe(0);
      expect(flower.spin).toBe(0);
    });

    it('plucks flowers a finger swipes over; they fly, spin and grow back', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const y = game.flowerHead(game.flowers[0]).y;
      swipe(game, 1, [10, y], [W - 10, y], 80);
      const plucked = game.flowers.filter((f) => f.flying);
      expect(plucked.length).toBeGreaterThanOrEqual(3);
      expect(events.filter((e) => e.type === 'flower' && e.what === 'pluck').length).toBe(plucked.length);
      for (const f of plucked) {
        expect(f.growth).toBe(0);
        // Thrown upwards: still above the flower bed even though gravity has been pulling for a moment.
        expect(f.flying!.y).toBeLessThan(y);
      }
      advance(game, 0.4);
      for (const f of plucked) expect(f.angle).not.toBe(0);
      // A plucked flower can't be plucked or spun again until it has grown back.
      expect(game.findFlowerAt(game.flowerHead(plucked[0]).x, y)).toBeNull();
      advance(game, 7);
      for (const f of game.flowers) {
        expect(f.flying).toBeNull();
        expect(f.growth).toBe(1);
      }
    });

    it('spin a little when the phone is shaken', () => {
      const { game } = makeGame();
      game.shake();
      expect(game.flowers.some((f) => f.spin !== 0)).toBe(true);
    });
  });

  describe('age profiles and the pause', () => {
    it('starts on the youngest profile: few balloons, one visitor, no storms by themselves, no screen flash', () => {
      const game = new Game({}, 5);
      game.resize(W, H);
      const events: GameEvent[] = [];
      game.onEvent((e) => events.push(e));
      expect(game.currentAge).toBe('8-12');
      expect(game.targetBalloons).toBe(3);
      let mostVisitors = 0;
      for (let t = 0; t < 600; t += 1 / 20) {
        game.update(1 / 20);
        mostVisitors = Math.max(mostVisitors, game.visitors.filter((v) => v.state !== 'gone').length);
      }
      expect(events.filter((e) => e.type === 'visitor' && e.kind === 'storm' && e.what === 'appear')).toHaveLength(0);
      expect(mostVisitors).toBeLessThanOrEqual(1);
      expect(game.balloons.length).toBeLessThanOrEqual(4);
      // A storm a parent summons still strikes, but never lights up the whole screen.
      game.balloons = [];
      game.visitors = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      storm.y = H * 0.25;
      advance(game, 0.5);
      game.press(1, storm.x, storm.y);
      game.release(1);
      const bolt = events.find((e) => e.type === 'lightning');
      expect(bolt).toMatchObject({ flash: false });
    });

    it('lets older children have more going on', () => {
      const { game } = makeGame();
      game.setAge('1-2');
      expect(game.targetBalloons).toBe(5);
      expect(game.profile.visitors).toBe(2);
      game.setAge('2+');
      expect(game.targetBalloons).toBe(6);
      expect(game.profile.storms).toBe(true);
    });

    it('goes to sleep calmly and wakes up when a parent says so', () => {
      const { game } = makeGame();
      advance(game, 1);
      game.sleep();
      expect(game.asleep).toBe(true);
      const count = game.balloons.length;
      advance(game, 10);
      expect(game.dusk).toBe(1);
      expect(game.balloons.length).toBeLessThanOrEqual(count); // nothing new arrives
      expect(game.visitors.filter((v) => v.state !== 'gone' && v.state !== 'leave')).toHaveLength(0);
      const before = game.balloons.length;
      game.press(1, W / 2, H * 0.45);
      game.release(1);
      expect(game.balloons.length).toBe(before); // a touch is only a twinkle now
      game.wake();
      advance(game, 3);
      expect(game.dusk).toBe(0);
      advance(game, 15);
      expect(game.balloons.length).toBeGreaterThan(0);
    });
  });

  describe('the farm and its tractor', () => {
    it('smokes from the farmhouse chimney now and then', () => {
      const { game } = makeGame();
      const chimney = game.farmChimney();
      let seen = false;
      for (let t = 0; t < 8 && !seen; t += 1 / 60) {
        game.update(1 / 60);
        seen = game.particles.some((p) => p.shape === 'smoke' && Math.abs(p.x - chimney.x) < 40 * game.unit && p.y <= chimney.y + 1);
      }
      expect(seen).toBe(true);
    });

    it('drives out from the farm, pauses, and drives back home puffing smoke', () => {
      const { game, events } = makeGame();
      game.visitors = [];
      const tractor = game.spawnVisitor('tractor');
      expect(tractor.x).toBeGreaterThan(W);
      expect(tractor.dir).toBe(-1);
      advance(game, 1);
      expect(tractor.x).toBeLessThan(W);
      expect(tractor.y).toBe(game.ground(tractor.x));
      expect(game.particles.some((p) => p.shape === 'smoke' && Math.abs(p.x - tractor.x) < tractor.size * 3)).toBe(true);
      advanceUntil(game, () => tractor.state === 'idle', 15);
      expect(tractor.x).toBeLessThan(W * 0.6);
      expect(tractor.vx).toBe(0);
      advanceUntil(game, () => tractor.state === 'leave', 10);
      expect(tractor.dir).toBe(1);
      advanceUntil(game, () => tractor.state === 'gone', 20);
      expect(events.some((e) => e.type === 'visitor' && e.kind === 'tractor' && e.what === 'appear')).toBe(true);
    });

    it('is faster than the dog', () => {
      const { game } = makeGame();
      game.visitors = [];
      const tractor = game.spawnVisitor('tractor');
      const dog = game.spawnVisitor('dog');
      expect(Math.abs(tractor.vx)).toBeGreaterThan(Math.abs(dog.vx) * 1.5);
    });

    it('honks and hops when touched', () => {
      const { game, events } = makeGame();
      game.visitors = [];
      game.balloons = [];
      const tractor = game.spawnVisitor('tractor');
      tractor.x = W / 2;
      advance(game, 0.1);
      const hit = game.visitorHit(tractor);
      game.press(1, hit.x, hit.y);
      game.release(1);
      expect(events.some((e) => e.type === 'visitor' && e.kind === 'tractor' && e.what === 'poke')).toBe(true);
      advance(game, 0.15);
      expect(tractor.lift).toBeGreaterThan(0);
    });

    it('can be lifted by a balloon and drives home after landing', () => {
      const { game } = makeGame();
      game.visitors = [];
      game.balloons = [];
      for (const c of game.clouds) c.y = -1000;
      const tractor = game.spawnVisitor('tractor');
      tractor.x = W / 2;
      tractor.targetX = W / 2 - 1;
      advance(game, 0.2);
      const hit = game.visitorHit(tractor);
      game.press(1, hit.x, hit.y - 100 * game.unit);
      game.release(1);
      expect(tractor.state).toBe('carried');
      const balloon = game.balloons.find((b) => b.carrying === tractor.id)!;
      expect(balloon).toBeDefined();
      advanceUntil(game, () => tractor.y < game.ground(tractor.x) - 30 * game.unit, 10);
      game.press(2, balloon.x, balloon.y);
      expect(tractor.state).toBe('falling');
      advanceUntil(game, () => tractor.state !== 'falling', 20);
      expect(['idle', 'leave']).toContain(tractor.state);
      advanceUntil(game, () => tractor.state === 'gone', 30);
    });
  });

  describe('holding a finger still', () => {
    /** Clears the sky so a held finger meets exactly what the test wants. */
    function clearSky(game: Game): void {
      game.balloons = [];
      game.visitors = [];
      for (const c of game.clouds) c.x = -1000;
    }

    it('turns a held cloud dark and then into the storm cloud, where it was', () => {
      const { game, events } = makeGame();
      clearSky(game);
      const cloud = game.clouds[0];
      cloud.x = W / 2;
      cloud.y = H * 0.25;
      game.press(1, cloud.x, cloud.y);
      advance(game, 0.2);
      expect(cloud.dark).toBe(0); // a plain tap is still just a tap
      advance(game, 0.8);
      expect(cloud.dark).toBeGreaterThan(0.2);
      expect(cloud.dark).toBeLessThan(1);
      expect(game.storm).toBeNull();
      advance(game, 1);
      const storm = game.storm;
      expect(storm).not.toBeNull();
      expect(Math.abs(storm!.x - W / 2)).toBeLessThan(40);
      expect(events.some((e) => e.type === 'hold' && e.what === 'storm')).toBe(true);
      expect(cloud.dark).toBe(0);
      expect(cloud.x).toBeLessThan(W / 4); // the white cloud drifts back in from the side later
      game.release(1);
    });

    it('holds the storm cloud until it is bright again: the rain stops, a white cloud takes its place, the rainbow comes', () => {
      const { game, events } = makeGame();
      clearSky(game);
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      storm.y = H * 0.25;
      storm.state = 'idle';
      game.update(1 / 60);
      game.press(1, storm.x, storm.y);
      advance(game, 0.8);
      expect(storm.clearing).toBeGreaterThan(0.2);
      expect(game.storm).toBe(storm);
      advance(game, 1);
      expect(game.storm).toBeNull();
      expect(events.some((e) => e.type === 'hold' && e.what === 'clear')).toBe(true);
      expect(events.some((e) => e.type === 'visitor' && e.kind === 'storm' && e.what === 'leave')).toBe(true);
      expect(game.rainbowGlow).toBeGreaterThan(0);
      expect(game.clouds.some((c) => Math.abs(c.x - W / 2) < 40 && c.dark === 0)).toBe(true);
      game.release(1);
      // Letting go early only lets it fade back to the dark cloud it was.
      const again = game.spawnVisitor('storm');
      again.x = W / 2;
      again.y = H * 0.25;
      again.state = 'idle';
      game.update(1 / 60);
      game.press(2, again.x, again.y);
      advance(game, 0.8);
      expect(again.clearing).toBeGreaterThan(0.2);
      game.release(2);
      advance(game, 1);
      expect(again.clearing).toBe(0);
      expect(game.storm).toBe(again);
    });

    it('lets a cloud turn white again when the finger moves away or lets go early', () => {
      const { game } = makeGame();
      clearSky(game);
      const cloud = game.clouds[0];
      cloud.x = W / 2;
      cloud.y = H * 0.25;
      game.press(1, cloud.x, cloud.y);
      advance(game, 0.8);
      expect(cloud.dark).toBeGreaterThan(0);
      game.drag(1, cloud.x + 60 * game.unit, cloud.y);
      advance(game, 2);
      game.release(1);
      expect(game.storm).toBeNull();
      expect(cloud.dark).toBe(0);
      game.press(2, cloud.x, cloud.y);
      advance(game, 0.8);
      game.release(2);
      advance(game, 2);
      expect(game.storm).toBeNull();
      expect(cloud.dark).toBe(0);
    });

    it('keeps a new balloon growing under a held finger until it bursts', () => {
      const { game, events } = makeGame();
      clearSky(game);
      game.press(1, W / 2, H * 0.45);
      const b = game.balloons[game.balloons.length - 1];
      expect(b.heldBy).toBe(1);
      advance(game, 1);
      expect(b.scale).toBeGreaterThanOrEqual(1);
      const y = b.y;
      advance(game, 1);
      expect(b.y).toBe(y); // pinned under the finger
      expect(b.scale).toBeGreaterThan(1.1);
      expect(game.balloons).toContain(b); // its own finger does not pop it
      advance(game, 1.5);
      expect(game.balloons).not.toContain(b);
      expect(events.some((e) => e.type === 'hold' && e.what === 'burst')).toBe(true);
      game.release(1);
    });

    it('lets a big balloon float off when the finger lets go before it bursts', () => {
      const { game } = makeGame();
      clearSky(game);
      game.press(1, W / 2, H * 0.45);
      const b = game.balloons[game.balloons.length - 1];
      advance(game, 1.5);
      game.release(1);
      const scale = b.scale;
      expect(scale).toBeGreaterThan(1.05);
      const y = b.y;
      advance(game, 1);
      expect(b.scale).toBe(scale);
      expect(b.y).toBeLessThan(y);
      expect(game.balloons).toContain(b);
    });

    it('charges the sun and lets off a sunburst that boosts the flowers and lifts the balloons', () => {
      const { game, events } = makeGame();
      game.visitors = [];
      for (const c of game.clouds) c.x = -1000;
      const sun = game.sun;
      game.press(1, sun.x, sun.y);
      advance(game, 1);
      expect(game.sunCharge).toBeGreaterThan(0);
      expect(game.sunCharge).toBeLessThan(1);
      const before = new Map(game.balloons.map((b) => [b.id, b.vyImpulse]));
      advance(game, 1);
      expect(events.some((e) => e.type === 'hold' && e.what === 'sunburst')).toBe(true);
      expect(game.flowers.every((f) => f.boost > 0)).toBe(true);
      for (const b of game.balloons) {
        if (before.has(b.id)) expect(b.vyImpulse).toBeLessThan(before.get(b.id)!);
      }
      game.release(1);
    });
  });

  describe('balloons carrying creatures', () => {
    /** Spawns a balloon by touching just above a creature, so the string reaches it. */
    function liftWithBalloon(game: Game, v: Visitor): Balloon {
      const hit = game.visitorHit(v);
      const before = game.balloons.length;
      game.press(1, hit.x, hit.y - 100 * game.unit);
      game.release(1);
      expect(game.balloons.length).toBe(before + 1);
      return game.balloons[game.balloons.length - 1];
    }

    it('a balloon made above the dog picks it up; popping it lets the dog parachute down and walk on', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const dog = game.spawnVisitor('dog');
      dog.x = W / 2;
      advance(game, 1);
      const balloon = liftWithBalloon(game, dog);
      expect(dog.state).toBe('carried');
      expect(balloon.carrying).toBe(dog.id);
      expect(events.some((e) => e.type === 'carry' && e.what === 'hooked')).toBe(true);
      advance(game, 3);
      // Hangs from the string and calls for help.
      expect(Math.abs(game.visitorHit(dog).y - game.stringEnd(balloon).y)).toBeLessThan(2);
      expect(dog.y).toBeLessThan(game.ground(dog.x) - 50);
      expect(events.filter((e) => e.type === 'carry' && e.what === 'help').length).toBeGreaterThanOrEqual(1);
      game.press(2, balloon.x, balloon.y);
      expect(game.balloons).not.toContain(balloon);
      expect(dog.state).toBe('falling');
      const heightBefore = dog.y;
      advance(game, 1);
      expect(dog.y).toBeGreaterThan(heightBefore);
      expect(dog.y).toBeLessThan(heightBefore + 100 * game.unit); // gently, not a drop
      advanceUntil(game, () => dog.state !== 'falling', 30);
      expect(dog.state).toBe('idle');
      expect(dog.y).toBe(game.ground(dog.x));
      expect(events.some((e) => e.type === 'carry' && e.what === 'landed')).toBe(true);
      const x = dog.x;
      advance(game, 1);
      expect(dog.x).not.toBe(x); // walking again
    });

    it('a balloon carrying a creature rises slowly', () => {
      const { game } = makeGame();
      game.balloons = [];
      const dog = game.spawnVisitor('dog');
      dog.x = W / 2;
      advance(game, 1);
      const heavy = liftWithBalloon(game, dog);
      const light = game.spawnBalloon({ x: 60, y: heavy.y })!;
      light.vy = heavy.vy;
      light.inflate = heavy.inflate;
      light.scale = heavy.scale;
      advance(game, 3);
      expect(heavy.y).toBeGreaterThan(light.y + 30);
    });

    it('lets a lifted bird fly on when the balloon pops, and the elephant land on the hill', () => {
      const { game } = makeGame();
      game.balloons = [];
      const bird = game.spawnVisitor('bird');
      bird.x = W / 2;
      bird.y = H * 0.5;
      advance(game, 0.5);
      const balloon = liftWithBalloon(game, bird);
      expect(bird.state).toBe('carried');
      game.press(2, balloon.x, balloon.y);
      expect(bird.state).toBe('idle');

      game.balloons = [];
      const elephant = game.spawnVisitor('elephant');
      elephant.x = W / 2;
      advance(game, 2);
      const lifter = liftWithBalloon(game, elephant);
      expect(elephant.state).toBe('carried');
      game.press(3, lifter.x, lifter.y);
      expect(elephant.state).toBe('falling');
      advanceUntil(game, () => elephant.state !== 'falling', 40);
      expect(elephant.state).toBe('idle');
      expect(elephant.lift).toBeGreaterThan(elephant.size);
      expect(elephant.y).toBe(game.ground(elephant.x));
    });

    it('the storm cloud and shooting stars cannot be picked up', () => {
      const { game } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      game.press(1, storm.x, storm.y - 110 * game.unit);
      expect(storm.state).not.toBe('carried');
    });

    it('a creature dropped by a balloon floating off the top parachutes down from there', () => {
      const { game } = makeGame();
      game.balloons = [];
      const snail = game.spawnVisitor('snail');
      snail.x = W / 2;
      advance(game, 1);
      const balloon = liftWithBalloon(game, snail);
      const ageBefore = snail.age;
      // The balloon drifts off the top of the screen with the snail on its string.
      advanceUntil(game, () => snail.state !== 'carried', 60);
      expect(game.balloons).not.toContain(balloon);
      expect(snail.state).toBe('falling');
      expect(snail.y).toBeLessThan(H * 0.25); // let go near the top of the screen
      expect(snail.age).toBeCloseTo(ageBefore, 1); // the adventure does not count as lifetime
      advanceUntil(game, () => snail.state !== 'falling', 60);
      expect(snail.state).toBe('idle');
      expect(snail.y).toBe(game.ground(snail.x));
    });
  });

  describe('storm cloud', () => {
    it('is rare: never in the first minute, then at most every four minutes', () => {
      const game = new Game({}, 5);
      game.resize(W, H);
      game.setAge('2+');
      let storms = 0;
      game.onEvent((e) => {
        if (e.type === 'visitor' && e.kind === 'storm' && e.what === 'appear') storms++;
      });
      advance(game, 55, 1 / 20);
      expect(storms).toBe(0);
      advance(game, 900, 1 / 20);
      expect(storms).toBeGreaterThanOrEqual(1);
      expect(storms).toBeLessThanOrEqual(4);
    });

    it('drifts across, rains, presses balloons down and grows flowers, then leaves with a glowing rainbow', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      storm.dir = 1;
      storm.vx = Math.abs(storm.vx);
      const balloon = game.spawnBalloon({ x: W / 2, y: H * 0.6 })!;
      const flower = game.flowers.reduce((best, f) => (Math.abs(game.flowerHead(f).x - W / 2) < Math.abs(game.flowerHead(best).x - W / 2) ? f : best));
      advance(game, 1);
      expect(game.particles.filter((p) => p.shape === 'drop').length).toBeGreaterThan(10);
      expect(balloon.vyImpulse).toBeGreaterThan(20);
      expect(flower.boost).toBeGreaterThan(0.2);
      // It lingers for a good while, bouncing off the edges, before it moves on.
      advance(game, 60, 1 / 30);
      expect(game.visitors).toContain(storm);
      expect(storm.x).toBeGreaterThan(0);
      expect(storm.x).toBeLessThan(W);
      storm.age = STORM_STAY + 1;
      // Then it drifts off the screen; the rainbow glows right after it has gone.
      for (let t = 0; t < 120 && game.visitors.includes(storm); t += 1 / 30) game.update(1 / 30);
      expect(game.visitors).not.toContain(storm);
      expect(events.some((e) => e.type === 'visitor' && e.kind === 'storm' && e.what === 'leave')).toBe(true);
      expect(game.rainbowGlow).toBeGreaterThan(5);
      advance(game, 10);
      expect(game.rainbowGlow).toBe(0);
    });

    it('flashes lightning by itself and when touched', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      advance(game, 0.2);
      const hit = game.visitorHit(storm);
      game.press(1, hit.x, hit.y);
      game.release(1);
      expect(storm.lightning).toBeGreaterThan(0);
      expect(events.filter((e) => e.type === 'lightning')).toHaveLength(1);
      advance(game, 14);
      expect(events.filter((e) => e.type === 'lightning').length).toBeGreaterThanOrEqual(2);
    });

    it('strikes on every quick tap, but flashes the whole screen at most three times a second', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      storm.y = H * 0.25;
      advance(game, 0.5);
      const hit = game.visitorHit(storm);
      for (let i = 0; i < 6; i++) {
        game.press(1, hit.x, hit.y);
        game.release(1);
        advance(game, 0.15);
      }
      const bolts = events.filter((e) => e.type === 'lightning');
      expect(bolts).toHaveLength(6);
      expect(bolts.filter((e) => e.type === 'lightning' && e.flash).length).toBeLessThanOrEqual(3);
      expect(bolts[0]).toMatchObject({ quick: false, flash: true });
      expect(bolts[1]).toMatchObject({ quick: true });
    });

    it('turns the dog into a hotdog and the elephant into a mouse for a while', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      const dog = game.spawnVisitor('dog');
      dog.x = W / 2;
      dog.vx = 0;
      const elephant = game.spawnVisitor('elephant');
      elephant.x = W / 2;
      advance(game, 2);
      const hit = game.visitorHit(storm);
      game.press(1, hit.x, hit.y);
      expect(dog.form).toBe('hotdog');
      expect(elephant.form).toBe('mouse');
      expect(events.filter((e) => e.type === 'transform' && e.form)).toHaveLength(2);
      storm.nextLightning = 100; // the cloud lingers now; no second strike while we wait
      advance(game, 8);
      expect(dog.form).toBeNull();
      expect(elephant.form).toBeNull();
      expect(events.filter((e) => e.type === 'transform' && e.form === null)).toHaveLength(2);
    });

    it('shoves balloons near the bolt aside instead of popping them', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      const under = game.spawnBalloon({ x: W / 2 + 10, y: H * 0.6 })!;
      const aside = game.spawnBalloon({ x: W / 2 - 130, y: storm.y - 60 })!; // above the cloud: out of the bolt's way
      advance(game, 0.2);
      game.press(1, storm.x, storm.y);
      expect(game.balloons).toContain(under);
      expect(game.balloons).toContain(aside);
      expect(Math.abs(under.vx)).toBeGreaterThan(100);
      expect(under.vyImpulse).toBeLessThan(0);
      expect(aside.vx).toBe(0);
      expect(events.some((e) => e.type === 'pop')).toBe(false);
    });

    it('can be grabbed, swiped around the sky and flung, without lightning on every move', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      storm.y = H * 0.25;
      advance(game, 0.5);
      const hit = game.visitorHit(storm);
      game.press(1, hit.x, hit.y);
      expect(events.filter((e) => e.type === 'lightning')).toHaveLength(1);
      for (let i = 1; i <= 6; i++) {
        game.drag(1, hit.x - i * 10, hit.y + i * 4);
        game.update(1 / 60);
      }
      expect(storm.x).toBeCloseTo(hit.x - 60, 0);
      expect(storm.y).toBeCloseTo(hit.y + 24, 0);
      expect(events.filter((e) => e.type === 'lightning')).toHaveLength(1);
      game.release(1);
      expect(storm.grabbedBy).toBeNull();
      expect(storm.vx).toBeLessThan(0); // keeps the swing it was given
      const x = storm.x;
      advance(game, 0.1);
      expect(storm.x).toBeLessThan(x);
      advance(game, 10);
      expect(game.visitors).toContain(storm); // still around, cruising (it bounces off the edges)
      expect(storm.x).toBeGreaterThan(0);
      expect(storm.x).toBeLessThan(W);
    });

    it('rain pushes balloons down and out from under the cloud', () => {
      const { game } = makeGame();
      game.balloons = [];
      const storm = game.spawnVisitor('storm');
      storm.x = W / 2;
      storm.y = H * 0.25;
      const left = game.spawnBalloon({ x: W / 2 - 15, y: H * 0.6 })!;
      const right = game.spawnBalloon({ x: W / 2 + 15, y: H * 0.6 })!;
      advance(game, 1);
      expect(left.vx).toBeLessThan(0);
      expect(right.vx).toBeGreaterThan(0);
      expect(left.vyImpulse).toBeGreaterThan(0);
    });
  });

  describe('visitors', () => {
    const kinds = ['dog', 'elephant', 'bird', 'butterfly', 'snail', 'star'] as const;

    it('drops by on its own after a while, never more than two at a time', () => {
      const { game, events } = makeGame();
      advance(game, 12);
      expect(game.visitors.length).toBeGreaterThanOrEqual(1);
      expect(events.some((e) => e.type === 'visitor' && e.what === 'appear')).toBe(true);
      advance(game, 120);
      expect(game.visitors.length).toBeLessThanOrEqual(2);
    });

    for (const kind of kinds) {
      it(`${kind}: appears, can be touched and leaves again by itself`, () => {
        const { game, events } = makeGame();
        game.balloons = [];
        const visitor = game.spawnVisitor(kind);
        expect(game.visitors).toContain(visitor);
        // The shooting star is gone in a couple of seconds; everyone else takes their time.
        advance(game, kind === 'star' ? 0.3 : 2);
        const hit = game.visitorHit(visitor);
        expect(game.findVisitorAt(hit.x, hit.y)).toBe(visitor);
        game.press(1, hit.x, hit.y);
        game.release(1);
        const poke = events.find((e) => e.type === 'visitor' && e.what === 'poke');
        expect(poke).toMatchObject({ kind });
        expect(visitor.pokes).toBe(1);
        // Everybody leaves in the end (the dog walks off, the snail sinks into the grass, the star flies away ...).
        advance(game, 90);
        expect(game.visitors).not.toContain(visitor);
      });
    }

    it('a finger sliding back and forth over the dog makes it bark at a natural pace, not every frame', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const dog = game.spawnVisitor('dog');
      advance(game, 1);
      const hit = game.visitorHit(dog);
      game.press(1, hit.x - hit.r, hit.y);
      for (let t = 0; t < 2; t += 1 / 120) {
        game.drag(1, hit.x + Math.sin(t * 20) * hit.r * 0.8, hit.y);
        game.update(1 / 120);
      }
      game.release(1);
      const pokes = events.filter((e) => e.type === 'visitor' && e.what === 'poke').length;
      expect(pokes).toBeGreaterThanOrEqual(2);
      expect(pokes).toBeLessThanOrEqual(7);
    });

    it('the dog jumps when touched and lands again', () => {
      const { game } = makeGame();
      game.balloons = [];
      const dog = game.spawnVisitor('dog');
      advance(game, 1);
      const hit = game.visitorHit(dog);
      game.press(1, hit.x, hit.y);
      advance(game, 0.15);
      expect(dog.lift).toBeGreaterThan(5);
      advance(game, 1.5);
      expect(dog.lift).toBe(0);
    });

    it('the elephant rises, trumpets when touched and sinks back down', () => {
      const { game } = makeGame();
      game.balloons = [];
      const elephant = game.spawnVisitor('elephant');
      expect(elephant.lift).toBe(0);
      advance(game, 2);
      expect(elephant.state).toBe('idle');
      expect(elephant.lift).toBeGreaterThan(elephant.size);
      const hit = game.visitorHit(elephant);
      game.press(1, hit.x, hit.y);
      expect(elephant.state).toBe('react');
      advance(game, 1.5);
      expect(elephant.state).toBe('idle');
      advance(game, 14);
      expect(game.visitors).not.toContain(elephant);
    });

    it('touching between two visitors picks the closest one', () => {
      const { game, events } = makeGame();
      game.balloons = [];
      const dog = game.spawnVisitor('dog');
      const snail = game.spawnVisitor('snail');
      dog.x = 150;
      snail.x = 190;
      advance(game, 0.6);
      const hit = game.visitorHit(snail);
      game.press(1, hit.x + 5, hit.y);
      expect(events.find((e) => e.type === 'visitor' && e.what === 'poke')).toMatchObject({ kind: 'snail' });
    });

    it('a shake makes the dog jump and the elephant trumpet', () => {
      const { game } = makeGame();
      const dog = game.spawnVisitor('dog');
      const elephant = game.spawnVisitor('elephant');
      advance(game, 2);
      game.shake();
      expect(dog.vy).toBeLessThan(0);
      expect(elephant.state).toBe('react');
    });
  });

  it('celebrates every tenth pop', () => {
    const { game, events } = makeGame();
    let pops = 0;
    while (pops < 10) {
      if (game.balloons.length === 0) advance(game, 2);
      const balloon = game.balloons[0];
      game.press(pops, balloon.x, balloon.y);
      game.release(pops);
      pops++;
    }
    const celebrations = events.filter((e) => e.type === 'celebrate');
    expect(celebrations).toHaveLength(1);
    expect(celebrations[0]).toMatchObject({ pops: 10 });
    expect(game.sinceCelebration).toBe(0);
  });

  it('keeps balloons coming and removes the ones that float away', () => {
    const { game } = makeGame();
    advance(game, 60);
    expect(game.balloons.length).toBeGreaterThan(0);
    expect(game.balloons.length).toBeLessThanOrEqual(DEFAULT_CONFIG.maxBalloons);
    for (const b of game.balloons) expect(b.y).toBeGreaterThan(-b.r * 2.5);
  });

  it('clears particles over time', () => {
    const { game } = makeGame();
    const balloon = game.balloons[0];
    game.press(1, balloon.x, balloon.y);
    expect(game.particles.length).toBeGreaterThan(0);
    advance(game, 5);
    // Only the farmhouse chimney keeps smoking; everything from the pop is gone.
    expect(game.particles.filter((p) => p.shape !== 'smoke')).toHaveLength(0);
  });

  it('scales balloons with the screen size', () => {
    const phone = new Game({}, 1);
    phone.resize(390, 844);
    const tablet = new Game({}, 1);
    tablet.resize(1024, 1366);
    const avg = (g: Game) => g.balloons.reduce((sum, b) => sum + b.r, 0) / g.balloons.length;
    expect(avg(tablet)).toBeGreaterThan(avg(phone) * 1.8);
  });
});
