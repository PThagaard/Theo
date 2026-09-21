import type { Game } from './game';
import { FARM_CHIMNEY, STRING_LENGTH, TRAIL_LIFE } from './game';
import { HILLS, RAINBOW, SKY } from './palette';
import { TAU, clamp, easeOutBack } from '../../engine/rng';
import { hillY } from './terrain';
import type { Balloon, Cloud, Flower, Particle, Trail, Visitor } from './types';

/**
 * Draws the world on a 2D canvas: sky, smiling sun, rainbow, clouds, flowery
 * hills, the balloons with their faces, the finger ribbons and all the confetti.
 */

/** Puff circles that make up each cloud: [dx, dy, radius]. The game picks a shape index. */
const CLOUD_SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [
    [0, 0, 30],
    [-30, 8, 22],
    [32, 6, 24],
    [8, -14, 22],
    [-12, -10, 18],
  ],
  [
    [0, 0, 26],
    [-26, 6, 20],
    [24, 4, 22],
    [4, -12, 18],
  ],
  [
    [0, 0, 34],
    [-36, 10, 24],
    [36, 8, 26],
    [-8, -16, 24],
    [18, -14, 22],
  ],
];

const EYE_COLOR = '#3b2a4a';

export class Renderer {
  /** Shared with other activities that borrow this renderer's creatures and scenery (see activities/ord). */
  readonly ctx: CanvasRenderingContext2D;
  W = 1;
  H = 1;
  private sunAngle = 0;
  private sky: CanvasGradient | null = null;
  time = 0;
  private photos = new Map<string, HTMLImageElement>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D er ikke understøttet');
    this.ctx = ctx;
  }

  /** Family photos for the photo balloons, keyed by id. */
  setPhotos(photos: Array<{ id: string; dataUrl: string }>): void {
    const next = new Map<string, HTMLImageElement>();
    for (const photo of photos) {
      const existing = this.photos.get(photo.id);
      if (existing) {
        next.set(photo.id, existing);
        continue;
      }
      const image = new Image();
      image.src = photo.dataUrl;
      next.set(photo.id, image);
    }
    this.photos = next;
  }

  photo(id: string | undefined): HTMLImageElement | null {
    if (!id) return null;
    const image = this.photos.get(id);
    return image && image.complete && image.naturalWidth > 0 ? image : null;
  }

  resize(width: number, height: number, dpr: number): void {
    this.W = width;
    this.H = height;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildScenery();
  }

  get u(): number {
    return Math.max(0.5, Math.min(this.W, this.H) / 400);
  }

  private buildScenery(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.H);
    gradient.addColorStop(0, SKY.top);
    gradient.addColorStop(0.55, SKY.middle);
    gradient.addColorStop(1, SKY.bottom);
    this.sky = gradient;
  }

  /** Paints the sky and advances the clock; other activities start their frame with this. */
  beginFrame(dt: number): void {
    this.time += dt;
    this.ctx.fillStyle = this.sky ?? SKY.middle;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  draw(game: Game, dt: number): void {
    this.time += dt;
    const ctx = this.ctx;
    ctx.fillStyle = this.sky ?? SKY.middle;
    ctx.fillRect(0, 0, this.W, this.H);
    // Asleep: the sun sinks behind the hills (it is drawn before them).
    ctx.save();
    const setting = game.dusk * game.dusk * (3 - 2 * game.dusk);
    ctx.translate(0, setting * this.H * 0.55);
    this.drawSun(game, dt);
    ctx.restore();
    this.drawRainbow(game.rainbowGlow > 0 ? Math.min(1, game.rainbowGlow / 2) : 0);
    for (const cloud of game.clouds) this.drawCloud(cloud);
    for (const v of game.visitors) if (v.kind === 'storm') this.drawStorm(v);
    this.drawHill(0);
    this.drawFarm(game);
    // The elephant peeks up from between the hills, so it is drawn before the front hill (unless it is airborne).
    const airborne = (v: Visitor) => v.state === 'carried' || v.state === 'falling';
    for (const v of game.visitors) if (v.kind === 'elephant' && !airborne(v)) this.drawVisitor(v);
    this.drawHill(1);
    for (const f of game.flowers) this.drawFlower(f, game);
    for (const v of game.visitors) if ((v.kind !== 'elephant' || airborne(v)) && v.kind !== 'storm') this.drawVisitor(v);
    for (const v of game.visitors) if (v.kind === 'storm' && v.lightning > 0) this.drawLightning(v, game);
    for (const b of game.balloons) this.drawString(b, game);
    for (const b of game.balloons) this.drawBalloon(b);
    for (const trail of game.trails) this.drawTrail(trail, game.time);
    for (const p of game.particles) this.drawParticle(p);
    if (game.dusk > 0) this.drawNight(game.dusk);
    // The whole sky lights up for an instant when lightning strikes.
    const flash = game.visitors.reduce((max, v) => Math.max(max, v.kind === 'storm' ? v.flash : 0), 0);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, flash * 2.5)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  // ---- Scenery -------------------------------------------------------------

  private drawSun(game: Game, dt: number): void {
    const ctx = this.ctx;
    const sun = game.sun;
    // The sun spins and bounces for a moment after every celebration and whenever it is touched.
    const party = Math.max(
      game.sinceCelebration < 1.6 ? 1 - game.sinceCelebration / 1.6 : 0,
      game.sunHit < 1.2 ? 1 - game.sunHit / 1.2 : 0,
    );
    const charge = game.sunCharge;
    this.sunAngle += dt * (0.12 + party * 5 + charge * 4);
    const wobbleClock = Math.min(game.sinceCelebration, game.sunHit);
    const pulse = party > 0 ? 1 + party * 0.12 * Math.sin(wobbleClock * 14) : 1;
    const r = sun.r * pulse;

    ctx.save();
    ctx.translate(sun.x, sun.y);
    if (charge > 0) {
      // Charging up under a held finger: a growing warm halo.
      const halo = ctx.createRadialGradient(0, 0, r, 0, 0, r * (1.8 + charge * 1.6));
      halo.addColorStop(0, `rgba(255, 230, 120, ${0.55 * charge})`);
      halo.addColorStop(1, 'rgba(255, 230, 120, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.8 + charge * 1.6), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 196, 40, 0.85)';
    for (let i = 0; i < 12; i++) {
      const a = this.sunAngle + (i * TAU) / 12;
      const length = r * (i % 2 ? 1.55 : 1.85) * (1 + charge * 0.35);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.17) * r * 1.1, Math.sin(a - 0.17) * r * 1.1);
      ctx.lineTo(Math.cos(a) * length, Math.sin(a) * length);
      ctx.lineTo(Math.cos(a + 0.17) * r * 1.1, Math.sin(a + 0.17) * r * 1.1);
      ctx.closePath();
      ctx.fill();
    }
    const disc = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    disc.addColorStop(0, '#fff7c2');
    disc.addColorStop(1, '#ffd23f');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    // A touched sun squeezes its eyes shut with joy.
    const gleeful = game.sunHit < 0.9;
    ctx.fillStyle = '#5a3d1e';
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      if (gleeful) {
        ctx.lineWidth = r * 0.07;
        ctx.beginPath();
        ctx.arc(side * r * 0.32, -r * 0.06, r * 0.12, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(side * r * 0.32, -r * 0.12, r * 0.08, r * 0.12, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * (gleeful ? 0.44 : 0.38), 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 120, 120, 0.45)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.55, r * 0.2, r * 0.13, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRainbow(glow = 0): void {
    const ctx = this.ctx;
    const u = this.u;
    const cx = this.W * 0.22;
    const cy = this.H * 0.92;
    const radius = Math.max(this.W * 0.42, 160 * u);
    ctx.save();
    // After a storm the rainbow shines brightly for a while, then settles back to its soft self.
    ctx.globalAlpha = 0.28 + 0.6 * Math.min(1, glow);
    ctx.lineWidth = 9 * u;
    ctx.lineCap = 'butt';
    RAINBOW.forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - i * 9 * u, Math.PI, TAU);
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawCloud(cloud: Cloud): void {
    const ctx = this.ctx;
    const wobble = cloud.wobble > 0 ? 1 + 0.1 * cloud.wobble * Math.sin(cloud.wobble * 22) : 1;
    ctx.save();
    // A held cloud turns grey and trembles a little before it becomes the storm cloud.
    const dark = cloud.dark;
    const tremble = dark > 0.6 ? Math.sin(this.time * 40) * (dark - 0.6) * 5 * this.u : 0;
    ctx.translate(cloud.x + tremble, cloud.y + dark * 6 * this.u);
    ctx.scale(cloud.scale * wobble, cloud.scale / wobble);
    const mix = (from: number, to: number) => Math.round(from + (to - from) * dark);
    ctx.fillStyle = `rgba(${mix(255, 96)}, ${mix(255, 92)}, ${mix(255, 122)}, 0.93)`;
    ctx.beginPath();
    for (const [dx, dy, r] of CLOUD_SHAPES[cloud.shape % CLOUD_SHAPES.length]) {
      ctx.moveTo(dx + r, dy);
      ctx.arc(dx, dy, r, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  }

  /** Night falls softly over everything: a blue veil, a moon and a few slow stars. Calm, never scary. */
  drawNight(dusk: number): void {
    const ctx = this.ctx;
    const u = this.u;
    ctx.save();
    ctx.fillStyle = `rgba(24, 28, 80, ${0.55 * dusk})`;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = Math.max(0, dusk - 0.3) / 0.7;
    // Stars, fixed places, twinkling slowly.
    ctx.fillStyle = '#fff6c4';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 0.618 + 0.13) % 1) * this.W;
      const y = ((i * 0.382 + 0.07) % 1) * this.H * 0.45;
      const twinkle = 0.6 + 0.4 * Math.sin(this.time * 1.5 + i);
      this.starPath(x, y, (3 + (i % 3)) * u * twinkle, 4, 0.4);
      ctx.fill();
    }
    // A sleepy crescent moon in the top left, away from the sun's old spot.
    const mx = this.W * 0.2;
    const my = this.H * 0.14;
    const r = 26 * u;
    ctx.fillStyle = '#fff1a8';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(24, 28, 80, ${0.55 * dusk + 0.45})`;
    ctx.beginPath();
    ctx.arc(mx + r * 0.45, my - r * 0.2, r * 0.85, 0, TAU);
    ctx.fill();
    // Closed, smiling eyes on the lit part.
    ctx.strokeStyle = '#b9962a';
    ctx.lineWidth = 2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(mx - r * 0.35, my + r * 0.05, r * 0.14, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx - r * 0.3, my + r * 0.4, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  private hillY(x: number, layer: 0 | 1): number {
    return hillY(x, this.W, this.H, this.u, layer);
  }

  drawHill(layer: 0 | 1): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * this.W;
      ctx.lineTo(x, this.hillY(x, layer));
    }
    ctx.lineTo(this.W, this.H);
    ctx.closePath();
    ctx.fillStyle = layer === 0 ? HILLS.back : HILLS.front;
    ctx.fill();
  }

  /** A flower on the hill (or its head flying through the air after being plucked). */
  private drawFlower(f: Flower, game: Game): void {
    const ctx = this.ctx;
    const u = this.u;
    const x = f.fx * this.W;
    const baseY = this.hillY(x, 1) + 4 * u;
    const growth = f.growth < 1 ? clamp(easeOutBack(f.growth), 0, 1.3) : 1;
    const sway = Math.sin(this.time * 1.6 + f.phase) * 0.12;

    if (f.flying) {
      // The plucked head tumbles through the air with a little stem still attached.
      ctx.save();
      ctx.translate(f.flying.x, f.flying.y);
      ctx.rotate(f.angle);
      ctx.strokeStyle = HILLS.frontDark;
      ctx.lineWidth = 2 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, f.size * 1.4);
      ctx.stroke();
      this.drawFlowerHead(f, 1, game.time);
      ctx.restore();
    }

    if (growth <= 0.02) {
      // Only a stub is left where the flower was plucked.
      ctx.fillStyle = HILLS.frontDark;
      ctx.beginPath();
      ctx.arc(x, baseY, 2 * u, 0, TAU);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(sway);
    ctx.strokeStyle = HILLS.frontDark;
    ctx.lineWidth = 2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -f.size * (1 + f.boost) * 2.2 * growth);
    ctx.stroke();
    ctx.translate(0, -f.size * (1 + f.boost) * 2.4 * growth);
    ctx.rotate(f.angle);
    this.drawFlowerHead(f, growth, game.time);
    ctx.restore();
  }

  private drawFlowerHead(f: Flower, scale: number, now: number): void {
    const ctx = this.ctx;
    const size = f.size * (1 + f.boost) * scale;
    for (let i = 0; i < f.petals; i++) {
      const a = (i / f.petals) * TAU;
      // A tapped flower shimmers: every petal runs through the rainbow at its own offset.
      ctx.fillStyle = f.rainbow > 0 ? `hsl(${(now * 260 + i * 60 + f.id * 40) % 360}, 90%, 62%)` : f.color;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * size * 0.75, Math.sin(a) * size * 0.75, size * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = f.rainbow > 0 ? '#ffffff' : '#ffdf5e';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, TAU);
    ctx.fill();
  }

  // ---- Visitors ------------------------------------------------------------

  drawVisitor(v: Visitor): void {
    const ctx = this.ctx;
    ctx.save();
    if (v.state === 'falling') this.drawParachute(v);
    if (v.state === 'carried') {
      // Dangling from the string: swing gently around the hook point.
      const hook = { x: v.x, y: v.y - v.size * 0.8 - v.lift };
      ctx.translate(hook.x, hook.y);
      ctx.rotate(Math.sin(v.stateAge * 3) * 0.18);
      ctx.translate(-hook.x, -hook.y);
    }
    if (v.wet > 0) this.drawDrips(v);
    switch (v.kind) {
      case 'dog':
        if (v.form === 'hotdog') this.drawHotdog(v);
        else this.drawDog(v);
        break;
      case 'elephant':
        if (v.form === 'mouse') this.drawMouse(v);
        else this.drawElephant(v);
        break;
      case 'bird':
        if (v.form === 'puffed') this.drawPuffedBird(v);
        else this.drawBird(v);
        break;
      case 'butterfly':
        this.drawButterfly(v);
        break;
      case 'snail':
        this.drawSnail(v);
        break;
      case 'star':
        this.drawShootingStar(v);
        break;
      case 'tractor':
        this.drawTractor(v);
        break;
      case 'storm':
        break;
    }
    ctx.restore();
  }

  /** The little farm on the back hill: a fence and a red barn with a smoking chimney. */
  private drawFarm(game: Game): void {
    const ctx = this.ctx;
    const u = this.u;
    const a = game.farmAnchor();
    ctx.save();
    ctx.translate(a.x, a.y);
    // Fence along the hill: every post stands on the ground right under it, the rails follow the slope.
    const groundAt = (x: number) => this.hillY(a.x + x, 0) - a.y + 2 * u;
    ctx.strokeStyle = '#a97142';
    ctx.lineWidth = 2.2 * u;
    ctx.lineCap = 'round';
    for (let i = -6; i <= -2; i++) {
      const x = i * 12 * u;
      ctx.beginPath();
      ctx.moveTo(x, groundAt(x));
      ctx.lineTo(x, groundAt(x) - 16 * u);
      ctx.stroke();
    }
    for (const rail of [-11, -5]) {
      ctx.beginPath();
      ctx.moveTo(-72 * u, groundAt(-72 * u) + rail * u);
      ctx.lineTo(-24 * u, groundAt(-24 * u) + rail * u);
      ctx.stroke();
    }
    // Barn: red walls with white trim, a chimney, a dark roof, a big door and a round gable window.
    ctx.fillStyle = '#d9483b';
    ctx.fillRect(-30 * u, -42 * u, 60 * u, 44 * u);
    ctx.fillStyle = '#5a3d33';
    ctx.fillRect((FARM_CHIMNEY.dx - 4) * u, FARM_CHIMNEY.dy * u, 8 * u, (-40 - FARM_CHIMNEY.dy) * u + 2 * u);
    ctx.fillStyle = '#6b4a3a';
    ctx.beginPath();
    ctx.moveTo(-36 * u, -40 * u);
    ctx.lineTo(0, -66 * u);
    ctx.lineTo(36 * u, -40 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f6efe6';
    ctx.fillRect(-30 * u, -41 * u, 60 * u, 3 * u);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(-11 * u, -24 * u, 22 * u, 26 * u);
    ctx.strokeStyle = '#f6efe6';
    ctx.lineWidth = 1.5 * u;
    ctx.strokeRect(-11 * u, -24 * u, 22 * u, 26 * u);
    ctx.beginPath();
    ctx.moveTo(-11 * u, -24 * u);
    ctx.lineTo(11 * u, 2 * u);
    ctx.moveTo(11 * u, -24 * u);
    ctx.lineTo(-11 * u, 2 * u);
    ctx.stroke();
    ctx.fillStyle = '#f6efe6';
    ctx.beginPath();
    ctx.arc(0, -50 * u, 5 * u, 0, TAU);
    ctx.fill();
    // A little mound of grass in front of the base, so the barn sits in the hill rather than on a line.
    ctx.fillStyle = HILLS.back;
    ctx.beginPath();
    ctx.ellipse(0, 1 * u, 42 * u, 6 * u, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** An old red tractor: big back wheel, small front wheel, a tall chimney and a face on the grille. */
  private drawTractor(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    ctx.translate(v.x, v.y - v.lift);
    ctx.scale(v.dir, 1);
    const rolling = v.vx !== 0 ? v.age * 6 : Math.sin(v.age * 8) * 0.05;
    this.wheel(-s * 0.55, -s * 0.55, s * 0.55, rolling);
    this.wheel(s * 0.75, -s * 0.32, s * 0.32, rolling * 1.7);
    // Engine hood and cab.
    ctx.fillStyle = '#e0473b';
    ctx.beginPath();
    ctx.roundRect(-s * 0.3, -s * 1.0, s * 1.25, s * 0.5, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#c93a2f';
    ctx.beginPath();
    ctx.roundRect(-s * 0.85, -s * 1.5, s * 0.75, s * 1.0, s * 0.12);
    ctx.fill();
    // Seat, steering wheel and chimney.
    ctx.fillStyle = '#3a2f2a';
    ctx.fillRect(-s * 0.8, -s * 1.62, s * 0.4, s * 0.14);
    ctx.strokeStyle = '#3a2f2a';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 1.5);
    ctx.lineTo(-s * 0.05, -s * 1.3);
    ctx.stroke();
    ctx.fillRect(s * 0.3, -s * 1.75, s * 0.14, s * 0.75);
    // A friendly face on the grille, and a headlight.
    ctx.fillStyle = '#f6efe6';
    ctx.beginPath();
    ctx.roundRect(s * 0.62, -s * 0.95, s * 0.3, s * 0.4, s * 0.06);
    ctx.fill();
    this.eye(s * 0.72, -s * 0.85, s * 0.05);
    this.eye(s * 0.84, -s * 0.85, s * 0.05);
    ctx.strokeStyle = EYE_COLOR;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.arc(s * 0.78, -s * 0.7, s * 0.07, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.arc(s * 0.97, -s * 0.7, s * 0.07, 0, TAU);
    ctx.fill();
  }

  private wheel(x: number, y: number, r: number, angle: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#2f2a2a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = r * 0.12;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos((i * Math.PI) / 2) * r * 0.5, Math.sin((i * Math.PI) / 2) * r * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A little parachute for a creature floating back down to the ground. */
  private drawParachute(v: Visitor): void {
    const ctx = this.ctx;
    const u = this.u;
    const r = Math.max(v.size * 1.4, 28 * u);
    const top = v.y - v.size * 1.6 - v.lift - r * 1.3;
    ctx.save();
    ctx.strokeStyle = 'rgba(70, 50, 90, 0.6)';
    ctx.lineWidth = 1.5 * u;
    for (const side of [-1, -0.35, 0.35, 1]) {
      ctx.beginPath();
      ctx.moveTo(v.x + side * r, top);
      ctx.lineTo(v.x, v.y - v.size * 0.9 - v.lift);
      ctx.stroke();
    }
    const canopy = ctx.createLinearGradient(v.x - r, top, v.x + r, top);
    canopy.addColorStop(0, '#ff7ad9');
    canopy.addColorStop(0.5, '#ffd93d');
    canopy.addColorStop(1, '#4d96ff');
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.arc(v.x, top, r, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (const side of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.arc(v.x + side * r, top, r * 0.28, Math.PI, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Little drops flying off a creature that has been rained on. */
  private drawDrips(v: Visitor): void {
    const ctx = this.ctx;
    const u = this.u;
    ctx.save();
    ctx.fillStyle = 'rgba(120, 180, 240, 0.7)';
    for (let i = 0; i < 4; i++) {
      const a = this.time * 5 + i * 1.7;
      ctx.beginPath();
      ctx.ellipse(v.x + Math.cos(a) * v.size * 1.1, v.y - v.size * 0.8 - v.lift + Math.sin(a * 1.3) * v.size * 0.5, 2 * u, 3 * u, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The dog after a lightning strike: a hotdog in a bun, still wagging. */
  private drawHotdog(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    ctx.translate(v.x, v.y - v.lift);
    ctx.scale(v.dir, 1);
    // Short legs.
    ctx.strokeStyle = '#c8863c';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.2;
    for (const x of [-0.5, -0.15, 0.25, 0.6]) {
      const swing = Math.sin(v.age * 9 + x * 10) * s * 0.15;
      ctx.beginPath();
      ctx.moveTo(x * s, -s * 0.45);
      ctx.lineTo(x * s + swing, 0);
      ctx.stroke();
    }
    // Bun.
    ctx.fillStyle = '#e9b46a';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.72, s * 1.05, s * 0.4, 0, 0, TAU);
    ctx.fill();
    // Sausage with a wiggle of mustard.
    ctx.fillStyle = '#c8553d';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.85, s * 1.15, s * 0.24, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    for (let x = -s * 0.9; x <= s * 0.9; x += s * 0.15) {
      const y = -s * 0.85 + Math.sin(x / s * 12) * s * 0.08;
      if (x === -s * 0.9) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Top bun.
    ctx.fillStyle = '#f2c785';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.98, s * 1.0, s * 0.28, 0, Math.PI, TAU);
    ctx.fill();
    // Head at the front, tail at the back.
    ctx.fillStyle = '#c8863c';
    ctx.beginPath();
    ctx.arc(s * 1.2, -s * 1.0, s * 0.36, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.ellipse(s * 1.0, -s * 1.15, s * 0.12, s * 0.26, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = EYE_COLOR;
    ctx.beginPath();
    ctx.arc(s * 1.52, -s * 0.98, s * 0.08, 0, TAU);
    ctx.fill();
    this.eye(s * 1.26, -s * 1.1, s * 0.07);
    ctx.strokeStyle = '#c8863c';
    ctx.lineWidth = s * 0.14;
    const wag = Math.sin(v.age * 16) * s * 0.25;
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, -s * 0.85);
    ctx.quadraticCurveTo(-s * 1.4, -s * 1.1, -s * 1.5 + wag * 0.3, -s * 1.25 + wag);
    ctx.stroke();
  }

  /** The elephant after a lightning strike: a small mouse peeking up from the same spot. */
  private drawMouse(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size * 0.5;
    const cy = v.size * 0.1 - v.lift + v.size * 0.35;
    ctx.translate(v.x, v.y);
    // Ears.
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#9b9b9b';
      ctx.beginPath();
      ctx.arc(side * s * 0.6, cy - s * 0.55, s * 0.42, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f5b8c8';
      ctx.beginPath();
      ctx.arc(side * s * 0.6, cy - s * 0.55, s * 0.26, 0, TAU);
      ctx.fill();
    }
    // Head with a pointy snout.
    ctx.fillStyle = '#b3b3b3';
    ctx.beginPath();
    ctx.ellipse(0, cy, s * 0.75, s * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, cy + s * 0.1);
    ctx.lineTo(0, cy + s * 0.75);
    ctx.lineTo(s * 0.5, cy + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a9a';
    ctx.beginPath();
    ctx.arc(0, cy + s * 0.68, s * 0.1, 0, TAU);
    ctx.fill();
    // Whiskers.
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.7)';
    ctx.lineWidth = s * 0.04;
    for (const side of [-1, 1]) {
      for (const dy of [-0.05, 0.08]) {
        ctx.beginPath();
        ctx.moveTo(side * s * 0.15, cy + s * 0.55);
        ctx.lineTo(side * s * 0.9, cy + s * 0.45 + dy * s * 3);
        ctx.stroke();
      }
    }
    for (const side of [-1, 1]) this.eye(side * s * 0.28, cy - s * 0.05, s * 0.1);
    // A tail that curls up beside it.
    ctx.strokeStyle = '#9b9b9b';
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(s * 0.8, cy + s * 0.5);
    ctx.quadraticCurveTo(s * 1.5, cy + s * 0.3 + Math.sin(v.age * 4) * s * 0.2, s * 1.3, cy - s * 0.4);
    ctx.stroke();
  }

  /** The bird with its feathers standing on end after a fright. */
  private drawPuffedBird(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    ctx.translate(v.x, v.y);
    ctx.scale(v.dir, 1);
    ctx.fillStyle = '#4d96ff';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const r = s * (1.5 + 0.25 * Math.sin(v.age * 30 + i));
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, s * 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.35, s * 0.6, s * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.moveTo(s * 1.0, -s * 0.1);
    ctx.lineTo(s * 1.6, 0.05 * s);
    ctx.lineTo(s * 1.0, s * 0.2);
    ctx.closePath();
    ctx.fill();
    this.eye(s * 0.6, -s * 0.3, s * 0.16);
  }

  /** The dark storm cloud: bigger and darker than the others, lit up from inside when it flashes. */
  private drawStorm(v: Visitor): void {
    const ctx = this.ctx;
    const scale = (v.size / 60) * 1.7;
    const lit = v.lightning > 0.25;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.scale(scale, scale);
    const body = ctx.createLinearGradient(0, -34, 0, 30);
    body.addColorStop(0, lit ? '#c9d3e0' : '#8b96a6');
    body.addColorStop(1, lit ? '#8a97ab' : '#4e5866');
    ctx.fillStyle = body;
    ctx.beginPath();
    for (const [dx, dy, r] of CLOUD_SHAPES[2]) {
      ctx.moveTo(dx + r, dy);
      ctx.arc(dx, dy, r, 0, TAU);
    }
    ctx.fill();
    // A cheeky, happy face: this cloud is fun, not scary. Eyes go wide and the grin opens when it flashes.
    const wide = lit ? 1.3 : 1;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(side * 15, -4, 7 * wide, 8.5 * wide, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2f3641';
      ctx.beginPath();
      ctx.arc(side * 15 + (lit ? 0 : side * 1.5), -3, 3.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 140, 160, 0.5)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 27, 9, 5, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#2f3641';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 7, lit ? 12 : 9, 0.15 * Math.PI, 0.85 * Math.PI);
    if (lit) {
      ctx.closePath();
      ctx.fillStyle = '#2f3641';
      ctx.fill();
    }
    ctx.stroke();
    ctx.restore();
  }

  /** A jagged bolt from the cloud to the ground, fading with the flash. */
  private drawLightning(v: Visitor, game: Game): void {
    const ctx = this.ctx;
    const u = this.u;
    const alpha = Math.min(1, v.lightning / 0.3);
    const top = v.y + v.size * 0.4;
    const bottom = game.ground(v.boltX);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, colour] of [
      [14 * u, `rgba(255, 240, 150, ${alpha * 0.35})`],
      [4 * u, `rgba(255, 255, 255, ${alpha})`],
    ] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(v.x, top);
      const segments = 6;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = v.x + (v.boltX - v.x) * t + Math.sin(i * 12.9898 + v.boltX) * 22 * u * (i < segments ? 1 : 0);
        ctx.lineTo(x, top + (bottom - top) * t);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private eye(x: number, y: number, r: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = EYE_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU);
    ctx.fill();
  }

  /** Side view, facing `dir`, feet on the ground; jumps when touched. */
  private drawDog(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    const jumping = v.lift > 0;
    ctx.translate(v.x, v.y - v.lift);
    ctx.scale(v.dir, 1);
    const stride = jumping ? 0 : Math.sin(v.age * 9);
    ctx.strokeStyle = '#c8863c';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.22;
    // Legs (back pair slightly darker so the walk reads).
    for (const [x, phase, shade] of [
      [-0.45, 0, '#a86e2e'],
      [0.45, Math.PI, '#a86e2e'],
      [-0.3, Math.PI, '#c8863c'],
      [0.6, 0, '#c8863c'],
    ] as const) {
      const swing = jumping ? 0 : Math.sin(v.age * 9 + phase) * s * 0.25;
      ctx.strokeStyle = shade;
      ctx.beginPath();
      ctx.moveTo(x * s, -s * 0.6);
      ctx.lineTo(x * s + swing, jumping ? -s * 0.25 : 0);
      ctx.stroke();
    }
    // Tail, wagging faster when happy.
    ctx.strokeStyle = '#c8863c';
    ctx.lineWidth = s * 0.14;
    const wag = Math.sin(v.age * (jumping || v.pokes > 0 ? 18 : 10)) * s * 0.25;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.95);
    ctx.quadraticCurveTo(-s * 1.0, -s * 1.25, -s * 1.1 + wag * 0.3, -s * 1.35 + wag);
    ctx.stroke();
    // Body.
    ctx.fillStyle = '#c8863c';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.78 + stride * s * 0.02, s * 0.78, s * 0.42, 0, 0, TAU);
    ctx.fill();
    // Head, snout, ear, nose, eye.
    ctx.beginPath();
    ctx.arc(s * 0.78, -s * 1.18, s * 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b072';
    ctx.beginPath();
    ctx.ellipse(s * 1.06, -s * 1.06, s * 0.26, s * 0.19, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a5a2b';
    ctx.beginPath();
    ctx.ellipse(s * 0.56, -s * 1.3, s * 0.14, s * 0.3, jumping ? -0.5 : 0.25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = EYE_COLOR;
    ctx.beginPath();
    ctx.arc(s * 1.28, -s * 1.12, s * 0.09, 0, TAU);
    ctx.fill();
    this.eye(s * 0.86, -s * 1.28, s * 0.07);
    // Happy mouth (and tongue when jumping).
    ctx.strokeStyle = EYE_COLOR;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(s * 1.05, -s * 1.0, s * 0.12, 0.1 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    if (jumping) {
      ctx.fillStyle = '#ff7a9a';
      ctx.beginPath();
      ctx.ellipse(s * 1.1, -s * 0.86, s * 0.07, s * 0.12, 0, 0, TAU);
      ctx.fill();
    }
  }

  /** Front view: head and ears rising from behind the front hill; trumpets with the trunk up. */
  private drawElephant(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    const cy = s * 0.1 - v.lift;
    const trumpeting = v.state === 'react';
    const flap = Math.sin(v.age * 3) * 0.08 + (trumpeting ? Math.sin(v.stateAge * 20) * 0.2 : 0);
    ctx.translate(v.x, v.y);
    // Ears.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * s * 0.6, cy - s * 0.05);
      ctx.rotate(side * flap);
      ctx.fillStyle = '#8f9bab';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.42, s * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8b6c8';
      ctx.beginPath();
      ctx.ellipse(side * -s * 0.05, 0, s * 0.28, s * 0.36, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Head.
    ctx.fillStyle = '#9aa5b1';
    ctx.beginPath();
    ctx.arc(0, cy, s * 0.62, 0, TAU);
    ctx.fill();
    // Trunk: hangs down and curls, or lifts high when trumpeting.
    ctx.strokeStyle = '#9aa5b1';
    ctx.lineWidth = s * 0.24;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, cy + s * 0.32);
    if (trumpeting) {
      ctx.bezierCurveTo(s * 0.1, cy + s * 0.9, s * 0.9, cy + s * 0.6, s * 0.75, cy - s * 0.45);
    } else {
      const sway = Math.sin(v.age * 1.5) * s * 0.12;
      ctx.bezierCurveTo(0, cy + s * 0.85, s * 0.05 + sway, cy + s * 1.15, s * 0.35 + sway, cy + s * 1.05);
    }
    ctx.stroke();
    // Tusks, cheeks and eyes.
    ctx.strokeStyle = '#fff8e6';
    ctx.lineWidth = s * 0.1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.22, cy + s * 0.42);
      ctx.quadraticCurveTo(side * s * 0.32, cy + s * 0.62, side * s * 0.4, cy + s * 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 105, 140, 0.3)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * s * 0.38, cy + s * 0.12, s * 0.11, 0, TAU);
      ctx.fill();
    }
    if (trumpeting) {
      ctx.strokeStyle = EYE_COLOR;
      ctx.lineWidth = s * 0.05;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * s * 0.22, cy - s * 0.1, s * 0.09, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else {
      for (const side of [-1, 1]) this.eye(side * s * 0.22, cy - s * 0.14, s * 0.07);
    }
  }

  /** A little blue bird flapping across the sky; loops the loop when touched. */
  private drawBird(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    ctx.translate(v.x, v.y);
    ctx.scale(v.dir, 1);
    if (v.state === 'react') ctx.rotate(-(v.stateAge / 0.9) * TAU);
    const flapY = -Math.sin(v.age * 14) * s * 1.1;
    // Far wing.
    ctx.fillStyle = '#2b6fd9';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.2);
    ctx.lineTo(-s * 1.1, flapY - s * 0.2);
    ctx.lineTo(s * 0.4, -s * 0.1);
    ctx.closePath();
    ctx.fill();
    // Body, tail, head.
    ctx.fillStyle = '#4d96ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, -s * 0.1);
    ctx.lineTo(-s * 1.6, -s * 0.5);
    ctx.lineTo(-s * 1.5, s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.95, -s * 0.45, s * 0.52, 0, TAU);
    ctx.fill();
    // Near wing.
    ctx.fillStyle = '#7ab6ff';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(-s * 0.9, flapY);
    ctx.lineTo(s * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    // Beak, eye, belly.
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.moveTo(s * 1.4, -s * 0.5);
    ctx.lineTo(s * 1.95, -s * 0.35);
    ctx.lineTo(s * 1.4, -s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.ellipse(s * 0.15, s * 0.25, s * 0.6, s * 0.35, 0, 0, TAU);
    ctx.fill();
    this.eye(s * 1.1, -s * 0.55, s * 0.12);
  }

  /** Colourful wings that flap while it flutters around the flowers. */
  private drawButterfly(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    const flap = 0.35 + Math.abs(Math.sin(v.age * (v.state === 'react' ? 22 : 11))) * 0.65;
    ctx.translate(v.x, v.y);
    ctx.rotate(Math.sin(v.age * 2) * 0.15);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side * flap, 1);
      ctx.fillStyle = `hsl(${v.hue}, 85%, 62%)`;
      ctx.beginPath();
      ctx.ellipse(s * 0.95, -s * 0.35, s * 0.95, s * 0.72, -0.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `hsl(${(v.hue + 45) % 360}, 85%, 60%)`;
      ctx.beginPath();
      ctx.ellipse(s * 0.75, s * 0.55, s * 0.65, s * 0.5, 0.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(s * 1.1, -s * 0.4, s * 0.22, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = EYE_COLOR;
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.28;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.8);
    ctx.lineTo(0, s * 0.9);
    ctx.stroke();
    ctx.lineWidth = s * 0.08;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.quadraticCurveTo(side * s * 0.3, -s * 1.3, side * s * 0.55, -s * 1.45);
      ctx.stroke();
    }
  }

  /** Slow and easy to catch; pulls into its shell when touched. */
  private drawSnail(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    const hiding = v.state === 'react';
    const out = hiding ? (v.stateAge < 0.3 ? 1 - v.stateAge / 0.3 : v.stateAge < 1.2 ? 0 : Math.min(1, (v.stateAge - 1.2) / 0.4)) : 1;
    ctx.translate(v.x, v.y - v.lift);
    ctx.scale(v.dir, 1);
    // Body (retracts into the shell).
    if (out > 0.02) {
      ctx.save();
      ctx.translate(-s * 0.2, 0);
      ctx.scale(out, 0.6 + 0.4 * out);
      ctx.fillStyle = '#b5e48c';
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, 0);
      ctx.quadraticCurveTo(-s * 0.9, -s * 0.5, -s * 0.2, -s * 0.5);
      ctx.lineTo(s * 1.0, -s * 0.5);
      ctx.quadraticCurveTo(s * 1.5, -s * 0.5, s * 1.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 1.15, -s * 0.5, s * 0.34, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#b5e48c';
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      for (const [dx, dy] of [
        [s * 0.25, -s * 0.55],
        [s * 0.05, -s * 0.6],
      ]) {
        ctx.beginPath();
        ctx.moveTo(s * 1.15, -s * 0.7);
        ctx.lineTo(s * 1.15 + dx, -s * 0.7 + dy);
        ctx.stroke();
        this.eye(s * 1.15 + dx, -s * 0.7 + dy, s * 0.09);
      }
      ctx.restore();
    }
    // Shell with a spiral.
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.72, s * 0.72, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#d1600f';
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let a = 0; a < TAU * 2.2; a += 0.15) {
      const r = s * 0.08 + (a / (TAU * 2.2)) * s * 0.58;
      const px = -s * 0.2 + Math.cos(a) * r;
      const py = -s * 0.72 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  private drawShootingStar(v: Visitor): void {
    const ctx = this.ctx;
    const s = v.size;
    ctx.translate(v.x, v.y);
    ctx.rotate(Math.atan2(v.vy, v.vx));
    const glow = ctx.createLinearGradient(-s * 9, 0, 0, 0);
    glow.addColorStop(0, 'rgba(255, 246, 168, 0)');
    glow.addColorStop(1, 'rgba(255, 246, 168, 0.8)');
    ctx.strokeStyle = glow;
    ctx.lineWidth = s * 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 9, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.rotate(v.age * 6);
    ctx.fillStyle = '#fff6a8';
    this.starPath(0, 0, s * 1.4, 5);
    ctx.fill();
  }

  // ---- Finger ribbons ------------------------------------------------------

  /** A glowing rainbow ribbon that follows the finger and fades away behind it. */
  private drawTrail(trail: Trail, now: number): void {
    const points = trail.points;
    if (points.length < 2) return;
    const ctx = this.ctx;
    const u = this.u;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Two passes: a wide soft glow, then the bright core.
    for (const pass of [0, 1] as const) {
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const life = clamp(1 - (now - p1.t) / TRAIL_LIFE, 0, 1);
        if (life <= 0) continue;
        const hue = (trail.hue + i * 7) % 360;
        ctx.strokeStyle = `hsl(${hue}, 95%, ${pass === 0 ? 70 : 62}%)`;
        ctx.globalAlpha = pass === 0 ? life * 0.3 : life * 0.95;
        ctx.lineWidth = (pass === 0 ? 30 : 13) * u * (0.35 + 0.65 * life);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- Balloons ------------------------------------------------------------

  /** Balloons lean into the direction they are swaying (and into a push). */
  private tilt(b: Balloon): number {
    const push = clamp(b.vx / (400 * this.u), -1, 1) * 0.35;
    return Math.cos(TAU * b.swayFreq * b.age + b.swayPhase) * 0.13 + push;
  }

  private drawString(b: Balloon, game: Game): void {
    const ctx = this.ctx;
    const u = this.u;
    const s = b.scale;
    if (s <= 0.05) return;
    const tilt = this.tilt(b);
    const knotDistance = (b.r * 1.15 + b.r * 0.2) * s;
    const kx = b.x - Math.sin(tilt) * knotDistance;
    const ky = b.y + Math.cos(tilt) * knotDistance;
    const wobble = Math.sin(this.time * 2.4 + b.swayPhase) * 9 * u - clamp(b.vx / 20, -14 * u, 14 * u);
    ctx.strokeStyle = 'rgba(70, 50, 90, 0.55)';
    ctx.lineWidth = 2.2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    const carried = b.carrying === undefined ? undefined : game.visitors.find((v) => v.id === b.carrying);
    if (carried && carried.state === 'carried') {
      // The string runs to the creature hanging from it (slack while the creature is still on the ground).
      const hook = game.visitorHit(carried);
      const slack = Math.max(0, STRING_LENGTH * u * s - (hook.y - ky));
      ctx.bezierCurveTo(kx + wobble * 0.5, ky + (hook.y - ky) * 0.4 + slack * 0.6, hook.x - wobble * 0.5, hook.y - (hook.y - ky) * 0.3 + slack * 0.4, hook.x, hook.y);
    } else {
      const length = STRING_LENGTH * u * s;
      ctx.bezierCurveTo(kx + wobble, ky + length * 0.35, kx - wobble, ky + length * 0.7, kx + wobble * 0.6, ky + length);
    }
    ctx.stroke();
  }

  private bodyPath(rx: number, ry: number): void {
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  }

  drawBalloon(b: Balloon): void {
    const ctx = this.ctx;
    const s = b.scale;
    if (s <= 0.02) return;
    const breathe = Math.sin(this.time * 3 + b.swayPhase) * 0.025;
    // A balloon being held past full size strains and quivers before it bursts.
    const strain = b.overinflate > 0.5 ? (b.overinflate - 0.5) * 2 : 0;
    const quiver = Math.sin(this.time * 45) * 0.035 * strain;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(this.tilt(b));
    ctx.scale(s * (1 + breathe + quiver), s * (1 - breathe - quiver));
    const rx = b.r;
    const ry = b.r * 1.15;

    const photo = b.kind === 'photo' ? this.photo(b.photoId) : null;
    this.bodyPath(rx, ry);
    if (photo) {
      // The photo fills the balloon, with a gentle shade so it still looks round.
      ctx.save();
      ctx.clip();
      const side = Math.max(rx * 2, ry * 2);
      ctx.drawImage(photo, -side / 2, -side / 2, side, side);
      // Soft vignette into the balloon colour: the face stays, the photo's background melts away.
      const vignette = ctx.createRadialGradient(0, -ry * 0.05, rx * 0.45, 0, 0, rx * 1.05);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.55, `${b.color.main}55`);
      vignette.addColorStop(1, b.color.main);
      ctx.fillStyle = vignette;
      ctx.fill();
      const shade = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, rx * 0.1, 0, 0, rx * 1.35);
      shade.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      shade.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
      shade.addColorStop(1, 'rgba(40, 20, 60, 0.3)');
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.restore();
      // A coloured rim so it reads as a balloon and not a loose picture.
      this.bodyPath(rx, ry);
      ctx.strokeStyle = b.color.main;
      ctx.lineWidth = rx * 0.1;
      ctx.stroke();
    } else if (b.kind === 'rainbow') {
      const stripes = ctx.createLinearGradient(0, -ry, 0, ry);
      RAINBOW.forEach((color, i) => stripes.addColorStop(i / (RAINBOW.length - 1), color));
      ctx.fillStyle = stripes;
    } else {
      const shade = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, rx * 0.05, 0, 0, rx * 1.35);
      shade.addColorStop(0, b.color.light);
      shade.addColorStop(0.5, b.color.main);
      shade.addColorStop(1, b.color.dark);
      ctx.fillStyle = shade;
    }
    if (!photo) ctx.fill();

    if (b.kind === 'dots' || b.kind === 'stripes' || b.kind === 'star') {
      ctx.save();
      this.bodyPath(rx, ry);
      ctx.clip();
      this.drawPattern(b, rx, ry);
      ctx.restore();
    }
    if (b.kind === 'rainbow') {
      // Soft shading so the striped balloon still looks round.
      const shade = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, rx * 0.05, 0, 0, rx * 1.35);
      shade.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      shade.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      shade.addColorStop(1, 'rgba(60, 0, 90, 0.35)');
      ctx.fillStyle = shade;
      this.bodyPath(rx, ry);
      ctx.fill();
    }

    // Glint (smaller on a photo, so it doesn't hide an eye).
    ctx.fillStyle = photo ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.42, -ry * 0.45, rx * (photo ? 0.1 : 0.16), ry * (photo ? 0.16 : 0.26), -0.55, 0, TAU);
    ctx.fill();

    // Knot.
    ctx.fillStyle = b.color.dark;
    ctx.beginPath();
    ctx.moveTo(0, ry - rx * 0.05);
    ctx.lineTo(-rx * 0.16, ry + rx * 0.2);
    ctx.lineTo(rx * 0.16, ry + rx * 0.2);
    ctx.closePath();
    ctx.fill();

    if (!photo) this.drawFace(b, rx, ry);
    ctx.restore();
  }

  private drawPattern(b: Balloon, rx: number, ry: number): void {
    const ctx = this.ctx;
    if (b.kind === 'dots') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      const step = rx * 0.5;
      let row = 0;
      for (let y = -ry; y <= ry; y += step, row++) {
        const offset = row % 2 ? step / 2 : 0;
        for (let x = -rx + offset; x <= rx; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, rx * 0.1, 0, TAU);
          ctx.fill();
        }
      }
    } else if (b.kind === 'stripes') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.save();
      ctx.rotate(-0.5);
      const width = rx * 0.3;
      for (let x = -rx * 1.8; x < rx * 1.8; x += width * 2) ctx.fillRect(x, -ry * 1.8, width, ry * 3.6);
      ctx.restore();
    } else if (b.kind === 'star') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const step = rx * 0.55;
      let row = 0;
      for (let y = -ry * 0.9; y <= ry * 0.9; y += step, row++) {
        const offset = row % 2 ? step / 2 : 0;
        for (let x = -rx * 0.9 + offset; x <= rx * 0.9; x += step) {
          this.starPath(x, y, rx * 0.1, 5);
          ctx.fill();
        }
      }
    }
  }

  private drawFace(b: Balloon, rx: number, ry: number): void {
    const ctx = this.ctx;
    const ex = rx * 0.34;
    const ey = -ry * 0.1;
    const er = rx * 0.15;
    const blinking = b.blink > 0;

    ctx.fillStyle = 'rgba(255, 105, 140, 0.35)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * rx * 0.52, ry * 0.2, rx * 0.13, rx * 0.09, 0, 0, TAU);
      ctx.fill();
    }

    for (const side of [-1, 1]) {
      const closed = blinking || b.face === 'sleepy' || (b.face === 'wink' && side === 1);
      if (closed) {
        ctx.strokeStyle = EYE_COLOR;
        ctx.lineWidth = rx * 0.06;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(side * ex, ey + er * 0.4, er * 0.9, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else {
        const big = b.face === 'surprised' ? 1.2 : 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(side * ex, ey, er * big, er * 1.25 * big, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = EYE_COLOR;
        ctx.beginPath();
        ctx.arc(side * ex + rx * 0.02, ey + er * 0.2, er * 0.55 * big, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(side * ex - er * 0.15, ey - er * 0.1, er * 0.2, 0, TAU);
        ctx.fill();
      }
    }

    if (b.face === 'surprised') {
      ctx.fillStyle = EYE_COLOR;
      ctx.beginPath();
      ctx.ellipse(0, ry * 0.32, rx * 0.11, rx * 0.14, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = EYE_COLOR;
      ctx.lineWidth = rx * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, ry * 0.18, rx * 0.3, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }

  // ---- Particles -----------------------------------------------------------

  private drawParticle(p: Particle): void {
    const ctx = this.ctx;
    const u = this.u;
    const lifeRatio = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = clamp(p.life / 0.3, 0, 1);

    if (p.shape === 'ring') {
      const t = 1 - lifeRatio;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, 6 * u * (1 - t));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + 1.8 * t), 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (p.shape === 'photo') {
      this.drawPhotoCard(p, lifeRatio);
      ctx.restore();
      return;
    }

    if (p.shape === 'string') {
      const wobble = Math.sin(this.time * 6) * 8 * u;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.bezierCurveTo(p.x + wobble, p.y + p.size * 0.35, p.x - wobble, p.y + p.size * 0.7, p.x, p.y + p.size);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    const s = p.size;
    switch (p.shape) {
      case 'rect':
        ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, TAU);
        ctx.fill();
        break;
      case 'star':
        this.starPath(0, 0, s * 0.7, 5);
        ctx.fill();
        break;
      case 'sparkle':
        this.starPath(0, 0, s * 0.8, 4, 0.35);
        ctx.fill();
        break;
      case 'heart':
        this.heartPath(0, 0, s);
        ctx.fill();
        break;
      case 'drop':
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.32, s * 0.5, 0, 0, TAU);
        ctx.fill();
        break;
      case 'smoke': {
        // Grows and thins out as it rises.
        const t = 1 - lifeRatio;
        ctx.globalAlpha = lifeRatio * 0.55;
        ctx.beginPath();
        ctx.arc(0, 0, (s / 2) * (0.6 + 1.2 * t), 0, TAU);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  /** A family photo bouncing in as a round picture with a white border, then fading out. */
  private drawPhotoCard(p: Particle, lifeRatio: number): void {
    const ctx = this.ctx;
    const image = this.photo(p.photoId);
    const shown = 1 - lifeRatio;
    const bounce = shown < 0.3 ? easeOutBack(shown / 0.3) : 1;
    const alpha = p.life < 0.4 ? p.life / 0.4 : 1;
    const radius = (p.size / 2) * bounce;
    if (radius <= 1) return;
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(shown * 9) * 0.06 * (1 - shown));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.07, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    if (image) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(image, -radius, -radius, radius * 2, radius * 2);
      const edge = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, radius);
      edge.addColorStop(0, 'rgba(255, 255, 255, 0)');
      edge.addColorStop(1, 'rgba(255, 255, 255, 0.85)');
      ctx.fillStyle = edge;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }

  private starPath(x: number, y: number, r: number, points: number, innerRatio = 0.5): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 ? r * innerRatio : r;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  private heartPath(x: number, y: number, s: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.45);
    ctx.bezierCurveTo(x - s * 0.9, y - s * 0.2, x - s * 0.4, y - s * 0.75, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.4, y - s * 0.75, x + s * 0.9, y - s * 0.2, x, y + s * 0.45);
    ctx.closePath();
  }
}
