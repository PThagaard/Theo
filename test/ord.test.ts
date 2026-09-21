import { describe, expect, it } from 'vitest';
import { BASE_THINGS, OrdGame, type OrdEvent } from '../src/activities/ord/logic';

const W = 390;
const H = 844;

function makeOrd(seed = 7): { game: OrdGame; events: OrdEvent[] } {
  const game = new OrdGame(seed);
  const events: OrdEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  return { game, events };
}

function advance(game: OrdGame, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

function swipe(game: OrdGame): void {
  game.press(1, W * 0.7, H * 0.4);
  for (let i = 1; i <= 8; i++) game.drag(1, W * 0.7 - i * 12 * game.unit, H * 0.4);
  game.release(1);
}

describe('Ord: one thing at a time', () => {
  it('slides a thing in, lets it be touched, and says its word', () => {
    const { game, events } = makeOrd();
    expect(game.state).toBe('enter');
    advance(game, 1);
    expect(game.state).toBe('idle');
    expect(game.x).toBe(game.centerX);
    game.press(1, game.hit.x, game.hit.y);
    game.release(1);
    expect(game.state).toBe('react');
    const touch = events.find((e) => e.type === 'touch');
    expect(touch).toMatchObject({ key: game.current.key });
    advance(game, 1);
    expect(game.state).toBe('idle');
  });

  it('brings the next thing on a swipe and goes through every thing before repeating', () => {
    const { game, events } = makeOrd();
    advance(game, 1);
    const seen: string[] = [game.current.key];
    for (let i = 0; i < BASE_THINGS.length - 1; i++) {
      swipe(game);
      expect(game.state).toBe('leave');
      advance(game, 1.5);
      expect(game.state).toBe('idle');
      seen.push(game.current.key);
    }
    expect(new Set(seen).size).toBe(BASE_THINGS.length);
    expect(events.filter((e) => e.type === 'next')).toHaveLength(BASE_THINGS.length - 1);
    expect(events.filter((e) => e.type === 'enter')).toHaveLength(BASE_THINGS.length - 1);
  });

  it('hides every third thing behind the bush for the youngest, until it is touched (titte-bøh)', () => {
    const { game, events } = makeOrd();
    advance(game, 1);
    let hiddenAt = -1;
    for (let i = 1; i <= 4; i++) {
      swipe(game);
      advance(game, 1.5);
      if (game.hidden) {
        hiddenAt = i;
        break;
      }
    }
    expect(hiddenAt).toBe(3);
    expect(game.bushOpen).toBe(0);
    // Touching the sky does nothing to the bush; touching the bush reveals the thing.
    game.press(1, 20, 20);
    game.release(1);
    expect(game.hidden).toBe(true);
    game.press(2, game.hit.x, game.hit.y);
    game.release(2);
    expect(game.hidden).toBe(false);
    expect(events.some((e) => e.type === 'peek')).toBe(true);
    advance(game, 1);
    expect(game.bushOpen).toBe(1);
  });

  it('never moves on by itself for the youngest, but does for older children after a while', () => {
    const { game } = makeOrd();
    advance(game, 1);
    const key = game.current.key;
    advance(game, 120);
    expect(game.current.key).toBe(key);
    game.setAge('2+');
    advance(game, 30);
    expect(game.current.key).not.toBe(key);
  });

  it('adds family photos to the deck with their name as the word', () => {
    const { game } = makeOrd();
    game.setPhotos(['abc']);
    expect(game.things.map((t) => t.key)).toContain('photo:abc');
    const keys = new Set<string>();
    advance(game, 1);
    for (let i = 0; i < BASE_THINGS.length + 2; i++) {
      keys.add(game.current.key);
      swipe(game);
      advance(game, 1.5);
    }
    expect(keys).toContain('photo:abc');
  });

  it('goes to sleep: the thing leaves, touches only twinkle, and wakes up again', () => {
    const { game, events } = makeOrd();
    advance(game, 1);
    game.sleep();
    advance(game, 6);
    expect(game.dusk).toBeGreaterThan(0.5);
    expect(game.state === 'leave' || game.state === 'enter').toBe(true);
    const before = events.length;
    game.press(1, game.hit.x, game.hit.y);
    expect(events.slice(before).every((e) => e.type === 'sparkle')).toBe(true);
    game.wake();
    advance(game, 4);
    expect(game.dusk).toBe(0);
    expect(game.state).toBe('idle');
  });
});
