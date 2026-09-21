import { describe, expect, it } from 'vitest';
import { SessionClock } from '../src/engine/session';

describe('the session clock behind the pause', () => {
  it('counts plain time while the world is awake, not only touches, and stops in the menu', () => {
    const clock = new SessionClock();
    for (let i = 0; i < 60; i++) clock.tick(1, true);
    expect(clock.seconds).toBe(60);
    clock.tick(30, false); // parent menu open
    expect(clock.seconds).toBe(60);
    expect(clock.due(5)).toBe(false);
    for (let i = 0; i < 240; i++) clock.tick(1, true);
    expect(clock.due(5)).toBe(true);
    expect(clock.left(5)).toBe(0);
  });

  it('never falls due when the pause is off, and starts over after a wake', () => {
    const clock = new SessionClock();
    clock.tick(10000, true);
    expect(clock.due(0)).toBe(false);
    expect(clock.left(0)).toBeNull();
    clock.reset();
    expect(clock.seconds).toBe(0);
    expect(clock.left(10)).toBe(600);
  });
});
