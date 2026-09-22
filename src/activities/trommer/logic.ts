import { DEFAULT_AGE, type Age } from '../../engine/age';
import { Rng, clamp } from '../../engine/rng';

/**
 * "Trommer": the whole screen is a few big drum pads. Hitting one plays a note from a pentatonic scale (so
 * banging with a whole hand always sounds like music), the pad bounces and sends a wave out from the hand, and
 * little notes fly up. Slide across the pads and they sing one after the other; rest a hand on a pad and it
 * rolls; shake the phone and every pad rolls in turn. Banging is what an 8-month-old does best, and the pads are
 * big enough for a fist. No flashing: a pad brightens at most three times a second, while waves and sparks
 * answer every single hit. Pure logic: no DOM, no canvas, no audio.
 */

export interface Pad {
  index: number;
  /** MIDI note; the bottom pad is the lowest. */
  note: number;
  /** Which of the pad colours it wears (render.ts). */
  color: number;
  /** Its rectangle on screen (portrait: stacked bands, the first at the bottom; landscape: columns). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** How pushed-in it is right now (0..1, springing back), and its soft brightening (0..1, fading). */
  squash: number;
  bloom: number;
  /** When it last brightened, so it never flashes faster than three times a second. */
  lastBloom: number;
  hits: number;
}

/** A ring spreading over a pad from where the hand landed. */
export interface Wave {
  pad: number;
  x: number;
  y: number;
  age: number;
  power: number;
}

export type SparkKind = 'note' | 'star' | 'photo';

/** A little note (or star, or a family face on a note) flying up from a hit. */
export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  life: number;
  maxLife: number;
  kind: SparkKind;
  color: number;
  photoId?: string;
}

export type HitHow = 'tap' | 'sweep' | 'roll' | 'shake';

export type TrommerEvent =
  | { type: 'hit'; pad: number; note: number; x: number; y: number; how: HitHow }
  | { type: 'shake' }
  | { type: 'photo'; photoId: string; x: number; y: number }
  | { type: 'sparkle'; x: number; y: number };

/** How many pads: few and big for the youngest. */
export const PADS: Record<Age, number> = { '8-12': 3, '1-2': 4, '2+': 5 };
/** C major pentatonic, bottom to top, for each pad count: any two together sound right. */
const PAD_NOTES: Record<number, number[]> = { 3: [60, 64, 67], 4: [60, 64, 67, 72], 5: [60, 62, 64, 67, 69] };
/** Colour indices (render.ts) with strong contrast between neighbours. */
const PAD_COLORS: Record<number, number[]> = { 3: [0, 2, 4], 4: [0, 2, 3, 4], 5: [0, 1, 2, 4, 5] };
/** A pad brightens at most this often: three times a second is the limit for big flat areas. */
export const BLOOM_INTERVAL = 0.34;
/** A hand resting on a pad this long starts a roll; the roll rests after ROLL_MAX seconds until the hand lifts. */
export const HOLD_START = 0.4;
export const ROLL_MAX = 3;
const ROLL_INTERVAL: Record<Age, number> = { '8-12': 0.2, '1-2': 0.16, '2+': 0.13 };
const SHAKE_COOLDOWN = 0.6;
/** A shake rolls over the pads with this much between hits. */
export const SHAKE_STEP = 0.09;
export const MAX_WAVES = 24;
export const MAX_SPARKS = 120;
const SPARKS_PER_HIT: Record<Age, number> = { '8-12': 4, '1-2': 6, '2+': 8 };
/** Every so many hits a note carries a family face, when there are photos. */
export const PHOTO_EVERY = 6;
const SLEEP_TIME = 8;
const WAKE_TIME = 2.5;

interface PointerState {
  id: number;
  pad: number;
  x: number;
  y: number;
  /** Seconds the hand has rested on this pad, how long it has rolled, and when the next roll hit is due. */
  held: number;
  rolled: number;
  nextRoll: number;
}

export class TrommerGame {
  width = 1;
  height = 1;
  time = 0;
  pads: Pad[] = [];
  waves: Wave[] = [];
  sparks: Spark[] = [];
  /** Taps, sweeps and shake hits (not the many small hits of a roll). */
  hits = 0;
  sweeps = 0;
  rolls = 0;
  shakes = 0;
  asleep = false;
  dusk = 0;
  private age: Age = DEFAULT_AGE;
  private photoIds: string[] = [];
  private lastShake = -Infinity;
  /** Hits a shake has lined up: when, and on which pad. */
  private queue: Array<{ at: number; pad: number }> = [];
  private readonly rng: Rng;
  private readonly pointers = new Map<number, PointerState>();
  private readonly listeners: Array<(event: TrommerEvent) => void> = [];

  constructor(seed = Date.now()) {
    this.rng = new Rng(seed);
    this.layout();
  }

  onEvent(listener: (event: TrommerEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: TrommerEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // ---- Settings and layout ---------------------------------------------------------

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layout();
  }

  setAge(age: Age): void {
    if (age === this.age) return;
    this.age = age;
    this.layout();
  }

  get currentAge(): Age {
    return this.age;
  }

  /** Family faces ride up on a note now and then. */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
  }

  get unit(): number {
    return Math.max(0.5, Math.min(this.width, this.height) / 400);
  }

  get padCount(): number {
    return PADS[this.age];
  }

  /** Big bands across the screen (columns when the screen is wider than tall), with a small gap between them. */
  private layout(): void {
    const n = this.padCount;
    const notes = PAD_NOTES[n];
    const colors = PAD_COLORS[n];
    const u = this.unit;
    const gap = 8 * u;
    const margin = 6 * u;
    const portrait = this.height >= this.width;
    const pads: Pad[] = [];
    for (let i = 0; i < n; i++) {
      const old = this.pads[i];
      let x0: number;
      let y0: number;
      let x1: number;
      let y1: number;
      if (portrait) {
        const band = (this.height - 2 * margin - gap * (n - 1)) / n;
        y1 = this.height - margin - i * (band + gap);
        y0 = y1 - band;
        x0 = margin;
        x1 = this.width - margin;
      } else {
        const column = (this.width - 2 * margin - gap * (n - 1)) / n;
        x0 = margin + i * (column + gap);
        x1 = x0 + column;
        y0 = margin;
        y1 = this.height - margin;
      }
      pads.push({
        index: i,
        note: notes[i],
        color: colors[i],
        x0,
        y0,
        x1,
        y1,
        squash: old?.squash ?? 0,
        bloom: old?.bloom ?? 0,
        lastBloom: old?.lastBloom ?? -Infinity,
        hits: old?.hits ?? 0,
      });
    }
    this.pads = pads;
    this.waves = [];
    for (const pointer of this.pointers.values()) pointer.pad = Math.min(pointer.pad, n - 1);
  }

  /** The pad under a point: the nearest one, so the gaps and margins belong to a pad too (no dead spots). */
  padAt(x: number, y: number): Pad {
    let best = this.pads[0];
    let bestDistance = Infinity;
    for (const pad of this.pads) {
      const dx = Math.max(pad.x0 - x, 0, x - pad.x1);
      const dy = Math.max(pad.y0 - y, 0, y - pad.y1);
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = pad;
      }
    }
    return best;
  }

  // ---- Touch -----------------------------------------------------------------------

  press(id: number, x: number, y: number): void {
    if (this.asleep) {
      this.addSparks(x, y, 3, 'star', 0);
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    const pad = this.padAt(x, y);
    this.pointers.set(id, { id, pad: pad.index, x, y, held: 0, rolled: 0, nextRoll: HOLD_START });
    this.hit(pad, x, y, 'tap');
  }

  drag(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    pointer.x = x;
    pointer.y = y;
    if (this.asleep) return;
    const pad = this.padAt(x, y);
    if (pad.index === pointer.pad) return;
    // Sliding onto the next pad: it sings too, a glissando across the drums; the roll starts afresh there.
    pointer.pad = pad.index;
    pointer.held = 0;
    pointer.rolled = 0;
    pointer.nextRoll = HOLD_START;
    this.sweeps++;
    this.hit(pad, x, y, 'sweep');
  }

  release(id: number): void {
    this.pointers.delete(id);
  }

  /** Shaking the phone: a drum roll over every pad, bottom to top and back, and everything bounces. */
  shake(): void {
    if (this.asleep || this.time - this.lastShake < SHAKE_COOLDOWN) return;
    this.lastShake = this.time;
    this.shakes++;
    const up = this.pads.map((pad) => pad.index);
    const order = [...up, ...up.slice(0, -1).reverse()];
    order.forEach((index, k) => this.queue.push({ at: this.time + k * SHAKE_STEP, pad: index }));
    for (const pad of this.pads) pad.squash = Math.max(pad.squash, 0.6);
    this.emit({ type: 'shake' });
  }

  sleep(): void {
    this.asleep = true;
    this.pointers.clear();
    this.queue = [];
  }

  wake(): void {
    this.asleep = false;
  }

  // ---- Reactions -------------------------------------------------------------------

  private hit(pad: Pad, x: number, y: number, how: HitHow): void {
    pad.squash = how === 'roll' ? Math.max(pad.squash, 0.5) : 1;
    pad.hits++;
    if (how === 'roll') this.rolls++;
    else this.hits++;
    // A soft brightening, never more than three times a second on the same pad: no flashing for small eyes.
    if (this.time - pad.lastBloom >= BLOOM_INTERVAL) {
      pad.bloom = 1;
      pad.lastBloom = this.time;
    }
    this.addWave(pad.index, x, y, how === 'roll' ? 0.45 : 1);
    this.addSparks(x, y, how === 'roll' ? 1 : SPARKS_PER_HIT[this.age], 'note', pad.color);
    // Every so many hits a note carries a family face up the screen.
    if (how !== 'roll' && this.photoIds.length > 0 && this.hits % PHOTO_EVERY === 0) {
      const photoId = this.rng.pick(this.photoIds);
      this.addSpark(x, y, 'photo', pad.color, photoId);
      this.emit({ type: 'photo', photoId, x, y });
    }
    this.emit({ type: 'hit', pad: pad.index, note: pad.note, x, y, how });
  }

  private addWave(pad: number, x: number, y: number, power: number): void {
    if (this.waves.length >= MAX_WAVES) this.waves.shift();
    this.waves.push({ pad, x, y, age: 0, power });
  }

  private addSparks(x: number, y: number, count: number, kind: SparkKind, color: number): void {
    for (let i = 0; i < count; i++) this.addSpark(x, y, kind, color);
  }

  private addSpark(x: number, y: number, kind: SparkKind, color: number, photoId?: string): void {
    if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
    const u = this.unit;
    const maxLife = kind === 'photo' ? 3.2 : this.rng.range(0.9, 1.6);
    this.sparks.push({
      x: x + this.rng.range(-12, 12) * u,
      y: y + this.rng.range(-8, 8) * u,
      vx: this.rng.range(-70, 70) * u * (kind === 'photo' ? 0.3 : 1),
      vy: -this.rng.range(90, 190) * u * (kind === 'photo' ? 0.45 : 1),
      spin: this.rng.range(-3, 3),
      life: maxLife,
      maxLife,
      kind,
      color,
      photoId,
    });
  }

  // ---- Time ------------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    this.dusk = this.asleep ? Math.min(1, this.dusk + dt / SLEEP_TIME) : Math.max(0, this.dusk - dt / WAKE_TIME);
    const u = this.unit;
    if (!this.asleep) {
      // A hand resting on a pad rolls it: soft, quick hits, until it has rolled long enough and rests.
      for (const pointer of this.pointers.values()) {
        pointer.held += dt;
        if (pointer.held >= pointer.nextRoll && pointer.rolled < ROLL_MAX) {
          const interval = ROLL_INTERVAL[this.age];
          pointer.nextRoll = pointer.held + interval;
          pointer.rolled += interval;
          const pad = this.pads[pointer.pad];
          if (pad) this.hit(pad, pointer.x, pointer.y, 'roll');
        }
      }
      // The hits a shake lined up.
      while (this.queue.length && this.queue[0].at <= this.time) {
        const next = this.queue.shift();
        const pad = next ? this.pads[next.pad] : undefined;
        if (pad) this.hit(pad, (pad.x0 + pad.x1) / 2 + this.rng.range(-0.25, 0.25) * (pad.x1 - pad.x0), (pad.y0 + pad.y1) / 2, 'shake');
      }
    }
    // Pads spring back and their glow fades.
    for (const pad of this.pads) {
      pad.squash = Math.max(0, pad.squash - dt * 4.5);
      pad.bloom = Math.max(0, pad.bloom - dt * 3);
    }
    // Waves spread and fade; notes float up, slow down sideways and fade.
    for (const wave of this.waves) wave.age += dt;
    this.waves = this.waves.filter((wave) => wave.age < 1.2);
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life -= dt;
      spark.vx *= Math.max(0, 1 - 1.5 * dt);
      spark.vy -= (spark.kind === 'photo' ? 6 : 25) * u * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.x = clamp(spark.x, 0, this.width);
      if (spark.life <= 0 || spark.y < -40 * u) this.sparks.splice(i, 1);
    }
  }
}
