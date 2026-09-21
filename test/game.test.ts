import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, GLIDE_NOTES, Game, TAP_HIT_FACTOR, TRAIL_LIFE } from '../src/game';
import type { GameEvent } from '../src/types';

const W = 390;
const H = 844;

function makeGame(seed = 42): { game: Game; events: GameEvent[] } {
  const game = new Game({}, seed);
  const events: GameEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  return { game, events };
}

/** Finds a point on screen that is not near any balloon, the sun or a cloud. */
function emptySpot(game: Game): [number, number] {
  for (let y = 80; y < H - 80; y += 12) {
    for (let x = 40; x < W - 40; x += 12) {
      if (!game.findBalloonAt(x, y, TAP_HIT_FACTOR) && !game.isOnSun(x, y) && !game.findCloudAt(x, y)) return [x, y];
    }
  }
  throw new Error('Ingen ledig plads på skærmen');
}

function advance(game: Game, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
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
    expect(game.particles.length).toBe(0);
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
