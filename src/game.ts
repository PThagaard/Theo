import { BALLOON_COLORS, GOLD, RAINBOW, RAINBOW_COLOR, SPARKLE_COLORS } from './palette';
import { Rng, TAU, clamp, easeOutBack } from './rng';
import type { Balloon, BalloonKind, Cloud, Face, GameEvent, Particle, ParticleShape, Trail } from './types';

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
  x: number;
  y: number;
  travelled: number;
  glideTravelled: number;
  lastGlide: number;
  trail: Trail;
}

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

  private nextId = 1;
  private spawnTimer = 0.4;
  private photoIds: string[] = [];
  private nextPhoto = 0;
  private tempo: Tempo = 'normal';
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
    this.pointers.set(id, { x, y, travelled: 0, glideTravelled: 0, lastGlide: -1, trail });

    // Same order as the drawing: balloons are in front of clouds, clouds in front of the sun.
    const balloon = this.findBalloonAt(x, y, TAP_HIT_FACTOR);
    if (balloon) {
      this.pop(balloon);
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

    this.wind(x, y, dx, dy);

    const balloon = this.findBalloonAt(x, y, DRAG_HIT_FACTOR, DRAG_MIN_AGE);
    if (balloon) {
      this.pop(balloon);
      return;
    }
    if (this.isOnSun(x, y) && this.sunHit > SUN_POKE_INTERVAL) this.pokeSun(x, y);
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
    if (pointer) pointer.trail.active = false;
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
  private wind(x: number, y: number, dx: number, dy: number): void {
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
    this.emit({ type: 'pop', x: balloon.x, y: balloon.y, size, kind: balloon.kind });

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
