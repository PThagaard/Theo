import type { Game } from './game';
import { FLOWER_COLORS, HILLS, RAINBOW, SKY } from './palette';
import { Rng, TAU, clamp } from './rng';
import type { Balloon, Particle } from './types';

/**
 * Draws the world on a 2D canvas: sky, smiling sun, rainbow, clouds, flowery
 * hills, the balloons with their faces, and all the confetti.
 */

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  shape: number;
}

interface Flower {
  /** Horizontal position as a fraction of the width. */
  fx: number;
  color: string;
  size: number;
  phase: number;
  petals: number;
}

/** Puff circles that make up each cloud: [dx, dy, radius]. */
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
  private readonly ctx: CanvasRenderingContext2D;
  private W = 1;
  private H = 1;
  private clouds: Cloud[] = [];
  private flowers: Flower[] = [];
  private sunAngle = 0;
  private sky: CanvasGradient | null = null;
  private rng = new Rng(20240101);
  private time = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D er ikke understøttet');
    this.ctx = ctx;
  }

  resize(width: number, height: number, dpr: number): void {
    this.W = width;
    this.H = height;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildScenery();
  }

  private get u(): number {
    return Math.max(0.5, Math.min(this.W, this.H) / 400);
  }

  private buildScenery(): void {
    const u = this.u;
    const rng = this.rng;
    this.clouds = [];
    const cloudCount = 4 + Math.round(this.W / 300);
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        x: rng.range(-100, this.W),
        y: rng.range(this.H * 0.06, this.H * 0.5),
        scale: u * rng.range(0.7, 1.3),
        speed: u * rng.range(5, 14),
        shape: rng.int(0, CLOUD_SHAPES.length - 1),
      });
    }
    this.flowers = [];
    const flowerCount = 6 + Math.round(this.W / 70);
    for (let i = 0; i < flowerCount; i++) {
      this.flowers.push({
        fx: (i + rng.range(0.15, 0.85)) / flowerCount,
        color: rng.pick(FLOWER_COLORS),
        size: u * rng.range(5, 8),
        phase: rng.range(0, TAU),
        petals: rng.int(5, 6),
      });
    }
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.H);
    gradient.addColorStop(0, SKY.top);
    gradient.addColorStop(0.55, SKY.middle);
    gradient.addColorStop(1, SKY.bottom);
    this.sky = gradient;
  }

  draw(game: Game, dt: number): void {
    this.time += dt;
    const ctx = this.ctx;
    ctx.fillStyle = this.sky ?? SKY.middle;
    ctx.fillRect(0, 0, this.W, this.H);
    this.drawSun(game, dt);
    this.drawRainbow();
    this.drawClouds(dt);
    this.drawHills();
    for (const b of game.balloons) this.drawString(b);
    for (const b of game.balloons) this.drawBalloon(b);
    for (const p of game.particles) this.drawParticle(p);
  }

  // ---- Scenery -------------------------------------------------------------

  private drawSun(game: Game, dt: number): void {
    const ctx = this.ctx;
    const u = this.u;
    const cx = this.W - 72 * u;
    const cy = 78 * u;
    // The sun spins and bounces for a moment after every celebration.
    const party = game.sinceCelebration < 1.6 ? 1 - game.sinceCelebration / 1.6 : 0;
    this.sunAngle += dt * (0.12 + party * 5);
    const pulse = party > 0 ? 1 + party * 0.12 * Math.sin(game.sinceCelebration * 14) : 1;
    const r = 40 * u * pulse;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(255, 196, 40, 0.85)';
    for (let i = 0; i < 12; i++) {
      const a = this.sunAngle + (i * TAU) / 12;
      const length = r * (i % 2 ? 1.55 : 1.85);
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

    ctx.fillStyle = '#5a3d1e';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.32, -r * 0.12, r * 0.08, r * 0.12, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, r * 0.12, r * 0.38, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 120, 120, 0.45)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.55, r * 0.2, r * 0.13, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRainbow(): void {
    const ctx = this.ctx;
    const u = this.u;
    const cx = this.W * 0.22;
    const cy = this.H * 0.92;
    const radius = Math.max(this.W * 0.42, 160 * u);
    ctx.save();
    ctx.globalAlpha = 0.28;
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

  private drawClouds(dt: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.93)';
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      const width = 80 * cloud.scale;
      if (cloud.x - width > this.W) {
        cloud.x = -width;
        cloud.y = this.rng.range(this.H * 0.06, this.H * 0.5);
      }
      ctx.save();
      ctx.translate(cloud.x, cloud.y);
      ctx.scale(cloud.scale, cloud.scale);
      ctx.beginPath();
      for (const [dx, dy, r] of CLOUD_SHAPES[cloud.shape]) {
        ctx.moveTo(dx + r, dy);
        ctx.arc(dx, dy, r, 0, TAU);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  private hillY(x: number, layer: 0 | 1): number {
    const u = this.u;
    const { W, H } = this;
    return layer === 0
      ? H - H * 0.17 - u * 24 * Math.sin((x / W) * Math.PI * 2.1 + 1.2)
      : H - H * 0.1 - u * 16 * Math.sin((x / W) * Math.PI * 1.5 + 0.3);
  }

  private drawHills(): void {
    const ctx = this.ctx;
    const u = this.u;
    for (const layer of [0, 1] as const) {
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

    for (const flower of this.flowers) {
      const x = flower.fx * this.W;
      const y = this.hillY(x, 1) + 4 * u;
      const sway = Math.sin(this.time * 1.6 + flower.phase) * 0.12;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sway);
      ctx.strokeStyle = HILLS.frontDark;
      ctx.lineWidth = 2 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -flower.size * 2.2);
      ctx.stroke();
      ctx.translate(0, -flower.size * 2.4);
      ctx.fillStyle = flower.color;
      for (let i = 0; i < flower.petals; i++) {
        const a = (i / flower.petals) * TAU;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * flower.size * 0.75, Math.sin(a) * flower.size * 0.75, flower.size * 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffdf5e';
      ctx.beginPath();
      ctx.arc(0, 0, flower.size * 0.42, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- Balloons ------------------------------------------------------------

  /** Balloons lean into the direction they are swaying. */
  private tilt(b: Balloon): number {
    return Math.cos(TAU * b.swayFreq * b.age + b.swayPhase) * 0.13;
  }

  private drawString(b: Balloon): void {
    const ctx = this.ctx;
    const u = this.u;
    const s = b.scale;
    if (s <= 0.05) return;
    const tilt = this.tilt(b);
    const knotDistance = (b.r * 1.15 + b.r * 0.2) * s;
    const kx = b.x - Math.sin(tilt) * knotDistance;
    const ky = b.y + Math.cos(tilt) * knotDistance;
    const length = 62 * u * s;
    const wobble = Math.sin(this.time * 2.4 + b.swayPhase) * 9 * u;
    ctx.strokeStyle = 'rgba(70, 50, 90, 0.55)';
    ctx.lineWidth = 2.2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.bezierCurveTo(kx + wobble, ky + length * 0.35, kx - wobble, ky + length * 0.7, kx + wobble * 0.6, ky + length);
    ctx.stroke();
  }

  private bodyPath(rx: number, ry: number): void {
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  }

  private drawBalloon(b: Balloon): void {
    const ctx = this.ctx;
    const s = b.scale;
    if (s <= 0.02) return;
    const breathe = Math.sin(this.time * 3 + b.swayPhase) * 0.025;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(this.tilt(b));
    ctx.scale(s * (1 + breathe), s * (1 - breathe));
    const rx = b.r;
    const ry = b.r * 1.15;

    this.bodyPath(rx, ry);
    if (b.kind === 'rainbow') {
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
    ctx.fill();

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

    // Glint.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.42, -ry * 0.45, rx * 0.16, ry * 0.26, -0.55, 0, TAU);
    ctx.fill();

    // Knot.
    ctx.fillStyle = b.color.dark;
    ctx.beginPath();
    ctx.moveTo(0, ry - rx * 0.05);
    ctx.lineTo(-rx * 0.16, ry + rx * 0.2);
    ctx.lineTo(rx * 0.16, ry + rx * 0.2);
    ctx.closePath();
    ctx.fill();

    this.drawFace(b, rx, ry);
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
    }
    ctx.restore();
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
