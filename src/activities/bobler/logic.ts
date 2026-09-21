import { AGE_PROFILES, DEFAULT_AGE, type Age, type AgeProfile } from '../../engine/age';
import type { Tempo } from '../../engine/parent';
import { Rng, TAU, clamp } from '../../engine/rng';

/**
 * "Bobler": a bath full of soap bubbles. The same kind of toy as Balloner, because that is what an 8-month-old
 * can use (docs/FORSKNING.md: contingency): every touch answers at once, with movement and sound, and nothing is
 * ever wrong. Tap a bubble and it pops with a wet plop; tap the water and it splashes and sends up new bubbles;
 * a swipe pops what it crosses, leaves a trail of tiny bubbles and makes waves; hold still and a bubble grows
 * under the finger; shake the phone and everything jiggles while a shower of bubbles rises; the rubber ducks
 * quack and spin when touched. Now and then a guest comes by, in the water or in the air (a whale hiding with
 * only its back showing until a touch lets the water out of it, a cow in a speedboat, a penguin on a jet ski, a
 * fish that jumps and can end up in a bubble, a shower head that sprays when touched, a polar bear waving from
 * an ice floe): few and slow for the youngest, and every one answers a touch. Pure logic: no DOM, no canvas,
 * no audio.
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

export type GuestKind = 'whale' | 'boat' | 'jetski' | 'fish' | 'shower' | 'bear';
/** `ride` and `fall` belong to the fish: carried up inside a bubble, and dropping back when it pops. */
export type GuestState = 'enter' | 'stay' | 'act' | 'ride' | 'fall' | 'leave';

/** A visitor to the bath: in the water (whale, fish, boat, jet ski, bear on a floe) or in the air (the shower head). */
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
  /** A little hop after a touch (boats, the bear's floe), fading. */
  hop: number;
  /** How many times it has done its own thing (the fish: jumps, the bear: waves), so every third jump can end in a bubble. */
  acts: number;
  /** The bubble the fish is riding in, or null. */
  ride: number | null;
  /** Seconds until the next thing it does by itself (a fish jump, a spray ripple). */
  nextAct: number;
  /** Where the entering guest is heading. */
  targetY: number;
  /** The y it left from (to animate the leave). */
  fromY: number;
}

/**
 * What a guest did: came, was touched (`pokes` counts the touches, so the first one can sound special), did its
 * own thing, stopped it (the shower's spray ending), dripped, rode off in a bubble or fell out of one, left.
 */
export type GuestEventWhat = 'appear' | 'poke' | 'act' | 'stop' | 'drip' | 'ride' | 'fall' | 'leave';

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
  | { type: 'guest'; kind: GuestKind; what: GuestEventWhat; x: number; y: number; pokes?: number }
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
const GUEST_KINDS: ReadonlyArray<GuestKind> = ['whale', 'boat', 'fish', 'jetski', 'shower', 'bear'];
/** How long a guest stays by itself (crossing guests leave when they have crossed; the whale and the shower have their own rules). */
const GUEST_STAY: Record<GuestKind, number> = { whale: 16, boat: Infinity, jetski: Infinity, fish: 16, shower: 60, bear: Infinity };
/** Crossing speed (times unit and the age profile's speed). */
const GUEST_SPEED: Record<GuestKind, number> = { whale: 0, boat: 85, jetski: 135, fish: 22, shower: 0, bear: 20 };
const GUEST_ENTER_TIME: Record<GuestKind, number> = { whale: 1.2, boat: 0, jetski: 0, fish: 1.0, shower: 0.9, bear: 0 };
const GUEST_LEAVE_TIME = 1.1;
/** Crossing guests that have to leave (the bath falls asleep) hurry off at this speed. */
const HURRY_OFF_SPEED = 130;
/**
 * The whale hides: only its back and blowhole show above the water, a secret to find. Untouched, it sinks away
 * after a while (the youngest get longest to find it). The first touch lets the water out and brings it up, glad
 * to be helped; it then stays a while, and every touch keeps it a little longer, up to a cap.
 */
const WHALE_HIDDEN_STAY: Record<Age, number> = { '8-12': 40, '1-2': 30, '2+': 25 };
const WHALE_TOUCH_EXTRA = 6;
const WHALE_MAX_STAY = 50;
const WHALE_RISE_TIME = 1.0;
const WHALE_HINT_EVERY = 3.5;
const SPOUT_TIME = 0.9;
const FIRST_SPOUT_TIME = 1.6;
export const FISH_JUMP_TIME = 1.1;
/** The fish jumps by itself every so often from 1 year; the youngest make it jump by touching it. */
const FISH_JUMP_EVERY: Record<Age, number> = { '8-12': Infinity, '1-2': 7, '2+': 5 };
/** The second jump, and every third after it, ends inside a bubble that carries the fish away unless it is popped. */
const FISH_BUBBLE_EVERY = 3;
const FISH_BUBBLE_FIRST = 2;
/**
 * The shower drips gently until it is touched; then it sprays hard for a while (drops per second), and foam
 * bubbles rise where the spray hits the water. From 1 year it also bursts by itself now and then. It stays long,
 * and every touch keeps it longer, up to a cap: the more it is played with, the longer it stays.
 */
const SHOWER_DRIP: Record<Age, number> = { '8-12': 2.5, '1-2': 4, '2+': 5 };
const SHOWER_SPRAY: Record<Age, number> = { '8-12': 28, '1-2': 40, '2+': 48 };
export const SPRAY_TIME = 5;
const SPRAY_EVERY: Record<Age, number> = { '8-12': Infinity, '1-2': 14, '2+': 10 };
const SPRAY_BUBBLE_EVERY = 0.6;
const SHOWER_STAY: Record<Age, number> = { '8-12': 45, '1-2': 60, '2+': 60 };
const SHOWER_TOUCH_EXTRA = 12;
const SHOWER_MAX_STAY = 150;
const DRIP_EVERY = 2.2;
/** The bear waves hello when it comes on screen, when touched, and now and then by itself (seldom for the youngest). */
export const WAVE_TIME = 1.8;
const WAVE_EVERY: Record<Age, number> = { '8-12': 12, '1-2': 9, '2+': 7 };
const FIRST_WAVE = 1.5;
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
  /** The shower head under the finger: dragging carries it around the bath, spraying as it goes. */
  guest: Guest | null;
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
      // A fish inside a bubble is reached through the bubble (popping it lets the fish out).
      if (g.state === 'leave' || g.state === 'ride' || g.state === 'fall') continue;
      const wide = g.kind === 'boat' || g.kind === 'jetski' || g.kind === 'bear' ? 2.2 : 1.8;
      // The bear sits up tall on its floe; the others are centred a little above their water line.
      const centerY = g.kind === 'bear' ? g.y - g.size * 1.0 : g.y - g.size * 0.3;
      const tall = g.kind === 'bear' ? 2.2 : 1.7;
      if (Math.abs(x - g.x) <= g.size * wide && Math.abs(y - centerY) <= g.size * tall) return g;
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

  /** Where the whale sits: hidden (only its back and blowhole above the water) or up, helped out of hiding. */
  private whaleY(x: number, size: number, up: boolean): number {
    return this.surfaceY(x) + (up ? -size * 0.35 : size * 0.5);
  }

  /** A guest arrives (also used by the smoke test with a chosen kind). */
  spawnGuest(kind = this.nextGuestKind()): Guest {
    const u = this.unit;
    const size = this.guestSize * (kind === 'boat' ? 1.15 : kind === 'whale' ? 1.25 : kind === 'bear' ? 1.05 : kind === 'shower' ? 0.9 : 1);
    const dir: 1 | -1 = this.rng.chance(0.5) ? 1 : -1;
    const speed = GUEST_SPEED[kind] * u * this.profile.speed;
    const crossing = kind === 'boat' || kind === 'jetski' || kind === 'bear';
    let x = this.rng.range(0.3, 0.7) * this.width;
    let y = this.surfaceY(x) + size * 2.2;
    let targetY = this.surfaceY(x) - size * 0.6;
    let state: GuestState = 'enter';
    let stay = GUEST_STAY[kind];
    let nextAct = 0;
    if (kind === 'whale') {
      // The whale comes up only far enough for its back and blowhole to show: the secret to find.
      targetY = this.whaleY(x, size, false);
      stay = WHALE_HIDDEN_STAY[this.age];
      nextAct = WHALE_HINT_EVERY;
    } else if (crossing) {
      // Crossing guests come in from one side, already on the water.
      x = dir > 0 ? -size * 2.5 : this.width + size * 2.5;
      y = this.waterY;
      targetY = y;
      state = 'stay';
      if (kind === 'bear') nextAct = FIRST_WAVE;
    } else if (kind === 'shower') {
      y = -size * 2;
      targetY = this.height * 0.14;
      stay = SHOWER_STAY[this.age];
      nextAct = SPRAY_EVERY[this.age];
    } else if (kind === 'fish') {
      x = this.rng.range(0.25, 0.75) * this.width;
      targetY = this.surfaceY(x) + size * 0.35;
      nextAct = FISH_JUMP_EVERY[this.age];
    }
    const guest: Guest = {
      id: this.nextId++,
      kind,
      x,
      y,
      vx: crossing || kind === 'fish' ? dir * speed : 0,
      dir,
      state,
      age: 0,
      stateAge: 0,
      size,
      stay,
      pokes: 0,
      lastPoke: -Infinity,
      phase: this.rng.range(0, TAU),
      hop: 0,
      acts: 0,
      ride: null,
      nextAct,
      targetY,
      fromY: y,
    };
    this.guests.push(guest);
    // The fish arrives with a splash; the whale's arrival is only a small stir, so the secret stays a secret.
    if (kind === 'whale' || kind === 'fish') this.waterSplash(x, false);
    this.guestsSeen++;
    this.emit({ type: 'guest', kind, what: 'appear', x, y: targetY });
    return guest;
  }

  /**
   * Touching a guest: the whale lets its water out (and rises out of hiding, the first time), the fish jumps,
   * the boat hops and the cow moos, the shower sprays (and follows the finger), the bear waves hello.
   */
  pokeGuest(g: Guest, x: number, y: number): void {
    if (this.time - g.lastPoke < 0.25) return;
    g.lastPoke = this.time;
    g.pokes++;
    this.guestsPoked++;
    const u = this.unit;
    switch (g.kind) {
      case 'whale':
        if (g.pokes === 1) {
          // Helped: up it comes, glad, with a splash, and it stays a while.
          g.fromY = g.y;
          g.stay = g.age + GUEST_STAY.whale;
          this.waterSplash(g.x, true);
        } else {
          g.stay = Math.min(g.stay + WHALE_TOUCH_EXTRA, WHALE_HIDDEN_STAY[this.age] + WHALE_MAX_STAY);
        }
        g.state = 'act';
        g.stateAge = 0;
        break;
      case 'fish':
        if (g.state === 'stay') this.fishJump(g);
        break;
      case 'boat':
      case 'jetski':
        g.hop = 1;
        g.vx += g.dir * 60 * u;
        this.addRipple(g.x, 0.8);
        break;
      case 'shower':
        this.spray(g);
        g.stay = Math.min(g.stay + SHOWER_TOUCH_EXTRA, SHOWER_MAX_STAY);
        break;
      case 'bear':
        this.wave(g);
        g.hop = 1;
        this.addRipple(g.x, 0.6);
        break;
    }
    this.emit({ type: 'guest', kind: g.kind, what: 'poke', x, y, pokes: g.pokes });
  }

  private fishJump(g: Guest): void {
    g.state = 'act';
    g.stateAge = 0;
    g.fromY = g.y;
    g.acts++;
    this.waterSplash(g.x, false);
    this.emit({ type: 'guest', kind: 'fish', what: 'act', x: g.x, y: g.y });
  }

  /** Whether this jump is one that ends inside a bubble (the second, then every third). */
  private jumpEndsInBubble(g: Guest): boolean {
    return g.acts >= FISH_BUBBLE_FIRST && (g.acts - FISH_BUBBLE_FIRST) % FISH_BUBBLE_EVERY === 0;
  }

  /**
   * At the top of a jump the fish lands inside a new bubble, which carries it slowly up and away, unless the
   * bubble is popped first: then the fish drops back into the water. A reason to pop, and a small surprise.
   */
  private fishRide(g: Guest): void {
    const b = this.spawnBubble({ x: g.x, y: g.y, r: Math.max(this.baseR * 1.25, g.size * 1.35), kind: 'plain', hurry: 0.7 });
    if (!b) return;
    b.wobbleAmp = 0.8;
    b.vx = g.vx * 0.3;
    g.ride = b.id;
    g.state = 'ride';
    g.stateAge = 0;
    this.emit({ type: 'guest', kind: 'fish', what: 'ride', x: g.x, y: g.y });
  }

  /** The bubble the fish rode in popped: it drops back towards the water. */
  private fishFall(g: Guest): void {
    g.ride = null;
    g.state = 'fall';
    g.stateAge = 0;
    g.fromY = g.y;
  }

  /** The shower's spray turns on, or keeps going. Returns true when it was off. */
  private spray(g: Guest): boolean {
    if (g.state === 'leave' || g.state === 'ride' || g.state === 'fall') return false;
    const started = g.state !== 'act';
    g.state = 'act';
    g.stateAge = 0;
    if (started) for (let i = 0; i < 10; i++) this.showerDrop(g, true);
    return started;
  }

  /** The bear waves hello: a big, slow wave with the whole arm, the kind Theo is learning himself. */
  private wave(g: Guest): void {
    if (g.state === 'leave') return;
    g.state = 'act';
    g.stateAge = 0;
    g.acts++;
  }

  /** A drop from the shower head: a gentle drip, or part of the hard spray. */
  private showerDrop(g: Guest, hard: boolean): void {
    const u = this.unit;
    if (this.droplets.length >= MAX_DROPLETS) this.droplets.shift();
    this.droplets.push({
      x: g.x + this.rng.range(-0.8, 0.8) * g.size,
      y: g.y + g.size * 0.3,
      vx: (hard ? this.rng.range(-45, 45) : this.rng.range(-10, 10)) * u,
      vy: (hard ? this.rng.range(120, 230) : this.rng.range(40, 90)) * u,
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
    if (g.ride !== null) {
      // Leaving from inside a bubble (the bath fell asleep): the bubble quietly goes, the fish dives from the water.
      const index = this.bubbles.findIndex((b) => b.id === g.ride);
      if (index >= 0) this.bubbles.splice(index, 1);
      g.ride = null;
    }
    if (g.kind === 'fish') g.y = Math.max(g.y, this.surfaceY(g.x) + g.size * 0.35);
    g.state = 'leave';
    g.stateAge = 0;
    g.fromY = g.y;
    // A hidden whale slips away quietly; one that was helped up dives with a splash.
    if (g.kind === 'whale' || g.kind === 'fish') this.waterSplash(g.x, g.kind === 'whale' && g.pokes > 0);
    this.emit({ type: 'guest', kind: g.kind, what: 'leave', x: g.x, y: g.y, pokes: g.pokes });
  }

  private updateGuests(dt: number): void {
    const u = this.unit;
    for (let i = this.guests.length - 1; i >= 0; i--) {
      const g = this.guests[i];
      g.age += dt;
      g.stateAge += dt;
      g.hop = Math.max(0, g.hop - dt * 1.6);
      g.phase += dt * (g.kind === 'fish' ? 6 : 3);
      // Asleep, or stayed long enough: off it goes (not in the middle of a jump, a ride or a spout).
      const busy = g.state === 'act' || g.state === 'ride' || g.state === 'fall';
      if ((this.asleep || (g.age > g.stay && !busy)) && g.state !== 'leave') this.guestLeave(g);
      switch (g.kind) {
        case 'whale': {
          const down = this.whaleY(g.x, g.size, false);
          const up = this.whaleY(g.x, g.size, true);
          if (g.state === 'enter') {
            const t = Math.min(1, g.stateAge / GUEST_ENTER_TIME.whale);
            g.y = g.fromY + (g.targetY - g.fromY) * (1 - (1 - t) * (1 - t));
            if (t >= 1) {
              g.state = 'stay';
              g.stateAge = 0;
            }
          } else if (g.state === 'act') {
            // Letting the water out: a fountain from the blowhole; the first time it also rises out of hiding.
            const first = g.pokes === 1;
            const rise = first ? Math.min(1, g.stateAge / WHALE_RISE_TIME) : 1;
            g.y = down + (up - down) * (1 - (1 - rise) * (1 - rise));
            for (let k = 0; k < 3; k++) {
              if (this.droplets.length >= MAX_DROPLETS) this.droplets.shift();
              this.droplets.push({
                x: g.x + g.dir * g.size * 0.35 + this.rng.range(-4, 4) * u,
                y: g.y - g.size * 1.0,
                vx: this.rng.range(-70, 70) * u,
                vy: -this.rng.range(280, 430) * u,
                life: 1.6,
                maxLife: 1.6,
                r: this.rng.range(2.5, 4.5) * u,
                kind: 'drop',
              });
            }
            if (g.stateAge >= (first ? FIRST_SPOUT_TIME : SPOUT_TIME)) {
              g.state = 'stay';
              g.stateAge = 0;
            }
          } else if (g.state === 'stay') {
            g.y = g.pokes > 0 ? up : down;
            if (g.pokes === 0) {
              // Hidden, it gives a tiny hint now and then: a few bubbles from the blowhole.
              g.nextAct -= dt;
              if (g.nextAct <= 0) {
                g.nextAct = WHALE_HINT_EVERY;
                this.addDroplets(g.x + g.dir * g.size * 0.35, g.y - g.size * 1.0, 3, 'soap', 30, 60);
                this.emit({ type: 'guest', kind: 'whale', what: 'drip', x: g.x, y: g.y });
              }
            }
          } else if (g.state === 'leave') {
            const t = Math.min(1, g.stateAge / GUEST_LEAVE_TIME);
            g.y = g.fromY + g.size * 2.6 * t * t;
            if (t >= 1) this.guests.splice(i, 1);
          }
          break;
        }
        case 'fish': {
          const swim = this.surfaceY(g.x) + g.size * 0.35;
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
            g.y = swim;
            g.nextAct -= dt;
            if (g.nextAct <= 0) {
              g.nextAct = FISH_JUMP_EVERY[this.age];
              this.fishJump(g);
            }
          } else if (g.state === 'act') {
            // The jump: an arc out of the water and back in with a splash, or, at the top, into a bubble.
            const t = Math.min(1, g.stateAge / FISH_JUMP_TIME);
            const before = (g.stateAge - dt) / FISH_JUMP_TIME;
            g.x += g.vx * 1.6 * dt;
            g.y = swim - Math.sin(t * Math.PI) * g.size * 3.2;
            if (before < 0.5 && t >= 0.5 && this.jumpEndsInBubble(g)) this.fishRide(g);
            else if (t >= 1) {
              g.state = 'stay';
              g.stateAge = 0;
              this.waterSplash(g.x, true);
            }
          } else if (g.state === 'ride') {
            const b = this.bubbles.find((bubble) => bubble.id === g.ride);
            if (!b) {
              // The bubble floated off the top: the fish is gone with it.
              this.guests.splice(i, 1);
              this.emit({ type: 'guest', kind: 'fish', what: 'leave', x: g.x, y: g.y });
              break;
            }
            g.x = b.x;
            g.y = b.y;
          } else if (g.state === 'fall') {
            g.y = g.fromY + 450 * u * g.stateAge * g.stateAge;
            if (g.y >= swim) {
              g.y = swim;
              g.state = 'stay';
              g.stateAge = 0;
              this.waterSplash(g.x, true);
              this.emit({ type: 'guest', kind: 'fish', what: 'fall', x: g.x, y: g.y });
            }
          } else if (g.state === 'leave') {
            const t = Math.min(1, g.stateAge / GUEST_LEAVE_TIME);
            g.y = g.fromY + g.size * 2.4 * t * t;
            if (t >= 1) this.guests.splice(i, 1);
          }
          break;
        }
        case 'boat':
        case 'jetski':
        case 'bear': {
          // Crosses the bath: speeds back down after a push (and hurries off when it has to leave), leaves a
          // wake and rocks the ducks. The boats bounce over the waves; the bear's floe just bobs along.
          const cruise = (g.state === 'leave' ? HURRY_OFF_SPEED : GUEST_SPEED[g.kind]) * u * this.profile.speed;
          if (Math.abs(g.vx) > cruise) g.vx -= Math.sign(g.vx) * cruise * 0.8 * dt;
          else if (g.state === 'leave') g.vx = g.dir * cruise;
          g.x += g.vx * dt;
          const bounce =
            g.kind === 'jetski' ? Math.abs(Math.sin(g.phase * 1.3)) * g.size * 0.12 : g.kind === 'boat' ? Math.sin(g.phase) * g.size * 0.05 : Math.sin(g.phase * 0.7) * g.size * 0.03;
          const hopUp = g.kind === 'bear' ? 0.25 : 0.6;
          g.y = this.surfaceY(g.x) - g.size * 0.1 - bounce - Math.sin(Math.min(1, 1 - g.hop) * Math.PI) * g.size * hopUp * (g.hop > 0 ? 1 : 0);
          if (g.kind === 'bear') {
            // Waves hello once it is on screen, and now and then after that (few and calm for the youngest).
            if (g.state === 'act' && g.stateAge >= WAVE_TIME) {
              g.state = 'stay';
              g.stateAge = 0;
            }
            g.nextAct -= dt;
            if (g.nextAct <= 0) {
              const onScreen = g.x > g.size && g.x < this.width - g.size;
              g.nextAct = onScreen ? WAVE_EVERY[this.age] : 1;
              if (onScreen && g.state === 'stay') {
                this.wave(g);
                this.emit({ type: 'guest', kind: 'bear', what: 'act', x: g.x, y: g.y });
              }
            }
            if (Math.floor(g.age * 1.2) !== Math.floor((g.age - dt) * 1.2)) this.addRipple(g.x, 0.25);
          } else {
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
          }
          const gentle = g.kind === 'bear';
          for (const duck of this.ducks) {
            if (Math.abs(duck.x - g.x) < (gentle ? 100 : 140) * u) {
              duck.vx += g.dir * (gentle ? 10 : 25) * u * dt * 10;
              duck.bobV -= (gentle ? 15 : 40) * u * dt * 10;
            }
          }
          if ((g.dir > 0 && g.x > this.width + g.size * 2.5) || (g.dir < 0 && g.x < -g.size * 2.5)) {
            this.guests.splice(i, 1);
            if (g.state !== 'leave') this.emit({ type: 'guest', kind: g.kind, what: 'leave', x: g.x, y: g.y });
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
          } else if (g.state === 'stay' || g.state === 'act') {
            const spraying = g.state === 'act';
            g.y += (g.targetY - g.y) * Math.min(1, 6 * dt);
            // Drips gently by itself; sprays hard after a touch (and now and then by itself from 1 year).
            this.showerSpray += (spraying ? SHOWER_SPRAY[this.age] : SHOWER_DRIP[this.age]) * dt;
            while (this.showerSpray >= 1) {
              this.showerSpray -= 1;
              this.showerDrop(g, spraying);
            }
            if (spraying) {
              if (Math.floor(g.stateAge / SPRAY_BUBBLE_EVERY) !== Math.floor((g.stateAge - dt) / SPRAY_BUBBLE_EVERY)) {
                // Foam bubbles rise where the spray hits the water, and the water ripples there.
                const x = clamp(g.x + this.rng.range(-0.9, 0.9) * g.size, 20 * u, this.width - 20 * u);
                this.spawnBubble({ x, r: this.baseR * this.rng.range(0.35, 0.55), kind: 'plain', hurry: 1.3 });
                this.addRipple(x, 0.5);
              }
              // The ducks under the spray quack and bob.
              for (const duck of this.ducks) {
                if (Math.abs(duck.x - g.x) < g.size * 1.3 && duck.quackAge > 1.6) this.quack(duck, false);
              }
              if (g.stateAge >= SPRAY_TIME) {
                g.state = 'stay';
                g.stateAge = 0;
                g.nextAct = SPRAY_EVERY[this.age];
                this.emit({ type: 'guest', kind: 'shower', what: 'stop', x: g.x, y: g.y });
              }
            } else {
              // A drip now and then (a small sound, so it is not forgotten), and from 1 year a burst by itself.
              if (Math.floor(g.age / DRIP_EVERY) !== Math.floor((g.age - dt) / DRIP_EVERY)) this.emit({ type: 'guest', kind: 'shower', what: 'drip', x: g.x, y: g.y });
              g.nextAct -= dt;
              if (g.nextAct <= 0 && this.spray(g)) this.emit({ type: 'guest', kind: 'shower', what: 'act', x: g.x, y: g.y });
            }
            // Bubbles under the shower get pushed about.
            for (const b of this.bubbles) {
              if (b.heldBy === null && Math.abs(b.x - g.x) < g.size * 1.2 && b.y > g.y) {
                b.vy += (spraying ? 60 : 15) * u * dt;
                b.wobbleAmp = Math.max(b.wobbleAmp, spraying ? 0.6 : 0.3);
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
    // A fish riding in this bubble drops back towards the water.
    for (const g of this.guests) if (g.ride === b.id) this.fishFall(g);
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

  quack(duck: Duck, touched = true): void {
    duck.spinAge = 0;
    duck.quackAge = 0;
    duck.bobV = -60 * this.unit;
    // Every touch gives the duck its next colour (a shower does not).
    if (touched) duck.color = (duck.color + 1) % DUCK_COLORS;
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
    const pointer: PointerState = { id, x, y, downX: x, downY: y, held: 0, holding: false, bubble: null, duck: null, guest: null, swiped: false, travelled: 0, lastRipple: -1 };
    this.pointers.set(id, pointer);
    const bubble = this.findBubbleAt(x, y, TAP_HIT_FACTOR);
    if (bubble) {
      this.pop(bubble);
      return;
    }
    const guest = this.findGuestAt(x, y);
    if (guest) {
      this.pokeGuest(guest, x, y);
      // The shower head can be carried around by the finger.
      if (guest.kind === 'shower') pointer.guest = guest;
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
    if (pointer.guest) {
      // Carrying the shower head: it follows the finger and keeps spraying; nothing else happens under this finger.
      const g = pointer.guest;
      if (this.guests.includes(g) && g.state !== 'leave') {
        g.x = clamp(x, g.size * 1.2, this.width - g.size * 1.2);
        g.y = clamp(y, this.height * 0.06, this.waterY - g.size * 1.6);
        g.targetY = g.y;
        if (this.spray(g)) this.emit({ type: 'guest', kind: 'shower', what: 'act', x: g.x, y: g.y });
      }
      return;
    }
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
      else if (g.kind === 'shower' && this.spray(g)) this.emit({ type: 'guest', kind: 'shower', what: 'act', x: g.x, y: g.y });
      else if (g.kind === 'bear' && g.state === 'stay') {
        this.wave(g);
        g.hop = 1;
        this.emit({ type: 'guest', kind: 'bear', what: 'act', x: g.x, y: g.y });
      }
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
