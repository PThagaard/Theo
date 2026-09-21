import { BALLOON_COLORS, FLOWER_COLORS, GOLD, RAINBOW, RAINBOW_COLOR, SPARKLE_COLORS } from './palette';
import { Rng, TAU, clamp, easeOutBack } from './rng';
import { hillY } from './terrain';
import type {
  Balloon,
  BalloonKind,
  Cloud,
  Face,
  Flower,
  GameEvent,
  Particle,
  ParticleShape,
  Trail,
  Visitor,
  VisitorForm,
  VisitorKind,
} from './types';

/**
 * Pure game logic: balloons, clouds, the sun, touches, swipes, pops and particles.
 * No DOM or canvas access here, so it can be unit tested in Node.
 */

export interface GameConfig {
  /** Hard cap on balloons on screen at once. */
  maxBalloons: number;
  /** The game keeps spawning from the bottom until this many are on screen. */
  targetBalloons: number;
  /** Seconds between natural spawns. */
  spawnInterval: number;
  /** A little celebration happens every N pops. */
  celebrateEvery: number;
  /** Max particles kept alive (protects older phones). */
  maxParticles: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  maxBalloons: 12,
  targetBalloons: 6,
  spawnInterval: 1.1,
  celebrateEvery: 10,
  maxParticles: 500,
};

/** How far outside the balloon outline a tap still counts (1 = exact outline). Babies are not precise. */
export const TAP_HIT_FACTOR = 1.6;
/** Hit area while a finger is sliding over the screen. */
export const DRAG_HIT_FACTOR = 1.15;
/** A balloon that was just made by a touch can't be popped by the same sliding finger for this long. */
const DRAG_MIN_AGE = 0.4;
const INFLATE_TIME = 0.45;
/** Seconds a finger ribbon stays visible. */
export const TRAIL_LIFE = 0.75;
const TRAIL_MAX_POINTS = 160;
/** Finger travel (times unit) between two harp notes while swiping. */
const GLIDE_STEP = 34;
const GLIDE_MIN_INTERVAL = 0.045;
/** The sky is divided into this many harp notes, from bottom (0) to top. */
export const GLIDE_NOTES = 8;
/** Number of cloud shapes the renderer knows. */
const CLOUD_SHAPES = 3;
/** Balloons this many radii from a swiping finger feel its wind. */
const WIND_REACH = 2.6;
const SUN_HIT_FACTOR = 1.3;
const SUN_POKE_INTERVAL = 0.6;
/** Visitors: creatures that drop by now and then, so there is always something new to discover. */
const VISITOR_WEIGHTS: Array<{ kind: VisitorKind; weight: number }> = [
  { kind: 'dog', weight: 24 },
  { kind: 'elephant', weight: 20 },
  { kind: 'bird', weight: 20 },
  { kind: 'butterfly', weight: 18 },
  { kind: 'snail', weight: 12 },
  { kind: 'star', weight: 6 },
];
const MAX_VISITORS = 2;
/** The storm cloud is a rare treat: never in the first minute, and at least this long between storms. */
const STORM_MIN_INTERVAL = 240;
const STORM_FIRST_DELAY = 60;
const STORM_WEIGHT = 10;
/** Seconds a lightning-struck visitor stays in its new shape. */
const FORM_TIME = 7;
const LIGHTNING_INTERVAL: [number, number] = [6, 12];
const LIGHTNING_FLASH = 0.45;
const LIGHTNING_TOUCH_COOLDOWN = 1.2;
/** Half width of the rain (and of a lightning strike's reach), in storm sizes. */
const RAIN_HALF_WIDTH = 1.5;
const RAINBOW_GLOW_TIME = 7;
/** Shortest time between two reactions of the same visitor (a bark takes about this long). */
const VISITOR_POKE_INTERVAL = 0.35;
const FIRST_VISIT_DELAY = 8;
const VISIT_INTERVAL: [number, number] = [14, 32];
/** Flowers: how long a tapped flower cycles colours, and how long a plucked one takes to grow back. */
const FLOWER_RAINBOW_TIME = 4.5;
const FLOWER_REGROW_DELAY = 3;
const FLOWER_REGROW_TIME = 0.6;
/** Share of new balloons that carry a family photo, when photos exist. */
const PHOTO_CHANCE = 0.3;
/** How long the photo stays up after its balloon pops (seconds). */
const PHOTO_SHOW_TIME = 2.2;

const KINDS: Array<{ kind: BalloonKind; weight: number }> = [
  { kind: 'plain', weight: 40 },
  { kind: 'dots', weight: 22 },
  { kind: 'stripes', weight: 18 },
  { kind: 'star', weight: 10 },
  { kind: 'rainbow', weight: 10 },
];

const FACES: Face[] = ['happy', 'happy', 'happy', 'surprised', 'sleepy', 'wink'];
const RAIN_COLORS = ['#6fc3ff', '#a6d8ff', '#4d96ff'];
const SUN_COLORS = ['#fff3a6', '#ffd93d', '#ffffff', '#ffb703'];

interface PointerState {
  id: number;
  x: number;
  y: number;
  travelled: number;
  /** Whole distance the finger has moved since it touched down. */
  totalTravelled: number;
  glideTravelled: number;
  lastGlide: number;
  trail: Trail;
}

/** A finger must travel at least this far (times unit) to count as a swipe. */
const SWIPE_MIN_TRAVEL = 60;

export type Tempo = 'rolig' | 'normal' | 'vild';

/** How busy the sky is: how many balloons, how often they come and how fast they rise. */
const TEMPO: Record<Tempo, { target: number; interval: number; speed: number }> = {
  rolig: { target: 4, interval: 1.5, speed: 0.75 },
  normal: { target: 6, interval: 1, speed: 1 },
  vild: { target: 9, interval: 0.55, speed: 1.35 },
};

export interface SpawnOptions {
  x?: number;
  y?: number;
  /** Start tiny and inflate (used for balloons made by touching the sky). */
  inflate?: boolean;
}

export class Game {
  readonly config: GameConfig;
  width = 0;
  height = 0;
  balloons: Balloon[] = [];
  clouds: Cloud[] = [];
  visitors: Visitor[] = [];
  flowers: Flower[] = [];
  particles: Particle[] = [];
  trails: Trail[] = [];
  /** Seconds since the game started. */
  time = 0;
  /** Total balloons popped. */
  pops = 0;
  /** Seconds since the last celebration (a very long time before the first one). */
  sinceCelebration = 1e9;
  /** Seconds since the sun was last touched (the renderer spins it for a moment). */
  sunHit = 1e9;
  /** Seconds left of the rainbow glowing after a storm has passed. */
  rainbowGlow = 0;
  private lastStorm = -Infinity;

  private nextId = 1;
  private spawnTimer = 0.4;
  private photoIds: string[] = [];
  private nextPhoto = 0;
  private tempo: Tempo = 'normal';
  private visitorTimer = FIRST_VISIT_DELAY;
  private nextVisitorId = 1;
  private nextFlowerId = 1;
  private listeners: Array<(event: GameEvent) => void> = [];
  private pointers = new Map<number, PointerState>();
  private rng: Rng;
  private initialised = false;

  constructor(config: Partial<GameConfig> = {}, seed?: number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new Rng(seed);
  }

  /** Size factor: about 1 on a phone, about 2 on a tablet. */
  get unit(): number {
    return Math.max(0.5, Math.min(this.width, this.height) / 400);
  }

  /** Ground level (top of the front hill) at horizontal position x. */
  ground(x: number): number {
    return hillY(x, this.width, this.height, this.unit, 1);
  }

  /** Where the sun is drawn (top right corner). */
  get sun(): { x: number; y: number; r: number } {
    const u = this.unit;
    return { x: this.width - 72 * u, y: 78 * u, r: 40 * u };
  }

  /** Rolig, normal or vild: parents pick how busy the sky should be. Takes effect at once. */
  setTempo(tempo: Tempo): void {
    const before = TEMPO[this.tempo].speed;
    this.tempo = tempo;
    const factor = TEMPO[tempo].speed / before;
    for (const b of this.balloons) b.vy *= factor;
    this.spawnTimer = Math.min(this.spawnTimer, this.config.spawnInterval * TEMPO[tempo].interval);
  }

  get currentTempo(): Tempo {
    return this.tempo;
  }

  /** Family photos available for photo balloons (ids only; the renderer holds the pictures). */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
    this.nextPhoto = 0;
    // Balloons whose photo was removed become ordinary balloons again.
    for (const b of this.balloons) {
      if (b.photoId && !ids.includes(b.photoId)) {
        b.photoId = undefined;
        b.kind = 'plain';
      }
    }
  }

  onEvent(listener: (event: GameEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  resize(width: number, height: number): void {
    const first = !this.initialised;
    this.width = width;
    this.height = height;
    if (first) {
      this.initialised = true;
      // Start with a few balloons already floating so the screen is never empty.
      for (let i = 0; i < 5; i++) {
        const balloon = this.spawnBalloon();
        if (balloon) balloon.y = this.rng.range(height * 0.25, height * 1.05);
      }
      const u = this.unit;
      const flowerCount = 6 + Math.round(width / 70);
      for (let i = 0; i < flowerCount; i++) {
        this.flowers.push({
          id: this.nextFlowerId++,
          fx: (i + this.rng.range(0.15, 0.85)) / flowerCount,
          color: this.rng.pick(FLOWER_COLORS),
          size: u * this.rng.range(5, 8),
          petals: this.rng.int(5, 6),
          phase: this.rng.range(0, TAU),
          angle: 0,
          spin: 0,
          rainbow: 0,
          growth: 1,
          regrow: 0,
          flying: null,
          boost: 0,
        });
      }
      const cloudCount = 4 + Math.round(width / 300);
      for (let i = 0; i < cloudCount; i++) {
        this.clouds.push({
          x: this.rng.range(-100, width),
          y: this.rng.range(height * 0.06, height * 0.5),
          scale: u * this.rng.range(0.7, 1.3),
          speed: u * this.rng.range(5, 14),
          shape: this.rng.int(0, CLOUD_SHAPES - 1),
          vx: 0,
          wobble: 0,
        });
      }
      return;
    }
    for (const b of this.balloons) b.baseX = clamp(b.baseX, b.r, width - b.r);
    for (const c of this.clouds) c.y = clamp(c.y, height * 0.06, height * 0.5);
  }

  /** A finger (or mouse) touched the screen. */
  press(id: number, x: number, y: number): void {
    const trail: Trail = { id, hue: this.rng.range(0, 360), points: [{ x, y, t: this.time }], active: true };
    this.trails.push(trail);
    this.pointers.set(id, { id, x, y, travelled: 0, totalTravelled: 0, glideTravelled: 0, lastGlide: -1, trail });

    // Same order as the drawing: balloons in front of visitors, visitors in front of clouds, clouds in front of the sun.
    const balloon = this.findBalloonAt(x, y, TAP_HIT_FACTOR);
    if (balloon) {
      this.pop(balloon);
      return;
    }
    const visitor = this.findVisitorAt(x, y);
    if (visitor) {
      this.pokeVisitor(visitor, x, y);
      return;
    }
    const flower = this.findFlowerAt(x, y);
    if (flower) {
      this.spinFlower(flower, x, y);
      return;
    }
    const cloud = this.findCloudAt(x, y);
    if (cloud) {
      this.pokeCloud(cloud, x, y);
      return;
    }
    if (this.isOnSun(x, y)) {
      this.pokeSun(x, y);
      return;
    }
    // Touching empty sky is rewarded too: sparkles, and a brand new balloon inflates under the finger.
    this.sparkleBurst(x, y, 8);
    this.emit({ type: 'sparkle', x, y });
    if (this.balloons.length < this.config.maxBalloons) {
      const created = this.spawnBalloon({ x, y, inflate: true });
      if (created) this.emit({ type: 'spawn', x, y });
    }
  }

  /**
   * A finger moved while touching. The finger paints a ribbon, plays harp notes as it
   * travels, blows nearby balloons and clouds around, and pops the balloons it touches.
   */
  drag(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    const u = this.unit;
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const moved = Math.hypot(dx, dy);
    pointer.travelled += moved;
    pointer.totalTravelled += moved;
    pointer.glideTravelled += moved;
    pointer.x = x;
    pointer.y = y;

    const points = pointer.trail.points;
    const last = points[points.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) >= 3) {
      points.push({ x, y, t: this.time });
      if (points.length > TRAIL_MAX_POINTS) points.shift();
    }

    if (pointer.travelled > 26 * u) {
      pointer.travelled = 0;
      this.sparkleBurst(x, y, 1);
    }

    if (pointer.glideTravelled >= GLIDE_STEP * u && this.time - pointer.lastGlide >= GLIDE_MIN_INTERVAL) {
      pointer.glideTravelled = 0;
      pointer.lastGlide = this.time;
      const note = Math.round((1 - clamp(y / this.height, 0, 1)) * (GLIDE_NOTES - 1));
      this.emit({ type: 'glide', x, y, note });
    }

    this.wind(x, y, dx, dy, pointer.id);

    const balloon = this.findBalloonAt(x, y, DRAG_HIT_FACTOR, DRAG_MIN_AGE);
    if (balloon) {
      this.pop(balloon);
      return;
    }
    const visitor = this.findVisitorAt(x, y);
    if (visitor) {
      this.pokeVisitor(visitor, x, y);
      return;
    }
    if (moved > 1) {
      const flower = this.findFlowerAt(x, y);
      if (flower) {
        this.pluckFlower(flower, dx / moved, dy / moved);
        return;
      }
    }
    if (this.isOnSun(x, y) && this.sunHit > SUN_POKE_INTERVAL) this.pokeSun(x, y);
  }

  // ---- Flowers ---------------------------------------------------------------

  /** Where a flower's head is (its stem grows from the ground). */
  flowerHead(f: Flower): { x: number; y: number } {
    const x = f.fx * this.width;
    return { x, y: this.ground(x) + 4 * this.unit - f.size * (1 + f.boost) * 2.4 * f.growth };
  }

  findFlowerAt(x: number, y: number): Flower | null {
    let best: Flower | null = null;
    let bestDistance = Infinity;
    for (const f of this.flowers) {
      if (f.flying || f.growth < 0.5) continue;
      const head = this.flowerHead(f);
      const r = Math.max(f.size * 3.2, 24 * this.unit);
      const distance = Math.hypot(x - head.x, y - head.y) / r;
      if (distance <= 1 && distance < bestDistance) {
        bestDistance = distance;
        best = f;
      }
    }
    return best;
  }

  /** A tap makes the flower spin and shimmer through the rainbow for a few seconds. */
  private spinFlower(f: Flower, x: number, y: number): void {
    f.spin = (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(12, 18);
    f.rainbow = FLOWER_RAINBOW_TIME;
    const head = this.flowerHead(f);
    this.sparkleBurst(head.x, head.y, 6, [f.color, '#ffffff', '#fff6a8']);
    this.emit({ type: 'flower', x, y, what: 'spin' });
  }

  /** A swipe plucks the flower: the head flies off in the swipe's direction, spinning, and grows back later. */
  private pluckFlower(f: Flower, dirX: number, dirY: number): void {
    const u = this.unit;
    const head = this.flowerHead(f);
    f.flying = {
      x: head.x,
      y: head.y,
      vx: dirX * 140 * u + this.rng.range(-40, 40) * u,
      vy: -this.rng.range(240, 360) * u + Math.min(0, dirY) * 120 * u,
      life: 2.6,
    };
    f.spin = (dirX >= 0 ? 1 : -1) * this.rng.range(8, 16);
    f.growth = 0;
    f.regrow = FLOWER_REGROW_DELAY;
    this.sparkleBurst(head.x, head.y, 5, [f.color, '#b5e48c', '#ffffff']);
    this.emit({ type: 'flower', x: head.x, y: head.y, what: 'pluck' });
  }

  private updateFlowers(dt: number): void {
    const u = this.unit;
    for (const f of this.flowers) {
      f.rainbow = Math.max(0, f.rainbow - dt);
      f.boost = Math.max(0, f.boost - dt * 0.04);
      if (f.flying) {
        const fly = f.flying;
        fly.vy += 420 * u * dt;
        const drag = Math.max(0, 1 - 0.6 * dt);
        fly.vx *= drag;
        fly.vy *= drag;
        fly.x += fly.vx * dt;
        fly.y += fly.vy * dt;
        fly.life -= dt;
        f.angle += f.spin * dt;
        if (fly.life <= 0 || fly.y > this.height + 40 * u) {
          f.flying = null;
          f.spin = 0;
          f.angle = 0;
        }
        continue;
      }
      if (f.growth < 1) {
        f.regrow -= dt;
        if (f.regrow <= 0) f.growth = Math.min(1, f.growth + dt / FLOWER_REGROW_TIME);
      }
      f.angle += f.spin * dt;
      f.spin *= Math.max(0, 1 - 1.1 * dt);
      if (Math.abs(f.spin) < 0.05) f.spin = 0;
    }
  }

  // ---- Visitors --------------------------------------------------------------

  /** Where a visitor can be touched: a generous circle around its body. */
  visitorHit(v: Visitor): { x: number; y: number; r: number } {
    const s = v.size;
    switch (v.kind) {
      case 'dog':
        return { x: v.x, y: v.y - s * 0.8 - v.lift, r: s * 1.5 };
      case 'elephant':
        return { x: v.x, y: v.y + s * 0.1 - v.lift, r: s * 1.1 };
      case 'bird':
        return { x: v.x, y: v.y, r: s * 2.4 };
      case 'butterfly':
        return { x: v.x, y: v.y, r: s * 2.6 };
      case 'snail':
        return { x: v.x, y: v.y - s * 0.5, r: s * 1.8 };
      case 'star':
        return { x: v.x, y: v.y, r: s * 3.5 };
      case 'storm':
        return { x: v.x, y: v.y, r: s * 1.7 };
    }
  }

  /** The storm cloud on screen, if any. */
  get storm(): Visitor | null {
    return this.visitors.find((v) => v.kind === 'storm' && v.state !== 'gone') ?? null;
  }

  findVisitorAt(x: number, y: number): Visitor | null {
    let best: Visitor | null = null;
    let bestDistance = Infinity;
    for (const v of this.visitors) {
      if (v.state === 'gone') continue;
      const hit = this.visitorHit(v);
      const distance = Math.hypot(x - hit.x, y - hit.y) / hit.r;
      if (distance <= 1 && distance < bestDistance) {
        bestDistance = distance;
        best = v;
      }
    }
    return best;
  }

  private pickVisitorKind(): VisitorKind {
    const stormAllowed = this.time > STORM_FIRST_DELAY && this.time - this.lastStorm > STORM_MIN_INTERVAL && !this.storm;
    const weights = stormAllowed ? [...VISITOR_WEIGHTS, { kind: 'storm' as VisitorKind, weight: STORM_WEIGHT }] : VISITOR_WEIGHTS;
    const total = weights.reduce((sum, k) => sum + k.weight, 0);
    let roll = this.rng.range(0, total);
    for (const k of weights) {
      roll -= k.weight;
      if (roll <= 0) return k.kind;
    }
    return 'dog';
  }

  /** A creature drops by. Each kind enters in its own way and leaves again by itself. */
  spawnVisitor(kind: VisitorKind = this.pickVisitorKind()): Visitor {
    const u = this.unit;
    const W = this.width;
    const H = this.height;
    const dir: 1 | -1 = this.rng.chance(0.5) ? 1 : -1;
    const v: Visitor = {
      id: this.nextVisitorId++,
      kind,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      dir,
      age: 0,
      state: 'enter',
      stateAge: 0,
      size: u,
      pokes: 0,
      lastPoke: -Infinity,
      hue: this.rng.range(0, 360),
      targetX: 0,
      targetY: 0,
      lift: 0,
      form: null,
      formTimer: 0,
      lightning: 0,
      boltX: 0,
      nextLightning: this.rng.range(LIGHTNING_INTERVAL[0], LIGHTNING_INTERVAL[1]),
      wet: 0,
    };
    switch (kind) {
      case 'storm':
        v.size = 60 * u;
        v.x = dir === 1 ? -v.size * 3 : W + v.size * 3;
        v.y = this.rng.range(H * 0.16, H * 0.3);
        v.vx = dir * 14 * u;
        v.state = 'idle';
        this.lastStorm = this.time;
        break;
      case 'dog':
        v.size = 34 * u;
        v.x = dir === 1 ? -v.size * 2 : W + v.size * 2;
        v.vx = dir * 42 * u;
        v.y = this.ground(v.x);
        v.state = 'idle';
        break;
      case 'elephant':
        v.size = 60 * u;
        v.x = this.rng.range(W * 0.25, W * 0.75);
        v.y = this.ground(v.x);
        break;
      case 'bird':
        v.size = 16 * u;
        v.x = dir === 1 ? -v.size * 3 : W + v.size * 3;
        v.y = this.rng.range(H * 0.12, H * 0.45);
        v.vx = dir * 70 * u;
        v.state = 'idle';
        break;
      case 'butterfly':
        v.size = 14 * u;
        v.x = this.rng.range(W * 0.15, W * 0.85);
        v.y = this.ground(v.x) - 40 * u;
        v.state = 'idle';
        this.newButterflyTarget(v);
        break;
      case 'snail':
        v.size = 18 * u;
        v.x = dir === 1 ? -v.size * 2 : W + v.size * 2;
        v.vx = dir * 9 * u;
        v.y = this.ground(v.x);
        v.state = 'idle';
        break;
      case 'star':
        v.size = 12 * u;
        v.dir = 1;
        v.x = -v.size * 3;
        v.y = this.rng.range(H * 0.08, H * 0.3);
        v.vx = W / 1.6;
        v.vy = 70 * u;
        v.state = 'idle';
        break;
    }
    this.visitors.push(v);
    this.emit({ type: 'visitor', kind, x: v.x, y: v.y, what: 'appear' });
    return v;
  }

  private newButterflyTarget(v: Visitor): void {
    const u = this.unit;
    v.targetX = this.rng.range(this.width * 0.1, this.width * 0.9);
    v.targetY = this.ground(v.targetX) - this.rng.range(20, 150) * u;
  }

  private pokeVisitor(v: Visitor, x: number, y: number): void {
    // A finger sliding over a visitor sends a touch every few milliseconds; react at a natural pace instead.
    if (this.time - v.lastPoke < VISITOR_POKE_INTERVAL) return;
    v.lastPoke = this.time;
    const u = this.unit;
    v.pokes++;
    switch (v.kind) {
      case 'dog':
        // Jump for joy (only from the ground, so quick taps don't stack).
        if (v.lift <= 0.01 && v.vy === 0) v.vy = -300 * u;
        break;
      case 'elephant':
        if (v.state === 'idle' || v.state === 'react') {
          v.state = 'react';
          v.stateAge = 0;
        }
        break;
      case 'bird':
      case 'snail':
        v.state = 'react';
        v.stateAge = 0;
        break;
      case 'butterfly':
        v.state = 'react';
        v.stateAge = 0;
        this.newButterflyTarget(v);
        break;
      case 'star':
        this.sparkleBurst(v.x, v.y, 18, SUN_COLORS, v.size);
        v.state = 'gone';
        break;
      case 'storm':
        if (this.time - v.lastPoke < LIGHTNING_TOUCH_COOLDOWN && v.pokes > 1) return;
        this.strike(v, x);
        break;
    }
    this.sparkleBurst(x, y, 5);
    this.emit({ type: 'visitor', kind: v.kind, x, y, what: 'poke' });
  }

  // ---- Storm -------------------------------------------------------------

  /** True when x is under the storm's rain. */
  private underStorm(storm: Visitor, x: number, y: number): boolean {
    return Math.abs(x - storm.x) < storm.size * RAIN_HALF_WIDTH && y > storm.y;
  }

  /** Lightning from the storm cloud down to the ground: everything in its path reacts. */
  private strike(storm: Visitor, x: number): void {
    const u = this.unit;
    storm.lightning = LIGHTNING_FLASH;
    storm.boltX = clamp(x + this.rng.range(-20, 20) * u, storm.size * 0.5, this.width - storm.size * 0.5);
    storm.nextLightning = this.rng.range(LIGHTNING_INTERVAL[0], LIGHTNING_INTERVAL[1]);
    const reach = 60 * u;
    const groundY = this.ground(storm.boltX);
    this.emit({ type: 'lightning', x: storm.boltX, y: groundY });
    this.sparkleBurst(storm.boltX, groundY, 12, SUN_COLORS, 20 * u);

    // Balloons in the bolt's path pop with a bang.
    for (const b of [...this.balloons]) {
      if (Math.abs(b.x - storm.boltX) < reach + b.r && b.y > storm.y) this.pop(b);
    }
    // Flowers near the strike light up and spin.
    for (const f of this.flowers) {
      const head = this.flowerHead(f);
      if (!f.flying && Math.abs(head.x - storm.boltX) < reach * 1.5) {
        f.rainbow = FLOWER_RAINBOW_TIME;
        f.spin = (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(10, 16);
      }
    }
    // Creatures near the strike change shape for a while.
    for (const v of this.visitors) {
      if (v === storm || v.state === 'gone') continue;
      const hit = this.visitorHit(v);
      if (Math.abs(hit.x - storm.boltX) > reach + hit.r) continue;
      switch (v.kind) {
        case 'dog':
          this.transform(v, 'hotdog');
          break;
        case 'elephant':
          if (v.state === 'idle' || v.state === 'react') this.transform(v, 'mouse');
          break;
        case 'bird':
          this.transform(v, 'puffed');
          break;
        case 'snail':
          v.state = 'react';
          v.stateAge = 0;
          break;
        case 'butterfly':
          v.state = 'react';
          v.stateAge = 0;
          this.newButterflyTarget(v);
          break;
        default:
          break;
      }
    }
  }

  private transform(v: Visitor, form: VisitorForm): void {
    v.form = form;
    v.formTimer = FORM_TIME;
    const hit = this.visitorHit(v);
    this.sparkleBurst(hit.x, hit.y, 10, SUN_COLORS, hit.r * 0.6);
    this.emit({ type: 'transform', kind: v.kind, form, x: hit.x, y: hit.y });
  }

  private updateStorm(storm: Visitor, dt: number): void {
    const u = this.unit;
    storm.x += storm.vx * dt;
    storm.lightning = Math.max(0, storm.lightning - dt);
    storm.nextLightning -= dt;
    const onScreen = storm.x > storm.size && storm.x < this.width - storm.size;
    if (storm.nextLightning <= 0 && onScreen) this.strike(storm, storm.x + this.rng.range(-0.6, 0.6) * storm.size);

    // Rain: drops fall from the cloud's underside all the time.
    const drops = 22 * dt + (this.rng.chance((22 * dt) % 1) ? 1 : 0);
    for (let i = 0; i < Math.floor(drops); i++) {
      const life = this.rng.range(1.2, 1.8);
      this.addParticle({
        x: storm.x + this.rng.range(-RAIN_HALF_WIDTH, RAIN_HALF_WIDTH) * storm.size,
        y: storm.y + this.rng.range(0.3, 0.6) * storm.size,
        vx: storm.vx * 0.5,
        vy: u * this.rng.range(220, 300),
        life,
        maxLife: life,
        size: u * this.rng.range(4, 6),
        color: this.rng.pick(['#5b9bd5', '#7fb3e0', '#a6d8ff']),
        shape: 'drop',
        rot: 0,
        spin: 0,
        gravity: u * 300,
        drag: 0,
      });
    }

    // Rain presses balloons down, makes flowers grow and gets creatures wet.
    for (const b of this.balloons) {
      if (this.underStorm(storm, b.x, b.y)) b.vyImpulse = Math.min(b.vyImpulse + 130 * u * dt, 90 * u);
    }
    for (const f of this.flowers) {
      const head = this.flowerHead(f);
      if (!f.flying && this.underStorm(storm, head.x, head.y)) f.boost = Math.min(0.7, f.boost + dt * 0.5);
    }
    for (const v of this.visitors) {
      if (v === storm) continue;
      if (this.underStorm(storm, v.x, v.y)) {
        v.wet = 1.5;
        if (v.kind === 'snail' && v.state === 'idle') v.x += v.vx * dt * 2; // snails love rain
        if (v.kind === 'butterfly' && v.state === 'idle' && Math.abs(v.targetX - storm.x) < storm.size * RAIN_HALF_WIDTH) {
          this.newButterflyTarget(v);
        }
      }
    }

    const margin = storm.size * 3.2;
    if ((storm.dir === 1 && storm.x > this.width + margin) || (storm.dir === -1 && storm.x < -margin)) {
      storm.state = 'gone';
      this.rainbowGlow = RAINBOW_GLOW_TIME;
      this.emit({ type: 'visitor', kind: 'storm', x: storm.x, y: storm.y, what: 'leave' });
    }
  }

  private updateVisitors(dt: number): void {
    this.visitorTimer -= dt;
    if (this.visitorTimer <= 0) {
      this.visitorTimer = this.rng.range(VISIT_INTERVAL[0], VISIT_INTERVAL[1]);
      if (this.visitors.length < MAX_VISITORS) this.spawnVisitor();
    }
    const u = this.unit;
    const W = this.width;
    for (let i = this.visitors.length - 1; i >= 0; i--) {
      const v = this.visitors[i];
      v.age += dt;
      v.stateAge += dt;
      v.wet = Math.max(0, v.wet - dt);
      if (v.form) {
        v.formTimer -= dt;
        if (v.formTimer <= 0) {
          v.form = null;
          const hit = this.visitorHit(v);
          this.sparkleBurst(hit.x, hit.y, 8, SPARKLE_COLORS, hit.r * 0.5);
          this.emit({ type: 'transform', kind: v.kind, form: null, x: hit.x, y: hit.y });
        }
      }
      const margin = v.size * 3;
      const offScreen = (v.dir === 1 && v.x > W + margin) || (v.dir === -1 && v.x < -margin);
      switch (v.kind) {
        case 'dog': {
          v.x += v.vx * dt * (v.form === 'hotdog' ? 0.6 : 1);
          v.y = this.ground(v.x);
          if (v.vy !== 0 || v.lift > 0) {
            v.vy += 900 * u * dt;
            v.lift = Math.max(0, v.lift - v.vy * dt);
            if (v.lift === 0) v.vy = 0;
          }
          if (offScreen) v.state = 'gone';
          break;
        }
        case 'elephant': {
          const up = v.size * 1.15;
          if (v.state === 'enter') {
            v.lift = Math.min(up, v.lift + (dt * up) / 1.4);
            if (v.lift >= up) {
              v.state = 'idle';
              v.stateAge = 0;
            }
          } else if (v.state === 'react' && v.stateAge > 1.3) {
            v.state = 'idle';
            v.stateAge = 0;
          } else if (v.state === 'idle' && (v.stateAge > 10 || (v.pokes >= 4 && v.stateAge > 2))) {
            v.state = 'leave';
            v.stateAge = 0;
          } else if (v.state === 'leave') {
            v.lift -= (dt * up) / 1.2;
            if (v.lift <= 0) v.state = 'gone';
          }
          break;
        }
        case 'bird': {
          v.x += v.vx * dt;
          v.y += Math.sin(v.age * 2.2) * 30 * u * dt;
          if (v.state === 'react' && v.stateAge > 0.9) {
            v.state = 'idle';
            v.stateAge = 0;
          }
          if (offScreen) v.state = 'gone';
          break;
        }
        case 'butterfly': {
          const dx = v.targetX - v.x;
          const dy = v.targetY - v.y;
          const distance = Math.hypot(dx, dy);
          const speed = (v.state === 'react' ? 170 : v.state === 'leave' ? 90 : 55) * u;
          if (v.state !== 'leave' && (distance < 6 * u || (v.state === 'idle' && this.rng.chance(dt * 0.35)))) {
            this.newButterflyTarget(v);
          } else if (distance > 0.5) {
            v.x += (dx / distance) * speed * dt + Math.sin(v.age * 7) * 30 * u * dt;
            v.y += (dy / distance) * speed * dt + Math.cos(v.age * 5) * 20 * u * dt;
          }
          if (v.state === 'react' && v.stateAge > 1.2) {
            v.state = 'idle';
            v.stateAge = 0;
          }
          if (v.state !== 'leave' && v.age > 28) {
            v.state = 'leave';
            v.stateAge = 0;
            v.targetX = clamp(v.x + this.rng.range(-80, 80) * u, 0, W);
            v.targetY = -80 * u;
          }
          if (v.state === 'leave' && v.y < -40 * u) v.state = 'gone';
          break;
        }
        case 'snail': {
          if (v.state === 'react') {
            if (v.stateAge > 1.6) {
              v.state = 'idle';
              v.stateAge = 0;
            }
          } else if (v.state === 'leave') {
            // Sinks into the grass and is gone.
            v.lift -= dt * v.size;
            if (v.lift < -v.size * 1.6) v.state = 'gone';
          } else {
            v.x += v.vx * dt;
            v.y = this.ground(v.x);
            if (v.age > 36) {
              v.state = 'leave';
              v.stateAge = 0;
            }
          }
          if (offScreen) v.state = 'gone';
          break;
        }
        case 'star': {
          v.x += v.vx * dt;
          v.y += v.vy * dt;
          this.sparkleBurst(v.x - v.size, v.y, 1, SUN_COLORS);
          if (v.x > W + margin) v.state = 'gone';
          break;
        }
        case 'storm': {
          this.updateStorm(v, dt);
          break;
        }
      }
      if (v.state === 'gone') this.visitors.splice(i, 1);
    }
  }

  /** The phone was shaken: everything jumps, the sun gets dizzy and confetti flies. */
  shake(): void {
    const u = this.unit;
    for (const b of this.balloons) {
      b.vx = clamp(b.vx + u * this.rng.range(-260, 260), -500 * u, 500 * u);
      b.vyImpulse = clamp(b.vyImpulse - u * this.rng.range(140, 320), -500 * u, 500 * u);
    }
    for (const c of this.clouds) {
      c.wobble = 1;
      c.vx = clamp(c.vx + u * this.rng.range(-160, 160), -220 * u, 220 * u);
    }
    this.sunHit = 0;
    for (const f of this.flowers) {
      if (!f.flying) f.spin += (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(6, 12);
    }
    for (const v of this.visitors) {
      if (v.kind === 'dog' && v.lift <= 0.01) v.vy = -260 * u;
      if ((v.kind === 'elephant' && v.state === 'idle') || v.kind === 'snail' || v.kind === 'bird') {
        v.state = 'react';
        v.stateAge = 0;
      }
    }
    for (let i = 0; i < 24; i++) {
      const life = this.rng.range(0.9, 1.6);
      this.addParticle({
        x: this.rng.range(0, this.width),
        y: this.rng.range(this.height * 0.1, this.height * 0.9),
        vx: u * this.rng.range(-220, 220),
        vy: u * this.rng.range(-260, -60),
        life,
        maxLife: life,
        size: u * this.rng.range(6, 12),
        color: this.rng.pick(RAINBOW),
        shape: this.rng.chance(0.5) ? 'rect' : 'star',
        rot: this.rng.range(0, TAU),
        spin: this.rng.range(-12, 12),
        gravity: u * 500,
        drag: 1.2,
      });
    }
    this.emit({ type: 'shake' });
  }

  release(id: number): void {
    const pointer = this.pointers.get(id);
    if (pointer) {
      pointer.trail.active = false;
      if (pointer.totalTravelled >= SWIPE_MIN_TRAVEL * this.unit) {
        this.emit({ type: 'swipe', length: pointer.totalTravelled });
      }
    }
    this.pointers.delete(id);
  }

  /** Finds the balloon closest to a point, within `factor` times its outline. */
  findBalloonAt(x: number, y: number, factor: number, minAge = 0): Balloon | null {
    let best: Balloon | null = null;
    let bestDistance = Infinity;
    for (const b of this.balloons) {
      // A balloon the child just made should not burst under the very finger that made it.
      if (b.tapped && b.age < minAge) continue;
      const scale = Math.max(0.3, b.scale);
      const rx = b.r * scale * factor;
      const ry = b.r * 1.15 * scale * factor;
      const dx = (x - b.x) / rx;
      const dy = (y - b.y) / ry;
      const distance = dx * dx + dy * dy;
      if (distance <= 1 && distance < bestDistance) {
        bestDistance = distance;
        best = b;
      }
    }
    return best;
  }

  isOnSun(x: number, y: number): boolean {
    const sun = this.sun;
    return Math.hypot(x - sun.x, y - sun.y) <= sun.r * SUN_HIT_FACTOR;
  }

  findCloudAt(x: number, y: number): Cloud | null {
    for (const c of this.clouds) {
      const dx = (x - c.x) / (72 * c.scale);
      const dy = (y - c.y) / (44 * c.scale);
      if (dx * dx + dy * dy <= 1) return c;
    }
    return null;
  }

  spawnBalloon(options: SpawnOptions = {}): Balloon | null {
    if (this.balloons.length >= this.config.maxBalloons) return null;
    const u = this.unit;
    // Photo balloons take turns between the family photos and are a little bigger, so faces are easy to see.
    const photo = this.photoIds.length > 0 && this.rng.chance(PHOTO_CHANCE);
    const photoId = photo ? this.photoIds[this.nextPhoto++ % this.photoIds.length] : undefined;
    const r = u * this.rng.range(40, 56) * (photo ? 1.15 : 1);
    const kind: BalloonKind = photo ? 'photo' : this.pickKind();
    const color = kind === 'star' ? GOLD : kind === 'rainbow' ? RAINBOW_COLOR : this.rng.pick(BALLOON_COLORS);
    const x = options.x ?? this.rng.range(r * 1.3, Math.max(r * 1.3, this.width - r * 1.3));
    const y = options.y ?? this.height + r * 1.6;
    const swayAmp = u * this.rng.range(8, 22);
    const swayPhase = this.rng.range(0, TAU);
    const balloon: Balloon = {
      id: this.nextId++,
      x,
      y,
      // Choose baseX so the balloon starts exactly where it was created (no jump on the first frame).
      baseX: x - swayAmp * Math.sin(swayPhase),
      r,
      color,
      kind,
      face: this.rng.pick(FACES),
      vy: (this.height / 800) * this.rng.range(45, 85) * TEMPO[this.tempo].speed,
      swayAmp,
      swayFreq: this.rng.range(0.25, 0.5),
      swayPhase,
      scale: options.inflate ? 0 : 1,
      inflate: options.inflate ? 0 : 1,
      age: 0,
      blinkTimer: this.rng.range(1.5, 5),
      blink: 0,
      tapped: !!options.inflate,
      vx: 0,
      vyImpulse: 0,
      photoId,
    };
    this.balloons.push(balloon);
    return balloon;
  }

  update(dt: number): void {
    this.time += dt;
    this.sinceCelebration += dt;
    this.sunHit += dt;
    this.rainbowGlow = Math.max(0, this.rainbowGlow - dt);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      // Refill quickly when the screen is nearly empty so there is always something to pop.
      const hurry = this.balloons.length < 3 ? 0.45 : 1;
      const tempo = TEMPO[this.tempo];
      this.spawnTimer = this.config.spawnInterval * tempo.interval * hurry * this.rng.range(0.7, 1.3);
      if (this.balloons.length < Math.min(tempo.target, this.config.maxBalloons)) this.spawnBalloon();
    }

    const damping = Math.max(0, 1 - 2.5 * dt);
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      b.age += dt;
      if (b.inflate < 1) {
        b.inflate = Math.min(1, b.inflate + dt / INFLATE_TIME);
        b.scale = easeOutBack(b.inflate);
      } else {
        b.scale = 1;
      }
      b.y -= b.vy * dt * (0.3 + 0.7 * b.inflate);
      // Pushes from swipes: drift sideways/vertically and settle again.
      b.baseX += b.vx * dt;
      b.y += b.vyImpulse * dt;
      b.vx *= damping;
      b.vyImpulse *= damping;
      if (b.baseX < b.r) {
        b.baseX = b.r;
        b.vx = Math.abs(b.vx) * 0.5;
      } else if (b.baseX > this.width - b.r) {
        b.baseX = this.width - b.r;
        b.vx = -Math.abs(b.vx) * 0.5;
      }
      b.x = b.baseX + b.swayAmp * Math.sin(TAU * b.swayFreq * b.age + b.swayPhase);
      if (b.blink > 0) {
        b.blink -= dt;
      } else {
        b.blinkTimer -= dt;
        if (b.blinkTimer <= 0) {
          b.blink = 0.13;
          b.blinkTimer = this.rng.range(1.5, 5);
        }
      }
      if (b.y < -b.r * 2.5) this.balloons.splice(i, 1);
    }

    for (const c of this.clouds) {
      c.x += (c.speed + c.vx) * dt;
      c.vx *= Math.max(0, 1 - 2 * dt);
      c.wobble = Math.max(0, c.wobble - dt * 1.2);
      const w = 80 * c.scale;
      if (c.x - w > this.width) {
        c.x = -w;
        c.y = this.rng.range(this.height * 0.06, this.height * 0.5);
      } else if (c.x + w < -w) {
        c.x = this.width + w;
      }
    }

    this.updateVisitors(dt);
    this.updateFlowers(dt);

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      while (trail.points.length && this.time - trail.points[0].t > TRAIL_LIFE) trail.points.shift();
      if (!trail.active && trail.points.length === 0) this.trails.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  /** A moving finger blows nearby balloons and clouds along with it. */
  private wind(x: number, y: number, dx: number, dy: number, pointerId: number): void {
    const moved = Math.hypot(dx, dy);
    if (moved < 0.5) return;
    const u = this.unit;
    const push = Math.min(moved, 40 * u) * 1.2;
    const dirX = dx / moved;
    const dirY = dy / moved;
    for (const b of this.balloons) {
      const reach = b.r * WIND_REACH;
      const offX = b.x - x;
      const offY = b.y - y;
      const distance = Math.hypot(offX, offY);
      // Balloons ahead in the finger's lane are about to be popped, so the wind leaves them alone;
      // only balloons beside the lane (or behind the finger) get blown away.
      if (distance > reach || distance < b.r * 1.3) continue;
      const ahead = offX * dirX + offY * dirY;
      const lateral = Math.abs(offX * dirY - offY * dirX);
      if (ahead > 0 && lateral < b.r * DRAG_HIT_FACTOR * 1.2) continue;
      const strength = (1 - distance / reach) * push;
      b.vx = clamp(b.vx + dirX * strength * 6 + (offX / distance) * strength * 1.5, -420 * u, 420 * u);
      b.vyImpulse = clamp(b.vyImpulse + dirY * strength * 6 + (offY / distance) * strength * 1.5, -420 * u, 420 * u);
      // Count a balloon as "blown away" once per swipe, as soon as it visibly moves.
      if (b.blownBy !== pointerId && Math.abs(b.vx) + Math.abs(b.vyImpulse) > 40 * u) {
        b.blownBy = pointerId;
        this.emit({ type: 'blow' });
      }
    }
    for (const c of this.clouds) {
      const reach = 110 * c.scale;
      const distance = Math.hypot(c.x - x, c.y - y);
      if (distance > reach) continue;
      const strength = (1 - distance / reach) * push;
      c.vx = clamp(c.vx + dirX * strength * 3, -220 * u, 220 * u);
    }
  }

  private pokeSun(x: number, y: number): void {
    this.sunHit = 0;
    const sun = this.sun;
    this.sparkleBurst(sun.x, sun.y, 14, SUN_COLORS, sun.r);
    this.emit({ type: 'sun', x, y });
  }

  /** Touching a cloud makes it wobble and rain a few drops. */
  private pokeCloud(cloud: Cloud, x: number, y: number): void {
    cloud.wobble = 1;
    const u = this.unit;
    for (let i = 0; i < 12; i++) {
      const life = this.rng.range(0.9, 1.4);
      this.addParticle({
        x: cloud.x + this.rng.range(-60, 60) * cloud.scale,
        y: cloud.y + this.rng.range(10, 24) * cloud.scale,
        vx: u * this.rng.range(-15, 15),
        vy: u * this.rng.range(60, 160),
        life,
        maxLife: life,
        size: u * this.rng.range(5, 8),
        color: this.rng.pick(RAIN_COLORS),
        shape: 'drop',
        rot: 0,
        spin: 0,
        gravity: u * 500,
        drag: 0.3,
      });
    }
    this.emit({ type: 'cloud', x, y });
  }

  private pickKind(): BalloonKind {
    const total = KINDS.reduce((sum, k) => sum + k.weight, 0);
    let roll = this.rng.range(0, total);
    for (const k of KINDS) {
      roll -= k.weight;
      if (roll <= 0) return k.kind;
    }
    return 'plain';
  }

  private pop(balloon: Balloon): void {
    const index = this.balloons.indexOf(balloon);
    if (index < 0) return;
    this.balloons.splice(index, 1);
    this.pops++;

    const u = this.unit;
    const scale = Math.max(0.3, balloon.scale);
    const r = balloon.r * scale;

    // Expanding ring.
    this.addParticle({
      x: balloon.x,
      y: balloon.y,
      vx: 0,
      vy: 0,
      life: 0.4,
      maxLife: 0.4,
      size: r,
      color: balloon.color.light,
      shape: 'ring',
      rot: 0,
      spin: 0,
      gravity: 0,
      drag: 0,
    });

    // Confetti.
    const count = Math.round(14 + r / u / 4);
    const colors =
      balloon.kind === 'rainbow'
        ? RAINBOW
        : balloon.kind === 'star'
          ? [GOLD.main, GOLD.light, '#ffffff']
          : [balloon.color.main, balloon.color.light, this.rng.pick(RAINBOW), '#ffffff'];
    const lovey = balloon.color.name === 'pink' || balloon.color.name === 'red';
    for (let i = 0; i < count; i++) {
      const angle = this.rng.range(0, TAU);
      const speed = u * this.rng.range(120, 420);
      let shape: ParticleShape;
      if (balloon.kind === 'star') shape = this.rng.chance(0.7) ? 'star' : 'sparkle';
      else if (lovey && this.rng.chance(0.35)) shape = 'heart';
      else shape = this.rng.chance(0.5) ? 'rect' : 'circle';
      const life = this.rng.range(0.8, 1.5);
      this.addParticle({
        x: balloon.x + Math.cos(angle) * r * 0.5,
        y: balloon.y + Math.sin(angle) * r * 0.55,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - u * 90,
        life,
        maxLife: life,
        size: u * this.rng.range(5, 11),
        color: this.rng.pick(colors),
        shape,
        rot: this.rng.range(0, TAU),
        spin: this.rng.range(-12, 12),
        gravity: u * 700,
        drag: 1.6,
      });
    }

    // The string falls down on its own.
    this.addParticle({
      x: balloon.x,
      y: balloon.y + r * 1.3,
      vx: u * this.rng.range(-20, 20),
      vy: u * 30,
      life: 1.3,
      maxLife: 1.3,
      size: u * 50 * scale,
      color: balloon.color.dark,
      shape: 'string',
      rot: 0,
      spin: 0,
      gravity: u * 350,
      drag: 1.2,
    });

    // A popped photo balloon is not "gone": the family photo jumps out big, with hearts around it.
    if (balloon.kind === 'photo' && balloon.photoId) {
      const side = Math.min(this.width, this.height) * 0.42;
      const x = clamp(balloon.x, side * 0.6, this.width - side * 0.6);
      const y = clamp(balloon.y, side * 0.6 + this.sun.r, this.height - side * 0.7);
      this.addParticle({
        x,
        y,
        vx: 0,
        vy: 0,
        life: PHOTO_SHOW_TIME,
        maxLife: PHOTO_SHOW_TIME,
        size: side,
        color: balloon.color.main,
        shape: 'photo',
        rot: 0,
        spin: 0,
        gravity: 0,
        drag: 0,
        photoId: balloon.photoId,
      });
      for (let i = 0; i < 14; i++) {
        const angle = this.rng.range(0, TAU);
        const speed = u * this.rng.range(60, 200);
        const life = this.rng.range(1.2, 2);
        this.addParticle({
          x: x + Math.cos(angle) * side * 0.45,
          y: y + Math.sin(angle) * side * 0.45,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - u * 120,
          life,
          maxLife: life,
          size: u * this.rng.range(8, 14),
          color: this.rng.pick(['#ff4d6d', '#ff7ad9', '#ff9db0', '#ffffff']),
          shape: 'heart',
          rot: this.rng.range(-0.4, 0.4),
          spin: this.rng.range(-2, 2),
          gravity: u * 90,
          drag: 1.2,
        });
      }
    }

    const size = clamp((balloon.r / u - 40) / 16, 0, 1);
    this.emit({ type: 'pop', x: balloon.x, y: balloon.y, size, kind: balloon.kind, photoId: balloon.photoId });

    if (this.pops % this.config.celebrateEvery === 0) this.celebrate();
  }

  private celebrate(): void {
    const u = this.unit;
    for (let i = 0; i < 46; i++) {
      const life = this.rng.range(2.2, 3.6);
      this.addParticle({
        x: this.rng.range(0, this.width),
        y: -u * this.rng.range(10, 220),
        vx: u * this.rng.range(-40, 40),
        vy: u * this.rng.range(60, 200),
        life,
        maxLife: life,
        size: u * this.rng.range(6, 12),
        color: this.rng.pick(RAINBOW),
        shape: this.rng.chance(0.6) ? 'rect' : this.rng.chance(0.5) ? 'circle' : 'star',
        rot: this.rng.range(0, TAU),
        spin: this.rng.range(-8, 8),
        gravity: u * 60,
        drag: 0.6,
      });
    }
    this.sinceCelebration = 0;
    this.emit({ type: 'celebrate', pops: this.pops });
  }

  private sparkleBurst(x: number, y: number, count: number, colors: readonly string[] = SPARKLE_COLORS, spread = 0): void {
    const u = this.unit;
    for (let i = 0; i < count; i++) {
      const angle = this.rng.range(0, TAU);
      const speed = u * this.rng.range(40, 160);
      const life = this.rng.range(0.35, 0.7);
      this.addParticle({
        x: x + Math.cos(angle) * spread * this.rng.next(),
        y: y + Math.sin(angle) * spread * this.rng.next(),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - u * 40,
        life,
        maxLife: life,
        size: u * this.rng.range(4, 9),
        color: this.rng.pick(colors),
        shape: 'sparkle',
        rot: this.rng.range(0, TAU),
        spin: this.rng.range(-6, 6),
        gravity: u * 120,
        drag: 2,
      });
    }
  }

  private addParticle(particle: Particle): void {
    if (this.particles.length >= this.config.maxParticles) {
      // Drop the oldest ordinary particle; a family photo on display must not vanish early.
      const index = this.particles.findIndex((p) => p.shape !== 'photo');
      this.particles.splice(index < 0 ? 0 : index, 1);
    }
    this.particles.push(particle);
  }
}
