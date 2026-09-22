import { AGE_PROFILES, DEFAULT_AGE, type Age, type AgeProfile } from '../../engine/age';
import { Rng, clamp } from '../../engine/rng';

/**
 * "Bolde": a playroom with a few big, soft balls with faces. They bounce and roll and never leave the screen.
 * Touch a ball and it squashes and looks glad; let go quickly and it hops; keep the finger on it and it follows
 * the hand, and flies off the way the hand throws it. Tap the floor and it bounces the balls near the hand like
 * a trampoline; a swipe pushes the balls it passes; a shake makes every ball jump; turn the phone and the balls
 * roll down to the low side. Grabbing, letting go and throwing is what 8–12 months is about, and following a
 * ball with the eyes and guessing where it lands comes right after. Few, big and slow balls for the youngest,
 * and nothing happens by itself; from 1 year a ball hops on its own now and then. Pure logic: no DOM, no canvas,
 * no audio.
 */

export interface Ball {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  /** Which of the ball colours it wears (render.ts). */
  color: number;
  /** A family face on the ball instead of a drawn one. */
  photoId?: string;
  /** How squashed it is (0..1, springing back) and from which direction (radians). */
  squash: number;
  squashAngle: number;
  /** The pattern's rolling angle (radians). */
  angle: number;
  /** Seconds left of the glad face after a touch or a bounce. */
  happy: number;
  /** The finger holding it, or null. */
  heldBy: number | null;
  /** Sitting on the floor. */
  resting: boolean;
  /** When a swipe last pushed it (so one swipe pushes once). */
  lastPush: number;
  /** When it last made a bounce sound (a ball in a pile must not rattle the speaker). */
  lastSound: number;
}

export interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
}

/** The floor's trampoline bulge where it was tapped, fading. */
export interface Bump {
  x: number;
  age: number;
}

export type BoldeEvent =
  | { type: 'tap'; x: number; y: number; size: number }
  | { type: 'jump'; x: number; y: number }
  | { type: 'throw'; x: number; y: number; speed: number }
  | { type: 'bounce'; x: number; y: number; size: number; strength: number }
  | { type: 'floor'; x: number; y: number }
  | { type: 'push'; x: number; y: number }
  | { type: 'shake' }
  | { type: 'celebration' }
  | { type: 'sparkle'; x: number; y: number }
  | { type: 'photo'; photoId: string; x: number; y: number };

/** How many balls, and how big (share of the shorter screen side): few and big for the youngest. */
export const BALLS: Record<Age, number> = { '8-12': 3, '1-2': 5, '2+': 6 };
const BALL_SIZE: Record<Age, number> = { '8-12': 0.11, '1-2': 0.085, '2+': 0.075 };
/** Now and then a ball hops by itself, from 1 year; never for the youngest. */
export const NUDGE_EVERY: Record<Age, number> = { '8-12': 24, '1-2': 12, '2+': 8 };
export const MAX_BALLS = 6;
export const MAX_SPARKLES = 120;
/** The floor mat takes this share of the screen height. */
const FLOOR_SHARE = 0.11;
/** Soft foam balls: they bounce a few times and settle within a few seconds, so the room is calm between touches. */
const RESTITUTION_FLOOR = 0.6;
const RESTITUTION_WALL = 0.8;
const RESTITUTION_BALL = 0.85;
/** A press-and-release shorter and stiller than this is a tap (the ball hops); longer is a hold or a throw. */
export const TAP_MAX_SECONDS = 0.25;
const TAP_MAX_MOVE = 18;
/** Impacts softer than this share of the reference speed make no sound, so resting balls stay quiet. */
const SOUND_STRENGTH = 0.22;
export const CELEBRATE_EVERY = 10;
const MAX_TILT = 0.45;
const SHAKE_COOLDOWN = 0.5;
/** Gravity as the phone reports it: a jerk of the phone pushes the balls like extra gravity, up to this much of it. */
const MAX_DOWN = 2.5;
/** The least time between two bounce sounds from one ball, and between any two at all. */
const BALL_SOUND_GAP = 0.15;
const SOUND_GAP = 0.05;
const SLEEP_TIME = 8;
const WAKE_TIME = 2.5;

interface PointerState {
  id: number;
  x: number;
  y: number;
  downX: number;
  downY: number;
  downTime: number;
  ball: Ball | null;
  /** The finger's speed lately, for the throw. */
  vx: number;
  vy: number;
  lastX: number;
  lastY: number;
  lastTime: number;
}

export class BoldeGame {
  width = 1;
  height = 1;
  time = 0;
  balls: Ball[] = [];
  sparkles: Sparkle[] = [];
  bumps: Bump[] = [];
  taps = 0;
  throws = 0;
  bounces = 0;
  pushes = 0;
  floorTaps = 0;
  shakes = 0;
  asleep = false;
  dusk = 0;
  /** The room's slope (radians) as the phone is tilted: where it is, and where the phone says it should be. */
  tilt = 0;
  private tiltTarget = 0;
  private tiltSpeed = 0;
  /**
   * Which way is down for the balls, in screen coordinates, 1 = plain gravity: from the phone's own motion, so a
   * tilt rolls them, a jerk throws them and a shake jiggles them, the way real balls in a box behave.
   */
  private downX = 0;
  private downY = 1;
  private downTargetX = 0;
  private downTargetY = 1;
  private lastBounceSound = -Infinity;
  /** Seconds since the last celebration (a very long time before the first one). */
  sinceCelebration = 1e9;
  private age: Age = DEFAULT_AGE;
  private photoIds: string[] = [];
  private lastShake = -Infinity;
  private nudgeTimer = NUDGE_EVERY[DEFAULT_AGE];
  private nextId = 1;
  private readonly rng: Rng;
  private readonly pointers = new Map<number, PointerState>();
  private readonly listeners: Array<(event: BoldeEvent) => void> = [];

  constructor(seed = Date.now()) {
    this.rng = new Rng(seed);
    this.ensureBalls();
  }

  onEvent(listener: (event: BoldeEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: BoldeEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // ---- Settings and geometry ----------------------------------------------------

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const ball of this.balls) {
      ball.r = this.ballR;
      ball.x = clamp(ball.x, ball.r, Math.max(ball.r, width - ball.r));
      ball.y = Math.min(ball.y, this.floorY - ball.r);
    }
    this.ensureBalls();
  }

  setAge(age: Age): void {
    if (age === this.age) return;
    this.age = age;
    this.nudgeTimer = NUDGE_EVERY[age];
    for (const ball of this.balls) ball.r = this.ballR;
    this.ensureBalls();
  }

  get currentAge(): Age {
    return this.age;
  }

  get profile(): AgeProfile {
    return AGE_PROFILES[this.age];
  }

  /** The family rides on the balls: one face per ball, as far as the photos go. */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
    this.assignPhotos();
  }

  private assignPhotos(): void {
    this.balls.forEach((ball, i) => {
      ball.photoId = this.photoIds[i];
    });
  }

  get unit(): number {
    return Math.max(0.5, Math.min(this.width, this.height) / 400);
  }

  /** The top of the floor mat. */
  get floorY(): number {
    return this.height * (1 - FLOOR_SHARE);
  }

  get ballR(): number {
    return Math.min(this.width, this.height) * BALL_SIZE[this.age];
  }

  /** Gravity (px/s²): a ball dropped from the top lands in a little over a second; slower for the youngest. */
  get gravity(): number {
    return this.height * 1.5 * this.profile.speed;
  }

  /** The speed a hop starts with (up to about half the screen), and the speed of a fall over half the screen. */
  get jumpSpeed(): number {
    return Math.sqrt(2 * this.gravity * this.height * 0.45);
  }

  private get referenceSpeed(): number {
    return Math.sqrt(2 * this.gravity * this.height * 0.5);
  }

  /** Keeps the number of balls the age asks for; new ones drop in from above, one after another. */
  private ensureBalls(): void {
    const wanted = BALLS[this.age];
    while (this.balls.length > wanted) {
      const gone = this.balls.pop();
      for (const pointer of this.pointers.values()) if (pointer.ball === gone) pointer.ball = null;
    }
    let k = 0;
    while (this.balls.length < wanted) {
      const r = this.ballR;
      const i = this.balls.length;
      this.balls.push({
        id: this.nextId++,
        x: clamp(((i + 0.5) / wanted) * this.width + this.rng.range(-0.3, 0.3) * r, r, this.width - r),
        y: -r - k * r * 2.5,
        r,
        vx: this.rng.range(-20, 20) * this.unit,
        vy: 0,
        color: i % 8,
        squash: 0,
        squashAngle: 0,
        angle: this.rng.range(0, Math.PI * 2),
        happy: 0,
        heldBy: null,
        resting: false,
        lastPush: -Infinity,
        lastSound: -Infinity,
      });
      k++;
    }
    this.assignPhotos();
  }

  /** The ball under a hand: generous, a whole hand, not a fingertip. */
  findBallAt(x: number, y: number): Ball | null {
    let best: Ball | null = null;
    let bestDistance = Infinity;
    for (const ball of this.balls) {
      if (ball.heldBy !== null) continue;
      const distance = Math.hypot(x - ball.x, y - ball.y);
      if (distance <= ball.r * 1.7 && distance < bestDistance) {
        bestDistance = distance;
        best = ball;
      }
    }
    return best;
  }

  // ---- Touch --------------------------------------------------------------------

  press(id: number, x: number, y: number): void {
    if (this.asleep) {
      this.addSparkles(x, y, 3, 0);
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    const u = this.unit;
    const pointer: PointerState = { id, x, y, downX: x, downY: y, downTime: this.time, ball: null, vx: 0, vy: 0, lastX: x, lastY: y, lastTime: this.time };
    this.pointers.set(id, pointer);
    const ball = this.findBallAt(x, y);
    if (ball) {
      // Caught: it squashes towards the hand, looks glad, and follows the hand until it is let go.
      ball.heldBy = id;
      pointer.ball = ball;
      ball.squash = 1;
      ball.squashAngle = Math.atan2(y - ball.y, x - ball.x);
      ball.happy = 0.9;
      this.taps++;
      this.addSparkles(ball.x, ball.y - ball.r, 6, ball.color);
      this.emit({ type: 'tap', x: ball.x, y: ball.y, size: ball.r / this.ballR });
      if (ball.photoId) this.emit({ type: 'photo', photoId: ball.photoId, x: ball.x, y: ball.y });
      if (this.taps % CELEBRATE_EVERY === 0) this.celebrate();
      return;
    }
    if (y >= this.floorY - 30 * u) {
      // The floor is a trampoline: the balls near the hand bounce up.
      this.bumps.push({ x, age: 0 });
      if (this.bumps.length > 8) this.bumps.shift();
      for (const other of this.balls) {
        if (other.heldBy !== null) continue;
        const reach = 170 * u;
        const distance = Math.abs(other.x - x);
        if (distance < reach && other.y > this.floorY - other.r * 3) {
          other.vy = Math.min(other.vy, -this.jumpSpeed * (0.35 + 0.45 * (1 - distance / reach)));
          other.vx += Math.sign(other.x - x || 1) * 40 * u;
          other.happy = 0.8;
        }
      }
      this.floorTaps++;
      this.emit({ type: 'floor', x, y });
      return;
    }
    // The air: a puff of sparkles, so there is no dead spot anywhere.
    this.addSparkles(x, y, 5, 0);
    this.emit({ type: 'sparkle', x, y });
  }

  drag(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    const u = this.unit;
    const seconds = Math.max(1 / 120, this.time - pointer.lastTime);
    pointer.vx = pointer.vx * 0.5 + ((x - pointer.lastX) / seconds) * 0.5;
    pointer.vy = pointer.vy * 0.5 + ((y - pointer.lastY) / seconds) * 0.5;
    pointer.lastX = x;
    pointer.lastY = y;
    pointer.lastTime = this.time;
    pointer.x = x;
    pointer.y = y;
    if (this.asleep || pointer.ball) return;
    // A swipe pushes the balls it passes, the way the hand moves.
    for (const ball of this.balls) {
      if (ball.heldBy !== null || this.time - ball.lastPush < 0.2) continue;
      if (Math.hypot(ball.x - x, ball.y - y) > ball.r * 1.6) continue;
      ball.lastPush = this.time;
      ball.vx = clamp(pointer.vx * 0.9, -this.referenceSpeed, this.referenceSpeed);
      ball.vy = clamp(pointer.vy * 0.9, -this.referenceSpeed, this.referenceSpeed) - 60 * u;
      ball.squash = 0.6;
      ball.squashAngle = Math.atan2(y - ball.y, x - ball.x);
      ball.happy = 0.6;
      this.pushes++;
      this.emit({ type: 'push', x: ball.x, y: ball.y });
    }
  }

  release(id: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    this.pointers.delete(id);
    const ball = pointer.ball;
    if (!ball || ball.heldBy !== id) return;
    ball.heldBy = null;
    const u = this.unit;
    const quick = this.time - pointer.downTime < TAP_MAX_SECONDS && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) < TAP_MAX_MOVE * u;
    if (quick) {
      // A tap: the ball hops.
      ball.vy = -this.jumpSpeed;
      ball.vx += this.rng.range(-40, 40) * u;
      this.emit({ type: 'jump', x: ball.x, y: ball.y });
      return;
    }
    // Let go on the move: the ball flies the way the hand went.
    const max = this.referenceSpeed * 1.3;
    ball.vx = clamp(pointer.vx, -max, max);
    ball.vy = clamp(pointer.vy, -max, max);
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 120 * u) {
      this.throws++;
      this.emit({ type: 'throw', x: ball.x, y: ball.y, speed: Math.min(1, speed / max) });
    }
  }

  /** Shaking the phone: every ball jumps, glad, in its own direction. */
  shake(): void {
    if (this.asleep || this.time - this.lastShake < SHAKE_COOLDOWN) return;
    this.lastShake = this.time;
    const u = this.unit;
    for (const ball of this.balls) {
      if (ball.heldBy !== null) continue;
      ball.vy = -this.jumpSpeed * this.rng.range(0.5, 1);
      ball.vx += this.rng.range(-140, 140) * u;
      ball.happy = 1;
      ball.squash = Math.max(ball.squash, 0.5);
    }
    this.shakes++;
    this.emit({ type: 'shake' });
  }

  /** The phone's roll (radians, positive = right side down): the balls roll down to the low side. */
  setTilt(roll: number): void {
    this.tiltTarget = clamp(roll, -MAX_TILT, MAX_TILT);
    this.downTargetX = Math.sin(this.tiltTarget);
    this.downTargetY = Math.cos(this.tiltTarget);
  }

  /**
   * The phone's acceleration in screen coordinates (m/s², gravity included, x right, y up). In the phone's own
   * frame that is what "down" feels like for the balls: a tilt rolls them, a jerk throws them the other way, a
   * shake jiggles them. Lying flat (or in free fall) the reading says nothing, and the last "down" stays.
   */
  setMotion(x: number, y: number): void {
    if (Math.hypot(x, y) < 0.5) return;
    this.downTargetX = clamp(-x / 9.8, -MAX_DOWN, MAX_DOWN);
    this.downTargetY = clamp(y / 9.8, -MAX_DOWN, MAX_DOWN);
    this.tiltTarget = clamp(Math.atan2(-x, Math.max(1, y)), -MAX_TILT, MAX_TILT);
  }

  sleep(): void {
    this.asleep = true;
    for (const ball of this.balls) ball.heldBy = null;
    this.pointers.clear();
  }

  wake(): void {
    this.asleep = false;
  }

  /** Every tenth ball touched: all the balls hop together and sparkles rain. Calm, no flashing. */
  private celebrate(): void {
    this.sinceCelebration = 0;
    const u = this.unit;
    for (const ball of this.balls) {
      if (ball.heldBy !== null) continue;
      ball.vy = -this.jumpSpeed * this.rng.range(0.5, 0.8);
      ball.happy = 1.5;
    }
    for (let i = 0; i < 24; i++) this.addSparkles(this.rng.range(0.1, 0.9) * this.width, this.rng.range(0.1, 0.5) * this.height, 1, i % 8);
    this.emit({ type: 'celebration' });
    void u;
  }

  private addSparkles(x: number, y: number, count: number, color: number): void {
    const u = this.unit;
    for (let i = 0; i < count; i++) {
      if (this.sparkles.length >= MAX_SPARKLES) this.sparkles.shift();
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(40, 160) * u;
      const maxLife = this.rng.range(0.5, 1.1);
      this.sparkles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60 * u, life: maxLife, maxLife, color });
    }
  }

  // ---- Time ---------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    this.sinceCelebration += dt;
    this.dusk = this.asleep ? Math.min(1, this.dusk + dt / SLEEP_TIME) : Math.max(0, this.dusk - dt / WAKE_TIME);
    // The room's slope follows the phone with a soft spring, so it swings a little; "down" follows quickly, so
    // even a short shake reaches the balls.
    const pull = (this.tiltTarget - this.tilt) * 14 - this.tiltSpeed * 3.2;
    this.tiltSpeed += pull * dt;
    this.tilt += this.tiltSpeed * dt;
    const follow = Math.min(1, dt * 14);
    this.downX += (this.downTargetX - this.downX) * follow;
    this.downY += (this.downTargetY - this.downY) * follow;
    // Two small steps keep the bouncing steady even when a frame is late.
    const step = Math.min(dt, 1 / 30) / 2;
    for (let k = 0; k < 2; k++) this.stepPhysics(step);
    // Faces, squashes, sparkles and bumps.
    for (const ball of this.balls) {
      ball.happy = Math.max(0, ball.happy - dt);
      ball.squash = Math.max(0, ball.squash - dt * 5);
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sparkle = this.sparkles[i];
      sparkle.life -= dt;
      sparkle.vy += 240 * this.unit * dt;
      sparkle.x += sparkle.vx * dt;
      sparkle.y += sparkle.vy * dt;
      if (sparkle.life <= 0) this.sparkles.splice(i, 1);
    }
    for (const bump of this.bumps) bump.age += dt;
    this.bumps = this.bumps.filter((bump) => bump.age < 0.6);
    // A ball hops by itself now and then (something to look at): seldom for the youngest, more often for older.
    if (!this.asleep) {
      this.nudgeTimer -= dt;
      if (this.nudgeTimer <= 0) {
        this.nudgeTimer = NUDGE_EVERY[this.age] * this.rng.range(0.8, 1.2);
        const resting = this.balls.filter((ball) => ball.resting && ball.heldBy === null);
        if (resting.length > 0) {
          const ball = this.rng.pick(resting);
          ball.vy = -this.jumpSpeed * 0.7;
          ball.happy = 1;
          this.emit({ type: 'jump', x: ball.x, y: ball.y });
        }
      }
    }
  }

  private stepPhysics(h: number): void {
    const u = this.unit;
    const g = this.gravity;
    const gx = g * this.downX;
    const gy = g * this.downY;
    const floor = this.floorY;
    const reference = this.referenceSpeed;
    for (const ball of this.balls) {
      const pointer = ball.heldBy !== null ? this.pointers.get(ball.heldBy) : undefined;
      if (pointer) {
        // Held: it hurries after the hand and stays inside the room, with no bounces or sounds of its own (a
        // ball pressed against the mat must not rattle the phone).
        ball.vx = (pointer.x - ball.x) * 18;
        ball.vy = (pointer.y - ball.y) * 18;
        ball.x = clamp(ball.x + ball.vx * h, ball.r, Math.max(ball.r, this.width - ball.r));
        ball.y = clamp(ball.y + ball.vy * h, ball.r, Math.max(ball.r, floor - ball.r));
        ball.resting = false;
        ball.angle += (ball.vx / ball.r) * h * 0.4;
        continue;
      }
      ball.vx += gx * h;
      ball.vy += gy * h;
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      // The walls, the ceiling and the floor: the balls never leave the room.
      if (ball.x < ball.r) {
        ball.x = ball.r;
        if (ball.vx < 0) this.bounce(ball, 'x', reference, RESTITUTION_WALL);
      } else if (ball.x > this.width - ball.r) {
        ball.x = this.width - ball.r;
        if (ball.vx > 0) this.bounce(ball, 'x', reference, RESTITUTION_WALL);
      }
      if (ball.y < ball.r) {
        ball.y = ball.r;
        if (ball.vy < 0) ball.vy = -ball.vy * RESTITUTION_WALL;
      }
      ball.resting = false;
      if (ball.y > floor - ball.r) {
        ball.y = floor - ball.r;
        if (ball.vy > 0) this.bounce(ball, 'y', reference, RESTITUTION_FLOOR);
        if (Math.abs(ball.vy) < 60 * u) {
          ball.vy = 0;
          ball.resting = true;
          // Rolling friction, and a rolling pattern.
          ball.vx *= Math.max(0, 1 - 1.6 * h);
        }
      }
      ball.angle += (ball.vx / ball.r) * h * (ball.resting ? 1 : 0.4);
    }
    // Balls bump into each other: they push apart and swap their speed along the line between them.
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i];
        const b = this.balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const minimum = a.r + b.r;
        if (distance >= minimum || distance === 0) continue;
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = minimum - distance;
        const aHeld = a.heldBy !== null;
        const bHeld = b.heldBy !== null;
        if (!aHeld && !bHeld) {
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;
        } else if (aHeld && !bHeld) {
          b.x += nx * overlap;
          b.y += ny * overlap;
        } else if (!aHeld && bHeld) {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
        }
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (approach <= 0) continue;
        const strength = Math.min(1, approach / reference);
        // Equal masses: the speed along the line swaps; a held ball is as good as a wall.
        const impulse = ((1 + RESTITUTION_BALL) * approach) / (aHeld || bHeld ? 1 : 2);
        if (!aHeld) {
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
        }
        if (!bHeld) {
          b.vx += impulse * nx;
          b.vy += impulse * ny;
        }
        for (const ball of [a, b]) {
          ball.squash = Math.max(ball.squash, strength * 0.8);
          ball.squashAngle = ball === a ? Math.atan2(ny, nx) : Math.atan2(-ny, -nx);
          if (strength > 0.3) ball.happy = Math.max(ball.happy, 0.5);
        }
        if (strength > SOUND_STRENGTH && this.maySound(aHeld ? b : a)) {
          this.emit({ type: 'bounce', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, size: (a.r + b.r) / 2 / this.ballR, strength });
        }
      }
    }
    // Pushing apart must never push a ball through a wall or the floor.
    for (const ball of this.balls) {
      ball.x = clamp(ball.x, ball.r, Math.max(ball.r, this.width - ball.r));
      ball.y = clamp(ball.y, ball.r, Math.max(ball.r, floor - ball.r));
    }
  }

  /** A wall or floor bounce: it squashes, and sounds when it is hard enough. */
  private bounce(ball: Ball, axis: 'x' | 'y', reference: number, restitution: number): void {
    const speed = axis === 'x' ? Math.abs(ball.vx) : Math.abs(ball.vy);
    const strength = Math.min(1, speed / reference);
    if (axis === 'x') ball.vx = -ball.vx * restitution;
    else ball.vy = -ball.vy * restitution;
    ball.squash = Math.max(ball.squash, strength);
    ball.squashAngle = axis === 'y' ? Math.PI / 2 : ball.x < this.width / 2 ? Math.PI : 0;
    if (strength > SOUND_STRENGTH && this.maySound(ball)) {
      if (axis === 'y') {
        this.bounces++;
        ball.happy = Math.max(ball.happy, 0.4);
      }
      this.emit({ type: 'bounce', x: ball.x, y: ball.y, size: ball.r / this.ballR, strength });
    }
  }

  /** Whether this ball may make a bounce sound now: not too soon after its last, nor right on top of another's. */
  private maySound(ball: Ball): boolean {
    if (this.time - ball.lastSound < BALL_SOUND_GAP || this.time - this.lastBounceSound < SOUND_GAP) return false;
    ball.lastSound = this.time;
    this.lastBounceSound = this.time;
    return true;
  }
}
