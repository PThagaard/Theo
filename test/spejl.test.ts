import { describe, expect, it } from 'vitest';
import { CELEBRATE_EVERY, HOLD_START, MAX_GLITTER, MAX_STICKERS, PHOTO_EVERY, STICKER_LIFE, STICKER_SIZE, SpejlGame, type SpejlEvent } from '../src/activities/spejl/logic';
import type { Age } from '../src/engine/age';

const W = 844;
const H = 390;

function makeMirror(age: Age = '8-12', seed = 5): { game: SpejlGame; events: SpejlEvent[] } {
  const game = new SpejlGame(seed);
  const events: SpejlEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  game.setAge(age);
  return { game, events };
}

function advance(game: SpejlGame, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

function tap(game: SpejlGame, x: number, y: number, id = 1): void {
  game.press(id, x, y);
  game.update(0.05);
  game.release(id);
}

function swipe(game: SpejlGame, x0: number, y0: number, x1: number, y1: number, steps = 14, id = 2): void {
  game.press(id, x0, y0);
  for (let i = 1; i <= steps; i++) {
    game.update(1 / 60);
    game.drag(id, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  }
  game.update(1 / 60);
  game.release(id);
}

describe('Spejl: the mirror', () => {
  it('puts a sticker where the finger lands, the kinds taking turns, big and few for the youngest', () => {
    const { game, events } = makeMirror('8-12');
    tap(game, 200, 150);
    tap(game, 300, 150, 2);
    expect(game.stickers).toHaveLength(2);
    expect(Math.abs(game.stickers[0].x - 200)).toBeLessThan(5); // it sways a little from the first frame
    expect(game.stickers[0].kind).not.toBe(game.stickers[1].kind);
    expect(events.filter((e) => e.type === 'sticker')).toHaveLength(2);
    expect(game.glitter.length).toBeGreaterThan(0);
    for (let i = 0; i < MAX_STICKERS['8-12'] + 3; i++) tap(game, 50 + i * 40, 250, 10 + i);
    expect(game.stickers).toHaveLength(MAX_STICKERS['8-12']);
    const { game: older } = makeMirror('2+');
    tap(older, 200, 150);
    // Each sticker varies a little in size on purpose (0.9–1.15), so compare the profile factor with that slack.
    const ratio = game.stickers[0].size / older.stickers[0].size;
    expect(ratio).toBeGreaterThan((STICKER_SIZE['8-12'] / STICKER_SIZE['2+']) * 0.75);
    expect(ratio).toBeLessThan((STICKER_SIZE['8-12'] / STICKER_SIZE['2+']) * 1.3);
    expect(MAX_STICKERS['8-12']).toBeLessThan(MAX_STICKERS['2+']);
  });

  it('lets stickers pop in, float up and fade away', () => {
    const { game } = makeMirror();
    tap(game, 400, 300);
    const sticker = game.stickers[0];
    expect(sticker.scale).toBeLessThan(1);
    advance(game, 1);
    expect(sticker.scale).toBe(1);
    expect(sticker.y).toBeLessThan(300);
    advance(game, STICKER_LIFE);
    expect(game.stickers).toHaveLength(0);
  });

  it('leaves glitter behind a drawn finger with a harp note now and then, under the cap', () => {
    const { game, events } = makeMirror();
    swipe(game, 100, 200, 700, 200, 40);
    expect(game.glitter.length).toBeGreaterThan(30);
    expect(game.glitter.length).toBeLessThanOrEqual(MAX_GLITTER);
    const trails = events.filter((e) => e.type === 'trail');
    expect(trails.length).toBeGreaterThanOrEqual(2);
    expect(trails.filter((e) => e.type === 'trail' && e.first)).toHaveLength(1);
    // Drawing puts one sticker down (where the finger landed), not one at every step.
    expect(game.stickers).toHaveLength(1);
    advance(game, 3);
    expect(game.glitter).toHaveLength(0);
  });

  it('grows a star under a still finger, which follows the finger and bursts when let go', () => {
    const { game, events } = makeMirror();
    game.press(3, 300, 200);
    advance(game, HOLD_START + 0.1);
    expect(game.charge).not.toBeNull();
    expect(events.some((e) => e.type === 'charge')).toBe(true);
    const small = game.charge?.size ?? 0;
    advance(game, 1);
    expect(game.charge?.size ?? 0).toBeGreaterThan(small);
    game.drag(3, 340, 220);
    expect(game.charge?.x).toBe(340);
    const glitter = game.glitter.length;
    game.release(3);
    expect(game.charge).toBeNull();
    expect(game.bursts).toBe(1);
    expect(game.glitter.length).toBeGreaterThan(glitter + 15);
    expect(events.some((e) => e.type === 'burst')).toBe(true);
  });

  it('throws confetti on a shake, once per shake', () => {
    const { game, events } = makeMirror();
    game.shake();
    game.shake();
    expect(game.shakes).toBe(1);
    expect(game.glitter.length).toBeGreaterThanOrEqual(30);
    expect(events.filter((e) => e.type === 'shake')).toHaveLength(1);
  });

  it('floats a family bubble up by itself now and then, one at a time, and pops it on a touch; none without photos', () => {
    const { game, events } = makeMirror('2+');
    game.setPhotos(['mor', 'far']);
    advance(game, PHOTO_EVERY['2+'] * 1.3, 1 / 20);
    expect(game.bubbles).toHaveLength(1);
    expect(events.some((e) => e.type === 'bubble' && e.what === 'appear')).toBe(true);
    const bubble = game.bubbles[0];
    advance(game, 2);
    expect(bubble.y).toBeLessThan(H + bubble.r);
    tap(game, bubble.x, bubble.y, 7);
    expect(game.bubbles).toHaveLength(0);
    expect(events.find((e) => e.type === 'bubble' && e.what === 'pop')).toMatchObject({ photoId: bubble.photoId });
    // A touch on a bubble pops it rather than sticking a sticker on it.
    expect(game.stickers).toHaveLength(0);
    const { game: plain, events: plainEvents } = makeMirror('2+');
    advance(plain, PHOTO_EVERY['2+'] * 2, 1 / 20);
    expect(plain.bubbles).toHaveLength(0);
    expect(plainEvents).toHaveLength(0);
  });

  it('celebrates every tenth sticker with confetti', () => {
    const { game, events } = makeMirror('2+');
    for (let i = 0; i < CELEBRATE_EVERY; i++) tap(game, 40 + i * 70, 150, 50 + i);
    expect(events.filter((e) => e.type === 'celebration')).toHaveLength(1);
    expect(game.glitter.length).toBeGreaterThan(20);
  });

  it('only twinkles while it sleeps, and answers again when woken', () => {
    const { game, events } = makeMirror();
    game.sleep();
    const count = events.length;
    tap(game, 300, 200);
    expect(game.stickers).toHaveLength(0);
    expect(events.slice(count).map((e) => e.type)).toEqual(['sparkle']);
    advance(game, 4);
    expect(game.dusk).toBeGreaterThan(0.3);
    game.wake();
    tap(game, 300, 200, 2);
    expect(game.stickers).toHaveLength(1);
  });

  it('keeps the stickers on the screen when the screen changes size', () => {
    const { game } = makeMirror();
    tap(game, W * 0.5, H * 0.5);
    game.resize(1024, 768);
    expect(game.stickers[0].x).toBeCloseTo(512, -1);
    expect(game.stickers[0].y).toBeCloseTo(384, -1); // it has floated up a little already
  });
});
