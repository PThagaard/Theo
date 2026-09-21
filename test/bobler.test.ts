import { describe, expect, it } from 'vitest';
import { BoblerGame, GROW_TIME, HOLD_START, MAX_BUBBLES, MAX_DROPLETS, SPRAY_TIME, WAVE_TIME, type BoblerEvent } from '../src/activities/bobler/logic';
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
    for (let i = 0; i < 6; i++) kinds.add(older.spawnGuest().kind);
    expect(kinds.size).toBe(6);
  });

  it('the whale hides with only its back showing; a touch lets the water out, and it rises up glad and stays a while', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const whale = game.spawnGuest('whale');
    expect(whale.state).toBe('enter');
    advance(game, 1.5);
    expect(whale.state).toBe('stay');
    // Hidden: its body sits below the water line, untouched.
    expect(whale.y).toBeGreaterThan(game.surfaceY(whale.x));
    expect(whale.pokes).toBe(0);
    game.bubbles = [];
    const drops = game.droplets.length;
    tap(game, whale.x, whale.y - whale.size * 0.3);
    expect(whale.state).toBe('act');
    expect(whale.pokes).toBe(1);
    advance(game, 0.3);
    expect(game.droplets.length).toBeGreaterThan(drops);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'whale' && e.what === 'poke' && e.pokes === 1)).toBe(true);
    advance(game, 2);
    expect(whale.state).toBe('stay');
    expect(whale.y).toBeLessThan(game.surfaceY(whale.x));
    // Touched again: another spout, and it stays a little longer.
    const stay = whale.stay;
    game.bubbles = [];
    tap(game, whale.x, whale.y - whale.size * 0.3, 2);
    expect(whale.state).toBe('act');
    expect(whale.stay).toBeGreaterThan(stay);
    advance(game, 30);
    expect(game.guests).not.toContain(whale);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'whale' && e.what === 'leave')).toBe(true);
  });

  it('an untouched whale sinks quietly away after a while, later for the youngest', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const whale = game.spawnGuest('whale');
    advance(game, 20);
    expect(game.guests).toContain(whale);
    expect(whale.pokes).toBe(0);
    // Hidden, it hints now and then with a few bubbles from the blowhole.
    expect(events.filter((e) => e.type === 'guest' && e.kind === 'whale' && e.what === 'drip').length).toBeGreaterThanOrEqual(3);
    advance(game, 5.5);
    expect(whale.state).toBe('leave');
    const { game: young } = makeBath('8-12');
    young.bubbles = [];
    const shy = young.spawnGuest('whale');
    advance(young, 35);
    expect(shy.state).toBe('stay');
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

  it('the fish jumps when touched, and by itself only from 1 year', () => {
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
  });

  it('the second jump ends inside a bubble that carries the fish up; popping it drops the fish back with a splash', () => {
    const { game, events } = makeBath('8-12');
    game.bubbles = [];
    const fish = game.spawnGuest('fish');
    advance(game, 1.5);
    game.bubbles = [];
    tap(game, fish.x, fish.y - fish.size * 0.3);
    advance(game, 1.5);
    expect(fish.state).toBe('stay');
    expect(fish.ride).toBeNull();
    game.bubbles = [];
    tap(game, fish.x, fish.y - fish.size * 0.3, 2);
    advance(game, 0.7);
    expect(fish.state).toBe('ride');
    const bubble = game.bubbles.find((b) => b.id === fish.ride);
    if (!bubble) throw new Error('no bubble around the fish');
    expect(events.some((e) => e.type === 'guest' && e.kind === 'fish' && e.what === 'ride')).toBe(true);
    advance(game, 1);
    expect(fish.x).toBeCloseTo(bubble.x);
    expect(fish.y).toBeCloseTo(bubble.y);
    // Tapping the bubble pops it, and the fish falls back into the water.
    tap(game, bubble.x, bubble.y, 3);
    expect(game.bubbles).not.toContain(bubble);
    expect(fish.state).toBe('fall');
    advance(game, 2);
    expect(fish.state).toBe('stay');
    expect(fish.ride).toBeNull();
    expect(events.some((e) => e.type === 'guest' && e.kind === 'fish' && e.what === 'fall')).toBe(true);
    expect(game.guests).toContain(fish);
  });

  it('left alone, the bubble floats off the top with the fish inside, and the fish is gone', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const fish = game.spawnGuest('fish');
    advance(game, 1.5);
    game.bubbles = [];
    tap(game, fish.x, fish.y - fish.size * 0.3);
    advance(game, 1.5);
    game.bubbles = [];
    tap(game, fish.x, fish.y - fish.size * 0.3, 2);
    advance(game, 0.7);
    expect(fish.state).toBe('ride');
    advance(game, 40);
    expect(game.guests).not.toContain(fish);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'fish' && e.what === 'leave')).toBe(true);
  });

  it('the shower drips until touched, then sprays hard, makes foam bubbles, showers the ducks, follows the finger and stays long', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const shower = game.spawnGuest('shower');
    advance(game, 2);
    expect(shower.state).toBe('stay');
    expect(shower.stay).toBeGreaterThanOrEqual(45);
    const dripping = game.droplets.filter((d) => d.kind === 'drop').length;
    // A touch: the spray, and a longer stay.
    game.bubbles = [];
    const stay = shower.stay;
    tap(game, shower.x, shower.y);
    expect(shower.state).toBe('act');
    expect(shower.stay).toBeGreaterThan(stay);
    advance(game, 1);
    expect(game.droplets.filter((d) => d.kind === 'drop').length).toBeGreaterThan(dripping + 10);
    expect(game.bubbles.length).toBeGreaterThan(0);
    // The ducks under it quack (without changing colour).
    const duck = game.ducks[0];
    duck.x = shower.x;
    duck.quackAge = 5;
    const quacks = game.quacks;
    const color = duck.color;
    advance(game, 0.5);
    expect(game.quacks).toBeGreaterThan(quacks);
    expect(duck.color).toBe(color);
    // Dragging carries it around.
    const x0 = shower.x;
    game.press(2, shower.x, shower.y);
    game.drag(2, shower.x + 80, shower.y + 40);
    game.release(2);
    expect(shower.x).toBeGreaterThan(x0 + 50);
    // After the spray time it drips again, and after its long stay it leaves.
    advance(game, SPRAY_TIME + 0.5);
    expect(shower.state).toBe('stay');
    expect(events.some((e) => e.type === 'guest' && e.kind === 'shower' && e.what === 'stop')).toBe(true);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'shower' && e.what === 'drip')).toBe(true);
    advance(game, 80);
    expect(game.guests).not.toContain(shower);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'shower' && e.what === 'leave')).toBe(true);
    // For the youngest it never sprays by itself: only a touch does that.
    const { game: young, events: youngEvents } = makeBath('8-12');
    young.bubbles = [];
    young.spawnGuest('shower');
    advance(young, 40);
    expect(youngEvents.some((e) => e.type === 'guest' && e.kind === 'shower' && e.what === 'act')).toBe(false);
  });

  it('the polar bear drifts by on its floe, waves hello on screen, when touched and now and then, and leaves at the far side', () => {
    const { game, events } = makeBath('2+');
    game.bubbles = [];
    const bear = game.spawnGuest('bear');
    expect(bear.state).toBe('stay');
    advance(game, 1);
    const x0 = bear.x;
    advance(game, 1);
    expect(Math.sign(bear.x - x0)).toBe(bear.dir);
    // Once on screen it waves.
    bear.x = W / 2;
    advance(game, 2);
    expect(bear.acts).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'bear' && e.what === 'act')).toBe(true);
    advance(game, WAVE_TIME + 0.5);
    expect(bear.state).toBe('stay');
    const acts = bear.acts;
    game.bubbles = [];
    tap(game, bear.x, bear.y - bear.size);
    expect(bear.state).toBe('act');
    expect(bear.acts).toBe(acts + 1);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'bear' && e.what === 'poke')).toBe(true);
    advance(game, 60);
    expect(game.guests).not.toContain(bear);
    expect(events.some((e) => e.type === 'guest' && e.kind === 'bear' && e.what === 'leave')).toBe(true);
    // The youngest get the greeting and a wave when touched, but few by themselves.
    const { game: young } = makeBath('8-12');
    young.bubbles = [];
    const shy = young.spawnGuest('bear');
    shy.x = W / 2;
    shy.vx = 0;
    advance(young, 20);
    expect(shy.acts).toBeLessThanOrEqual(2);
    expect(shy.acts).toBeGreaterThanOrEqual(1);
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
