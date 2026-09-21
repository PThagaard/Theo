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

  it('does not let the same touch pop the balloon it just created', () => {
    const { game } = makeGame();
    const [x, y] = emptySpot(game);
    game.press(1, x, y);
    const created = game.balloons[game.balloons.length - 1];
    game.drag(1, x + 2, y + 1);
    game.drag(1, x - 2, y - 1);
    expect(game.balloons).toContain(created);
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
