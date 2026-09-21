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
    const before = game.bubbles.length;
    game.shake();
    expect(events.filter((e) => e.type === 'shake')).toHaveLength(1);
    expect(b.wobbleAmp).toBe(1);
    expect(game.bubbles.length - before).toBe(14);
    expect(game.ducks[0].bobV).toBeLessThan(0);
    game.shake();
    expect(events.filter((e) => e.type === 'shake')).toHaveLength(1);
    const { game: young } = makeBath('8-12');
    advance(young, 0.1);
    const youngBefore = young.bubbles.length;
    young.shake();
    expect(young.bubbles.length - youngBefore).toBe(6);
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

  it('lets guests come by themselves (one at a time for the youngest), every kind once before any repeats', () => {
    const { game } = makeBath('8-12');
    advance(game, 60);
    expect(game.guestsSeen).toBeGreaterThanOrEqual(1);
    expect(game.guests.length).toBeLessThanOrEqual(1);
    const { game: older } = makeBath('2+');
    const kinds = new Set<string>();
    for (let i = 0; i < 5; i++) kinds.add(older.spawnGuest().kind);
    expect(kinds.size).toBe(5);
  });

  it('the whale surfaces, quivers, spouts when touched and dives after a while', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const whale = game.spawnGuest('whale');
    expect(whale.state).toBe('enter');
    advance(game, 1.5);
    expect(whale.state).toBe('stay');
    game.bubbles = [];
    const drops = game.droplets.length;
    tap(game, whale.x, whale.y - whale.size * 0.3);
    expect(whale.state).toBe('act');
    advance(game, 0.3);
    expect(game.droplets.length).toBeGreaterThan(drops);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'whale' && e.what === 'poke')).toBe(true);
    advance(game, 16);
    expect(game.guests).not.toContain(whale);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'whale' && e.what === 'leave')).toBe(true);
  });

  it('the cow in the speedboat crosses the bath, hops and moos when touched, and leaves a wake', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const boat = game.spawnGuest('boat');
    advance(game, 1);
    const x0 = boat.x;
    advance(game, 1);
    expect(Math.sign(boat.x - x0)).toBe(boat.dir);
    expect(game.droplets.some((d) => d.kind === 'foam')).toBe(true);
    boat.x = W / 2;
    advance(game, 0.1);
    game.bubbles = [];
    tap(game, boat.x, boat.y - boat.size * 0.3);
    expect(boat.hop).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'boat' && e.what === 'poke')).toBe(true);
    advance(game, 20);
    expect(game.guests).not.toContain(boat);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'boat' && e.what === 'leave')).toBe(true);
  });

  it('the fish jumps when touched, and by itself only from 1 year; the shower sprays and leaves', () => {
    const { game, events } = makeBath('8-12');
    game.bubbles = [];
    const fish = game.spawnGuest('fish');
    advance(game, 1.5);
    expect(fish.state).toBe('stay');
    advance(game, 12);
    expect(events.filter((e) => e.type === 'guest' && e.kind === 'fish' && e.what === 'act')).toHaveLength(0);
    game.bubbles = [];
    tap(game, fish.x, fish.y - fish.size * 0.3);
    expect(fish.state).toBe('act');
    const { game: older, events: olderEvents } = makeBath('2+');
    older.spawnGuest('fish');
    advance(older, 9);
    expect(olderEvents.some((e) => e.type === 'guest' && e.kind === 'fish' && e.what === 'act')).toBe(true);
    const shower = older.spawnGuest('shower');
    advance(older, 2);
    expect(shower.state).toBe('stay');
    expect(older.droplets.filter((d) => d.kind === 'drop').length).toBeGreaterThan(5);
    advance(older, 10);
    expect(older.guests).not.toContain(shower);
    expect(olderEvents.some((e) => e.type === 'guest' && e.kind === 'shower' && e.what === 'leave')).toBe(true);
  });

  it('a shake brings a guest when the bath is empty, and asleep the guests leave', () => {
    const { game } = makeBath('2+');
    advance(game, 1);
    expect(game.guests).toHaveLength(0);
    game.shake();
    advance(game, 2);
    expect(game.guests.length).toBeGreaterThanOrEqual(1);
    game.sleep();
    advance(game, 3);
    expect(game.guests.every((g) => g.state === 'leave')).toBe(true);
    advance(game, 20);
    expect(game.guests).toHaveLength(0);
  });

  it('never leaves the bath empty: when the last bubble pops, a new one rises at once on the other side', () => {
    const { game } = makeBath('8-12');
    advance(game, 0.5);
    game.bubbles = [];
    const only = game.spawnBubble({ x: W * 0.2, y: H * 0.4, r: 30, kind: 'plain' });
    if (!only) throw new Error('no bubble');
    game.spawnTimer = 10;
    tap(game, only.x, only.y);
    expect(game.bubbles).toHaveLength(0);
    game.update(1 / 60);
    expect(game.bubbles).toHaveLength(1);
    expect(game.bubbles[0].x).toBeGreaterThan(W / 2);
  });

  it('the duck changes colour when touched, and a long press sends it dashing in rainbow colours', () => {
    const { game, events } = makeBath('8-12');
    game.bubbles = [];
    const duck = game.ducks[0];
    expect(duck.color).toBe(0);
    tap(game, duck.x, game.duckY(duck) - game.duckSize * 0.5);
    expect(duck.color).toBe(1);
    expect(duck.rainbow).toBe(0);
    game.press(2, duck.x, game.duckY(duck) - game.duckSize * 0.5);
    expect(duck.color).toBe(2);
    advance(game, HOLD_START + 0.1);
    expect(duck.rainbow).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'dash')).toBe(true);
    game.release(2);
    const speed = Math.abs(duck.vx);
    expect(speed).toBeGreaterThan(100);
    advance(game, 7);
    expect(duck.rainbow).toBe(0);
    expect(Math.abs(duck.vx)).toBeLessThan(speed);
    // Moving the finger away before the hold is up does not start a dash.
    game.press(3, duck.x, game.duckY(duck) - game.duckSize * 0.5);
    game.drag(3, duck.x + 40, game.duckY(duck) - game.duckSize * 0.5);
    advance(game, 1);
    expect(duck.rainbow).toBe(0);
    game.release(3);
  });

  it('tilting the phone tilts the water, with a slosh, and the ducks drift to the low side', () => {
    const { game } = makeBath('2+');
    game.setTilt(0.3);
    advance(game, 2);
    expect(game.tilt).toBeCloseTo(0.3, 1);
    expect(game.surfaceY(W * 0.9)).toBeLessThan(game.surfaceY(W * 0.1));
    const before = game.ducks.map((d) => d.x);
    advance(game, 3);
    expect(game.ducks.some((d, i) => d.x > before[i])).toBe(true);
    game.setTilt(0);
    advance(game, 3);
    expect(Math.abs(game.tilt)).toBeLessThan(0.02);
    game.setTilt(2);
    advance(game, 3);
    expect(game.tilt).toBeLessThanOrEqual(0.46);
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
