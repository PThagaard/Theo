import { DEFAULT_AGE, type Age, AGE_PROFILES } from '../../engine/age';
import { Rng, TAU, clamp } from '../../engine/rng';

/**
 * "Lys": a dark night where every touch makes light. A tap lights a star where the finger lands (a soft bell,
 * higher up the screen higher in pitch), and stars near each other join into a constellation; a finger drawn
 * across the sky leaves stardust; a finger that stays still kindles a paper lantern that grows in the hand and
 * floats up when let go, swaying, now and then with a family face inside; the lamps on the hill and the window
 * of the house are switches (on with a touch, off with the next, or by themselves after a while); the moon wakes
 * up and hums when touched; a shake sends a shooting star across, and every star twinkles in turn. Light on dark
 * is the contrast babies see best, every light answers at once and fades slowly, so the night never fills up and
 * nothing flashes. For the youngest nothing happens by itself; from one year fireflies wander, and from two a
 * shooting star comes by now and then. Pure logic: no DOM, no canvas, no audio.
 */

export interface Light {
  id: number;
  x: number;
  y: number;
  /** Seconds left before it goes out, and how long it started with. */
  life: number;
  maxLife: number;
  /** 0..1: comes on quickly, goes out slowly with the last of its life. */
  brightness: number;
  /** A flare after a touch (1..0). */
  twinkle: number;
  /** A twinkle waiting to happen (a shake runs a wave across the sky), in seconds; 0 = none. */
  twinkleIn: number;
  /** Which colour of the palette (render.ts), and a little variation in size. */
  color: number;
  size: number;
  /** The lit star it joined into a constellation (its id), or -1. */
  linkId: number;
  lastFlare: number;
}

export interface Lantern {
  id: number;
  x: number;
  y: number;
  /** 0..1: grows in the hand while held, then full size. */
  size: number;
  /** The pointer carrying it, or null once it floats free. */
  held: number | null;
  vx: number;
  vy: number;
  /** Phase of its swaying (render.ts draws the sway). */
  sway: number;
  /** A brighter glow after a touch (1..0). */
  pulse: number;
  color: number;
  photoId?: string;
  /** Seconds since it was let go. */
  age: number;
  lastPush: number;
}

export interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

/** A lamp post on the hill: a switch. */
export interface Lamp {
  x: number;
  baseY: number;
  headY: number;
  on: boolean;
  /** 0..1, the light easing on and off (quickly by a touch, slowly by itself). */
  lit: number;
  since: number;
  fadeRate: number;
}

/** The little house on the hill: its window is a switch too. */
export interface House {
  x: number;
  baseY: number;
  width: number;
  height: number;
  windowX: number;
  windowY: number;
  windowSize: number;
  on: boolean;
  lit: number;
  since: number;
  fadeRate: number;
  /** A puff of smoke from the chimney when the light comes on (1..0). */
  puff: number;
}

export interface Moon {
  x: number;
  y: number;
  r: number;
  /** Seconds it stays awake (eyes open) after a touch. */
  awake: number;
  /** A soft brightening after a touch (1..0), never more than three times a second. */
  bloom: number;
  lastBloom: number;
  blooms: number;
}

export interface Firefly {
  x: number;
  y: number;
  angle: number;
  /** Phase of its slow blink. */
  phase: number;
  speed: number;
  /** Zipping away after a touch (1..0). */
  zip: number;
}

export interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  trail: Array<{ x: number; y: number }>;
}

export type LysEvent =
  | { type: 'star'; x: number; y: number; note: number }
  | { type: 'flare'; x: number; y: number }
  | { type: 'trail'; x: number; y: number; note: number; first: boolean }
  | { type: 'lantern'; what: 'lit' | 'rise' | 'tap' | 'push'; x: number; y: number }
  | { type: 'lamp'; on: boolean; x: number; y: number }
  | { type: 'house'; on: boolean; x: number; y: number }
  | { type: 'moon'; x: number; y: number }
  | { type: 'shooting'; by: 'shake' | 'self' }
  | { type: 'firefly'; x: number; y: number }
  | { type: 'shake' }
  | { type: 'celebration'; x: number; y: number }
  | { type: 'photo'; photoId: string; x: number; y: number }
  | { type: 'sparkle'; x: number; y: number };

/** Lit stars at once: few for the youngest, so the night stays a night. */
export const MAX_LIGHTS: Record<Age, number> = { '8-12': 10, '1-2': 16, '2+': 24 };
/** How long a star stays lit: longer for the youngest, who looks longer at each thing. */
export const LIGHT_LIFE: Record<Age, number> = { '8-12': 12, '1-2': 10, '2+': 8 };
export const MAX_LANTERNS: Record<Age, number> = { '8-12': 3, '1-2': 5, '2+': 6 };
/** Fireflies wander by themselves: none for the youngest (nothing happens without a touch). */
export const FIREFLIES: Record<Age, number> = { '8-12': 0, '1-2': 2, '2+': 4 };
/** A shooting star by itself, about this often; never for the little ones. */
export const SHOOT_EVERY: Record<Age, number> = { '8-12': Infinity, '1-2': Infinity, '2+': 45 };
/** A finger still this long kindles a lantern; it reaches full size after HOLD_GROW seconds more. */
export const HOLD_START = 0.35;
export const HOLD_GROW = 1.4;
/** Stars closer than this (times unit) join into a constellation. */
export const LINK_DISTANCE = 150;
/** A lamp or the window switched on goes out by itself after this long. */
export const LAMP_STAY = 25;
export const LAMPS = 3;
export const MAX_SPARKLES = 160;
export const CELEBRATE_EVERY = 10;
/** Every third lantern carries a family face, when there are photos. */
export const PHOTO_EVERY = 3;
export const MOON_AWAKE = 6;
/** The moon brightens at most this often: three times a second is the limit for big flat areas. */
export const BLOOM_INTERVAL = 0.34;
export const LIGHT_COLORS = 5;
export const LANTERN_COLORS = 3;
const SHAKE_COOLDOWN = 0.6;
/** Movement (times unit) before a press counts as drawing rather than holding. */
const DRAG_TOLERANCE = 12;
/** Stardust every so many units of movement, and a trail note at most this often. */
const TRAIL_STEP = 9;
const TRAIL_SOUND_GAP = 0.12;
const FLARE_GAP = 0.5;
const PUSH_GAP = 0.4;
/** The last seconds of a star's life fade it out. */
const LIGHT_FADE = 2.5;
const SLEEP_TIME = 8;
const WAKE_TIME = 2.5;

interface PointerState {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** Seconds it has stayed still, and whether it has moved enough to be drawing. */
  still: number;
  moved: boolean;
  /** The star it lit on landing (absorbed if a lantern kindles), or -1. */
  lightId: number;
  /** The lantern it carries, or null. */
  lantern: number | null;
  /** Movement since the last stardust, time of the last trail note, whether a trail note has sounded. */
  since: number;
  lastTrailSound: number;
  trailed: boolean;
}

/** The hill's silhouette under x: gentle rolling ground the lamps and the house stand on (render.ts draws it). */
export function groundY(x: number, width: number, horizon: number, u: number): number {
  const t = x / Math.max(1, width);
  return horizon - (Math.sin(t * Math.PI * 1.3 + 0.4) * 0.5 + 0.5) * 22 * u - Math.sin(t * 7.1) * 6 * u;
}

export class LysGame {
  width = 1;
  height = 1;
  time = 0;
  lights: Light[] = [];
  lanterns: Lantern[] = [];
  sparkles: Sparkle[] = [];
  lamps: Lamp[] = [];
  fireflies: Firefly[] = [];
  house: House;
  moon: Moon;
  shooting: ShootingStar | null = null;
  /** Stars lit, lanterns sent up, shakes and celebrations, all told. */
  lit = 0;
  lanternsSent = 0;
  shakes = 0;
  celebrations = 0;
  /** Sideways drift from the phone's tilt (pixels per second). */
  wind = 0;
  asleep = false;
  dusk = 0;
  private age: Age = DEFAULT_AGE;
  private photoIds: string[] = [];
  private nextId = 1;
  private kindled = 0;
  private lastShake = -Infinity;
  private shootTimer = Infinity;
  private readonly rng: Rng;
  private readonly pointers = new Map<number, PointerState>();
  private readonly listeners: Array<(event: LysEvent) => void> = [];

  constructor(seed = Date.now()) {
    this.rng = new Rng(seed);
    this.house = { x: 0, baseY: 0, width: 1, height: 1, windowX: 0, windowY: 0, windowSize: 1, on: false, lit: 0, since: -Infinity, fadeRate: 6, puff: 0 };
    this.moon = { x: 0, y: 0, r: 1, awake: 0, bloom: 0, lastBloom: -Infinity, blooms: 0 };
    this.layout();
  }

  onEvent(listener: (event: LysEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: LysEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // ---- Settings and layout ---------------------------------------------------------

  resize(width: number, height: number): void {
    const fx = width / this.width;
    const fy = height / this.height;
    this.width = width;
    this.height = height;
    // Everything in the sky keeps its place on the screen.
    for (const light of this.lights) {
      light.x *= fx;
      light.y *= fy;
    }
    for (const lantern of this.lanterns) {
      lantern.x *= fx;
      lantern.y *= fy;
    }
    for (const firefly of this.fireflies) {
      firefly.x *= fx;
      firefly.y *= fy;
    }
    this.sparkles = [];
    this.layout();
  }

  setAge(age: Age): void {
    if (age === this.age) return;
    this.age = age;
    this.layout();
    this.shootTimer = this.nextShoot();
  }

  get currentAge(): Age {
    return this.age;
  }

  /** The family rides up in the lanterns, one face at a time. */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
  }

  /** The phone's roll: the lanterns and the stardust drift towards the low side, like a soft wind. */
  setTilt(roll: number): void {
    this.wind = Math.sin(clamp(roll, -0.6, 0.6)) * 50 * this.unit;
  }

  get unit(): number {
    return Math.max(0.5, Math.min(this.width, this.height) / 400);
  }

  /** Where the hill meets the sky, roughly; the ground itself rolls a little (groundY). */
  get horizonY(): number {
    return this.height * 0.8;
  }

  ground(x: number): number {
    return groundY(x, this.width, this.horizonY, this.unit);
  }

  private layout(): void {
    const u = this.unit;
    const w = this.width;
    this.lamps = [0.13, 0.4, 0.88].map((fraction, i) => {
      const old = this.lamps[i];
      const x = w * fraction;
      const baseY = this.ground(x);
      return { x, baseY, headY: baseY - 64 * u, on: old?.on ?? false, lit: old?.lit ?? 0, since: old?.since ?? -Infinity, fadeRate: old?.fadeRate ?? 6 };
    });
    const house = this.house;
    house.x = w * 0.64;
    house.baseY = this.ground(house.x) + 4 * u;
    house.width = 96 * u;
    house.height = 58 * u;
    house.windowSize = 22 * u;
    house.windowX = house.x + 14 * u;
    house.windowY = house.baseY - 34 * u;
    const moon = this.moon;
    moon.r = Math.min(34 * u, w * 0.08);
    moon.x = w - moon.r * 2.4;
    moon.y = Math.max(moon.r * 1.5, this.height * 0.2);
    const wanted = FIREFLIES[this.age];
    while (this.fireflies.length > wanted) this.fireflies.pop();
    while (this.fireflies.length < wanted) this.fireflies.push(this.newFirefly());
  }

  private newFirefly(): Firefly {
    return {
      x: this.rng.range(this.width * 0.1, this.width * 0.7),
      y: this.rng.range(this.height * 0.15, this.horizonY - 50 * this.unit),
      angle: this.rng.range(0, TAU),
      phase: this.rng.range(0, TAU),
      speed: 22 * this.unit,
      zip: 0,
    };
  }

  private get profile() {
    return AGE_PROFILES[this.age];
  }

  private nextShoot(): number {
    const every = SHOOT_EVERY[this.age];
    return Number.isFinite(every) ? every * this.rng.range(0.8, 1.2) : Infinity;
  }

  /** Which bell a touch at this height rings: 0 at the bottom of the screen, 7 at the top. */
  noteAt(y: number): number {
    return clamp(Math.round((1 - y / Math.max(1, this.height)) * 7), 0, 7);
  }

  // ---- Touch -----------------------------------------------------------------------

  press(id: number, x: number, y: number): void {
    const u = this.unit;
    if (this.asleep) {
      this.addSparkles(x, y, 4, 0);
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    const pointer: PointerState = { id, x, y, startX: x, startY: y, lastX: x, lastY: y, still: 0, moved: false, lightId: -1, lantern: null, since: 0, lastTrailSound: -Infinity, trailed: false };
    this.pointers.set(id, pointer);
    // Big, forgiving targets (1.6 times the thing), the moon and the switches first, then the things in the air.
    const moon = this.moon;
    if (Math.hypot(x - moon.x, y - moon.y) <= moon.r * 1.6) {
      this.touchMoon();
      return;
    }
    for (const lamp of this.lamps) {
      if (Math.hypot(x - lamp.x, y - lamp.headY) <= 28 * u * 1.6) {
        this.toggleLamp(lamp);
        return;
      }
    }
    const house = this.house;
    if (Math.abs(x - house.x) <= house.width * 0.8 && y >= house.baseY - house.height * 1.9 && y <= house.baseY + 10 * u) {
      this.toggleHouse();
      return;
    }
    const lantern = this.lanternAt(x, y);
    if (lantern) {
      // Caught: it glows and comes along with the hand until it is let go again.
      lantern.held = id;
      lantern.pulse = 1;
      lantern.vx = 0;
      lantern.vy = 0;
      pointer.lantern = lantern.id;
      this.emit({ type: 'lantern', what: 'tap', x: lantern.x, y: lantern.y });
      return;
    }
    const firefly = this.fireflyAt(x, y);
    if (firefly) {
      firefly.zip = 1;
      firefly.angle = Math.atan2(firefly.y - y, firefly.x - x) + this.rng.range(-0.5, 0.5);
      this.addSparkles(firefly.x, firefly.y, 3, 4);
      this.emit({ type: 'firefly', x: firefly.x, y: firefly.y });
      return;
    }
    const light = this.lightAt(x, y);
    if (light) {
      this.flare(light);
      pointer.lightId = light.id;
      return;
    }
    pointer.lightId = this.lightStar(x, y);
  }

  drag(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    const u = this.unit;
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    pointer.x = x;
    pointer.y = y;
    if (this.asleep) return;
    if (pointer.lantern !== null) {
      const lantern = this.lanterns.find((l) => l.id === pointer.lantern);
      if (lantern) {
        lantern.x = x;
        lantern.y = y;
      }
      return;
    }
    if (!pointer.moved && Math.hypot(x - pointer.startX, y - pointer.startY) < DRAG_TOLERANCE * u) return;
    pointer.moved = true;
    // Stardust along the way, a soft harp note now and then, and everything on the path answers.
    pointer.since += Math.hypot(dx, dy);
    while (pointer.since >= TRAIL_STEP * u) {
      pointer.since -= TRAIL_STEP * u;
      this.addSparkles(x + this.rng.range(-6, 6) * u, y + this.rng.range(-6, 6) * u, 1, -1, dx, dy);
    }
    if (this.time - pointer.lastTrailSound >= TRAIL_SOUND_GAP) {
      pointer.lastTrailSound = this.time;
      this.emit({ type: 'trail', x, y, note: this.noteAt(y), first: !pointer.trailed });
      pointer.trailed = true;
    }
    for (const light of this.lights) {
      if (light.id !== pointer.lightId && this.time - light.lastFlare >= FLARE_GAP && Math.hypot(light.x - x, light.y - y) <= 30 * u * light.size) this.flare(light);
    }
    for (const lantern of this.lanterns) {
      if (lantern.held === null && this.time - lantern.lastPush >= PUSH_GAP && Math.hypot(lantern.x - x, lantern.y - y) <= 40 * u * lantern.size * 1.4) {
        lantern.lastPush = this.time;
        lantern.vx += Math.sign(dx || 1) * 90 * u;
        lantern.pulse = Math.max(lantern.pulse, 0.6);
        this.emit({ type: 'lantern', what: 'push', x: lantern.x, y: lantern.y });
      }
    }
  }

  release(id: number): void {
    const pointer = this.pointers.get(id);
    this.pointers.delete(id);
    if (!pointer || pointer.lantern === null) return;
    const lantern = this.lanterns.find((l) => l.id === pointer.lantern);
    if (lantern) this.letGo(lantern);
  }

  /** A shake: a shooting star crosses the sky, and every lit star twinkles in a wave after it. */
  shake(): void {
    if (this.asleep || this.time - this.lastShake < SHAKE_COOLDOWN) return;
    this.lastShake = this.time;
    this.shakes++;
    for (const light of this.lights) light.twinkleIn = 0.05 + (light.x / Math.max(1, this.width)) * 0.6;
    this.emit({ type: 'shake' });
    this.shoot('shake');
  }

  sleep(): void {
    this.asleep = true;
    this.pointers.clear();
    for (const lantern of this.lanterns) if (lantern.held !== null) this.letGo(lantern);
    for (const lamp of this.lamps) this.switchOff(lamp);
    this.switchOff(this.house);
    this.moon.awake = 0;
  }

  wake(): void {
    this.asleep = false;
  }

  // ---- The things that answer ----------------------------------------------------

  private lightAt(x: number, y: number): Light | null {
    const u = this.unit;
    let best: Light | null = null;
    let bestDistance = Infinity;
    for (const light of this.lights) {
      const distance = Math.hypot(light.x - x, light.y - y);
      if (distance <= 30 * u * light.size * 1.2 && distance < bestDistance) {
        best = light;
        bestDistance = distance;
      }
    }
    return best;
  }

  lanternAt(x: number, y: number): Lantern | null {
    const u = this.unit;
    let best: Lantern | null = null;
    let bestDistance = Infinity;
    for (const lantern of this.lanterns) {
      if (lantern.held !== null) continue;
      const distance = Math.hypot(lantern.x - x, lantern.y - y);
      if (distance <= 40 * u * Math.max(0.5, lantern.size) * 1.6 && distance < bestDistance) {
        best = lantern;
        bestDistance = distance;
      }
    }
    return best;
  }

  private fireflyAt(x: number, y: number): Firefly | null {
    const u = this.unit;
    for (const firefly of this.fireflies) {
      if (Math.hypot(firefly.x - x, firefly.y - y) <= 30 * u) return firefly;
    }
    return null;
  }

  /** A new star where the finger landed; it joins the nearest lit star into a constellation. */
  private lightStar(x: number, y: number): number {
    const u = this.unit;
    if (this.lights.length >= MAX_LIGHTS[this.age]) this.lights.shift();
    let linkId = -1;
    let nearest = LINK_DISTANCE * u;
    for (const other of this.lights) {
      const distance = Math.hypot(other.x - x, other.y - y);
      // Any star that is not about to go out, however new: two quick taps close together join up too.
      if (other.life > 1 && distance < nearest) {
        nearest = distance;
        linkId = other.id;
      }
    }
    const life = LIGHT_LIFE[this.age];
    const light: Light = { id: this.nextId++, x, y, life, maxLife: life, brightness: 0, twinkle: 1, twinkleIn: 0, color: this.rng.int(0, LIGHT_COLORS - 1), size: this.rng.range(0.85, 1.2), linkId, lastFlare: this.time };
    this.lights.push(light);
    this.lit++;
    this.addSparkles(x, y, 5, light.color);
    this.emit({ type: 'star', x, y, note: this.noteAt(y) });
    if (this.lit % CELEBRATE_EVERY === 0) this.celebrate();
    return light.id;
  }

  private flare(light: Light): void {
    light.twinkle = 1;
    light.lastFlare = this.time;
    light.life = light.maxLife;
    this.addSparkles(light.x, light.y, 4, light.color);
    this.emit({ type: 'flare', x: light.x, y: light.y });
  }

  /** A still finger: the star it lit becomes a lantern in the hand. */
  private kindle(pointer: PointerState): void {
    if (this.lanterns.length >= MAX_LANTERNS[this.age]) return;
    const index = this.lights.findIndex((light) => light.id === pointer.lightId);
    if (index >= 0) this.lights.splice(index, 1);
    pointer.lightId = -1;
    this.kindled++;
    const lantern: Lantern = { id: this.nextId++, x: pointer.x, y: pointer.y, size: 0.15, held: pointer.id, vx: 0, vy: 0, sway: this.rng.range(0, TAU), pulse: 1, color: this.rng.int(0, LANTERN_COLORS - 1), age: 0, lastPush: -Infinity };
    if (this.photoIds.length > 0 && this.kindled % PHOTO_EVERY === 0) {
      lantern.photoId = this.photoIds[(this.kindled / PHOTO_EVERY - 1) % this.photoIds.length];
    }
    this.lanterns.push(lantern);
    pointer.lantern = lantern.id;
    this.emit({ type: 'lantern', what: 'lit', x: pointer.x, y: pointer.y });
  }

  private letGo(lantern: Lantern): void {
    lantern.held = null;
    lantern.age = 0;
    lantern.size = Math.max(lantern.size, 0.5);
    this.lanternsSent++;
    this.emit({ type: 'lantern', what: 'rise', x: lantern.x, y: lantern.y });
    if (lantern.photoId) this.emit({ type: 'photo', photoId: lantern.photoId, x: lantern.x, y: lantern.y });
  }

  private toggleLamp(lamp: Lamp): void {
    lamp.on = !lamp.on;
    lamp.since = this.time;
    lamp.fadeRate = 6;
    if (lamp.on) this.addSparkles(lamp.x, lamp.headY, 5, 1);
    this.emit({ type: 'lamp', on: lamp.on, x: lamp.x, y: lamp.headY });
  }

  private toggleHouse(): void {
    const house = this.house;
    house.on = !house.on;
    house.since = this.time;
    house.fadeRate = 6;
    if (house.on) house.puff = 1;
    this.emit({ type: 'house', on: house.on, x: house.windowX, y: house.windowY });
  }

  private switchOff(thing: Lamp | House): void {
    if (!thing.on) return;
    thing.on = false;
    thing.since = this.time;
    thing.fadeRate = 0.6;
  }

  private touchMoon(): void {
    const moon = this.moon;
    moon.awake = MOON_AWAKE;
    if (this.time - moon.lastBloom >= BLOOM_INTERVAL) {
      moon.bloom = 1;
      moon.lastBloom = this.time;
      moon.blooms++;
    }
    this.addSparkles(moon.x, moon.y, 6, 1);
    this.emit({ type: 'moon', x: moon.x, y: moon.y });
  }

  private celebrate(): void {
    const moon = this.moon;
    this.celebrations++;
    moon.awake = MOON_AWAKE;
    if (this.time - moon.lastBloom >= BLOOM_INTERVAL) {
      moon.bloom = 1;
      moon.lastBloom = this.time;
      moon.blooms++;
    }
    this.addSparkles(moon.x, moon.y, 24, -1);
    this.emit({ type: 'celebration', x: moon.x, y: moon.y });
  }

  private shoot(by: 'shake' | 'self'): void {
    const u = this.unit;
    const fromLeft = this.rng.chance(0.5);
    const seconds = 1.4;
    this.shooting = {
      x: fromLeft ? -20 * u : this.width + 20 * u,
      y: this.height * this.rng.range(0.05, 0.3),
      vx: ((fromLeft ? 1 : -1) * this.width * 0.9) / seconds,
      vy: (this.height * 0.28) / seconds,
      life: seconds,
      trail: [],
    };
    this.emit({ type: 'shooting', by });
  }

  private addSparkles(x: number, y: number, count: number, color: number, dx = 0, dy = 0): void {
    const u = this.unit;
    for (let i = 0; i < count; i++) {
      if (this.sparkles.length >= MAX_SPARKLES) this.sparkles.shift();
      const angle = this.rng.range(0, TAU);
      const speed = this.rng.range(8, 40) * u;
      const maxLife = this.rng.range(0.7, 1.4);
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(angle) * speed - dx * 0.4,
        vy: Math.sin(angle) * speed - dy * 0.4 - 10 * u,
        life: maxLife,
        maxLife,
        color: color < 0 ? this.rng.int(0, LIGHT_COLORS - 1) : color,
        size: this.rng.range(0.7, 1.4),
      });
    }
  }

  // ---- Time ------------------------------------------------------------------------

  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const u = this.unit;
    this.dusk = this.asleep ? Math.min(1, this.dusk + dt / SLEEP_TIME) : Math.max(0, this.dusk - dt / WAKE_TIME);
    // A finger that stays still kindles a lantern.
    for (const pointer of this.pointers.values()) {
      if (pointer.moved || pointer.lantern !== null) continue;
      pointer.still += dt;
      if (pointer.still >= HOLD_START) this.kindle(pointer);
    }
    // Stars: on quickly, out slowly; faster while the world sleeps.
    const drain = this.asleep ? 4 : 1;
    for (const light of this.lights) {
      light.life -= dt * drain;
      const target = light.life < LIGHT_FADE ? Math.max(0, light.life / LIGHT_FADE) : 1;
      light.brightness += (target - light.brightness) * Math.min(1, dt * (target > light.brightness ? 8 : 3));
      if (light.twinkleIn > 0) {
        light.twinkleIn -= dt;
        if (light.twinkleIn <= 0) {
          light.twinkleIn = 0;
          light.twinkle = 1;
          this.addSparkles(light.x, light.y, 2, light.color);
        }
      }
      light.twinkle = Math.max(0, light.twinkle - dt / 0.6);
    }
    this.lights = this.lights.filter((light) => light.life > 0);
    // Lanterns: grow in the hand, then float up, swaying, pushed by the wind.
    const rise = this.height * 0.07 * this.profile.speed;
    for (const lantern of this.lanterns) {
      lantern.pulse = Math.max(0, lantern.pulse - dt / 0.8);
      lantern.sway += dt * 1.2;
      if (lantern.held !== null) {
        lantern.size = Math.min(1, lantern.size + dt / HOLD_GROW);
        continue;
      }
      lantern.age += dt;
      lantern.size = Math.min(1, lantern.size + dt / HOLD_GROW);
      lantern.vy += (-rise - lantern.vy) * Math.min(1, dt * 1.5);
      lantern.vx *= Math.max(0, 1 - 1.5 * dt);
      lantern.x += (lantern.vx + this.wind) * dt;
      lantern.y += lantern.vy * dt;
      lantern.x = clamp(lantern.x, 20 * u, this.width - 20 * u);
    }
    this.lanterns = this.lanterns.filter((lantern) => lantern.y > -60 * u);
    // Stardust drifts and fades.
    for (const sparkle of this.sparkles) {
      sparkle.life -= dt;
      sparkle.vx *= Math.max(0, 1 - 2 * dt);
      sparkle.vy *= Math.max(0, 1 - 2 * dt);
      sparkle.x += (sparkle.vx + this.wind * 0.5) * dt;
      sparkle.y += sparkle.vy * dt;
    }
    this.sparkles = this.sparkles.filter((sparkle) => sparkle.life > 0);
    // The switches ease on and off, and go out by themselves after a while.
    for (const lamp of this.lamps) this.updateSwitch(lamp, dt);
    this.updateSwitch(this.house, dt);
    this.house.puff = Math.max(0, this.house.puff - dt / 2.5);
    // The moon.
    const moon = this.moon;
    moon.awake = Math.max(0, moon.awake - dt);
    moon.bloom = Math.max(0, moon.bloom - dt / 0.6);
    // Fireflies wander (older profiles only); a touched one zips off.
    for (const firefly of this.fireflies) {
      firefly.phase += dt * TAU * 0.7;
      firefly.angle += this.rng.range(-1.8, 1.8) * dt;
      const speed = firefly.speed * (1 + firefly.zip * 5);
      firefly.zip = Math.max(0, firefly.zip - dt / 0.7);
      firefly.x += Math.cos(firefly.angle) * speed * dt;
      firefly.y += Math.sin(firefly.angle) * speed * dt;
      const top = this.height * 0.08;
      const bottom = this.horizonY - 30 * u;
      if (firefly.x < 20 * u) firefly.angle = this.rng.range(-0.8, 0.8);
      if (firefly.x > this.width - 20 * u) firefly.angle = Math.PI + this.rng.range(-0.8, 0.8);
      if (firefly.y < top) firefly.angle = Math.PI / 2 + this.rng.range(-0.8, 0.8);
      if (firefly.y > bottom) firefly.angle = -Math.PI / 2 + this.rng.range(-0.8, 0.8);
      firefly.x = clamp(firefly.x, 10 * u, this.width - 10 * u);
      firefly.y = clamp(firefly.y, top - 10 * u, bottom + 10 * u);
    }
    // The shooting star.
    const shooting = this.shooting;
    if (shooting) {
      shooting.life -= dt;
      shooting.x += shooting.vx * dt;
      shooting.y += shooting.vy * dt;
      shooting.trail.push({ x: shooting.x, y: shooting.y });
      if (shooting.trail.length > 16) shooting.trail.shift();
      if (shooting.life <= 0) this.shooting = null;
    }
    if (!this.asleep && Number.isFinite(this.shootTimer)) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = this.nextShoot();
        if (!this.shooting) this.shoot('self');
      }
    }
  }

  private updateSwitch(thing: Lamp | House, dt: number): void {
    if (thing.on && this.time - thing.since > LAMP_STAY) this.switchOff(thing);
    const target = thing.on ? 1 : 0;
    thing.lit += (target - thing.lit) * Math.min(1, dt * thing.fadeRate);
    if (Math.abs(thing.lit - target) < 0.002) thing.lit = target;
  }
}
