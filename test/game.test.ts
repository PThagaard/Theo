import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, Game, TAP_HIT_FACTOR } from '../src/game';
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

/** Finds a point on screen that is not near any balloon. */
function emptySpot(game: Game): [number, number] {
  for (let y = 80; y < H - 80; y += 12) {
    for (let x = 40; x < W - 40; x += 12) {
      if (!game.findBalloonAt(x, y, TAP_HIT_FACTOR)) return [x, y];
    }
  }
  throw new Error('Ingen ledig plads på skærmen');
}

function advance(game: Game, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

describe('Game', () => {
  it('starts with balloons already on screen', () => {
    const { game } = makeGame();
    expect(game.balloons.length).toBeGreaterThanOrEqual(4);
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
    game.press(1, x, y);
    // Slide across the screen in small steps to the balloon.
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      game.drag(1, x + ((balloon.x - x) * i) / steps, y + ((balloon.y - y) * i) / steps);
    }
    game.release(1);
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
