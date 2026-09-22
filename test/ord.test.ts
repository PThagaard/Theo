import { describe, expect, it } from 'vitest';
import { BASE_THINGS, FOUND_TIME, OrdGame, PLAN, REASK_AFTER, YOUNGEST_KEYS, type OrdEvent } from '../src/activities/ord/logic';
import { VOICE_WORDS } from '../src/engine/voices';

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

function tap(game: OrdGame, x: number, y: number, id = 1): void {
  game.press(id, x, y);
  game.release(id);
}

/** Swipes until a "Hvor er …?" round is on stage (at most a whole plan cycle). */
function swipeToRound(game: OrdGame): void {
  for (let i = 0; i < PLAN[game.currentAge].length + 1 && !game.round; i++) {
    swipe(game);
    advance(game, 1.5);
  }
  if (!game.round) throw new Error('no round came');
}

describe('Titte-bøh og Ord', () => {
  it('slides a thing in, lets it be touched, and says its word', () => {
    const { game, events } = makeOrd();
    game.setAge('1-2'); // the first thing simply stands there from 1 year
    expect(game.state).toBe('enter');
    advance(game, 1);
    expect(game.state).toBe('idle');
    expect(game.x).toBe(game.centerX);
    tap(game, game.hit.x, game.hit.y);
    expect(game.state).toBe('react');
    const touch = events.find((e) => e.type === 'touch');
    expect(touch).toMatchObject({ thing: { key: game.current.key } });
    advance(game, 1);
    expect(game.state).toBe('idle');
  });

  it('brings the next thing on a swipe and goes through every thing before repeating', () => {
    const { game, events } = makeOrd();
    game.setAge('1-2');
    advance(game, 1);
    const seen: string[] = [game.current.key];
    const total = game.deckThings.length;
    expect(total).toBe(BASE_THINGS.length);
    for (let i = 0; i < total - 1; i++) {
      swipe(game);
      expect(game.state).toBe('leave');
      advance(game, 1.5);
      expect(game.state).toBe('idle');
      seen.push(game.current.key);
    }
    expect(new Set(seen).size).toBe(total);
    expect(events.filter((e) => e.type === 'next')).toHaveLength(total - 1);
    expect(events.filter((e) => e.type === 'enter')).toHaveLength(total - 1);
  });

  it('gives the youngest peek-a-boo: the family and a few animals, hidden three times out of four, no questions', () => {
    const { game, events } = makeOrd();
    game.setPhotos(['abc']);
    expect(game.currentAge).toBe('8-12');
    for (const thing of game.deckThings) expect(thing.kind === 'photo' || YOUNGEST_KEYS.includes(thing.key), thing.key).toBe(true);
    expect(game.deckThings).toHaveLength(YOUNGEST_KEYS.length + 1);
    // The very first thing already hides; over eight things, six hide and none is a round.
    let hiddenCount = 0;
    for (let i = 0; i < 8; i++) {
      advance(game, 1);
      if (game.hidden) hiddenCount++;
      expect(game.round).toBeNull();
      swipe(game);
      advance(game, 0.6);
    }
    expect(hiddenCount).toBe(6);
    expect(events.some((e) => e.type === 'ask')).toBe(false);
    // Left alone, the next thing comes by itself only after a whole minute for the youngest.
    advance(game, 1);
    const key = game.current.key;
    advance(game, 40);
    expect(game.current.key).toBe(key);
    advance(game, 40);
    expect(game.current.key).not.toBe(key);
  });

  it('opens the bush on the first touch for the youngest (titte-bøh), and not for a touch in the sky', () => {
    const { game, events } = makeOrd();
    advance(game, 1);
    expect(game.hidden).toBe(true);
    expect(game.bushOpen).toBe(0);
    tap(game, 20, 20);
    expect(game.hidden).toBe(true);
    tap(game, game.hit.x, game.hit.y, 2);
    expect(game.hidden).toBe(false);
    expect(events.some((e) => e.type === 'peek')).toBe(true);
    advance(game, 1);
    expect(game.bushOpen).toBe(1);
  });

  it('for older children the bush only rustles on the first touch and opens on the second', () => {
    const { game, events } = makeOrd();
    game.setAge('2+');
    advance(game, 1);
    game.hide();
    tap(game, game.hit.x, game.hit.y);
    expect(game.hidden).toBe(true);
    expect(game.rustle).toBe(1);
    expect(events.some((e) => e.type === 'rustle')).toBe(true);
    expect(events.some((e) => e.type === 'peek')).toBe(false);
    advance(game, 1);
    expect(game.rustle).toBe(0);
    tap(game, game.hit.x, game.hit.y, 2);
    expect(game.hidden).toBe(false);
    expect(events.some((e) => e.type === 'peek')).toBe(true);
    // The next hidden thing starts afresh: two touches again.
    swipe(game);
    advance(game, 1.5);
    game.hide();
    tap(game, game.hit.x, game.hit.y, 3);
    expect(game.hidden).toBe(true);
  });

  it('from 1 year asks "hvor er …?" with two things side by side: everything answers, the asked-for one celebrates', () => {
    const { game, events } = makeOrd();
    game.setAge('1-2');
    advance(game, 1);
    swipeToRound(game);
    const round = game.round;
    if (!round) throw new Error('no round');
    expect(round.things).toHaveLength(2);
    expect(round.things[round.asked].key).toBe(game.current.key);
    expect(events.filter((e) => e.type === 'ask')).toHaveLength(1);
    expect(events.find((e) => e.type === 'ask')).toMatchObject({ thing: { key: game.current.key }, repeat: false });
    // Touching the other thing: it answers with its own name, nothing else happens.
    const other = round.asked === 0 ? 1 : 0;
    const before = events.length;
    tap(game, game.hitFor(other).x, game.hitFor(other).y);
    expect(round.found).toBe(false);
    expect(events.slice(before).map((e) => e.type)).toEqual(['touch']);
    expect((events[before] as { thing: { key: string } }).thing.key).toBe(round.things[other].key);
    // Touching the asked-for thing: found, celebration, then the next thing comes.
    tap(game, game.hitFor(round.asked).x, game.hitFor(round.asked).y, 2);
    expect(round.found).toBe(true);
    expect(events.some((e) => e.type === 'found')).toBe(true);
    advance(game, FOUND_TIME + 0.2);
    expect(game.state).toBe('leave');
    advance(game, 1.5);
    expect(game.round).toBeNull();
    expect(game.state).toBe('idle');
  });

  it('asks again with a wiggle when nothing happens, and never says anything is wrong', () => {
    const { game, events } = makeOrd();
    game.setAge('2+');
    advance(game, 1);
    swipeToRound(game);
    const round = game.round;
    if (!round) throw new Error('no round');
    expect(round.things).toHaveLength(3);
    advance(game, REASK_AFTER + 0.5);
    const asks = events.filter((e) => e.type === 'ask');
    expect(asks).toHaveLength(2);
    expect(asks[1]).toMatchObject({ repeat: true });
    expect(round.hint).toBeGreaterThan(0);
    expect(round.found).toBe(false);
    // A touch between two things still means the nearest one: no dead areas.
    const between = (game.hitFor(0).x + game.hitFor(1).x) / 2 + 3;
    const before = events.length;
    tap(game, between, game.hitFor(0).y);
    expect(events.length).toBe(before + 1);
    expect(['touch', 'found']).toContain(events[before].type);
    // A swipe skips the round.
    swipe(game);
    expect(game.state).toBe('leave');
  });

  it('starts the round at once when asked for while a thing stands there (the smoke test does this)', () => {
    const { game, events } = makeOrd();
    game.setAge('1-2');
    advance(game, 1);
    game.round = null;
    game.ask();
    expect(game.round).not.toBeNull();
    expect(events.filter((e) => e.type === 'ask')).toHaveLength(1);
  });

  it('has a word the parents can record for every thing, and for the question', () => {
    const keys = VOICE_WORDS.map((w) => w.key);
    for (const thing of BASE_THINGS) expect(keys, `no voice word for ${thing.key}`).toContain(thing.key);
    expect(keys).toContain('hvor-er');
    expect(BASE_THINGS.map((t) => t.kind)).toEqual(expect.arrayContaining(['cow', 'cat', 'car']));
  });

  it('moves on by itself after a while: sooner for older children', () => {
    const { game } = makeOrd();
    game.setAge('2+');
    advance(game, 1);
    const key = game.current.key;
    advance(game, 30);
    expect(game.current.key).not.toBe(key);
  });

  it('adds family photos to the deck with their name as the word', () => {
    const { game } = makeOrd();
    game.setPhotos(['abc']);
    expect(game.things.map((t) => t.key)).toContain('photo:abc');
    const keys = new Set<string>();
    advance(game, 1);
    for (let i = 0; i < game.deckThings.length + 2; i++) {
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
