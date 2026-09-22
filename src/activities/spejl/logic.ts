import { DEFAULT_AGE, type Age } from '../../engine/age';
import { Rng, TAU, clamp } from '../../engine/rng';

/**
 * "Spejl": the front camera as a mirror, and everything the child touches on it becomes a sticker, glitter or a
 * star. Babies love mirrors and faces most of all, and here the face is their own, or mom's and dad's. A tap puts
 * a big soft sticker (star, heart, flower, balloon) where the finger lands, which floats up and fades; a finger
 * drawn across leaves glitter with harp notes; a still finger grows a star that bursts into a shower when let go;
 * a shake throws confetti; now and then a bubble with a family photo floats up, and pops when touched. The camera
 * picture is only ever drawn on the screen: nothing is stored or sent anywhere (index.ts owns the camera, this
 * logic never sees it). Without a camera the same play happens on a soft, calm background. Pure logic: no DOM.
 */

export type StickerKind = 'star' | 'heart' | 'flower' | 'balloon';

export interface Sticker {
  id: number;
  x: number;
  y: number;
  kind: StickerKind;
  size: number;
  /** Seconds left; the last stretch fades. */
  life: number;
  maxLife: number;
  /** Rising speed and a little sway. */
  vy: number;
  sway: number;
  spin: number;
  /** Pops in: 0..1. */
  scale: number;
  color: number;
}

export interface Glitter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

/** A bubble carrying a family photo, floating up until it is touched. */
export interface PhotoBubble {
  id: number;
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  photoId: string;
  age: number;
}

/** The star growing under a still finger. */
export interface Charge {
  x: number;
  y: number;
  /** 0..1 as it grows. */
  size: number;
}

export type SpejlEvent =
  | { type: 'sticker'; x: number; y: number; kind: StickerKind }
  | { type: 'trail'; x: number; y: number; note: number; first: boolean }
  | { type: 'charge'; x: number; y: number }
  | { type: 'burst'; x: number; y: number }
  | { type: 'bubble'; what: 'appear' | 'pop'; photoId: string; x: number; y: number }
  | { type: 'shake' }
  | { type: 'celebration'; x: number; y: number }
  | { type: 'sparkle'; x: number; y: number };

/** Stickers on the mirror at once: few and big for the youngest. */
export const MAX_STICKERS: Record<Age, number> = { '8-12': 8, '1-2': 14, '2+': 20 };
export const STICKER_SIZE: Record<Age, number> = { '8-12': 1.3, '1-2': 1.1, '2+': 1 };
/** How long a sticker stays before it has floated up and faded. */
export const STICKER_LIFE = 7;
/** A family bubble floats up by itself about this often (when there are photos): seldom for the youngest. */
export const PHOTO_EVERY: Record<Age, number> = { '8-12': 40, '1-2': 30, '2+': 24 };
export const MAX_GLITTER = 220;
export const HOLD_START = 0.35;
export const HOLD_GROW = 1.6;
export const CELEBRATE_EVERY = 10;
export const COLORS = 6;
const KINDS: ReadonlyArray<StickerKind> = ['star', 'heart', 'flower', 'balloon'];
const SHAKE_COOLDOWN = 0.5;
const DRAG_TOLERANCE = 12;
const TRAIL_STEP = 8;
const TRAIL_SOUND_GAP = 0.12;
const SLEEP_TIME = 8;
const WAKE_TIME = 2.5;

interface PointerState {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  still: number;
  moved: boolean;
  charging: boolean;
  since: number;
  lastTrailSound: number;
  trailed: boolean;
}

export class SpejlGame {
  width = 1;
  height = 1;
  time = 0;
  stickers: Sticker[] = [];
  glitter: Glitter[] = [];
  bubbles: PhotoBubble[] = [];
  charge: Charge | null = null;
  /** Stickers put on, bursts, shakes and celebrations, all told. */
  stuck = 0;
  bursts = 0;
  shakes = 0;
  celebrations = 0;
  asleep = false;
  dusk = 0;
  private age: Age = DEFAULT_AGE;
  private photoIds: string[] = [];
  private nextId = 1;
  private nextKind = 0;
  private photoTimer = Infinity;
  private lastShake = -Infinity;
  private readonly rng: Rng;
  private readonly pointers = new Map<number, PointerState>();
  private readonly listeners: Array<(event: SpejlEvent) => void> = [];

  constructor(seed = Date.now()) {
    this.rng = new Rng(seed);
  }

  onEvent(listener: (event: SpejlEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: SpejlEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // ---- Settings ----------------------------------------------------------------

  resize(width: number, height: number): void {
    const fx = width / this.width;
    const fy = height / this.height;
    this.width = width;
    this.height = height;
    for (const sticker of this.stickers) {
      sticker.x *= fx;
      sticker.y *= fy;
    }
    for (const bubble of this.bubbles) {
      bubble.x *= fx;
      bubble.y *= fy;
    }
    this.glitter = [];
  }

  setAge(age: Age): void {
    if (age === this.age) return;
    this.age = age;
    this.photoTimer = this.nextPhoto();
  }

  get currentAge(): Age {
    return this.age;
  }

  /** The family floats by in bubbles now and then, one at a time, when there are photos. */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
    this.photoTimer = this.nextPhoto();
  }

  get unit(): number {
    return Math.max(0.5, Math.min(this.width, this.height) / 400);
  }

  private nextPhoto(): number {
    return this.photoIds.length > 0 ? PHOTO_EVERY[this.age] * this.rng.range(0.6, 1.2) : Infinity;
  }

  /** Which harp note a touch at this height plays: 0 at the bottom of the screen, 7 at the top. */
  noteAt(y: number): number {
    return clamp(Math.round((1 - y / Math.max(1, this.height)) * 7), 0, 7);
  }

  // ---- Touch -----------------------------------------------------------------------

  press(id: number, x: number, y: number): void {
    if (this.asleep) {
      this.addGlitter(x, y, 4, -1);
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    const pointer: PointerState = { id, x, y, startX: x, startY: y, still: 0, moved: false, charging: false, since: 0, lastTrailSound: -Infinity, trailed: false };
    this.pointers.set(id, pointer);
    const bubble = this.bubbleAt(x, y);
    if (bubble) {
      this.popBubble(bubble);
      return;
    }
    this.stick(x, y);
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
    if (pointer.charging && this.charge) {
      // The growing star comes along with the finger.
      this.charge.x = x;
      this.charge.y = y;
      return;
    }
    if (!pointer.moved && Math.hypot(x - pointer.startX, y - pointer.startY) < DRAG_TOLERANCE * u) return;
    pointer.moved = true;
    pointer.since += Math.hypot(dx, dy);
    while (pointer.since >= TRAIL_STEP * u) {
      pointer.since -= TRAIL_STEP * u;
      this.addGlitter(x + this.rng.range(-6, 6) * u, y + this.rng.range(-6, 6) * u, 1, -1, dx, dy);
    }
    if (this.time - pointer.lastTrailSound >= TRAIL_SOUND_GAP) {
      pointer.lastTrailSound = this.time;
      this.emit({ type: 'trail', x, y, note: this.noteAt(y), first: !pointer.trailed });
      pointer.trailed = true;
    }
    // A swipe pops the bubbles on its way.
    const bubble = this.bubbleAt(x, y);
    if (bubble) this.popBubble(bubble);
  }

  release(id: number): void {
    const pointer = this.pointers.get(id);
    this.pointers.delete(id);
    if (!pointer || !pointer.charging || !this.charge) return;
    this.burst(this.charge);
    this.charge = null;
  }

  /** A shake: confetti all over the mirror, and every sticker gets a spin. */
  shake(): void {
    if (this.asleep || this.time - this.lastShake < SHAKE_COOLDOWN) return;
    this.lastShake = this.time;
    this.shakes++;
    const u = this.unit;
    for (let i = 0; i < 30; i++) {
      this.addGlitter(this.rng.range(0, this.width), this.rng.range(0, this.height * 0.5), 1, -1, 0, 30 * u);
    }
    for (const sticker of this.stickers) sticker.spin += this.rng.range(-6, 6);
    this.emit({ type: 'shake' });
  }

  sleep(): void {
    this.asleep = true;
    this.pointers.clear();
    this.charge = null;
  }

  wake(): void {
    this.asleep = false;
  }

  // ---- The things on the mirror ------------------------------------------------------

  private bubbleAt(x: number, y: number): PhotoBubble | null {
    for (const bubble of this.bubbles) {
      if (Math.hypot(bubble.x - x, bubble.y - y) <= bubble.r * 1.6) return bubble;
    }
    return null;
  }

  /** A sticker where the finger landed: the kinds take turns, so every tap looks a little different. */
  private stick(x: number, y: number): void {
    const u = this.unit;
    if (this.stickers.length >= MAX_STICKERS[this.age]) this.stickers.shift();
    const kind = KINDS[this.nextKind++ % KINDS.length];
    const sticker: Sticker = {
      id: this.nextId++,
      x,
      y,
      kind,
      size: 34 * u * STICKER_SIZE[this.age] * this.rng.range(0.9, 1.15),
      life: STICKER_LIFE,
      maxLife: STICKER_LIFE,
      vy: -14 * u,
      sway: this.rng.range(0, TAU),
      spin: this.rng.range(-0.3, 0.3),
      scale: 0,
      color: this.rng.int(0, COLORS - 1),
    };
    this.stickers.push(sticker);
    this.stuck++;
    this.addGlitter(x, y, 6, sticker.color);
    this.emit({ type: 'sticker', x, y, kind });
    if (this.stuck % CELEBRATE_EVERY === 0) {
      this.celebrations++;
      for (let i = 0; i < 24; i++) this.addGlitter(this.rng.range(0, this.width), this.rng.range(0, this.height * 0.4), 1, -1, 0, 20 * u);
      this.emit({ type: 'celebration', x, y });
    }
  }

  private burst(charge: Charge): void {
    const u = this.unit;
    this.bursts++;
    this.addGlitter(charge.x, charge.y, 20 + Math.round(30 * charge.size), -1, 0, 0, (60 + 120 * charge.size) * u);
    this.emit({ type: 'burst', x: charge.x, y: charge.y });
  }

  private popBubble(bubble: PhotoBubble): void {
    const index = this.bubbles.indexOf(bubble);
    if (index < 0) return;
    this.bubbles.splice(index, 1);
    this.addGlitter(bubble.x, bubble.y, 14, -1, 0, 0, 90 * this.unit);
    this.emit({ type: 'bubble', what: 'pop', photoId: bubble.photoId, x: bubble.x, y: bubble.y });
  }

  private floatPhoto(): void {
    const u = this.unit;
    const photoId = this.rng.pick(this.photoIds);
    const r = 46 * u;
    const bubble: PhotoBubble = { id: this.nextId++, x: this.rng.range(r * 1.5, this.width - r * 1.5), y: this.height + r, r, vy: -26 * u, sway: this.rng.range(0, TAU), photoId, age: 0 };
    this.bubbles.push(bubble);
    this.emit({ type: 'bubble', what: 'appear', photoId, x: bubble.x, y: bubble.y });
  }

  private addGlitter(x: number, y: number, count: number, color: number, dx = 0, dy = 0, speed = 0): void {
    const u = this.unit;
    for (let i = 0; i < count; i++) {
      if (this.glitter.length >= MAX_GLITTER) this.glitter.shift();
      const angle = this.rng.range(0, TAU);
      const v = speed > 0 ? this.rng.range(0.3, 1) * speed : this.rng.range(8, 40) * u;
      const maxLife = this.rng.range(0.7, 1.5);
      this.glitter.push({
        x,
        y,
        vx: Math.cos(angle) * v - dx * 0.3,
        vy: Math.sin(angle) * v - dy * 0.3 - 6 * u,
        life: maxLife,
        maxLife,
        color: color < 0 ? this.rng.int(0, COLORS - 1) : color,
        size: this.rng.range(0.7, 1.5),
      });
    }
  }

  // ---- Time ------------------------------------------------------------------------

  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const u = this.unit;
    this.dusk = this.asleep ? Math.min(1, this.dusk + dt / SLEEP_TIME) : Math.max(0, this.dusk - dt / WAKE_TIME);
    // A still finger grows a star.
    for (const pointer of this.pointers.values()) {
      if (pointer.moved) continue;
      if (!pointer.charging) {
        pointer.still += dt;
        if (pointer.still >= HOLD_START && !this.charge) {
          pointer.charging = true;
          this.charge = { x: pointer.x, y: pointer.y, size: 0 };
          this.emit({ type: 'charge', x: pointer.x, y: pointer.y });
        }
      }
    }
    if (this.charge) this.charge.size = Math.min(1, this.charge.size + dt / HOLD_GROW);
    // Stickers pop in, float up, sway and fade out.
    for (const sticker of this.stickers) {
      sticker.life -= dt;
      sticker.scale = Math.min(1, sticker.scale + dt / 0.25);
      sticker.sway += dt * 1.5;
      sticker.y += sticker.vy * dt;
      sticker.x += Math.sin(sticker.sway) * 8 * u * dt;
      sticker.spin *= Math.max(0, 1 - 1.2 * dt);
    }
    this.stickers = this.stickers.filter((sticker) => sticker.life > 0 && sticker.y > -sticker.size * 2);
    for (const g of this.glitter) {
      g.life -= dt;
      g.vx *= Math.max(0, 1 - 1.5 * dt);
      g.vy = g.vy * Math.max(0, 1 - 1.5 * dt) + 40 * u * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    this.glitter = this.glitter.filter((g) => g.life > 0);
    // Family bubbles rise slowly; a new one comes by itself now and then, one at a time.
    for (const bubble of this.bubbles) {
      bubble.age += dt;
      bubble.sway += dt * 1.3;
      bubble.y += bubble.vy * dt;
      bubble.x += Math.sin(bubble.sway) * 12 * u * dt;
    }
    this.bubbles = this.bubbles.filter((bubble) => bubble.y > -bubble.r * 2);
    if (!this.asleep && Number.isFinite(this.photoTimer)) {
      this.photoTimer -= dt;
      if (this.photoTimer <= 0) {
        this.photoTimer = this.nextPhoto();
        if (this.bubbles.length === 0 && this.photoIds.length > 0) this.floatPhoto();
      }
    }
  }
}
