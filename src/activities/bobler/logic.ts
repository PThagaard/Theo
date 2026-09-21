import { AGE_PROFILES, DEFAULT_AGE, type Age, type AgeProfile } from '../../engine/age';
import type { Tempo } from '../../engine/parent';
import { Rng, TAU, clamp } from '../../engine/rng';

/**
 * "Bobler": a bath full of soap bubbles. The same kind of toy as Balloner, because that is what an 8-month-old
 * can use (docs/FORSKNING.md: contingency): every touch answers at once, with movement and sound, and nothing is
 * ever wrong. Tap a bubble and it pops with a wet plop; tap the water and it splashes and sends up new bubbles;
 * a swipe pops what it crosses, leaves a trail of tiny bubbles and makes waves; hold still and a bubble grows
 * under the finger; shake the phone and everything jiggles while a shower of bubbles rises; the rubber ducks
 * quack and spin when touched. Pure logic: no DOM, no canvas, no audio.
 */

export type BubbleKind = 'plain' | 'photo' | 'star';

export interface Bubble {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  /** Phase of the sideways sway and the shape wobble. */
  wobble: number;
  /** Extra wobble after a shake or a push, fading. */
  wobbleAmp: number;
  age: number;
  kind: BubbleKind;
  photoId?: string;
  /** Where on the colour wheel its sheen starts. */
  hue: number;
  /** The finger it is growing under, or null once it floats free. */
  heldBy: number | null;
}

export interface Duck {
  id: number;
  x: number;
  dir: 1 | -1;
  vx: number;
  /** Bobbing offset from the water surface, and its speed (a little spring). */
  bob: number;
  bobV: number;
  /** Seconds since it was touched and started a spin (Infinity when it never was). */
  spinAge: number;
  quackAge: number;
}

export type DropletKind = 'drop' | 'soap' | 'gold' | 'photo';

export interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  kind: DropletKind;
  photoId?: string;
}

/** A wave started by a touch, spreading outwards along the surface and fading. */
export interface Ripple {
  x: number;
  t: number;
  power: number;
}

export type BoblerEvent =
  | { type: 'pop'; x: number; y: number; size: number; kind: BubbleKind; photoId?: string }
  | { type: 'splash'; x: number; y: number; big: boolean }
  | { type: 'quack'; x: number; y: number }
  | { type: 'soap'; x: number; y: number }
  | { type: 'grow'; x: number; y: number }
  | { type: 'blow'; x: number; y: number; size: number }
  | { type: 'burst'; x: number; y: number }
  | { type: 'shake' }
  | { type: 'celebration' }
  | { type: 'swipe' }
  | { type: 'sparkle'; x: number; y: number };

export interface BoblerConfig {
  /** Seconds between bubbles rising by themselves (before tempo and age). */
  spawnInterval: number;
  /** A little celebration happens every N pops. */
  celebrateEvery: number;
}

const DEFAULT_CONFIG: BoblerConfig = { spawnInterval: 2.4, celebrateEvery: 10 };

/** How busy the bath is: how many bubbles, how often they come and how fast they rise (same scale as Balloner). */
const TEMPO: Record<Tempo, { target: number; interval: number; speed: number }> = {
  rolig: { target: 4, interval: 1.5, speed: 0.75 },
  normal: { target: 6, interval: 1, speed: 1 },
  vild: { target: 9, interval: 0.55, speed: 1.35 },
};

export const MAX_BUBBLES = 24;
export const MAX_DROPLETS = 180;
const MAX_RIPPLES = 12;
/** Touch targets are generous: a bubble is hit well outside its rim (a whole hand, not a fingertip). */
const TAP_HIT_FACTOR = 1.6;
const DRAG_HIT_FACTOR = 1.15;
/** A swipe does not pop a bubble that just appeared under the finger. */
const DRAG_MIN_AGE = 0.3;
/** Holding still this long grows a bubble under the finger; moving further than the tolerance ends the hold. */
export const HOLD_START = 0.35;
const HOLD_MOVE_TOLERANCE = 14;
/** Seconds of holding from a tiny bubble to one that bursts. */
export const GROW_TIME = 2.4;
const SHAKE_COOLDOWN = 0.5;
/** Tiny bubbles that rise when the phone is shaken, and at a celebration: fewer for the youngest. */
const SHOWER: Record<Age, number> = { '8-12': 6, '1-2': 10, '2+': 14 };
const CELEBRATION_SHOWER: Record<Age, number> = { '8-12': 8, '1-2': 14, '2+': 18 };
const DUCKS: Record<Age, number> = { '8-12': 1, '1-2': 2, '2+': 2 };
const PHOTO_CHANCE = 0.2;
const STAR_CHANCE = 0.08;
const SLEEP_TIME = 8;
const WAKE_TIME = 2.5;

interface PointerState {
  id: number;
  x: number;
  y: number;
  downX: number;
  downY: number;
  /** Seconds held still, and whether a bubble may grow from this touch. */
  held: number;
  holding: boolean;
  bubble: Bubble | null;
  swiped: boolean;
  travelled: number;
  lastRipple: number;
}

export class BoblerGame {
  width = 1;
  height = 1;
  time = 0;
  readonly config: BoblerConfig;
  bubbles: Bubble[] = [];
  ducks: Duck[] = [];
  droplets: Droplet[] = [];
  ripples: Ripple[] = [];
  pops = 0;
  splashes = 0;
  quacks = 0;
  shakes = 0;
  /** Seconds since the last celebration (a very long time before the first one). */
  sinceCelebration = 1e9;
  spawnTimer = 0.6;
  asleep = false;
  dusk = 0;
  private tempo: Tempo = 'normal';
  private age: Age = DEFAULT_AGE;
  private photoIds: string[] = [];
  private lastShake = -Infinity;
  private nextId = 1;
  private readonly rng: Rng;
  private readonly pointers = new Map<number, PointerState>();
  private readonly listeners: Array<(event: BoblerEvent) => void> = [];

  constructor(config: Partial<BoblerConfig> = {}, seed = Date.now()) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new Rng(seed);
  }

  onEvent(listener: (event: BoblerEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: BoblerEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // ---- Settings -------------------------------------------------------------------

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.ensureDucks();
  }

  setTempo(tempo: Tempo): void {
    const before = TEMPO[this.tempo].speed;
    this.tempo = tempo;
    const factor = TEMPO[tempo].speed / before;
    for (const b of this.bubbles) b.vy *= factor;
    this.spawnTimer = Math.min(this.spawnTimer, this.config.spawnInterval * TEMPO[tempo].interval);
  }

  setAge(age: Age): void {
    this.age = age;
    this.ensureDucks();
  }

  get currentAge(): Age {
    return this.age;
  }

  get profile(): AgeProfile {
    return AGE_PROFILES[this.age];
  }

  /** Family photos drift by inside bubbles now and then. */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
  }

  /** How many bubbles the bath keeps in the air for the current tempo and age. */
  get targetBubbles(): number {
    return Math.max(1, Math.round(TEMPO[this.tempo].target * this.profile.balloons));
  }

  // ---- Geometry -------------------------------------------------------------------

  get unit(): number {
    return Math.max(0.5, Math.min(this.width, this.height) / 400);
  }

  /** The still water line. */
  get waterY(): number {
    return this.height * 0.7;
  }

  /** A typical bubble radius. */
  get baseR(): number {
    return Math.min(this.width, this.height) * 0.075;
  }

  /** A held bubble bursts when it grows this big. */
  get maxHeldR(): number {
    return Math.min(this.width, this.height) * 0.2;
  }

  get duckSize(): number {
    return Math.min(this.width, this.height) * 0.09;
  }

  /** Where the water surface is at `x`: a gentle sway plus the waves that touches have started. */
  surfaceY(x: number): number {
    const u = this.unit;
    let y = this.waterY + Math.sin(x / (60 * u) + this.time * 1.3) * 3 * u;
    for (const ripple of this.ripples) {
      const age = this.time - ripple.t;
      const d = Math.abs(x - ripple.x) - age * 220 * u;
      const width = 40 * u;
      y -= Math.exp(-(d * d) / (2 * width * width)) * Math.exp(-age * 1.6) * ripple.power * 14 * u;
    }
    return y;
  }

  /** Where a duck sits (its belly on the surface). */
  duckY(duck: Duck): number {
    return this.surfaceY(duck.x) + duck.bob;
  }

  /** Whether a point is on the water rather than the wall. */
  onWater(x: number, y: number): boolean {
    return y >= this.surfaceY(x) - this.unit * 12;
  }

  // ---- Things ---------------------------------------------------------------------

  private ensureDucks(): void {
    const wanted = DUCKS[this.age];
    while (this.ducks.length > wanted) this.ducks.pop();
    while (this.ducks.length < wanted) {
      const dir = this.ducks.length % 2 === 0 ? 1 : -1;
      this.ducks.push({
        id: this.nextId++,
        x: this.width * (this.ducks.length === 0 ? 0.3 : 0.7),
        dir,
        vx: dir * this.rng.range(8, 14) * this.unit,
        bob: 0,
        bobV: 0,
        spinAge: Infinity,
        quackAge: Infinity,
      });
    }
  }

  /**
   * A new bubble at the water surface (or where given), rising slowly. Returns null when the bath is full, so
   * a burst of touches can never flood the screen.
   */
  spawnBubble(options: { x?: number; y?: number; r?: number; kind?: BubbleKind; hurry?: number } = {}): Bubble | null {
    if (this.bubbles.length >= MAX_BUBBLES) return null;
    const r = options.r ?? this.baseR * this.rng.range(0.7, 1.4);
    const x = clamp(options.x ?? this.rng.range(0.1, 0.9) * this.width, r, this.width - r);
    const y = options.y ?? this.surfaceY(x) + r * 0.4;
    let kind: BubbleKind = options.kind ?? 'plain';
    let photoId: string | undefined;
    if (!options.kind) {
      const photoOut = this.bubbles.some((b) => b.kind === 'photo');
      if (this.photoIds.length > 0 && !photoOut && this.rng.chance(PHOTO_CHANCE)) {
        kind = 'photo';
        photoId = this.rng.pick(this.photoIds);
      } else if (this.rng.chance(STAR_CHANCE)) kind = 'star';
    }
    const bubble: Bubble = {
      id: this.nextId++,
      x,
      y,
      r,
      vx: this.rng.range(-6, 6) * this.unit,
      vy: -(this.height / 800) * this.rng.range(28, 48) * TEMPO[this.tempo].speed * this.profile.speed * (options.hurry ?? 1),
      wobble: this.rng.range(0, TAU),
      wobbleAmp: 0,
      age: 0,
      kind,
      photoId,
      hue: this.rng.range(0, 360),
      heldBy: null,
    };
    this.bubbles.push(bubble);
    return bubble;
  }

  private addDroplets(x: number, y: number, count: number, kind: DropletKind, spread: number, up: number, photoId?: string): void {
    const u = this.unit;
    for (let i = 0; i < count; i++) {
      if (this.droplets.length >= MAX_DROPLETS) this.droplets.shift();
      const angle = this.rng.range(0, TAU);
      const speed = this.rng.range(0.3, 1) * spread * u;
      const maxLife = kind === 'soap' ? this.rng.range(0.8, 1.6) : kind === 'photo' ? 4 : this.rng.range(0.4, 0.9);
      this.droplets.push({
        x: x + Math.cos(angle) * this.rng.range(0, 8) * u,
        y: y + Math.sin(angle) * this.rng.range(0, 8) * u,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - up * u,
        life: maxLife,
        maxLife,
        r: (kind === 'photo' ? 0 : kind === 'soap' ? this.rng.range(2.5, 5) : this.rng.range(2, 4.5)) * u,
        kind,
        photoId,
      });
    }
  }

  private addRipple(x: number, power: number): void {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, t: this.time, power });
  }

  findBubbleAt(x: number, y: number, factor: number, minAge = 0): Bubble | null {
    let best: Bubble | null = null;
    let bestDistance = Infinity;
    for (const b of this.bubbles) {
      if (b.heldBy !== null || b.age < minAge) continue;
      const distance = Math.hypot(x - b.x, y - b.y) / (b.r * factor);
      if (distance <= 1 && distance < bestDistance) {
        bestDistance = distance;
        best = b;
      }
    }
    return best;
  }

  findDuckAt(x: number, y: number): Duck | null {
    const s = this.duckSize;
    for (const duck of this.ducks) {
      if (Math.abs(x - duck.x) <= s * 1.6 && Math.abs(y - (this.duckY(duck) - s * 0.4)) <= s * 1.5) return duck;
    }
    return null;
  }

  // ---- Reactions ------------------------------------------------------------------

  /** Size 0..1 for the sound: a tiny bubble pips, a big one plops deep. */
  private sizeOf(b: Bubble): number {
    return clamp((b.r - this.baseR * 0.4) / (this.maxHeldR - this.baseR * 0.4), 0, 1);
  }

  pop(b: Bubble): void {
    const index = this.bubbles.indexOf(b);
    if (index < 0) return;
    this.bubbles.splice(index, 1);
    const size = this.sizeOf(b);
    this.addDroplets(b.x, b.y, 7 + Math.round(size * 10), 'drop', 90 + size * 80, 20);
    if (b.kind === 'star') this.addDroplets(b.x, b.y, 8, 'gold', 120, 40);
    // The photo falls out and lands in the water with a splash.
    if (b.kind === 'photo') this.addDroplets(b.x, b.y, 1, 'photo', 0, 60, b.photoId);
    this.pops++;
    this.emit({ type: 'pop', x: b.x, y: b.y, size, kind: b.kind, photoId: b.photoId });
    if (this.pops % this.config.celebrateEvery === 0) this.celebrate();
  }

  /** Every tenth pop: a shower of little bubbles rises from the water and the ducks spin. Calm, no flashing. */
  private celebrate(): void {
    this.sinceCelebration = 0;
    for (let i = 0; i < CELEBRATION_SHOWER[this.age]; i++) {
      const x = this.rng.range(0.08, 0.92) * this.width;
      this.spawnBubble({ x, y: this.surfaceY(x) + this.rng.range(0, 40) * this.unit, r: this.baseR * this.rng.range(0.35, 0.6), kind: 'plain', hurry: 1.5 });
    }
    for (const duck of this.ducks) {
      duck.spinAge = 0;
      duck.bobV = -50 * this.unit;
    }
    this.emit({ type: 'celebration' });
  }

  /** A touch on the water: a wave, drops flying, and a couple of new bubbles from that very spot. */
  splash(x: number, y: number, big = false): void {
    const surface = this.surfaceY(x);
    this.addRipple(x, big ? 1.4 : 1);
    this.addDroplets(x, surface, big ? 18 : 10, 'drop', big ? 160 : 120, big ? 90 : 60);
    for (let i = 0; i < 2; i++) {
      this.spawnBubble({ x: x + this.rng.range(-30, 30) * this.unit, r: this.baseR * this.rng.range(0.5, 0.9), kind: 'plain', hurry: 1.3 });
    }
    // Ducks near the splash bob.
    for (const duck of this.ducks) if (Math.abs(duck.x - x) < 120 * this.unit) duck.bobV -= 30 * this.unit;
    this.splashes++;
    this.emit({ type: 'splash', x, y: Math.min(y, surface), big });
  }

  /** A touch on the wall: a puff of tiny soap bubbles, so there is no dead spot anywhere. */
  soapPuff(x: number, y: number): void {
    this.addDroplets(x, y, 6, 'soap', 40, 25);
    this.emit({ type: 'soap', x, y });
  }

  quack(duck: Duck): void {
    duck.spinAge = 0;
    duck.quackAge = 0;
    duck.bobV = -60 * this.unit;
    this.addRipple(duck.x, 0.6);
    this.quacks++;
    this.emit({ type: 'quack', x: duck.x, y: this.duckY(duck) });
  }

  // ---- Touch ----------------------------------------------------------------------

  press(id: number, x: number, y: number): void {
    if (this.asleep) {
      this.addDroplets(x, y, 3, 'soap', 20, 10);
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    const pointer: PointerState = { id, x, y, downX: x, downY: y, held: 0, holding: false, bubble: null, swiped: false, travelled: 0, lastRipple: -1 };
    this.pointers.set(id, pointer);
    const bubble = this.findBubbleAt(x, y, TAP_HIT_FACTOR);
    if (bubble) {
      this.pop(bubble);
      return;
    }
    const duck = this.findDuckAt(x, y);
    if (duck) {
      this.quack(duck);
      return;
    }
    // Water or wall: both answer, and keeping the finger there grows a bubble.
    if (this.onWater(x, y)) this.splash(x, y);
    else this.soapPuff(x, y);
    pointer.holding = true;
  }

  drag(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    const u = this.unit;
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const moved = Math.hypot(dx, dy);
    pointer.x = x;
    pointer.y = y;
    if (pointer.holding && Math.hypot(x - pointer.downX, y - pointer.downY) > HOLD_MOVE_TOLERANCE * u) this.endHold(pointer);
    if (pointer.bubble) {
      // A growing bubble follows the finger a little.
      pointer.bubble.x = x;
      pointer.bubble.y = y;
      return;
    }
    pointer.travelled += moved;
    if (pointer.travelled > 22 * u) {
      // The finger leaves a trail of tiny bubbles behind it.
      pointer.travelled = 0;
      this.addDroplets(x, y, 1, 'soap', 15, 20);
    }
    if (!pointer.swiped && Math.abs(x - pointer.downX) >= 60 * u) {
      pointer.swiped = true;
      this.emit({ type: 'swipe' });
    }
    // Bubbles nearby are pushed along, and the ones the finger crosses pop.
    for (const b of this.bubbles) {
      if (b.heldBy !== null) continue;
      const distance = Math.hypot(b.x - x, b.y - y);
      if (distance < 90 * u) {
        b.vx += dx * 3 * (1 - distance / (90 * u));
        b.vx = clamp(b.vx, -260 * u, 260 * u);
        b.wobbleAmp = 1;
      }
    }
    const bubble = this.findBubbleAt(x, y, DRAG_HIT_FACTOR, DRAG_MIN_AGE);
    if (bubble) {
      this.pop(bubble);
      return;
    }
    // Along the water the finger makes waves that carry the ducks.
    if (moved > 1 && this.onWater(x, y) && this.time - pointer.lastRipple > 0.15) {
      pointer.lastRipple = this.time;
      this.addRipple(x, 0.6);
      for (const duck of this.ducks) {
        if (Math.abs(duck.x - x) < 140 * u) {
          duck.vx += Math.sign(dx) * 40 * u;
          duck.bobV -= 20 * u;
        }
      }
    }
  }

  release(id: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    this.endHold(pointer);
    this.pointers.delete(id);
  }

  /** The finger let go (or moved): a bubble that was growing floats away. */
  private endHold(pointer: PointerState): void {
    pointer.holding = false;
    const b = pointer.bubble;
    if (!b) return;
    pointer.bubble = null;
    b.heldBy = null;
    b.age = 0;
    b.vy = -(this.height / 800) * this.rng.range(20, 32) * TEMPO[this.tempo].speed * this.profile.speed;
    b.wobbleAmp = 0.6;
    this.emit({ type: 'blow', x: b.x, y: b.y, size: this.sizeOf(b) });
  }

  /** Shaking the phone: everything jiggles, the ducks hop, and a shower of little bubbles rises. */
  shake(): void {
    if (this.asleep || this.time - this.lastShake < SHAKE_COOLDOWN) return;
    this.lastShake = this.time;
    const u = this.unit;
    for (const b of this.bubbles) {
      if (b.heldBy !== null) continue;
      b.vx += this.rng.range(-90, 90) * u;
      b.vy -= this.rng.range(0, 40) * u;
      b.wobbleAmp = 1;
    }
    for (let i = 0; i < SHOWER[this.age]; i++) {
      const x = this.rng.range(0.08, 0.92) * this.width;
      this.spawnBubble({ x, y: this.surfaceY(x) + this.rng.range(0, 30) * u, r: this.baseR * this.rng.range(0.35, 0.6), kind: 'plain', hurry: 1.6 });
    }
    for (const duck of this.ducks) {
      duck.bobV = -80 * u;
      duck.spinAge = 0;
    }
    for (let i = 0; i < 3; i++) this.addRipple(this.rng.range(0.1, 0.9) * this.width, 0.8);
    this.shakes++;
    this.emit({ type: 'shake' });
  }

  sleep(): void {
    this.asleep = true;
    for (const pointer of this.pointers.values()) this.endHold(pointer);
    this.pointers.clear();
  }

  wake(): void {
    this.asleep = false;
    this.spawnTimer = 0.5;
  }

  // ---- Time -----------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    this.sinceCelebration += dt;
    this.dusk = this.asleep ? Math.min(1, this.dusk + dt / SLEEP_TIME) : Math.max(0, this.dusk - dt / WAKE_TIME);
    const u = this.unit;

    // Holding still grows a bubble under the finger; it bursts if it grows too big.
    for (const pointer of this.pointers.values()) {
      if (!pointer.holding && !pointer.bubble) continue;
      pointer.held += dt;
      if (pointer.holding && !pointer.bubble && pointer.held >= HOLD_START) {
        const b = this.spawnBubble({ x: pointer.x, y: pointer.y, r: this.baseR * 0.35, kind: 'plain' });
        if (!b) {
          pointer.holding = false;
          continue;
        }
        b.heldBy = pointer.id;
        b.vy = 0;
        pointer.bubble = b;
        this.emit({ type: 'grow', x: pointer.x, y: pointer.y });
      }
      const b = pointer.bubble;
      if (b) {
        b.r = Math.min(this.maxHeldR, b.r + (this.maxHeldR / GROW_TIME) * dt);
        b.wobble += dt * 3;
        if (b.r >= this.maxHeldR) {
          this.bubbles.splice(this.bubbles.indexOf(b), 1);
          pointer.bubble = null;
          pointer.holding = false;
          this.addDroplets(b.x, b.y, 24, 'drop', 200, 40);
          this.emit({ type: 'burst', x: b.x, y: b.y });
        }
      }
    }

    // Bubbles rise, sway and drift off the top.
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      if (b.heldBy !== null) continue;
      b.wobble += dt * (2.2 + b.wobbleAmp * 6);
      b.wobbleAmp = Math.max(0, b.wobbleAmp - dt * 1.2);
      b.vx *= Math.max(0, 1 - 1.5 * dt);
      b.x += (b.vx + Math.sin(b.wobble) * 12 * u * (0.5 + b.wobbleAmp)) * dt;
      b.y += b.vy * dt;
      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
      } else if (b.x > this.width - b.r) {
        b.x = this.width - b.r;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y + b.r < -10 * u) this.bubbles.splice(i, 1);
    }

    // New bubbles keep coming by themselves, slowly, unless the bath is asleep.
    if (!this.asleep) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.bubbles.filter((b) => b.heldBy === null).length < this.targetBubbles) this.spawnBubble();
        const hurry = this.bubbles.length === 0 ? 0.35 : 1;
        this.spawnTimer = this.config.spawnInterval * TEMPO[this.tempo].interval * this.profile.spawn * hurry * this.rng.range(0.7, 1.3);
      }
    }

    // Drops fall back into the water; tiny soap bubbles drift up and fade; a photo lands with a splash.
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.life -= dt;
      if (d.kind === 'soap') {
        d.vy -= 30 * u * dt;
        d.vx *= Math.max(0, 1 - 2 * dt);
      } else {
        d.vy += 520 * u * dt;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.kind !== 'soap' && d.vy > 0 && d.y >= this.surfaceY(d.x)) {
        if (d.kind === 'photo') {
          this.addRipple(d.x, 1);
          this.addDroplets(d.x, d.y, 8, 'drop', 100, 60);
        }
        this.droplets.splice(i, 1);
        continue;
      }
      if (d.life <= 0) this.droplets.splice(i, 1);
    }

    // Waves fade out after a few seconds.
    this.ripples = this.ripples.filter((ripple) => this.time - ripple.t < 3);

    // The ducks paddle to and fro (and sleep still), bob like little springs, and spin when touched.
    for (const duck of this.ducks) {
      if (!this.asleep) {
        duck.vx = clamp(duck.vx, -60 * u, 60 * u);
        duck.x += duck.vx * dt;
        const min = this.width * 0.1;
        const max = this.width * 0.9;
        if (duck.x < min || duck.x > max) {
          duck.x = clamp(duck.x, min, max);
          duck.vx = -duck.vx;
        }
        // Back to the paddling pace after a push.
        const pace = 11 * u;
        if (Math.abs(duck.vx) > pace) duck.vx *= Math.max(0, 1 - 1.2 * dt);
        if (Math.abs(duck.vx) < pace * 0.8) duck.vx = Math.sign(duck.vx || 1) * pace;
        duck.dir = duck.vx >= 0 ? 1 : -1;
      }
      duck.bobV += (-duck.bob * 30 - duck.bobV * 4) * dt;
      duck.bob += duck.bobV * dt;
      duck.spinAge += dt;
      duck.quackAge += dt;
    }
  }
}
