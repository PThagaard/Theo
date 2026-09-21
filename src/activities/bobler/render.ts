import { TAU } from '../../engine/rng';
import { Renderer } from '../balloner/render';
import type { BoblerGame, Bubble, Droplet, Duck, Guest } from './logic';

/**
 * Draws the bath: a tiled wall, blue water with foam and waves, the guests (whale, boat, jet ski, fish, shower),
 * the rubber ducks, the bubbles with their rainbow sheen, and the drops and tiny bubbles that touches leave
 * behind. Borrows the balloon renderer's canvas handling, photo cache and night overlay. No game logic here.
 */

const WALL = '#46b8ea';
const TILE = '#68cbf5';
const GROUT = '#97dcf8';
const WATER = '#2f8fdc';
const WATER_DEEP = '#2470c4';
const SURFACE = '#a8e0ff';
/** The duck's colours, in the order touches cycle through them (yellow first). */
const DUCK_COLORS: Array<[string, string]> = [
  ['#ffd23f', '#f2b705'],
  ['#ff7ad9', '#d63ea8'],
  ['#4d96ff', '#2456c9'],
  ['#5ed37a', '#2f9e4f'],
  ['#b56cff', '#7b2fd6'],
  ['#ff8c42', '#d1600f'],
];
const WHALE = '#4d96ff';
const WHALE_DARK = '#3b7fe0';
const COW_WHITE = '#f7f4ee';
const COW_BLACK = '#3a3a3a';
const PENGUIN = '#2b2b3a';
const BEAK = '#ff8c42';
const EYE = '#3b2a4a';

export class BoblerRenderer {
  private readonly base: Renderer;

  constructor(canvas: HTMLCanvasElement) {
    this.base = new Renderer(canvas);
  }

  setPhotos(photos: Array<{ id: string; dataUrl: string }>): void {
    this.base.setPhotos(photos);
  }

  resize(width: number, height: number, dpr: number): void {
    this.base.resize(width, height, dpr);
  }

  draw(game: BoblerGame, dt: number): void {
    const base = this.base;
    base.time += dt;
    this.drawWall(game);
    this.drawWater(game);
    for (const duck of game.ducks) this.drawDuck(game, duck);
    // Guests in front of the ducks: the boats are bigger and closer, and the whale must not hide.
    for (const g of game.guests) this.drawGuest(game, g);
    // Small bubbles behind big ones; the one growing under a finger on top of everything.
    const free = game.bubbles.filter((b) => b.heldBy === null).sort((a, b) => a.r - b.r);
    for (const b of free) this.drawBubble(b, base.time, false);
    for (const d of game.droplets) this.drawDroplet(d);
    for (const b of game.bubbles) if (b.heldBy !== null) this.drawBubble(b, base.time, true);
    if (game.dusk > 0) base.drawNight(game.dusk);
  }

  private drawWall(game: BoblerGame): void {
    const { ctx, W, H, u } = this.base;
    const bottom = game.waterY + 30 * u;
    ctx.fillStyle = GROUT;
    ctx.fillRect(0, 0, W, bottom);
    const tile = Math.min(W, H) / 3.5;
    const gap = 3 * u;
    const rows = Math.ceil(bottom / tile) + 1;
    const cols = Math.ceil(W / tile) + 2;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 0 ? 0 : tile / 2;
      for (let c = -1; c < cols; c++) {
        const x = c * tile + offset;
        const y = r * tile;
        ctx.fillStyle = (r + c + 2) % 2 === 0 ? WALL : TILE;
        ctx.beginPath();
        ctx.roundRect(x + gap, y + gap, tile - 2 * gap, tile - 2 * gap, 6 * u);
        ctx.fill();
      }
    }
    // A soft light from the top left.
    const glow = ctx.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, W * 0.9);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, bottom);
  }

  private drawWater(game: BoblerGame): void {
    const { ctx, W, H, u, time } = this.base;
    const step = 6 * u;
    const surface: Array<[number, number]> = [];
    for (let x = -step; x <= W + step; x += step) surface.push([x, game.surfaceY(x)]);
    const gradient = ctx.createLinearGradient(0, game.waterY, 0, H);
    gradient.addColorStop(0, WATER);
    gradient.addColorStop(1, WATER_DEEP);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(surface[0][0], surface[0][1]);
    for (const [x, y] of surface) ctx.lineTo(x, y);
    ctx.lineTo(W + step, H + 10);
    ctx.lineTo(-step, H + 10);
    ctx.closePath();
    ctx.fill();
    // Light ripples under the surface.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3 * u;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += step * 2) {
        const y = game.waterY + k * 26 * u + Math.sin(x / (35 * u) + time * (0.8 + k * 0.2) + k) * 4 * u;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // The bright surface line, and foam bobbing along it.
    ctx.strokeStyle = SURFACE;
    ctx.lineWidth = 5 * u;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(surface[0][0], surface[0][1]);
    for (const [x, y] of surface) ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 9; i++) {
      const fx = ((i * 0.618 + 0.05) % 1) * W;
      const fy = game.surfaceY(fx) + 2 * u;
      const r = (5 + (i % 3) * 2) * u;
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx + r * 0.9, fy + 2 * u, r * 0.7, 0, TAU);
      ctx.fill();
    }
  }

  private drawGuest(game: BoblerGame, g: Guest): void {
    switch (g.kind) {
      case 'whale':
        this.drawWhale(game, g);
        break;
      case 'fish':
        this.drawFish(game, g);
        break;
      case 'boat':
        this.drawBoat(game, g);
        break;
      case 'jetski':
        this.drawJetski(game, g);
        break;
      case 'shower':
        this.drawShower(g);
        break;
    }
  }

  /** Tints what was just drawn below the water line in this strip, so a guest looks like it sits in the water. */
  private submerge(game: BoblerGame, x: number, halfWidth: number): void {
    const { ctx, H, u } = this.base;
    const step = 6 * u;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - halfWidth, game.surfaceY(x - halfWidth));
    for (let sx = x - halfWidth; sx <= x + halfWidth; sx += step) ctx.lineTo(sx, game.surfaceY(sx));
    ctx.lineTo(x + halfWidth, game.surfaceY(x + halfWidth));
    ctx.lineTo(x + halfWidth, H);
    ctx.lineTo(x - halfWidth, H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(47, 143, 220, 0.42)';
    ctx.fill();
    ctx.restore();
  }

  private eye(x: number, y: number, r: number): void {
    const ctx = this.base.ctx;
    ctx.fillStyle = EYE;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU);
    ctx.fill();
  }

  /** A blue toy whale standing at the surface, quivering; a white plume when it spouts. */
  private drawWhale(game: BoblerGame, g: Guest): void {
    const { ctx, time } = this.base;
    const s = g.size;
    const quiver = g.state === 'stay' || g.state === 'act' ? Math.sin(time * 38 + g.phase) * s * 0.025 : 0;
    const bob = Math.sin(g.phase) * s * 0.05;
    ctx.save();
    ctx.translate(g.x + quiver, g.y + bob);
    ctx.scale(g.dir, 1);
    // Tail flukes.
    ctx.fillStyle = WHALE_DARK;
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, s * 0.05);
    ctx.quadraticCurveTo(-s * 2.1, -s * 0.9, -s * 2.35, -s * 0.45);
    ctx.quadraticCurveTo(-s * 2.0, -s * 0.15, -s * 2.3, s * 0.35);
    ctx.quadraticCurveTo(-s * 1.9, s * 0.25, -s * 1.3, s * 0.35);
    ctx.closePath();
    ctx.fill();
    // Body, belly and fin.
    ctx.fillStyle = WHALE;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.6, s * 0.85, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#cfe6ff';
    ctx.beginPath();
    ctx.ellipse(s * 0.15, s * 0.4, s * 1.15, s * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = WHALE_DARK;
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.45, s * 0.45, s * 0.2, 0.5, 0, TAU);
    ctx.fill();
    // Blowhole, eye, cheek and smile.
    ctx.fillStyle = '#2a5fb0';
    ctx.beginPath();
    ctx.ellipse(s * 0.3, -s * 0.8, s * 0.12, s * 0.06, 0, 0, TAU);
    ctx.fill();
    this.eye(s * 0.95, -s * 0.2, s * 0.11);
    ctx.fillStyle = 'rgba(255, 120, 150, 0.35)';
    ctx.beginPath();
    ctx.arc(s * 1.0, s * 0.08, s * 0.12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(s * 1.15, s * 0.12, s * 0.25, 0.15 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    if (g.state === 'act') {
      // The spout: a fan of white plumes rising from the blowhole (the drops fly on their own).
      const p = Math.min(1, g.stateAge / 0.9);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = s * 0.09;
      ctx.lineCap = 'round';
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.3, -s * 0.85);
        ctx.quadraticCurveTo(s * 0.3 + k * s * 0.25, -s * 0.85 - s * 0.9 * p, s * 0.3 + k * s * 0.5, -s * 0.85 - s * 1.5 * p);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.submerge(game, g.x, s * 2.6);
  }

  /** A big goldfish, mostly under the water; it leaps in an arc when it jumps. */
  private drawFish(game: BoblerGame, g: Guest): void {
    const ctx = this.base.ctx;
    const s = g.size * 0.9;
    const jumping = g.state === 'act';
    const t = jumping ? Math.min(1, g.stateAge / 1.1) : 0;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.dir, 1);
    if (jumping) ctx.rotate(-(0.5 - t) * 1.4);
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.62, 0, 0, TAU);
    ctx.fill();
    // Tail, wagging.
    ctx.save();
    ctx.translate(-s * 1.0, 0);
    ctx.rotate(Math.sin(g.phase) * 0.35);
    ctx.fillStyle = '#ff6b3d';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.75, -s * 0.6);
    ctx.lineTo(-s * 0.55, 0);
    ctx.lineTo(-s * 0.75, s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Dorsal fin and scales.
    ctx.fillStyle = '#ff6b3d';
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.55);
    ctx.quadraticCurveTo(-s * 0.25, -s * 1.05, -s * 0.7, -s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffb27a';
    ctx.lineWidth = s * 0.05;
    for (const dx of [-0.4, -0.1, 0.2]) {
      ctx.beginPath();
      ctx.arc(dx * s, 0, s * 0.3, Math.PI * 0.6, Math.PI * 1.4);
      ctx.stroke();
    }
    this.eye(s * 0.6, -s * 0.15, s * 0.12);
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(s * 0.85, s * 0.12, s * 0.14, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.restore();
    if (!jumping) this.submerge(game, g.x, s * 2.0);
  }

  /** A red speedboat with a cow at the wheel, bouncing over the waves. */
  private drawBoat(game: BoblerGame, g: Guest): void {
    const { ctx, u } = this.base;
    const s = g.size;
    const slope = (game.surfaceY(g.x + 20 * u) - game.surfaceY(g.x - 20 * u)) / (40 * u);
    const hopTilt = g.hop > 0 ? Math.sin((1 - g.hop) * Math.PI) * 0.22 : 0;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(Math.atan(slope) * 0.7 - hopTilt * g.dir);
    ctx.scale(g.dir, 1);
    // Hull with a white stripe, a cream deck and a windscreen.
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.moveTo(-s * 1.6, -s * 0.15);
    ctx.lineTo(s * 1.5, -s * 0.15);
    ctx.quadraticCurveTo(s * 2.0, -s * 0.05, s * 1.6, s * 0.35);
    ctx.lineTo(-s * 1.3, s * 0.5);
    ctx.quadraticCurveTo(-s * 1.75, s * 0.4, -s * 1.6, -s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, s * 0.05);
    ctx.lineTo(s * 1.7, s * 0.05);
    ctx.stroke();
    ctx.fillStyle = '#fff1d6';
    ctx.beginPath();
    ctx.roundRect(-s * 1.25, -s * 0.45, s * 2.55, s * 0.32, s * 0.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(223, 243, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(s * 0.55, -s * 0.45);
    ctx.lineTo(s * 0.8, -s * 1.05);
    ctx.lineTo(s * 1.1, -s * 1.05);
    ctx.lineTo(s * 1.15, -s * 0.45);
    ctx.closePath();
    ctx.fill();
    // The cow at the wheel.
    ctx.fillStyle = COW_WHITE;
    ctx.beginPath();
    ctx.roundRect(-s * 1.0, -s * 0.95, s * 1.05, s * 0.55, s * 0.2);
    ctx.fill();
    ctx.fillStyle = COW_BLACK;
    ctx.beginPath();
    ctx.ellipse(-s * 0.7, -s * 0.7, s * 0.2, s * 0.14, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e4e0d6';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-s * 0.2 + side * s * 0.4, -s * 1.3, s * 0.16, s * 0.09, side * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#e8d5a6';
    ctx.lineWidth = s * 0.07;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2 + side * s * 0.2, -s * 1.5);
      ctx.quadraticCurveTo(-s * 0.2 + side * s * 0.3, -s * 1.7, -s * 0.2 + side * s * 0.22, -s * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = COW_WHITE;
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 1.2, s * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COW_BLACK;
    ctx.beginPath();
    ctx.ellipse(-s * 0.38, -s * 1.48, s * 0.18, s * 0.1, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffb3c6';
    ctx.beginPath();
    ctx.ellipse(s * 0.02, -s * 1.05, s * 0.28, s * 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9788f';
    for (const dx of [-0.06, 0.12]) {
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 1.1, s * 0.04, s * 0.03, 0, 0, TAU);
      ctx.fill();
    }
    this.eye(-s * 0.32, -s * 1.28, s * 0.07);
    this.eye(-s * 0.02, -s * 1.3, s * 0.07);
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(s * 0.4, -s * 0.8, s * 0.18, 0, TAU);
    ctx.stroke();
    ctx.restore();
    this.submerge(game, g.x, s * 2.2);
  }

  /** A yellow jet ski with a penguin holding the handlebar, spray flying. */
  private drawJetski(game: BoblerGame, g: Guest): void {
    const { ctx, u } = this.base;
    const s = g.size;
    const slope = (game.surfaceY(g.x + 20 * u) - game.surfaceY(g.x - 20 * u)) / (40 * u);
    const hopTilt = g.hop > 0 ? Math.sin((1 - g.hop) * Math.PI) * 0.35 : 0;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(Math.atan(slope) * 0.5 - hopTilt * g.dir);
    ctx.scale(g.dir, 1);
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, s * 0.15);
    ctx.lineTo(s * 1.8, s * 0.15);
    ctx.quadraticCurveTo(s * 2.1, -s * 0.15, s * 1.6, -s * 0.4);
    ctx.lineTo(-s * 0.5, -s * 0.6);
    ctx.quadraticCurveTo(-s * 1.6, -s * 0.5, -s * 1.5, s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = WHALE;
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, -s * 0.1);
    ctx.lineTo(s * 1.5, -s * 0.1);
    ctx.lineTo(s * 1.4, s * 0.05);
    ctx.lineTo(-s * 1.3, s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = EYE;
    ctx.beginPath();
    ctx.roundRect(-s * 1.1, -s * 0.78, s * 1.3, s * 0.25, s * 0.1);
    ctx.fill();
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.9, -s * 0.4);
    ctx.lineTo(s * 0.75, -s * 1.15);
    ctx.moveTo(s * 0.5, -s * 1.15);
    ctx.lineTo(s * 1.0, -s * 1.15);
    ctx.stroke();
    // The penguin on the seat.
    ctx.save();
    ctx.translate(-s * 0.45, -s * 0.75);
    ctx.fillStyle = PENGUIN;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.35, s * 0.42, s * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(s * 0.05, -s * 0.3, s * 0.26, s * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PENGUIN;
    ctx.beginPath();
    ctx.arc(s * 0.08, -s * 1.0, s * 0.32, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(s * 0.17, -s * 0.95, s * 0.2, s * 0.22, 0, 0, TAU);
    ctx.fill();
    this.eye(s * 0.2, -s * 1.02, s * 0.06);
    ctx.fillStyle = BEAK;
    ctx.beginPath();
    ctx.moveTo(s * 0.35, -s * 0.98);
    ctx.lineTo(s * 0.62, -s * 0.9);
    ctx.lineTo(s * 0.35, -s * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PENGUIN;
    ctx.beginPath();
    ctx.ellipse(s * 0.38, -s * 0.42, s * 0.34, s * 0.12, -0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = BEAK;
    ctx.beginPath();
    ctx.ellipse(s * 0.15, s * 0.15, s * 0.2, s * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    this.submerge(game, g.x, s * 2.3);
  }

  /** The shower head swinging in from above on its hose, spraying. */
  private drawShower(g: Guest): void {
    const { ctx, u } = this.base;
    const s = g.size;
    ctx.save();
    ctx.strokeStyle = '#9aa7b4';
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(g.x + s * 0.9, -20 * u);
    ctx.quadraticCurveTo(g.x + s * 0.9, g.y - s * 1.2, g.x + s * 0.25, g.y - s * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#c9d3de';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, s * 1.05, s * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e9eef3';
    ctx.beginPath();
    ctx.ellipse(g.x - s * 0.15, g.y - s * 0.1, s * 0.7, s * 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7f8c99';
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(g.x + k * s * 0.25, g.y + s * 0.22, s * 0.05, 0, TAU);
      ctx.fill();
    }
    if (g.state === 'stay') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2 * u;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(g.x + k * s * 0.2, g.y + s * 0.3);
        ctx.lineTo(g.x + k * s * 0.45, g.y + s * 2.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawDuck(game: BoblerGame, duck: Duck): void {
    const { ctx, u } = this.base;
    const s = game.duckSize;
    const y = game.duckY(duck);
    const spin = duck.spinAge < 0.7 ? (duck.spinAge / 0.7) * TAU : 0;
    const slope = (game.surfaceY(duck.x + 10 * u) - game.surfaceY(duck.x - 10 * u)) / (20 * u);
    const asleep = game.dusk > 0.5;
    const quacking = duck.quackAge < 0.35;
    // Its colour: the one touches gave it, or the rainbow sliding round while it dashes (no flashing).
    const [body, wing] = duck.rainbow > 0 ? [`hsl(${duck.hue}, 90%, 62%)`, `hsl(${duck.hue}, 80%, 45%)`] : DUCK_COLORS[duck.color % DUCK_COLORS.length];
    ctx.save();
    ctx.translate(duck.x, y);
    ctx.rotate(Math.atan(slope) * 0.6 + spin * duck.dir);
    ctx.scale(duck.dir, 1);
    // Body and tail.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.35, s * 1.05, s * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.45);
    ctx.quadraticCurveTo(-s * 1.3, -s * 0.9, -s * 1.05, -s * 1.0);
    ctx.lineTo(-s * 0.6, -s * 0.7);
    ctx.closePath();
    ctx.fill();
    // Wing.
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.3, s * 0.5, s * 0.28, -0.2, 0, TAU);
    ctx.fill();
    // Head, beak (open while quacking), eye and cheek.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(s * 0.6, -s * 1.0, s * 0.48, 0, TAU);
    ctx.fill();
    const open = quacking ? s * 0.14 : 0;
    ctx.fillStyle = BEAK;
    ctx.beginPath();
    ctx.moveTo(s * 0.95, -s * 1.05 - open * 0.4);
    ctx.quadraticCurveTo(s * 1.55, -s * 1.1 - open * 0.4, s * 1.5, -s * 0.92 - open * 0.3);
    ctx.lineTo(s * 0.95, -s * 0.86);
    ctx.closePath();
    ctx.fill();
    if (quacking) {
      ctx.beginPath();
      ctx.moveTo(s * 0.95, -s * 0.86);
      ctx.quadraticCurveTo(s * 1.45, -s * 0.84 + open * 0.3, s * 1.42, -s * 0.72 + open);
      ctx.lineTo(s * 0.95, -s * 0.74 + open * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    if (asleep) {
      ctx.strokeStyle = EYE;
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.arc(s * 0.75, -s * 1.1, s * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = EYE;
      ctx.beginPath();
      ctx.arc(s * 0.75, -s * 1.12, s * 0.09, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s * 0.72, -s * 1.15, s * 0.03, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 120, 150, 0.35)';
    ctx.beginPath();
    ctx.arc(s * 0.62, -s * 0.85, s * 0.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawBubble(b: Bubble, time: number, held: boolean): void {
    const { ctx, u } = this.base;
    const wob = Math.sin(b.wobble * 1.7) * 0.05 * (1 + b.wobbleAmp * 2);
    const rx = b.r * (1 + wob);
    const ry = b.r * (1 - wob);
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.kind === 'photo') {
      // The family floats by inside the bubble.
      const image = this.base.photo(b.photoId);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.92, ry * 0.92, 0, 0, TAU);
      ctx.clip();
      if (image) {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(image, -b.r, -b.r, b.r * 2, b.r * 2);
      } else {
        ctx.fillStyle = '#ffe1a8';
        ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
      }
      ctx.restore();
    }
    if (b.kind === 'star') {
      ctx.fillStyle = 'rgba(255, 215, 80, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffc933';
      this.star(0, 0, b.r * 0.4);
    }
    // The glassy body: clear in the middle, milky towards the rim.
    const glass = ctx.createRadialGradient(-rx * 0.25, -ry * 0.25, rx * 0.1, 0, 0, Math.max(rx, ry));
    glass.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    glass.addColorStop(0.72, 'rgba(255, 255, 255, 0.14)');
    glass.addColorStop(0.9, 'rgba(255, 255, 255, 0.6)');
    glass.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    // A thin darker edge, so the bubble stands out against the wall for small eyes.
    ctx.strokeStyle = 'rgba(30, 80, 140, 0.35)';
    ctx.lineWidth = 1.5 * u;
    ctx.stroke();
    // The rainbow sheen on the rim, turning slowly (never flashing).
    const hue = (b.hue + time * 25) % 360;
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = `hsla(${hue}, 90%, 78%, 1)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx - u, ry - u, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 3.5 * u;
    ctx.strokeStyle = `hsla(${(hue + 140) % 360}, 90%, 72%, 0.8)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx - 1.5 * u, ry - 1.5 * u, 0, Math.PI * 0.9, Math.PI * 1.55);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${(hue + 260) % 360}, 90%, 75%, 0.7)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx - 1.5 * u, ry - 1.5 * u, 0, Math.PI * 0.05, Math.PI * 0.5);
    ctx.stroke();
    // Highlights.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.38, -ry * 0.42, rx * 0.26, ry * 0.14, -0.65, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(rx * 0.35, ry * 0.4, rx * 0.09, 0, TAU);
    ctx.fill();
    if (held) {
      // Growing under a finger: a soft pulsing halo.
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 + 0.25 * Math.sin(time * 10)})`;
      ctx.lineWidth = 4 * u;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + 3 * u, ry + 3 * u, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDroplet(d: Droplet): void {
    const { ctx, u } = this.base;
    const t = Math.max(0, d.life / d.maxLife);
    if (d.kind === 'photo') {
      // The photo tumbles down into the water like a little card.
      const s = 30 * u;
      const image = this.base.photo(d.photoId);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate((d.maxLife - d.life) * 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2, s * 0.15);
      ctx.fill();
      if (image) ctx.drawImage(image, -s * 0.5, -s * 0.5, s, s);
      ctx.restore();
      return;
    }
    if (d.kind === 'foam') {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * t})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
      return;
    }
    if (d.kind === 'soap') {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * t})`;
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 * t})`;
      ctx.fill();
      return;
    }
    ctx.fillStyle = d.kind === 'gold' ? `rgba(255, 210, 80, ${t})` : `rgba(210, 240, 255, ${0.9 * t})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }

  private star(x: number, y: number, r: number): void {
    const ctx = this.base.ctx;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 === 0 ? r : r * 0.45;
      const a = (k / 10) * TAU - Math.PI / 2;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}
