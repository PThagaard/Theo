import { AGE_PROFILES, DEFAULT_AGE, type Age, type AgeProfile } from '../../engine/age';
import type { Tempo } from '../../engine/parent';
import { Rng, TAU, clamp } from '../../engine/rng';

/**
 * "Bobler": a bath full of soap bubbles. The same kind of toy as Balloner, because that is what an 8-month-old
 * can use (docs/FORSKNING.md: contingency): every touch answers at once, with movement and sound, and nothing is
 * ever wrong. Tap a bubble and it pops with a wet plop; tap the water and it splashes and sends up new bubbles;
 * a swipe pops what it crosses, leaves a trail of tiny bubbles and makes waves; hold still and a bubble grows
 * under the finger; shake the phone and everything jiggles while a shower of bubbles rises; the rubber ducks
 * quack and spin when touched. Now and then a guest comes by, in the water or in the air (a whale that surfaces
 * and spouts when touched, a cow in a speedboat, a penguin on a jet ski, a fish that jumps, a shower head that
 * sprays): few and slow for the youngest, and every one answers a touch. Pure logic: no DOM, no canvas, no audio.
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
  /** Which of the duck colours it wears (every touch picks the next). */
  color: number;
  /** Seconds left of the rainbow dash a long press starts (0 when paddling normally). */
  rainbow: number;
  /** Where on the colour wheel the rainbow is right now. */
  hue: number;
}

export type DropletKind = 'drop' | 'soap' | 'gold' | 'photo' | 'foam';

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

export type GuestKind = 'whale' | 'boat' | 'jetski' | 'fish' | 'shower';
export type GuestState = 'enter' | 'stay' | 'act' | 'leave';

/** A visitor to the bath: in the water (whale, fish, boat, jet ski) or in the air (the shower head). */
export interface Guest {
  id: number;
  kind: GuestKind;
  x: number;
  y: number;
  vx: number;
  dir: 1 | -1;
  state: GuestState;
  /** Seconds since it arrived, and since the state changed. */
  age: number;
  stateAge: number;
  size: number;
  /** How long it stays before leaving by itself (boats leave when they have crossed). */
  stay: number;
  pokes: number;
  lastPoke: number;
  /** Swimming or quivering phase. */
  phase: number;
  /** A little hop after a touch (boats), fading. */
  hop: number;
  /** Seconds until the next thing it does by itself (a fish jump, a spray ripple). */
  nextAct: number;
  /** Where the entering guest is heading. */
  targetY: number;
  /** The y it left from (to animate the leave). */
  fromY: number;
}

export type BoblerEvent =
  | { type: 'pop'; x: number; y: number; size: number; kind: BubbleKind; photoId?: string }
  | { type: 'splash'; x: number; y: number; big: boolean }
  | { type: 'quack'; x: number; y: number }
  | { type: 'dash'; x: number; y: number }
  | { type: 'soap'; x: number; y: number }
  | { type: 'grow'; x: number; y: number }
  | { type: 'blow'; x: number; y: number; size: number }
  | { type: 'burst'; x: number; y: number }
  | { type: 'shake' }
  | { type: 'celebration' }
  | { type: 'swipe' }
  | { type: 'guest'; kind: GuestKind; what: 'appear' | 'poke' | 'act' | 'leave'; x: number; y: number }
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
/** The colours a duck cycles through when touched (yellow first). */
export const DUCK_COLORS = 6;
/** How long a long-pressed duck dashes about in rainbow colours, and how fast. */
const DASH_TIME = 6;
const DASH_SPEED = 150;
/** Paddling pace (times unit): a little brisker than a real duck, so there is always movement to follow. */
const PADDLE_PACE: Record<Age, number> = { '8-12': 14, '1-2': 18, '2+': 20 };
/** The water never tilts more than this (radians), however far the phone is turned. */
const MAX_TILT = 0.45;
/** Seconds between guests (times the age profile's visit interval), and how long the first one waits. */
const GUEST_INTERVAL = 32;
const FIRST_GUEST = 18;
const GUEST_KINDS: ReadonlyArray<GuestKind> = ['whale', 'boat', 'fish', 'jetski', 'shower'];
/** How long a guest stays by itself (boats and jet skis leave when they have crossed the bath). */
const GUEST_STAY: Record<GuestKind, number> = { whale: 14, boat: Infinity, jetski: Infinity, fish: 16, shower: 9 };
/** Crossing speed (times unit and the age profile's speed). */
const GUEST_SPEED: Record<GuestKind, number> = { whale: 0, boat: 85, jetski: 135, fish: 22, shower: 0 };
const GUEST_ENTER_TIME: Record<GuestKind, number> = { whale: 1.2, boat: 0, jetski: 0, fish: 1.0, shower: 0.9 };
const GUEST_LEAVE_TIME = 1.1;
const SPOUT_TIME = 0.9;
const FISH_JUMP_TIME = 1.1;
/** The fish jumps by itself every so often from 1 year; the youngest make it jump by touching it. */
const FISH_JUMP_EVERY: Record<Age, number> = { '8-12': Infinity, '1-2': 7, '2+': 5 };
/** Drops per second from the shower head (fewer for the youngest). */
const SHOWER_RATE: Record<Age, number> = { '8-12': 9, '1-2': 16, '2+': 20 };
/** How often a new bubble carries a family photo (one photo bubble at a time): they are the best part. */
const PHOTO_CHANCE = 0.4;
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
  /** A duck under a still finger: a long press sends it dashing in rainbow colours. */
  duck: Duck | null;
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
  guests: Guest[] = [];
  guestTimer = FIRST_GUEST;
  guestsSeen = 0;
  guestsPoked = 0;
  pops = 0;
  /** Where the last bubble popped: the next one rises on the other side, so there is always one to reach for. */
  private lastPopX: number | null = null;
  /** The water's slope (radians) as the phone is tilted: where it is, and where the phone says it should be. */
  tilt = 0;
  private tiltTarget = 0;
  private tiltSpeed = 0;
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
  private guestDeck: GuestKind[] = [];
  private showerSpray = 0;
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

  get guestSize(): number {
    return Math.min(this.width, this.height) * 0.11;
  }

  /** Where the water surface is at `x`: a gentle sway plus the waves that touches have started. */
  surfaceY(x: number): number {
    const u = this.unit;
    // Tilted phone: the water stays level with the real world, so it climbs the side that is held lower.
    let y = this.waterY - (x - this.width / 2) * Math.tan(this.tilt) + Math.sin(x / (60 * u) + this.time * 1.3) * 3 * u;
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
        color: 0,
        rainbow: 0,
        hue: 0,
      });
    }
  }

  /**
   * A new bubble at the water surface (or where given), rising slowly. Returns null when the bath is full, so
   * a burst of touches can never flood the screen.
   */
  spawnBubble(options: { x?: number; y?: number; r?: number; kind?: BubbleKind; hurry?: number; photoChance?: number } = {}): Bubble | null {
    if (this.bubbles.length >= MAX_BUBBLES) return null;
    let kind: BubbleKind = options.kind ?? 'plain';
    let photoId: string | undefined;
    if (!options.kind) {
      const photoOut = this.bubbles.some((b) => b.kind === 'photo');
      if (this.photoIds.length > 0 && !photoOut && this.rng.chance(options.photoChance ?? PHOTO_CHANCE)) {
        kind = 'photo';
        photoId = this.rng.pick(this.photoIds);
      } else if (this.rng.chance(STAR_CHANCE)) kind = 'star';
    }
    // A face needs a big enough bubble to be seen.
    const r = kind === 'photo' ? Math.max(options.r ?? 0, this.baseR * 1.3) : (options.r ?? this.baseR * this.rng.range(0.7, 1.4));
    const x = clamp(options.x ?? this.rng.range(0.1, 0.9) * this.width, r, this.width - r);
    const y = options.y ?? this.surfaceY(x) + r * 0.4;
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

  findGuestAt(x: number, y: number): Guest | null {
    for (const g of this.guests) {
      if (g.state === 'leave') continue;
      const wide = g.kind === 'boat' || g.kind === 'jetski' ? 2.2 : 1.8;
      if (Math.abs(x - g.x) <= g.size * wide && Math.abs(y - (g.y - g.size * 0.3)) <= g.size * 1.7) return g;
    }
    return null;
  }

  // ---- Guests ---------------------------------------------------------------------

  /** The next kind of guest: every kind once before any repeats. */
  private nextGuestKind(): GuestKind {
    if (this.guestDeck.length === 0) {
      this.guestDeck = [...GUEST_KINDS];
      for (let i = this.guestDeck.length - 1; i > 0; i--) {
        const j = this.rng.int(0, i);
        [this.guestDeck[i], this.guestDeck[j]] = [this.guestDeck[j], this.guestDeck[i]];
      }
    }
    return this.guestDeck.shift() as GuestKind;
  }

  /** A guest arrives (also used by the smoke test with a chosen kind). */
  spawnGuest(kind = this.nextGuestKind()): Guest {
    const u = this.unit;
    const size = this.guestSize * (kind === 'boat' ? 1.15 : kind === 'jetski' ? 1.0 : kind === 'shower' ? 0.9 : 1);
    const dir: 1 | -1 = this.rng.chance(0.5) ? 1 : -1;
    const speed = GUEST_SPEED[kind] * u * this.profile.speed;
    let x = this.rng.range(0.3, 0.7) * this.width;
    let y = this.surfaceY(x) + size * 2.2;
    // The whale stands up out of the water (that is the joke), the fish stays mostly under it.
    let targetY = this.surfaceY(x) - size * 0.6;
    let state: GuestState = 'enter';
    if (kind === 'boat' || kind === 'jetski') {
      // Crossing guests come in from one side, already on the water.
      x = dir > 0 ? -size * 2.5 : this.width + size * 2.5;
      y = this.waterY;
      targetY = y;
      state = 'stay';
    } else if (kind === 'shower') {
      y = -size * 2;
      targetY = this.height * 0.14;
    } else if (kind === 'fish') {
      x = this.rng.range(0.25, 0.75) * this.width;
      targetY = this.surfaceY(x) + size * 0.35;
    }
    const guest: Guest = {
      id: this.nextId++,
      kind,
      x,
      y,
      vx: kind === 'boat' || kind === 'jetski' ? dir * speed : kind === 'fish' ? dir * speed : 0,
      dir,
      state,
      age: 0,
      stateAge: 0,
      size,
      stay: GUEST_STAY[kind],
      pokes: 0,
      lastPoke: -Infinity,
      phase: this.rng.range(0, TAU),
      hop: 0,
      nextAct: kind === 'fish' ? FISH_JUMP_EVERY[this.age] : 0,
      targetY,
      fromY: y,
    };
    this.guests.push(guest);
    if (kind === 'whale' || kind === 'fish') this.waterSplash(x, kind === 'whale');
    this.guestsSeen++;
    this.emit({ type: 'guest', kind, what: 'appear', x, y: targetY });
    return guest;
  }

  /** Touching a guest: the whale spouts, the boat hops and the cow moos, the fish jumps, the shower bursts. */
  pokeGuest(g: Guest, x: number, y: number): void {
    if (this.time - g.lastPoke < 0.25) return;
    g.lastPoke = this.time;
    g.pokes++;
    this.guestsPoked++;
    const u = this.unit;
    switch (g.kind) {
      case 'whale':
        g.state = 'act';
        g.stateAge = 0;
        break;
      case 'fish':
        if (g.state !== 'act') this.fishJump(g);
        break;
      case 'boat':
      case 'jetski':
        g.hop = 1;
        g.vx += g.dir * 60 * u;
        this.addRipple(g.x, 0.8);
        break;
      case 'shower':
        for (let i = 0; i < 24; i++) this.showerDrop(g);
        break;
    }
    this.emit({ type: 'guest', kind: g.kind, what: 'poke', x, y });
  }

  private fishJump(g: Guest): void {
    g.state = 'act';
    g.stateAge = 0;
    g.fromY = g.y;
    this.waterSplash(g.x, false);
    this.emit({ type: 'guest', kind: 'fish', what: 'act', x: g.x, y: g.y });
  }

  private showerDrop(g: Guest): void {
    const u = this.unit;
    if (this.droplets.length >= MAX_DROPLETS) this.droplets.shift();
    this.droplets.push({
      x: g.x + this.rng.range(-0.8, 0.8) * g.size,
      y: g.y + g.size * 0.3,
      vx: this.rng.range(-25, 25) * u,
      vy: this.rng.range(60, 140) * u,
      life: 3,
      maxLife: 3,
      r: this.rng.range(2, 3.5) * u,
      kind: 'drop',
    });
  }

  /** A splash without a touch behind it (guests arriving, diving, jumping): waves and drops, no event. */
  private waterSplash(x: number, big: boolean): void {
    this.addRipple(x, big ? 1.4 : 0.9);
    this.addDroplets(x, this.surfaceY(x), big ? 16 : 9, 'drop', big ? 150 : 100, big ? 80 : 50);
  }

  private guestLeave(g: Guest): void {
    if (g.state === 'leave') return;
    g.state = 'leave';
    g.stateAge = 0;
    g.fromY = g.y;
    if (g.kind === 'whale' || g.kind === 'fish') this.waterSplash(g.x, g.kind === 'whale');
    this.emit({ type: 'guest', kind: g.kind, what: 'leave', x: g.x, y: g.y });
  }

  private updateGuests(dt: number): void {
    const u = this.unit;
    for (let i = this.guests.length - 1; i >= 0; i--) {
      const g = this.guests[i];
      g.age += dt;
      g.stateAge += dt;
      g.hop = Math.max(0, g.hop - dt * 1.6);
      g.phase += dt * (g.kind === 'fish' ? 6 : 3);
      // Asleep, or stayed long enough: off it goes.
      if ((this.asleep || g.age > g.stay) && g.state !== 'leave') this.guestLeave(g);
      switch (g.kind) {
        case 'whale': {
          if (g.state === 'enter') {
            const t = Math.min(1, g.stateAge / GUEST_ENTER_TIME.whale);
            g.y = g.fromY + (g.targetY - g.fromY) * (1 - (1 - t) * (1 - t));
            if (t >= 1) {
              g.state = 'stay';
              g.stateAge = 0;
            }
          } else if (g.state === 'act') {
            // The spout: a fountain from the blowhole for a moment.
            for (let k = 0; k < 3; k++) {
              if (this.droplets.length >= MAX_DROPLETS) this.droplets.shift();
              this.droplets.push({
                x: g.x + g.dir * g.size * 0.3 + this.rng.range(-4, 4) * u,
                y: g.y - g.size * 0.85,
                vx: this.rng.range(-70, 70) * u,
                vy: -this.rng.range(280, 430) * u,
                life: 1.6,
                maxLife: 1.6,
                r: this.rng.range(2.5, 4.5) * u,
                kind: 'drop',
              });
            }
            if (g.stateAge >= SPOUT_TIME) {
              g.state = 'stay';
              g.stateAge = 0;
            }
          } else if (g.state === 'leave') {
            const t = Math.min(1, g.stateAge / GUEST_LEAVE_TIME);
            g.y = g.fromY + g.size * 2.6 * t * t;
            if (t >= 1) this.guests.splice(i, 1);
          }
          // Standing at the surface, it quivers (the bobbing is drawn from the phase).
          if (g.state === 'stay' || g.state === 'act') g.y = this.surfaceY(g.x) - g.size * 0.6;
          break;
        }
        case 'fish': {
          if (g.state === 'enter') {
            const t = Math.min(1, g.stateAge / GUEST_ENTER_TIME.fish);
            g.y = g.fromY + (g.targetY - g.fromY) * (1 - (1 - t) * (1 - t));
            if (t >= 1) {
              g.state = 'stay';
              g.stateAge = 0;
            }
          } else if (g.state === 'stay') {
            g.x += g.vx * dt;
            const min = this.width * 0.15;
            const max = this.width * 0.85;
            if (g.x < min || g.x > max) {
              g.x = Math.max(min, Math.min(max, g.x));
              g.vx = -g.vx;
              g.dir = g.vx >= 0 ? 1 : -1;
            }
            g.y = this.surfaceY(g.x) + g.size * 0.35;
            g.nextAct -= dt;
            if (g.nextAct <= 0) {
              g.nextAct = FISH_JUMP_EVERY[this.age];
              this.fishJump(g);
            }
          } else if (g.state === 'act') {
            // The jump: an arc out of the water and back in with a splash.
            const t = Math.min(1, g.stateAge / FISH_JUMP_TIME);
            g.x += g.vx * 1.6 * dt;
            g.y = this.surfaceY(g.x) + g.size * 0.35 - Math.sin(t * Math.PI) * g.size * 3.2;
            if (t >= 1) {
              g.state = 'stay';
              g.stateAge = 0;
              this.waterSplash(g.x, true);
            }
          } else if (g.state === 'leave') {
            const t = Math.min(1, g.stateAge / GUEST_LEAVE_TIME);
            g.y = g.fromY + g.size * 2.4 * t * t;
            if (t >= 1) this.guests.splice(i, 1);
          }
          break;
        }
        case 'boat':
        case 'jetski': {
          // Speeds back down after a push, bounces over the waves, leaves a wake and rocks the ducks.
          const cruise = GUEST_SPEED[g.kind] * u * this.profile.speed;
          if (Math.abs(g.vx) > cruise) g.vx -= Math.sign(g.vx) * cruise * 0.8 * dt;
          g.x += g.vx * dt;
          const bounce = g.kind === 'jetski' ? Math.abs(Math.sin(g.phase * 1.3)) * g.size * 0.12 : Math.sin(g.phase) * g.size * 0.05;
          g.y = this.surfaceY(g.x) - g.size * 0.1 - bounce - Math.sin(Math.min(1, 1 - g.hop) * Math.PI) * g.size * 0.6 * (g.hop > 0 ? 1 : 0);
          g.nextAct -= dt;
          if (g.nextAct <= 0) {
            g.nextAct = g.kind === 'jetski' ? 0.05 : 0.08;
            if (this.droplets.length < MAX_DROPLETS) {
              this.droplets.push({
                x: g.x - g.dir * g.size * this.rng.range(1.2, 1.8),
                y: this.surfaceY(g.x) + this.rng.range(-2, 4) * u,
                vx: -g.dir * this.rng.range(10, 40) * u,
                vy: g.kind === 'jetski' ? -this.rng.range(60, 160) * u : 0,
                life: g.kind === 'jetski' ? 0.8 : 1.6,
                maxLife: g.kind === 'jetski' ? 0.8 : 1.6,
                r: this.rng.range(3, 6) * u,
                kind: g.kind === 'jetski' ? 'drop' : 'foam',
              });
            }
          }
          if (Math.floor(g.age * 2.5) !== Math.floor((g.age - dt) * 2.5)) this.addRipple(g.x, 0.5);
          for (const duck of this.ducks) {
            if (Math.abs(duck.x - g.x) < 140 * u) {
              duck.vx += g.dir * 25 * u * dt * 10;
              duck.bobV -= 40 * u * dt * 10;
            }
          }
          if ((g.dir > 0 && g.x > this.width + g.size * 2.5) || (g.dir < 0 && g.x < -g.size * 2.5)) {
            this.guests.splice(i, 1);
            this.emit({ type: 'guest', kind: g.kind, what: 'leave', x: g.x, y: g.y });
          }
          break;
        }
        case 'shower': {
          if (g.state === 'enter') {
            const t = Math.min(1, g.stateAge / GUEST_ENTER_TIME.shower);
            g.y = g.fromY + (g.targetY - g.fromY) * (1 - (1 - t) * (1 - t));
            if (t >= 1) {
              g.state = 'stay';
              g.stateAge = 0;
            }
          } else if (g.state === 'stay') {
            // Spraying: drops fall into the water and make it ripple; bubbles under it get pushed about.
            this.showerSpray += SHOWER_RATE[this.age] * dt;
            while (this.showerSpray >= 1) {
              this.showerSpray -= 1;
              this.showerDrop(g);
            }
            g.nextAct -= dt;
            if (g.nextAct <= 0) {
              g.nextAct = 0.45;
              this.addRipple(g.x + this.rng.range(-0.6, 0.6) * g.size, 0.35);
            }
            for (const b of this.bubbles) {
              if (b.heldBy === null && Math.abs(b.x - g.x) < g.size * 1.2 && b.y > g.y) {
                b.vy += 40 * u * dt;
                b.wobbleAmp = Math.max(b.wobbleAmp, 0.5);
              }
            }
          } else if (g.state === 'leave') {
            const t = Math.min(1, g.stateAge / GUEST_LEAVE_TIME);
            g.y = g.fromY + (-g.size * 2 - g.fromY) * t * t;
            if (t >= 1) this.guests.splice(i, 1);
          }
          break;
        }
      }
    }
    // Guests come by themselves now and then: seldom and one at a time for the youngest.
    if (!this.asleep) {
      this.guestTimer -= dt;
      if (this.guestTimer <= 0) {
        if (this.guests.length < this.profile.visitors) this.spawnGuest();
        this.guestTimer = GUEST_INTERVAL * this.profile.visitInterval * this.rng.range(0.7, 1.3);
      }
    }
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
    if (b.kind === 'star') {
      // A star bubble is a little treat: gold sparks, a puff of tiny golden bubbles, and the ducks spin.
      this.addDroplets(b.x, b.y, 10, 'gold', 130, 40);
      for (let i = 0; i < 6; i++) {
        const tiny = this.spawnBubble({ x: b.x + this.rng.range(-0.8, 0.8) * b.r, y: b.y + this.rng.range(-0.5, 0.5) * b.r, r: this.baseR * this.rng.range(0.25, 0.4), kind: 'star', hurry: 1.8 });
        if (tiny) tiny.wobbleAmp = 1;
      }
      for (const duck of this.ducks) duck.spinAge = 0;
    }
    // The photo falls out and lands in the water with a splash.
    if (b.kind === 'photo') this.addDroplets(b.x, b.y, 1, 'photo', 0, 60, b.photoId);
    this.pops++;
    this.lastPopX = b.x;
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
    // Two new bubbles from that very spot; the child's own splash may bring the family up.
    for (let i = 0; i < 2; i++) {
      this.spawnBubble({ x: x + this.rng.range(-30, 30) * this.unit, r: this.baseR * this.rng.range(0.5, 0.9), hurry: 1.3, photoChance: i === 0 ? 0.3 : 0 });
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
    // Every touch gives the duck its next colour.
    duck.color = (duck.color + 1) % DUCK_COLORS;
    this.addRipple(duck.x, 0.6);
    this.quacks++;
    this.emit({ type: 'quack', x: duck.x, y: this.duckY(duck) });
  }

  /** A long press: the duck goes rainbow and dashes to and fro across the bath for a while. */
  dash(duck: Duck): void {
    duck.rainbow = DASH_TIME;
    duck.hue = 0;
    duck.spinAge = 0;
    duck.quackAge = 0;
    duck.bobV = -70 * this.unit;
    duck.vx = duck.dir * DASH_SPEED * this.unit;
    this.emit({ type: 'dash', x: duck.x, y: this.duckY(duck) });
  }

  /** The phone's roll (radians, positive = right side down), from the motion sensor; the water follows with a slosh. */
  setTilt(roll: number): void {
    this.tiltTarget = clamp(roll, -MAX_TILT, MAX_TILT);
  }

  // ---- Touch ----------------------------------------------------------------------

  press(id: number, x: number, y: number): void {
    if (this.asleep) {
      this.addDroplets(x, y, 3, 'soap', 20, 10);
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    const pointer: PointerState = { id, x, y, downX: x, downY: y, held: 0, holding: false, bubble: null, duck: null, swiped: false, travelled: 0, lastRipple: -1 };
    this.pointers.set(id, pointer);
    const bubble = this.findBubbleAt(x, y, TAP_HIT_FACTOR);
    if (bubble) {
      this.pop(bubble);
      return;
    }
    const guest = this.findGuestAt(x, y);
    if (guest) {
      this.pokeGuest(guest, x, y);
      return;
    }
    const duck = this.findDuckAt(x, y);
    if (duck) {
      this.quack(duck);
      pointer.duck = duck;
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
    if ((pointer.holding || pointer.duck) && Math.hypot(x - pointer.downX, y - pointer.downY) > HOLD_MOVE_TOLERANCE * u) {
      this.endHold(pointer);
      pointer.duck = null;
    }
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
    pointer.duck = null;
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
    for (const g of this.guests) {
      if (g.kind === 'boat' || g.kind === 'jetski') g.hop = 1;
      else if (g.kind === 'fish' && g.state === 'stay') this.fishJump(g);
      else if (g.kind === 'whale' && g.state === 'stay') g.phase += 3;
    }
    // A shake also calls a guest, if none is here: the child's own doing brings the whale up.
    if (this.guests.length === 0) this.guestTimer = Math.min(this.guestTimer, 1.5);
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
    // The water sloshes towards the slope the phone asks for: a soft spring, so it swings a little.
    const pull = (this.tiltTarget - this.tilt) * 14 - this.tiltSpeed * 3.2;
    this.tiltSpeed += pull * dt;
    this.tilt += this.tiltSpeed * dt;

    for (const pointer of this.pointers.values()) {
      if (pointer.duck) {
        pointer.held += dt;
        if (pointer.held >= HOLD_START) {
          this.dash(pointer.duck);
          pointer.duck = null;
        }
        continue;
      }
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
      // On a tilted phone, "up" leans away from the low side, and so do the bubbles.
      b.vx -= Math.sin(this.tilt) * 45 * u * dt;
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
      const free = this.bubbles.filter((b) => b.heldBy === null).length;
      // Never an empty bath: the moment the last bubble is gone, a new one rises at once, on the other side of
      // the bath from where it popped, so there is always something to reach for.
      if (free === 0) {
        const side = this.lastPopX === null ? this.rng.range(0.1, 0.9) : this.lastPopX < this.width / 2 ? this.rng.range(0.6, 0.9) : this.rng.range(0.1, 0.4);
        this.spawnBubble({ x: side * this.width, hurry: 1.2 });
        this.spawnTimer = Math.min(this.spawnTimer, 1.2);
      }
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (free < this.targetBubbles) this.spawnBubble();
        // Fewer than half the bubbles left: the next comes sooner.
        const hurry = free < this.targetBubbles / 2 ? 0.5 : 1;
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
      } else if (d.kind === 'foam') {
        // Wake foam floats on the surface and fades.
        d.vx *= Math.max(0, 1 - 1.5 * dt);
        d.x += d.vx * dt;
        d.y = this.surfaceY(d.x) + 2 * u;
        if (d.life <= 0) this.droplets.splice(i, 1);
        continue;
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

    this.updateGuests(dt);

    // The ducks paddle to and fro (and sleep still), bob like little springs, and spin when touched.
    for (const duck of this.ducks) {
      if (!this.asleep) {
        const dashing = duck.rainbow > 0;
        if (dashing) {
          // The rainbow dash: full speed, turning at the edges with a splash, colours sliding round the wheel.
          duck.rainbow = Math.max(0, duck.rainbow - dt);
          duck.hue = (duck.hue + dt * 240) % 360;
          duck.vx = Math.sign(duck.vx || 1) * DASH_SPEED * u;
        } else {
          // Tilted: the ducks drift down to the low side.
          duck.vx += Math.sin(this.tilt) * 90 * u * dt;
        }
        duck.vx = clamp(duck.vx, -DASH_SPEED * u, DASH_SPEED * u);
        duck.x += duck.vx * dt;
        const min = this.width * 0.1;
        const max = this.width * 0.9;
        if (duck.x < min || duck.x > max) {
          duck.x = clamp(duck.x, min, max);
          duck.vx = -duck.vx;
          if (dashing) {
            this.addRipple(duck.x, 0.8);
            duck.quackAge = 0;
          }
        }
        // Back to the paddling pace after a push.
        const pace = PADDLE_PACE[this.age] * u;
        if (!dashing) {
          if (Math.abs(duck.vx) > pace) duck.vx *= Math.max(0, 1 - 1.2 * dt);
          if (Math.abs(duck.vx) < pace * 0.8) duck.vx = Math.sign(duck.vx || 1) * pace;
        }
        duck.dir = duck.vx >= 0 ? 1 : -1;
        // A dashing duck's wake pushes the bubbles above it.
        if (dashing) {
          for (const b of this.bubbles) {
            if (b.heldBy === null && Math.abs(b.x - duck.x) < 80 * u && b.y > this.waterY - 120 * u) {
              b.vx += duck.dir * 60 * u * dt;
              b.wobbleAmp = Math.max(b.wobbleAmp, 0.6);
            }
          }
        }
      }
      duck.bobV += (-duck.bob * 30 - duck.bobV * 4) * dt;
      duck.bob += duck.bobV * dt;
      duck.spinAge += dt;
      duck.quackAge += dt;
    }
  }
}
