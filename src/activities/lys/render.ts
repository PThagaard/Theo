import { TAU, clamp } from '../../engine/rng';
import { Renderer } from '../balloner/render';
import { groundY, type Firefly, type Lamp, type Lantern, type Light, type LysGame, type Sparkle } from './logic';

/**
 * Draws the night: a deep blue sky with faint fixed stars, dark rolling hills with three lamp posts and a little
 * house, a big sleepy moon, and everything the child lights: stars with their constellation lines, stardust,
 * paper lanterns (now and then with a family face), fireflies and the shooting star. Every light is one soft
 * glow sprite drawn additively, so many lights stay cheap on an old phone. Borrows the balloon renderer's canvas
 * handling and photo cache. No game logic here.
 */

const SKY_TOP = '#060c33';
const SKY_MIDDLE = '#0f1d5c';
const SKY_HORIZON = '#1d3382';
const HILL_BACK = '#0b1240';
const HILL_FRONT = '#060a28';
const POST = '#151a45';
const HOUSE = '#161a48';
const HOUSE_EDGE = '#262c6a';
const ROOF = '#2a1e52';
const WINDOW_DARK = '#1e224f';
const WINDOW_LIT = '#ffd98a';
const LIGHT_COLORS: Array<[number, number, number]> = [
  [255, 246, 200],
  [255, 214, 100],
  [255, 170, 210],
  [150, 230, 255],
  [170, 255, 200],
];
const LANTERN_COLORS: Array<{ top: string; bottom: string; rim: string; glow: [number, number, number] }> = [
  { top: '#ffd27a', bottom: '#ff8a3d', rim: '#c9581f', glow: [255, 180, 80] },
  { top: '#ffb0c8', bottom: '#ff5f8a', rim: '#b83a5d', glow: [255, 140, 170] },
  { top: '#bfe9ff', bottom: '#5fb0ff', rim: '#2e6fb8', glow: [140, 200, 255] },
];
const LAMP_GLOW: [number, number, number] = [255, 214, 120];
const MOON_GLOW: [number, number, number] = [255, 240, 190];
const FIREFLY_GLOW: [number, number, number] = [214, 255, 110];
const MOON_INK = '#b9962a';
const BACKDROP_STARS = 42;

interface Backdrop {
  x: number;
  y: number;
  size: number;
}

export class LysRenderer {
  private readonly base: Renderer;
  private readonly glows = new Map<string, HTMLCanvasElement>();
  private backdrop: Backdrop[] = [];
  private sky: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.base = new Renderer(canvas);
  }

  setPhotos(photos: Array<{ id: string; dataUrl: string }>): void {
    this.base.setPhotos(photos);
  }

  resize(width: number, height: number, dpr: number): void {
    this.base.resize(width, height, dpr);
    const { ctx, W, H, u } = this.base;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(0.55, SKY_MIDDLE);
    sky.addColorStop(1, SKY_HORIZON);
    this.sky = sky;
    // Faint fixed stars, always in the same places, so the sky is never empty.
    this.backdrop = [];
    for (let i = 0; i < BACKDROP_STARS; i++) {
      this.backdrop.push({ x: ((i * 0.618 + 0.13) % 1) * W, y: ((i * 0.382 + 0.07) % 1) * H * 0.72, size: (0.8 + (i % 3) * 0.5) * u });
    }
  }

  draw(game: LysGame, dt: number): void {
    const base = this.base;
    const { ctx, W, H } = base;
    base.time += dt;
    ctx.fillStyle = this.sky ?? SKY_MIDDLE;
    ctx.fillRect(0, 0, W, H);
    this.drawBackdrop();
    this.drawMoon(game);
    this.drawHills(game);
    for (const lamp of game.lamps) this.drawLampPost(lamp);
    this.drawHouse(game);
    // Everything that glows, added onto the dark: cheap, and many lights never turn muddy.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.drawConstellations(game);
    for (const light of game.lights) this.drawLight(light);
    for (const lantern of game.lanterns) this.drawLanternGlow(lantern);
    for (const lamp of game.lamps) this.drawLampGlow(lamp);
    this.drawWindowGlow(game);
    for (const firefly of game.fireflies) this.drawFirefly(firefly);
    for (const sparkle of game.sparkles) this.drawSparkle(sparkle);
    this.drawShootingStar(game);
    ctx.restore();
    for (const lantern of game.lanterns) this.drawLantern(lantern);
    if (game.dusk > 0) {
      ctx.fillStyle = `rgba(3, 4, 20, ${0.6 * game.dusk})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---- Glow sprites ---------------------------------------------------------------

  private glow(color: [number, number, number]): HTMLCanvasElement | null {
    const key = color.join(',');
    const cached = this.glows.get(key);
    if (cached) return cached;
    const size = 96;
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const g = sprite.getContext('2d');
    if (!g) return null;
    const [r, gr, b] = color;
    const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0.9)`);
    gradient.addColorStop(0.25, `rgba(${r}, ${gr}, ${b}, 0.45)`);
    gradient.addColorStop(0.6, `rgba(${r}, ${gr}, ${b}, 0.12)`);
    gradient.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
    g.fillStyle = gradient;
    g.fillRect(0, 0, size, size);
    this.glows.set(key, sprite);
    return sprite;
  }

  private drawGlow(x: number, y: number, radius: number, color: [number, number, number], alpha: number): void {
    if (alpha <= 0.01 || radius <= 0) return;
    const sprite = this.glow(color);
    if (!sprite) return;
    const ctx = this.base.ctx;
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  private starPath(x: number, y: number, r: number, points: number, inner: number, rotation = 0): void {
    const ctx = this.base.ctx;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r : r * inner;
      const angle = rotation - Math.PI / 2 + (i * Math.PI) / points;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // ---- The scenery ---------------------------------------------------------------

  private drawBackdrop(): void {
    const { ctx, time } = this.base;
    ctx.fillStyle = '#dfe8ff';
    this.backdrop.forEach((star, i) => {
      // A slow twinkle, well under one blink a second.
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 0.8 + i * 1.7);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private drawHills(game: LysGame): void {
    const { ctx, W, H, u } = this.base;
    const horizon = game.horizonY;
    const layers: Array<[string, number]> = [
      [HILL_BACK, -16 * u],
      [HILL_FRONT, 0],
    ];
    for (const [color, offset] of layers) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 12 * u; x += 12 * u) ctx.lineTo(x, groundY(x + (offset ? 140 * u : 0), W, horizon, u) + offset);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawLampPost(lamp: Lamp): void {
    const { ctx, u } = this.base;
    ctx.strokeStyle = POST;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.moveTo(lamp.x, lamp.baseY + 2 * u);
    ctx.lineTo(lamp.x, lamp.headY + 10 * u);
    ctx.stroke();
    // The head: a small lantern box, warm when lit.
    const w = 16 * u;
    const h = 20 * u;
    ctx.fillStyle = POST;
    ctx.beginPath();
    ctx.moveTo(lamp.x - w * 0.7, lamp.headY - h / 2);
    ctx.lineTo(lamp.x + w * 0.7, lamp.headY - h / 2);
    ctx.lineTo(lamp.x, lamp.headY - h * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = WINDOW_DARK;
    ctx.fillRect(lamp.x - w / 2, lamp.headY - h / 2, w, h);
    if (lamp.lit > 0.01) {
      ctx.globalAlpha = lamp.lit;
      ctx.fillStyle = WINDOW_LIT;
      ctx.fillRect(lamp.x - w / 2 + 2 * u, lamp.headY - h / 2 + 2 * u, w - 4 * u, h - 4 * u);
      ctx.globalAlpha = 1;
    }
  }

  private drawLampGlow(lamp: Lamp): void {
    const { ctx, u } = this.base;
    if (lamp.lit <= 0.01) return;
    this.drawGlow(lamp.x, lamp.headY, 80 * u, LAMP_GLOW, lamp.lit * 0.85);
    // A pool of light on the ground under it.
    ctx.fillStyle = `rgba(255, 214, 120, ${lamp.lit * 0.22})`;
    ctx.beginPath();
    ctx.ellipse(lamp.x, lamp.baseY, 70 * u, 15 * u, 0, 0, TAU);
    ctx.fill();
  }

  private drawHouse(game: LysGame): void {
    const { ctx, u } = this.base;
    const house = game.house;
    const w = house.width;
    const h = house.height;
    const left = house.x - w / 2;
    const top = house.baseY - h;
    ctx.fillStyle = HOUSE;
    ctx.strokeStyle = HOUSE_EDGE;
    ctx.lineWidth = 2 * u;
    ctx.fillRect(left, top, w, h);
    ctx.strokeRect(left, top, w, h);
    // Roof and chimney.
    ctx.fillStyle = ROOF;
    ctx.beginPath();
    ctx.moveTo(left - 8 * u, top);
    ctx.lineTo(house.x, top - 36 * u);
    ctx.lineTo(left + w + 8 * u, top);
    ctx.closePath();
    ctx.fill();
    const chimneyX = house.x + w * 0.26;
    const chimneyTop = top - 30 * u;
    ctx.fillStyle = HOUSE_EDGE;
    ctx.fillRect(chimneyX - 6 * u, chimneyTop, 12 * u, 22 * u);
    if (house.puff > 0) {
      // A puff of smoke rises and thins when the light comes on.
      const rise = (1 - house.puff) * 34 * u;
      ctx.fillStyle = `rgba(200, 205, 230, ${house.puff * 0.45})`;
      ctx.beginPath();
      ctx.arc(chimneyX + rise * 0.2, chimneyTop - 6 * u - rise, (6 + (1 - house.puff) * 9) * u, 0, TAU);
      ctx.fill();
    }
    // The door, and the window: a switch.
    ctx.fillStyle = WINDOW_DARK;
    ctx.fillRect(house.x - w * 0.32 - 10 * u, house.baseY - 30 * u, 20 * u, 30 * u);
    const ws = house.windowSize;
    ctx.fillRect(house.windowX - ws / 2, house.windowY - ws / 2, ws, ws);
    if (house.lit > 0.01) {
      ctx.globalAlpha = house.lit;
      ctx.fillStyle = WINDOW_LIT;
      ctx.fillRect(house.windowX - ws / 2, house.windowY - ws / 2, ws, ws);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = HOUSE;
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(house.windowX, house.windowY - ws / 2);
    ctx.lineTo(house.windowX, house.windowY + ws / 2);
    ctx.moveTo(house.windowX - ws / 2, house.windowY);
    ctx.lineTo(house.windowX + ws / 2, house.windowY);
    ctx.stroke();
  }

  private drawWindowGlow(game: LysGame): void {
    const house = game.house;
    if (house.lit <= 0.01) return;
    this.drawGlow(house.windowX, house.windowY, 64 * this.base.u, LAMP_GLOW, house.lit * 0.75);
  }

  private drawMoon(game: LysGame): void {
    const { ctx, u } = this.base;
    const moon = game.moon;
    const r = moon.r;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.drawGlow(moon.x, moon.y, r * 3.2, MOON_GLOW, 0.35 + 0.45 * moon.bloom);
    ctx.restore();
    const disc = ctx.createRadialGradient(moon.x - r * 0.3, moon.y - r * 0.3, r * 0.2, moon.x, moon.y, r);
    disc.addColorStop(0, '#fffbe0');
    disc.addColorStop(1, '#ffe08a');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, r, 0, TAU);
    ctx.fill();
    // A few soft craters.
    ctx.fillStyle = 'rgba(220, 190, 110, 0.3)';
    for (const [cx, cy, cr] of [
      [0.45, -0.45, 0.16],
      [-0.55, 0.35, 0.12],
      [0.5, 0.5, 0.1],
    ]) {
      ctx.beginPath();
      ctx.arc(moon.x + cx * r, moon.y + cy * r, cr * r, 0, TAU);
      ctx.fill();
    }
    // The face: eyes open while it is awake, closed and smiling otherwise; always a smile.
    const eyeY = moon.y - r * 0.08;
    ctx.strokeStyle = MOON_INK;
    ctx.fillStyle = MOON_INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5 * u;
    for (const side of [-1, 1]) {
      const ex = moon.x + side * r * 0.32;
      if (moon.awake > 0.4) {
        ctx.beginPath();
        ctx.arc(ex, eyeY, r * 0.1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + r * 0.035, eyeY - r * 0.035, r * 0.035, 0, TAU);
        ctx.fill();
        ctx.fillStyle = MOON_INK;
      } else {
        ctx.beginPath();
        ctx.arc(ex, eyeY + r * 0.04, r * 0.12, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(moon.x, moon.y + r * 0.18, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 150, 140, 0.45)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(moon.x + side * r * 0.55, moon.y + r * 0.25, r * 0.13, 0, TAU);
      ctx.fill();
    }
  }

  // ---- The child's lights ----------------------------------------------------------

  private drawConstellations(game: LysGame): void {
    const { ctx, u } = this.base;
    const byId = new Map<number, Light>();
    for (const light of game.lights) byId.set(light.id, light);
    ctx.lineWidth = 1.5 * u;
    ctx.lineCap = 'round';
    for (const light of game.lights) {
      if (light.linkId < 0) continue;
      const other = byId.get(light.linkId);
      if (!other) continue;
      const alpha = 0.35 * Math.min(light.brightness, other.brightness);
      if (alpha <= 0.01) continue;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(light.x, light.y);
      ctx.lineTo(other.x, other.y);
      ctx.stroke();
    }
  }

  private drawLight(light: Light): void {
    const { ctx, u, time } = this.base;
    const b = light.brightness;
    if (b <= 0.01) return;
    const radius = (26 + 16 * light.twinkle) * u * light.size;
    this.drawGlow(light.x, light.y, radius, LIGHT_COLORS[light.color], b * 0.9);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * b})`;
    this.starPath(light.x, light.y, (5 + 4 * light.twinkle) * u * light.size, 4, 0.42, time * 0.3);
    ctx.fill();
  }

  private lanternX(lantern: Lantern): number {
    return lantern.held !== null ? lantern.x : lantern.x + Math.sin(lantern.sway) * 10 * this.base.u;
  }

  private drawLanternGlow(lantern: Lantern): void {
    const u = this.base.u;
    const style = LANTERN_COLORS[lantern.color];
    this.drawGlow(this.lanternX(lantern), lantern.y, 74 * u * Math.max(0.3, lantern.size), style.glow, 0.55 + 0.4 * lantern.pulse);
  }

  private drawLantern(lantern: Lantern): void {
    const { ctx, u } = this.base;
    const style = LANTERN_COLORS[lantern.color];
    const size = Math.max(0.15, lantern.size);
    const w = 36 * u * size;
    const h = 50 * u * size;
    ctx.save();
    ctx.translate(this.lanternX(lantern), lantern.y);
    if (lantern.held === null) ctx.rotate(Math.sin(lantern.sway) * 0.08);
    // The paper body, lit from inside.
    const paper = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    paper.addColorStop(0, style.top);
    paper.addColorStop(1, style.bottom);
    ctx.fillStyle = paper;
    ctx.strokeStyle = style.rim;
    ctx.lineWidth = 2 * u * size;
    this.roundRect(-w / 2, -h / 2, w, h, w * 0.35);
    ctx.fill();
    ctx.stroke();
    // Ribs, and the open bottom with the little flame.
    ctx.globalAlpha = 0.35;
    for (const t of [-0.2, 0.15]) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 2 * u, t * h);
      ctx.lineTo(w / 2 - 2 * u, t * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = style.rim;
    ctx.fillRect(-w * 0.3, h / 2 - 3 * u * size, w * 0.6, 3 * u * size);
    ctx.fillStyle = '#fff6c4';
    ctx.beginPath();
    ctx.ellipse(0, h / 2 - 8 * u * size, 3.5 * u * size, 5 * u * size, 0, 0, TAU);
    ctx.fill();
    // A family face inside, warm from the light.
    const image = this.base.photo(lantern.photoId);
    if (lantern.photoId && size > 0.4) {
      const r = w * 0.36;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -h * 0.08, r, 0, TAU);
      ctx.clip();
      if (image) ctx.drawImage(image, -r, -h * 0.08 - r, r * 2, r * 2);
      else {
        ctx.fillStyle = '#ffe1a8';
        ctx.fillRect(-r, -h * 0.08 - r, r * 2, r * 2);
      }
      ctx.fillStyle = 'rgba(255, 160, 60, 0.22)';
      ctx.fillRect(-r, -h * 0.08 - r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.base.ctx;
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private drawFirefly(firefly: Firefly): void {
    const { ctx, u } = this.base;
    const blink = 0.5 + 0.5 * Math.sin(firefly.phase);
    const alpha = 0.3 + 0.6 * blink;
    this.drawGlow(firefly.x, firefly.y, 14 * u, FIREFLY_GLOW, alpha * 0.8);
    ctx.fillStyle = `rgba(230, 255, 150, ${alpha})`;
    ctx.beginPath();
    ctx.arc(firefly.x, firefly.y, 3 * u, 0, TAU);
    ctx.fill();
  }

  private drawSparkle(sparkle: Sparkle): void {
    const { ctx, u } = this.base;
    const alpha = clamp(sparkle.life / sparkle.maxLife, 0, 1);
    this.drawGlow(sparkle.x, sparkle.y, 8 * u * sparkle.size, LIGHT_COLORS[sparkle.color], alpha * 0.7);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, 2.2 * u * sparkle.size, 0, TAU);
    ctx.fill();
  }

  private drawShootingStar(game: LysGame): void {
    const { ctx, u } = this.base;
    const star = game.shooting;
    if (!star) return;
    const n = star.trail.length;
    star.trail.forEach((point, i) => {
      const t = (i + 1) / n;
      this.drawGlow(point.x, point.y, (4 + 16 * t) * u, LIGHT_COLORS[0], t * 0.6);
    });
    this.drawGlow(star.x, star.y, 28 * u, LIGHT_COLORS[0], 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, 5 * u, 0, TAU);
    ctx.fill();
  }
}
