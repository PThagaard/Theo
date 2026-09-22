import { describe, expect, it } from 'vitest';
import { BLOOM_INTERVAL, HOLD_START, MAX_SPARKS, MAX_WAVES, PADS, PHOTO_EVERY, ROLL_MAX, SHAKE_STEP, TrommerGame, type TrommerEvent } from '../src/activities/trommer/logic';
import type { Age } from '../src/engine/age';

const W = 390;
const H = 844;
const PENTATONIC = new Set([0, 2, 4, 7, 9]);

function makeDrums(age: Age = '8-12', seed = 5): { game: TrommerGame; events: TrommerEvent[] } {
  const game = new TrommerGame(seed);
  const events: TrommerEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  game.setAge(age);
  return { game, events };
}

function advance(game: TrommerGame, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

function tap(game: TrommerGame, x: number, y: number, id = 1): void {
  game.press(id, x, y);
  game.release(id);
}

function center(game: TrommerGame, index: number): { x: number; y: number } {
  const pad = game.pads[index];
  return { x: (pad.x0 + pad.x1) / 2, y: (pad.y0 + pad.y1) / 2 };
}

describe('Trommer: the drum pads', () => {
  it('lays out a few big pads for the age, low notes at the bottom, and leaves no dead spot anywhere', () => {
    for (const age of ['8-12', '1-2', '2+'] as Age[]) {
      const { game } = makeDrums(age);
      expect(game.pads).toHaveLength(PADS[age]);
      for (let i = 1; i < game.pads.length; i++) {
        expect(game.pads[i].note).toBeGreaterThan(game.pads[i - 1].note);
        expect(game.pads[i].y1).toBeLessThan(game.pads[i - 1].y0);
      }
      for (const pad of game.pads) expect(PENTATONIC.has(pad.note % 12), `note ${pad.note}`).toBe(true);
      // Every point on the screen, gaps and margins included, belongs to a pad.
      for (let y = 0; y <= H; y += 21) for (let x = 0; x <= W; x += 39) expect(game.padAt(x, y)).toBeDefined();
    }
    const { game: young } = makeDrums('8-12');
    // The youngest get pads a whole hand cannot miss: a third of the screen each.
    for (const pad of young.pads) expect(pad.y1 - pad.y0).toBeGreaterThan(H * 0.28);
    // Landscape: columns instead of bands.
    young.resize(1024, 768);
    for (let i = 1; i < young.pads.length; i++) expect(young.pads[i].x0).toBeGreaterThan(young.pads[i - 1].x1);
  });

  it('a hit plays the pad’s note, bounces it, sends a wave from the hand and lets notes fly', () => {
    const { game, events } = makeDrums();
    const { x, y } = center(game, 1);
    tap(game, x, y);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'hit', pad: 1, note: game.pads[1].note, how: 'tap' });
    expect(game.pads[1].squash).toBe(1);
    expect(game.pads[1].bloom).toBe(1);
    expect(game.waves).toHaveLength(1);
    expect(game.sparks.length).toBeGreaterThan(0);
    expect(game.hits).toBe(1);
    advance(game, 2);
    expect(game.pads[1].squash).toBe(0);
    expect(game.waves).toHaveLength(0);
    expect(game.sparks).toHaveLength(0);
  });

  it('never flashes: a pad brightens at most three times a second, while every hit still makes a wave', () => {
    const { game } = makeDrums();
    const { x, y } = center(game, 0);
    tap(game, x, y);
    const firstBloom = game.pads[0].lastBloom;
    for (let i = 0; i < 5; i++) {
      advance(game, 0.05);
      tap(game, x, y, 2 + i);
    }
    expect(game.pads[0].lastBloom).toBe(firstBloom);
    expect(game.waves).toHaveLength(6);
    advance(game, BLOOM_INTERVAL);
    tap(game, x, y, 9);
    expect(game.pads[0].lastBloom).toBeGreaterThan(firstBloom);
  });

  it('sliding across the pads plays each one in turn (a glissando)', () => {
    const { game, events } = makeDrums('2+');
    const start = center(game, 0);
    game.press(1, start.x, start.y);
    for (let i = 1; i < game.pads.length; i++) {
      const { x, y } = center(game, i);
      game.drag(1, x, y - 5);
      game.drag(1, x, y);
    }
    game.release(1);
    const hits = events.filter((e) => e.type === 'hit');
    expect(hits.map((e) => (e.type === 'hit' ? e.how : ''))).toEqual(['tap', 'sweep', 'sweep', 'sweep', 'sweep']);
    expect(hits.map((e) => (e.type === 'hit' ? e.pad : -1))).toEqual([0, 1, 2, 3, 4]);
    expect(game.sweeps).toBe(4);
  });

  it('a hand resting on a pad rolls it: soft quick hits that rest after a while, and start again after a lift', () => {
    const { game, events } = makeDrums('8-12');
    const { x, y } = center(game, 2);
    game.press(1, x, y);
    advance(game, HOLD_START - 0.05);
    expect(events.filter((e) => e.type === 'hit' && e.how === 'roll')).toHaveLength(0);
    advance(game, 1.2);
    const rolled = events.filter((e) => e.type === 'hit' && e.how === 'roll').length;
    expect(rolled).toBeGreaterThanOrEqual(5);
    // A small shift of the hand on the same pad does not stop the roll.
    game.drag(1, x + 10, y + 10);
    advance(game, ROLL_MAX + 1);
    const total = events.filter((e) => e.type === 'hit' && e.how === 'roll').length;
    expect(total).toBeGreaterThan(rolled);
    advance(game, 2);
    expect(events.filter((e) => e.type === 'hit' && e.how === 'roll')).toHaveLength(total);
    expect(game.rolls).toBe(total);
    expect(game.hits).toBe(1);
    game.release(1);
    game.press(2, x, y);
    advance(game, 1);
    expect(events.filter((e) => e.type === 'hit' && e.how === 'roll').length).toBeGreaterThan(total);
  });

  it('a shake rolls over every pad and back, once per shake, and not twice in a row', () => {
    const { game, events } = makeDrums('1-2');
    game.shake();
    game.shake();
    expect(game.shakes).toBe(1);
    expect(events.filter((e) => e.type === 'shake')).toHaveLength(1);
    advance(game, SHAKE_STEP * 8 + 0.2);
    const hits = events.filter((e) => e.type === 'hit' && e.how === 'shake');
    expect(hits).toHaveLength(2 * PADS['1-2'] - 1);
    expect(hits.map((e) => (e.type === 'hit' ? e.pad : -1))).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it('every sixth hit sends a family face up on a note, when there are photos', () => {
    const { game, events } = makeDrums();
    const { x, y } = center(game, 0);
    for (let i = 0; i < PHOTO_EVERY; i++) tap(game, x, y, i);
    expect(events.filter((e) => e.type === 'photo')).toHaveLength(0);
    game.setPhotos(['mor']);
    for (let i = 0; i < PHOTO_EVERY; i++) tap(game, x, y, 10 + i);
    const photos = events.filter((e) => e.type === 'photo');
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ photoId: 'mor' });
    expect(game.sparks.some((spark) => spark.kind === 'photo')).toBe(true);
  });

  it('keeps waves and notes under their caps however wild the banging', () => {
    const { game } = makeDrums('2+');
    for (let i = 0; i < 300; i++) tap(game, (i * 37) % W, (i * 53) % H, i);
    expect(game.waves.length).toBeLessThanOrEqual(MAX_WAVES);
    expect(game.sparks.length).toBeLessThanOrEqual(MAX_SPARKS);
  });

  it('changing the age re-lays the pads while keeping the play going', () => {
    const { game } = makeDrums('8-12');
    const { x, y } = center(game, 0);
    game.press(1, x, y);
    game.setAge('2+');
    expect(game.pads).toHaveLength(5);
    advance(game, 1);
    game.release(1);
    expect(game.padAt(x, y)).toBeDefined();
  });

  it('sleeps: touches only twinkle, rolls and shakes stop; and wakes again', () => {
    const { game, events } = makeDrums();
    const { x, y } = center(game, 1);
    game.press(1, x, y);
    game.sleep();
    advance(game, 3);
    expect(game.dusk).toBeGreaterThan(0.3);
    const before = events.length;
    game.press(2, x, y);
    game.shake();
    expect(events.slice(before).every((e) => e.type === 'sparkle')).toBe(true);
    expect(game.sparks.some((spark) => spark.kind === 'star')).toBe(true);
    game.wake();
    advance(game, 4);
    expect(game.dusk).toBe(0);
    tap(game, x, y, 3);
    expect(events[events.length - 1].type).toBe('hit');
  });
});
