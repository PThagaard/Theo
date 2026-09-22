import { describe, expect, it } from 'vitest';
import { BALLS, BoldeGame, CELEBRATE_EVERY, MAX_SPARKLES, TAP_MAX_SECONDS, type BoldeEvent } from '../src/activities/bolde/logic';
import type { Age } from '../src/engine/age';

const W = 390;
const H = 844;

function makeRoom(age: Age = '8-12', seed = 11): { game: BoldeGame; events: BoldeEvent[] } {
  const game = new BoldeGame(seed);
  const events: BoldeEvent[] = [];
  game.onEvent((event) => events.push(event));
  game.resize(W, H);
  game.setAge(age);
  return { game, events };
}

function advance(game: BoldeGame, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

/** Lets the balls drop in and come to rest. */
function settle(game: BoldeGame): void {
  advance(game, 8);
}

function tap(game: BoldeGame, x: number, y: number, id = 1): void {
  game.press(id, x, y);
  game.update(0.05);
  game.release(id);
}

describe('Bolde: the bouncing balls', () => {
  it('has a few big balls for the youngest and more, smaller ones for older children; they drop in and come to rest on the mat', () => {
    for (const age of ['8-12', '1-2', '2+'] as Age[]) {
      const { game } = makeRoom(age);
      expect(game.balls).toHaveLength(BALLS[age]);
      settle(game);
      for (const ball of game.balls) {
        expect(ball.y).toBeLessThanOrEqual(game.floorY - ball.r + 0.01);
        expect(ball.y).toBeGreaterThan(game.floorY - ball.r * 1.5);
        expect(ball.x).toBeGreaterThanOrEqual(ball.r);
        expect(ball.x).toBeLessThanOrEqual(W - ball.r);
      }
      expect(game.balls.every((ball) => ball.resting)).toBe(true);
    }
    const { game: young } = makeRoom('8-12');
    const { game: older } = makeRoom('2+');
    expect(young.balls[0].r).toBeGreaterThan(older.balls[0].r);
  });

  it('never lets a ball leave the room, however hard it is thrown', () => {
    const { game } = makeRoom('2+');
    settle(game);
    for (const ball of game.balls) {
      ball.vx = 4000;
      ball.vy = -6000;
    }
    for (let i = 0; i < 600; i++) {
      game.update(1 / 60);
      for (const ball of game.balls) {
        expect(ball.x).toBeGreaterThanOrEqual(ball.r - 0.01);
        expect(ball.x).toBeLessThanOrEqual(W - ball.r + 0.01);
        expect(ball.y).toBeGreaterThanOrEqual(ball.r - 0.01);
        expect(ball.y).toBeLessThanOrEqual(game.floorY - ball.r + 0.01);
      }
    }
  });

  it('a quick tap on a ball makes it glad and hop, with a boing and sparkles; a family face says so too', () => {
    const { game, events } = makeRoom();
    settle(game);
    const ball = game.balls[1];
    tap(game, ball.x, ball.y);
    expect(events.some((e) => e.type === 'tap')).toBe(true);
    expect(events.some((e) => e.type === 'jump')).toBe(true);
    expect(ball.vy).toBeLessThan(-100);
    expect(ball.happy).toBeGreaterThan(0);
    expect(game.sparkles.length).toBeGreaterThan(0);
    expect(game.taps).toBe(1);
    advance(game, 0.4);
    expect(ball.y).toBeLessThan(game.floorY - ball.r * 2);
    game.setPhotos(['mor']);
    settle(game);
    const face = game.balls[0];
    expect(face.photoId).toBe('mor');
    tap(game, face.x, face.y, 2);
    expect(events.some((e) => e.type === 'photo' && e.photoId === 'mor')).toBe(true);
  });

  it('a ball held by the hand follows it, and flies off the way the hand moved when let go (a throw)', () => {
    const { game, events } = makeRoom();
    settle(game);
    const ball = game.balls[0];
    game.press(1, ball.x, ball.y);
    expect(ball.heldBy).toBe(1);
    // Carry it up and to the right over half a second.
    const startX = ball.x;
    for (let i = 1; i <= 30; i++) {
      game.drag(1, startX + i * 6, game.floorY - ball.r - i * 8);
      game.update(1 / 60);
    }
    expect(ball.x).toBeGreaterThan(startX + 100);
    expect(ball.y).toBeLessThan(game.floorY - ball.r - 150);
    game.release(1);
    expect(ball.heldBy).toBeNull();
    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.vy).toBeLessThan(0);
    expect(events.some((e) => e.type === 'throw')).toBe(true);
    expect(events.some((e) => e.type === 'jump')).toBe(false);
    expect(game.throws).toBe(1);
  });

  it('a slow hold and release is not a hop: the ball just stays', () => {
    const { game, events } = makeRoom();
    settle(game);
    const ball = game.balls[2];
    game.press(1, ball.x, ball.y);
    advance(game, TAP_MAX_SECONDS + 0.3);
    game.release(1);
    expect(events.some((e) => e.type === 'jump')).toBe(false);
    expect(events.some((e) => e.type === 'throw')).toBe(false);
    advance(game, 1);
    expect(ball.resting).toBe(true);
  });

  it('tapping the mat bounces the balls near the hand like a trampoline; tapping the air twinkles', () => {
    const { game, events } = makeRoom();
    // One ball on the left, the others far to the right, so the mat tap is near only one of them.
    game.balls[0].x = game.ballR * 1.2;
    game.balls[1].x = W - game.ballR;
    game.balls[2].x = W - game.ballR * 3.2;
    settle(game);
    const ball = game.balls[0];
    const before = events.length;
    tap(game, ball.x + ball.r * 2.2, game.floorY + 10);
    expect(events.slice(before).some((e) => e.type === 'floor')).toBe(true);
    expect(ball.vy).toBeLessThan(-50);
    expect(game.floorTaps).toBe(1);
    const mid = events.length;
    tap(game, W / 2, 40, 2);
    expect(events.slice(mid).map((e) => e.type)).toEqual(['sparkle']);
  });

  it('a swipe pushes the balls it passes the way the hand moves', () => {
    const { game, events } = makeRoom();
    settle(game);
    const ball = game.balls[1];
    const y = ball.y;
    game.press(1, ball.x - ball.r * 3, y - ball.r * 2.5);
    for (let i = 1; i <= 12; i++) {
      game.drag(1, ball.x - ball.r * 3 + i * ball.r * 0.6, y);
      game.update(1 / 60);
    }
    game.release(1);
    expect(events.some((e) => e.type === 'push')).toBe(true);
    expect(game.pushes).toBeGreaterThanOrEqual(1);
    // Pushed along the hand's way (it may already have bounced off the wall by now, so look at where it got to).
    expect(ball.x).toBeGreaterThan(W / 2);
  });

  it('a shake makes every ball jump, not twice in a row; bounces on the mat squash the ball and sound when hard', () => {
    const { game, events } = makeRoom('1-2');
    settle(game);
    game.shake();
    game.shake();
    expect(game.shakes).toBe(1);
    expect(game.balls.every((ball) => ball.vy < 0)).toBe(true);
    advance(game, 3);
    expect(events.some((e) => e.type === 'bounce' && e.strength > 0.2)).toBe(true);
    expect(game.bounces).toBeGreaterThan(0);
    // At rest, nothing sounds by itself.
    settle(game);
    const before = events.length;
    advance(game, 3);
    expect(events.slice(before).filter((e) => e.type === 'bounce')).toHaveLength(0);
  });

  it('a ball held against the mat is quiet: no storm of bounces, sounds or vibration', () => {
    const { game, events } = makeRoom('2+');
    settle(game);
    const ball = game.balls[2];
    game.press(1, ball.x, ball.y);
    const before = events.length;
    // Drag it into the mat and hold it there, moving a little, for a second.
    for (let i = 0; i < 60; i++) {
      game.drag(1, ball.x + (i % 2), game.floorY + 40);
      game.update(1 / 60);
    }
    const bounces = events.slice(before).filter((e) => e.type === 'bounce');
    expect(bounces.length).toBeLessThanOrEqual(3);
    expect(ball.y).toBeLessThanOrEqual(game.floorY - ball.r + 0.01);
    game.release(1);
  });

  it('bounce sounds are spaced out, even when a pile of balls is stirred', () => {
    const { game, events } = makeRoom('2+');
    settle(game);
    for (const ball of game.balls) {
      ball.x = W / 2 + (ball.id % 3) * 5;
      ball.y = game.floorY - ball.r * (1 + (ball.id % 4));
      ball.vy = -400;
    }
    const before = events.length;
    advance(game, 2);
    const bounces = events.slice(before).filter((e) => e.type === 'bounce').length;
    expect(bounces).toBeLessThanOrEqual(2 / 0.05 + 1);
  });

  it('the balls feel the phone: a tilt read from the sensor rolls them, and a sideways jerk throws them', () => {
    const { game } = makeRoom();
    settle(game);
    // Right side held down: the reaction to gravity leans to the left of the screen.
    game.setMotion(-5, 8.4);
    advance(game, 2.5);
    expect(game.tilt).toBeGreaterThan(0.3);
    expect(Math.max(...game.balls.map((ball) => ball.x))).toBeGreaterThan(W - game.ballR * 1.6);
    // Level again, then a hard jerk of the phone to the right: the balls are thrown to the left.
    game.setMotion(0, 9.8);
    advance(game, 2);
    const xs = game.balls.map((ball) => ball.x);
    game.setMotion(25, 9.8);
    advance(game, 0.25);
    game.setMotion(0, 9.8);
    advance(game, 0.3);
    expect(game.balls.some((ball, i) => ball.x < xs[i] - 20)).toBe(true);
    // Lying flat says nothing about down: the last "down" stays and the balls rest.
    game.setMotion(0, 0);
    advance(game, 2);
    expect(game.balls.every((ball) => ball.resting)).toBe(true);
  });

  it('tilting the phone rolls the balls down to the low side', () => {
    const { game } = makeRoom();
    settle(game);
    const before = game.balls.map((ball) => ball.x);
    game.setTilt(0.4);
    advance(game, 2.5);
    expect(game.tilt).toBeGreaterThan(0.3);
    for (let i = 0; i < game.balls.length; i++) expect(game.balls[i].x).toBeGreaterThan(before[i] - 1);
    expect(Math.max(...game.balls.map((ball) => ball.x))).toBeGreaterThan(W - game.ballR * 1.6);
  });

  it('balls bump into each other instead of passing through', () => {
    const { game } = makeRoom('2+');
    settle(game);
    advance(game, 2);
    for (let i = 0; i < game.balls.length; i++) {
      for (let j = i + 1; j < game.balls.length; j++) {
        const a = game.balls[i];
        const b = game.balls[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan((a.r + b.r) * 0.9);
      }
    }
  });

  it('a ball hops by itself now and then: seldom for the youngest, more often from 1 year', () => {
    const { game: young, events: youngEvents } = makeRoom('8-12');
    settle(young);
    const before = youngEvents.length;
    advance(young, 10);
    expect(youngEvents.slice(before).filter((e) => e.type === 'jump')).toHaveLength(0);
    advance(young, 20);
    expect(youngEvents.slice(before).filter((e) => e.type === 'jump').length).toBeGreaterThanOrEqual(1);
    const { game: older, events: olderEvents } = makeRoom('1-2');
    settle(older);
    advance(older, 40);
    expect(olderEvents.some((e) => e.type === 'jump')).toBe(true);
  });

  it('celebrates every tenth ball touched, and keeps sparkles under the cap', () => {
    const { game, events } = makeRoom('2+');
    settle(game);
    for (let i = 0; i < CELEBRATE_EVERY; i++) {
      settle(game);
      const ball = game.balls[i % game.balls.length];
      tap(game, ball.x, ball.y, 10 + i);
    }
    expect(events.filter((e) => e.type === 'celebration')).toHaveLength(1);
    for (let i = 0; i < 100; i++) game.press(100 + i, W / 2, 50);
    expect(game.sparkles.length).toBeLessThanOrEqual(MAX_SPARKLES);
  });

  it('sleeps: the balls rest, touches only twinkle, no hops or shakes; and wakes again', () => {
    const { game, events } = makeRoom('1-2');
    settle(game);
    game.sleep();
    advance(game, 3);
    expect(game.dusk).toBeGreaterThan(0.3);
    const before = events.length;
    const ball = game.balls[0];
    game.press(1, ball.x, ball.y);
    game.shake();
    expect(events.slice(before).every((e) => e.type === 'sparkle')).toBe(true);
    expect(ball.heldBy).toBeNull();
    game.wake();
    advance(game, 4);
    expect(game.dusk).toBe(0);
    tap(game, ball.x, ball.y, 2);
    expect(events[events.length - 1].type).toBe('jump');
  });
});
