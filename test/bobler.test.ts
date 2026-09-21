import { describe, expect, it } from 'vitest';
import { BoblerGame, GROW_TIME, HOLD_START, MAX_BUBBLES, MAX_DROPLETS, type BoblerEvent } from '../src/activities/bobler/logic';
import type { Age } from '../src/engine/age';

const W = 390;
const H = 844;

function makeBath(age: Age = '2+', seed = 3): { game: BoblerGame; events: BoblerEvent[] } {
  const game = new BoblerGame({}, seed);
  const events: BoblerEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  game.setAge(age);
  return { game, events };
}

function advance(game: BoblerGame, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

function tap(game: BoblerGame, x: number, y: number, id = 1): void {
  game.press(id, x, y);
  game.release(id);
}

describe('Bobler: the bath', () => {
  it('fills up slowly to the tempo and age, never past the cap', () => {
    const { game } = makeBath('2+');
    advance(game, 30);
    expect(game.bubbles.length).toBeGreaterThan(0);
    expect(game.bubbles.length).toBeLessThanOrEqual(game.targetBubbles);
    const { game: young } = makeBath('8-12');
    advance(young, 30);
    expect(young.targetBubbles).toBeLessThan(game.targetBubbles);
    expect(young.ducks).toHaveLength(1);
    expect(game.ducks).toHaveLength(2);
    for (let i = 0; i < 100; i++) game.spawnBubble();
    expect(game.bubbles.length).toBeLessThanOrEqual(MAX_BUBBLES);
  });

  it('pops a bubble on a generous tap, with drops and a sound event, and celebrates every tenth pop', () => {
    const { game, events } = makeBath();
    const first = game.spawnBubble({ x: W / 2, y: H * 0.4, r: 30, kind: 'plain' });
    if (!first) throw new Error('no bubble');
    tap(game, first.x + first.r * 1.4, first.y);
    expect(game.bubbles).not.toContain(first);
    expect(events.filter((e) => e.type === 'pop')).toHaveLength(1);
    expect(game.droplets.length).toBeGreaterThan(5);
    for (let i = 1; i < 10; i++) {
      const b = game.spawnBubble({ x: W / 2, y: H * 0.4, r: 30, kind: 'plain' });
      if (!b) throw new Error('no bubble');
      tap(game, b.x, b.y, i + 1);
    }
    expect(game.pops).toBe(10);
    expect(events.filter((e) => e.type === 'celebration')).toHaveLength(1);
    expect(game.sinceCelebration).toBe(0);
    expect(game.bubbles.length).toBeGreaterThan(0); // the celebration shower
  });

  it('answers every touch: the water splashes and sends up bubbles, the wall puffs soap, the duck quacks and spins', () => {
    const { game, events } = makeBath('8-12');
    game.bubbles = [];
    tap(game, W / 2, H * 0.85);
    expect(events.at(-1)?.type).toBe('splash');
    expect(game.ripples).toHaveLength(1);
    expect(game.bubbles).toHaveLength(2);
    tap(game, W * 0.2, H * 0.2, 2);
    expect(events.at(-1)?.type).toBe('soap');
    const duck = game.ducks[0];
    tap(game, duck.x, game.duckY(duck) - game.duckSize * 0.5, 3);
    expect(events.at(-1)?.type).toBe('quack');
    expect(duck.spinAge).toBe(0);
    // No touch anywhere is silent.
    const before = events.length;
    for (let i = 0; i < 20; i++) tap(game, (i / 20) * W, (((i * 7) % 20) / 20) * H, 10 + i);
    expect(events.length - before).toBeGreaterThanOrEqual(20);
  });

  it('a swipe pops the bubbles it crosses, pushes the rest, and makes waves along the water', () => {
    const { game, events } = makeBath();
    game.bubbles = [];
    const y = H * 0.35;
    const crossed = [0.3, 0.5, 0.7].map((f) => game.spawnBubble({ x: f * W, y, r: 28, kind: 'plain' }));
    const bystander = game.spawnBubble({ x: W * 0.5, y: y - 60, r: 28, kind: 'plain' });
    if (!bystander) throw new Error('no bubble');
    advance(game, 0.5);
    game.press(1, W * 0.1, y);
    for (let i = 1; i <= 30; i++) game.drag(1, W * 0.1 + W * 0.8 * (i / 30), y);
    game.release(1);
    for (const b of crossed) expect(game.bubbles).not.toContain(b);
    expect(events.filter((e) => e.type === 'swipe')).toHaveLength(1);
    expect(bystander.vx).toBeGreaterThan(0);
    const before = game.ripples.length;
    game.press(2, W * 0.2, H * 0.85);
    for (let i = 1; i <= 20; i++) {
      game.drag(2, W * 0.2 + i * 10, H * 0.85);
      game.update(0.05);
    }
    game.release(2);
    expect(game.ripples.length).toBeGreaterThan(before + 1);
  });

  it('grows a bubble under a still finger, lets it float away on release, and bursts it if held too long', () => {
    const { game, events } = makeBath();
    game.bubbles = [];
    game.press(1, W * 0.5, H * 0.85);
    advance(game, HOLD_START + 0.1);
    const held = game.bubbles.find((b) => b.heldBy === 1);
    if (!held) throw new Error('no bubble grew');
    expect(events.some((e) => e.type === 'grow')).toBe(true);
    const r0 = held.r;
    advance(game, 0.5);
    expect(held.r).toBeGreaterThan(r0);
    game.release(1);
    expect(held.heldBy).toBeNull();
    expect(held.vy).toBeLessThan(0);
    expect(events.some((e) => e.type === 'blow')).toBe(true);
    // Hold until it bursts.
    game.press(2, W * 0.5, H * 0.3);
    advance(game, HOLD_START + GROW_TIME + 0.3);
    expect(game.bubbles.some((b) => b.heldBy === 2)).toBe(false);
    expect(events.some((e) => e.type === 'burst')).toBe(true);
    game.release(2);
    // Moving the finger away cancels the hold before a bubble appears.
    game.press(3, W * 0.5, H * 0.3);
    game.drag(3, W * 0.5 + 40, H * 0.3);
    advance(game, 1);
    expect(game.bubbles.some((b) => b.heldBy === 3)).toBe(false);
    game.release(3);
  });

  it('shakes: bubbles jiggle, ducks hop, a shower of small bubbles rises (fewer for the youngest), not twice in a row', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const b = game.spawnBubble({ x: W / 2, y: H * 0.3, r: 30, kind: 'plain' });
    if (!b) throw new Error('no bubble');
    advance(game, 0.1);
    game.shake();
    expect(events.filter((e) => e.type === 'shake')).toHaveLength(1);
    expect(b.wobbleAmp).toBe(1);
    expect(game.bubbles).toHaveLength(1 + 14);
    expect(game.ducks[0].bobV).toBeLessThan(0);
    game.shake();
    expect(events.filter((e) => e.type === 'shake')).toHaveLength(1);
    const { game: young } = makeBath('8-12');
    young.bubbles = [];
    advance(young, 0.1);
    young.shake();
    expect(young.bubbles).toHaveLength(6);
  });

  it('lets the family ride inside bubbles; popping one drops the photo into the water with a splash', () => {
    const { game, events } = makeBath('2+', 5);
    game.setPhotos(['abc']);
    let photoBubble = null;
    for (let i = 0; i < 200 && !photoBubble; i++) {
      game.bubbles = [];
      const b = game.spawnBubble();
      if (b?.kind === 'photo') photoBubble = b;
    }
    if (!photoBubble) throw new Error('no photo bubble in 200 tries');
    tap(game, photoBubble.x, photoBubble.y);
    expect(events.find((e) => e.type === 'pop')).toMatchObject({ kind: 'photo', photoId: 'abc' });
    expect(game.droplets.some((d) => d.kind === 'photo')).toBe(true);
    let landed = false;
    for (let t = 0; t < 5 && !landed; t += 1 / 60) {
      game.update(1 / 60);
      if (!game.droplets.some((d) => d.kind === 'photo')) landed = true;
    }
    expect(landed).toBe(true);
    expect(game.ripples.length).toBeGreaterThan(0);
  });

  it('keeps the drops under the cap however wild the play', () => {
    const { game } = makeBath();
    for (let i = 0; i < 60; i++) tap(game, W / 2, H * 0.85, i);
    expect(game.droplets.length).toBeLessThanOrEqual(MAX_DROPLETS);
    expect(game.bubbles.length).toBeLessThanOrEqual(MAX_BUBBLES);
  });

  it('sleeps: no new bubbles, touches only twinkle, the ducks rest; and wakes again', () => {
    const { game, events } = makeBath();
    game.sleep();
    advance(game, 10);
    expect(game.dusk).toBeGreaterThan(0.9);
    const count = game.bubbles.length;
    advance(game, 10);
    expect(game.bubbles.length).toBeLessThanOrEqual(count);
    const before = events.length;
    tap(game, W / 2, H * 0.85);
    expect(events.slice(before).map((e) => e.type)).toEqual(['sparkle']);
    const duckX = game.ducks[0].x;
    advance(game, 2);
    expect(game.ducks[0].x).toBe(duckX);
    game.wake();
    advance(game, 5);
    expect(game.dusk).toBe(0);
    expect(game.bubbles.length).toBeGreaterThan(0);
  });
});
