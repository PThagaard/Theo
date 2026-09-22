import { describe, expect, it } from 'vitest';
import {
  CELEBRATE_EVERY,
  FIREFLIES,
  HOLD_START,
  LAMP_STAY,
  LIGHT_LIFE,
  LysGame,
  MAX_LANTERNS,
  MAX_LIGHTS,
  MAX_SPARKLES,
  PHOTO_EVERY,
  SHOOT_EVERY,
  type LysEvent,
} from '../src/activities/lys/logic';
import type { Age } from '../src/engine/age';

const W = 844;
const H = 390;

function makeNight(age: Age = '8-12', seed = 7): { game: LysGame; events: LysEvent[] } {
  const game = new LysGame(seed);
  const events: LysEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  game.setAge(age);
  return { game, events };
}

function advance(game: LysGame, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

function tap(game: LysGame, x: number, y: number, id = 1): void {
  game.press(id, x, y);
  game.update(0.05);
  game.release(id);
}

/** A finger drawn from one point to another in a few steps. */
function swipe(game: LysGame, x0: number, y0: number, x1: number, y1: number, steps = 12, id = 2): void {
  game.press(id, x0, y0);
  for (let i = 1; i <= steps; i++) {
    game.update(1 / 60);
    game.drag(id, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  }
  game.update(1 / 60);
  game.release(id);
}

/** A still finger, held for a while. */
function hold(game: LysGame, x: number, y: number, seconds: number, id = 3): void {
  game.press(id, x, y);
  advance(game, seconds);
}

describe('Lys: every touch makes light in the dark', () => {
  it('lights a star with a bell where the finger lands, higher up higher in pitch, and the star slowly goes out', () => {
    const { game, events } = makeNight();
    tap(game, 200, H * 0.3);
    expect(game.lights).toHaveLength(1);
    expect(game.lights[0].x).toBe(200);
    const star = events.find((e) => e.type === 'star');
    expect(star && star.type === 'star' && star.note).toBeGreaterThanOrEqual(4);
    tap(game, 300, H * 0.9, 4);
    const low = events.filter((e) => e.type === 'star')[1];
    expect(low.type === 'star' && low.note).toBeLessThanOrEqual(1);
    advance(game, 1);
    expect(game.lights[0].brightness).toBeGreaterThan(0.9);
    advance(game, LIGHT_LIFE['8-12']);
    expect(game.lights).toHaveLength(0);
  });

  it('keeps only a few stars lit for the youngest, more for older children: the oldest goes out when one too many is lit', () => {
    for (const age of ['8-12', '1-2', '2+'] as Age[]) {
      const { game } = makeNight(age);
      for (let i = 0; i < MAX_LIGHTS[age] + 5; i++) tap(game, 40 + i * 30, 60 + (i % 3) * 40, 10 + i);
      expect(game.lights).toHaveLength(MAX_LIGHTS[age]);
      // The newest are all still there.
      expect(game.lights[game.lights.length - 1].x).toBe(40 + (MAX_LIGHTS[age] + 4) * 30);
    }
    expect(MAX_LIGHTS['8-12']).toBeLessThan(MAX_LIGHTS['2+']);
  });

  it('joins stars near each other into a constellation, and a touch on a lit star makes it twinkle instead of lighting another', () => {
    const { game, events } = makeNight('2+');
    tap(game, 200, 100);
    tap(game, 260, 130, 5);
    tap(game, 700, 100, 6);
    expect(game.lights[1].linkId).toBe(game.lights[0].id);
    expect(game.lights[2].linkId).toBe(-1);
    advance(game, 2);
    tap(game, 202, 98, 7);
    expect(game.lights).toHaveLength(3);
    expect(game.lights[0].twinkle).toBeGreaterThan(0.9);
    expect(game.lights[0].life).toBeGreaterThan(LIGHT_LIFE['2+'] - 0.1);
    expect(events.filter((e) => e.type === 'flare')).toHaveLength(1);
  });

  it('leaves stardust behind a drawn finger, with a harp note now and then, and flares the stars on the way', () => {
    const { game, events } = makeNight();
    tap(game, 400, 150);
    advance(game, 1);
    swipe(game, 100, 150, 700, 150, 30);
    expect(game.sparkles.length).toBeGreaterThan(20);
    expect(game.sparkles.length).toBeLessThanOrEqual(MAX_SPARKLES);
    const trails = events.filter((e) => e.type === 'trail');
    expect(trails.length).toBeGreaterThanOrEqual(2);
    expect(trails.filter((e) => e.type === 'trail' && e.first)).toHaveLength(1);
    expect(events.filter((e) => e.type === 'flare')).toHaveLength(1);
    // Drawing lights only the star where the finger landed, not one at every step.
    expect(game.lights).toHaveLength(2);
    advance(game, 3);
    expect(game.sparkles).toHaveLength(0);
  });

  it('kindles a lantern under a still finger, which grows in the hand, follows it, and floats up when let go', () => {
    const { game, events } = makeNight();
    hold(game, 300, 200, HOLD_START + 0.1);
    expect(game.lanterns).toHaveLength(1);
    expect(game.lights).toHaveLength(0);
    expect(game.lanterns[0].held).toBe(3);
    const small = game.lanterns[0].size;
    advance(game, 1);
    expect(game.lanterns[0].size).toBeGreaterThan(small);
    game.drag(3, 340, 220);
    expect(game.lanterns[0].x).toBe(340);
    game.release(3);
    expect(game.lanterns[0].held).toBeNull();
    advance(game, 2);
    expect(game.lanterns[0].y).toBeLessThan(220 - 10);
    expect(events.filter((e) => e.type === 'lantern').map((e) => e.type === 'lantern' && e.what)).toEqual(['lit', 'rise']);
    advance(game, 60);
    expect(game.lanterns).toHaveLength(0);
  });

  it('never has more lanterns than the profile allows, and every third one carries a family face when there are photos', () => {
    const { game, events } = makeNight('2+');
    game.setPhotos(['mor', 'far']);
    for (let i = 0; i < MAX_LANTERNS['2+'] + 3; i++) {
      hold(game, 100 + i * 60, 120, HOLD_START + 0.1, 20 + i);
      game.release(20 + i);
    }
    expect(game.lanterns).toHaveLength(MAX_LANTERNS['2+']);
    const faces = game.lanterns.map((l) => l.photoId);
    expect(faces[PHOTO_EVERY - 1]).toBe('mor');
    expect(faces[0]).toBeUndefined();
    expect(faces[1]).toBeUndefined();
    expect(events.filter((e) => e.type === 'photo').length).toBeGreaterThanOrEqual(1);
    const { game: plain, events: plainEvents } = makeNight('2+');
    hold(plain, 100, 120, 1);
    plain.release(3);
    hold(plain, 200, 120, 1, 4);
    plain.release(4);
    hold(plain, 300, 120, 1, 5);
    plain.release(5);
    expect(plain.lanterns.every((l) => !l.photoId)).toBe(true);
    expect(plainEvents.some((e) => e.type === 'photo')).toBe(false);
  });

  it('catches a floating lantern with a touch, and a swipe pushes one aside', () => {
    const { game, events } = makeNight('2+');
    hold(game, 400, 200, 1);
    game.release(3);
    advance(game, 0.5);
    const lantern = game.lanterns[0];
    tap(game, lantern.x + 5, lantern.y - 5, 9);
    expect(events.some((e) => e.type === 'lantern' && e.what === 'tap')).toBe(true);
    // Caught and let go again: it rises once more, and no second lantern was lit.
    expect(game.lanterns).toHaveLength(1);
    expect(events.filter((e) => e.type === 'lantern' && e.what === 'rise')).toHaveLength(2);
    advance(game, 0.5);
    const before = lantern.x;
    swipe(game, lantern.x - 80, lantern.y, lantern.x + 80, lantern.y, 16, 11);
    expect(events.some((e) => e.type === 'lantern' && e.what === 'push')).toBe(true);
    advance(game, 0.5);
    expect(lantern.x).toBeGreaterThan(before);
  });

  it('switches the lamps and the window on with a touch and off with the next, with a forgiving target, and they go out by themselves', () => {
    const { game, events } = makeNight();
    const lamp = game.lamps[0];
    const u = game.unit;
    tap(game, lamp.x + 20 * u, lamp.headY - 20 * u);
    expect(lamp.on).toBe(true);
    advance(game, 1);
    expect(lamp.lit).toBeGreaterThan(0.9);
    tap(game, lamp.x, lamp.headY, 5);
    expect(lamp.on).toBe(false);
    expect(events.filter((e) => e.type === 'lamp').map((e) => e.type === 'lamp' && e.on)).toEqual([true, false]);
    const house = game.house;
    tap(game, house.x - house.width * 0.4, house.baseY - house.height * 0.5, 6);
    expect(house.on).toBe(true);
    expect(house.puff).toBeGreaterThan(0.9);
    tap(game, lamp.x, lamp.headY, 7);
    advance(game, LAMP_STAY + 1);
    expect(lamp.on).toBe(false);
    expect(house.on).toBe(false);
    advance(game, 5);
    expect(lamp.lit).toBeLessThan(0.2);
  });

  it('wakes the moon with a touch, brightening it at most three times a second', () => {
    const { game, events } = makeNight();
    const moon = game.moon;
    for (let i = 0; i < 10; i++) {
      tap(game, moon.x + moon.r * 0.5, moon.y, 30 + i);
      game.update(0.05);
    }
    expect(moon.awake).toBeGreaterThan(0);
    expect(events.filter((e) => e.type === 'moon')).toHaveLength(10);
    expect(moon.blooms).toBeLessThanOrEqual(3);
    expect(game.lights).toHaveLength(0);
    advance(game, 7);
    expect(moon.awake).toBe(0);
  });

  it('sends a shooting star across on a shake and runs a twinkle over every star, once per shake', () => {
    const { game, events } = makeNight();
    tap(game, 100, 100);
    tap(game, 500, 100, 5);
    advance(game, 2);
    game.shake();
    game.shake();
    expect(game.shooting).not.toBeNull();
    expect(game.shakes).toBe(1);
    expect(events.filter((e) => e.type === 'shooting')).toHaveLength(1);
    expect(game.lights.every((l) => l.twinkleIn > 0)).toBe(true);
    advance(game, 0.5);
    expect(game.lights.some((l) => l.twinkle > 0)).toBe(true);
    advance(game, 2);
    expect(game.shooting).toBeNull();
  });

  it('lets nothing happen by itself for the youngest: no fireflies, no shooting star', () => {
    const { game, events } = makeNight('8-12');
    expect(game.fireflies).toHaveLength(FIREFLIES['8-12']);
    expect(FIREFLIES['8-12']).toBe(0);
    advance(game, 120, 1 / 20);
    expect(game.shooting).toBeNull();
    expect(events).toHaveLength(0);
    const { game: older, events: olderEvents } = makeNight('2+');
    expect(older.fireflies).toHaveLength(FIREFLIES['2+']);
    advance(older, SHOOT_EVERY['2+'] * 1.3, 1 / 20);
    expect(olderEvents.some((e) => e.type === 'shooting' && e.by === 'self')).toBe(true);
    // A touched firefly zips away with a chirp.
    const firefly = older.fireflies[0];
    tap(older, firefly.x, firefly.y, 40);
    expect(firefly.zip).toBeGreaterThan(0.5);
    expect(olderEvents.some((e) => e.type === 'firefly')).toBe(true);
  });

  it('celebrates every tenth star from the moon', () => {
    // The youngest profile: no fireflies to catch the touches, and taps far enough apart to light a new star each.
    const { game, events } = makeNight('8-12');
    for (let i = 0; i < CELEBRATE_EVERY; i++) tap(game, 40 + i * 70, 150, 50 + i);
    expect(events.filter((e) => e.type === 'celebration')).toHaveLength(1);
    expect(game.moon.awake).toBeGreaterThan(0);
    expect(game.sparkles.length).toBeGreaterThan(20);
  });

  it('only twinkles while the world sleeps, lets the lights go out, and answers again when woken', () => {
    const { game, events } = makeNight();
    tap(game, 200, 100);
    const lamp = game.lamps[1];
    tap(game, lamp.x, lamp.headY, 5);
    game.sleep();
    expect(lamp.on).toBe(false);
    const count = events.length;
    tap(game, 400, 100, 6);
    expect(game.lights).toHaveLength(1);
    expect(events.slice(count).map((e) => e.type)).toEqual(['sparkle']);
    advance(game, 4);
    expect(game.lights).toHaveLength(0);
    expect(game.dusk).toBeGreaterThan(0.3);
    game.wake();
    tap(game, 400, 100, 7);
    expect(game.lights).toHaveLength(1);
  });

  it('keeps the lamps on the hill and the lights on the screen when the screen changes size', () => {
    const { game } = makeNight();
    tap(game, W * 0.5, H * 0.5);
    game.resize(1024, 768);
    expect(game.lights[0].x).toBeCloseTo(512);
    expect(game.lights[0].y).toBeCloseTo(384);
    for (const lamp of game.lamps) {
      expect(lamp.baseY).toBeCloseTo(game.ground(lamp.x));
      expect(lamp.headY).toBeLessThan(lamp.baseY);
    }
    expect(game.moon.x).toBeLessThan(1024);
    expect(game.moon.y).toBeGreaterThan(0);
  });
});
