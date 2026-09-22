import { TAU } from '../../engine/rng';
import { Renderer } from '../balloner/render';
import { FISH_JUMP_TIME, WAVE_TIME } from './logic';
import type { BoblerGame, Bubble, Droplet, Duck, Guest } from './logic';

/**
 * Draws the bath: a tiled wall, blue water with foam and waves, the guests (whale, boat, jet ski, fish, shower,
 * polar bear on a floe), the rubber ducks, the bubbles with their rainbow sheen, and the drops and tiny bubbles
 * that touches leave behind. Borrows the balloon renderer's canvas handling, photo cache and night overlay. No
 * game logic here.
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
const WHALE = '#4b9be0';
const WHALE_DARK = '#3474b8';
const WHALE_BELLY = '#e3f1ff';
const BEAR = '#ffffff';
const BEAR_LINE = 'rgba(110, 150, 185, 0.6)';
const BEAR_BELLY = '#eef5fb';
const BEAR_PAD = '#3a3a4a';
const ICE = '#f2fbff';
const ICE_SIDE = '#bfe0f4';
const COW_WHITE = '#f7f4ee';
const COW_BLACK = '#3a3a3a';
const PENGUIN = '#2b2b3a';
const BEAK = '#ff8c42';
/** Baby, mama and papa shark: our own colours, bright and different, so each is easy to tell apart. */
const SHARK_COLORS: Array<{ body: string; belly: string; fin: string }> = [
  { body: '#8fd3f4', belly: '#e8f8ff', fin: '#5fb7e6' },
  { body: '#ff9fc3', belly: '#ffe6f0', fin: '#ef6f9e' },
  { body: '#5b8def', belly: '#dce9ff', fin: '#3b6bd1' },
];
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
        this.drawFish(g);
        break;
      case 'bear':
        this.drawBear(game, g);
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
      case 'sharks':
        // Papa at the back is drawn first, the baby in front last.
        for (let i = g.members.length - 1; i >= 0; i--) this.drawShark(game, g, i);
        break;
    }
  }

  /**
   * One shark of the family: a round, smiling toy shark (no teeth), its fin above the water and its body faint
   * below, wearing a family face when there is a photo for it. A leap lifts it clear of the water, nose up.
   */
  private drawShark(game: BoblerGame, g: Guest, i: number): void {
    const { ctx } = this.base;
    const m = game.memberPosition(g, i);
    const s = m.size;
    const style = SHARK_COLORS[Math.min(i, SHARK_COLORS.length - 1)];
    const leap = g.members[i] ?? 0;
    const image = this.base.photo(g.faces[i]);
    const body = () => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(g.dir, 1);
      if (leap > 0) ctx.rotate(-(leap - 0.5) * 1.2);
      // Tail fin, wagging (faster in a leap).
      ctx.save();
      ctx.translate(-s * 1.15, 0);
      ctx.rotate(Math.sin(g.phase * 1.6 + i * 1.3) * (leap > 0 ? 0.45 : 0.28));
      ctx.fillStyle = style.fin;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-s * 0.7, -s * 0.75);
      ctx.lineTo(-s * 0.5, 0);
      ctx.lineTo(-s * 0.7, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Body, belly, dorsal fin, pectoral fin and gills.
      ctx.fillStyle = style.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.3, s * 0.62, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = style.belly;
      ctx.beginPath();
      ctx.ellipse(s * 0.1, s * 0.22, s * 1.0, s * 0.35, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = style.fin;
      ctx.beginPath();
      ctx.moveTo(s * 0.15, -s * 0.5);
      ctx.lineTo(-s * 0.2, -s * 1.2);
      ctx.lineTo(-s * 0.6, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.2, s * 0.3);
      ctx.lineTo(-s * 0.1, s * 0.85);
      ctx.lineTo(s * 0.55, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = style.fin;
      ctx.lineWidth = s * 0.05;
      ctx.lineCap = 'round';
      for (const dx of [-0.05, 0.1]) {
        ctx.beginPath();
        ctx.arc(dx * s, -s * 0.1, s * 0.22, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();
      }
      if (image) {
        // The family face sits high on the head, above the water line, with a pale rim so it reads as a photo.
        const r = s * 0.52;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s * 0.6, -s * 0.18, r + s * 0.06, 0, TAU);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(s * 0.6, -s * 0.18, r, 0, TAU);
        ctx.clip();
        ctx.drawImage(image, s * 0.6 - r, -s * 0.18 - r, r * 2, r * 2);
        ctx.restore();
      } else {
        this.eye(s * 0.7, -s * 0.2, s * 0.12);
        ctx.fillStyle = 'rgba(255, 140, 150, 0.45)';
        ctx.beginPath();
        ctx.arc(s * 0.55, s * 0.05, s * 0.1, 0, TAU);
        ctx.fill();
        // A wide, friendly smile.
        ctx.strokeStyle = EYE;
        ctx.lineWidth = s * 0.06;
        ctx.beginPath();
        ctx.arc(s * 0.85, s * 0.12, s * 0.3, 0.15 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    };
    this.inWater(game, m.x, s * 2.2, 0.45, body);
  }

  /**
   * Draws a guest that sits in the water: the part above the surface as it is, the part below faint through the
   * water (a hidden whale is just a dim shadow under its back). No tinted strip on the water itself.
   */
  private inWater(game: BoblerGame, x: number, halfWidth: number, alpha: number, draw: () => void): void {
    const { ctx, H, u } = this.base;
    const step = 6 * u;
    const surface = () => {
      ctx.beginPath();
      ctx.moveTo(x - halfWidth, game.surfaceY(x - halfWidth));
      for (let sx = x - halfWidth; sx <= x + halfWidth; sx += step) ctx.lineTo(sx, game.surfaceY(sx));
      ctx.lineTo(x + halfWidth, game.surfaceY(x + halfWidth));
    };
    ctx.save();
    surface();
    ctx.lineTo(x + halfWidth, -10 * u);
    ctx.lineTo(x - halfWidth, -10 * u);
    ctx.closePath();
    ctx.clip();
    draw();
    ctx.restore();
    ctx.save();
    surface();
    ctx.lineTo(x + halfWidth, H + 10 * u);
    ctx.lineTo(x - halfWidth, H + 10 * u);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = alpha;
    draw();
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

  /**
   * The toy whale the parents asked for: a big round head, blue back with speckles, cream belly, tail up, and the
   * blowhole on top. It hides with only its back and blowhole above the water until a touch lets the water out;
   * then it sits up in the water, glad, rocking, and spouts again at every touch.
   */
  private drawWhale(game: BoblerGame, g: Guest): void {
    const { ctx, time } = this.base;
    const s = g.size;
    const hidden = g.pokes === 0;
    const spouting = g.state === 'act';
    // Hidden it only quivers a little (something is there); helped up it rocks happily.
    const quiver = hidden ? Math.sin(time * 38 + g.phase) * s * 0.02 : 0;
    const rock = hidden ? 0 : Math.sin(time * 3.2 + g.phase) * 0.07 + (spouting ? Math.sin(time * 22) * 0.04 : 0);
    const body = () => {
      ctx.save();
      ctx.translate(g.x + quiver, g.y);
      ctx.rotate(rock * g.dir);
      ctx.scale(g.dir, 1);
      // The tail, held up behind.
      ctx.fillStyle = WHALE_DARK;
      ctx.beginPath();
      ctx.moveTo(-1.2 * s, -0.05 * s);
      ctx.quadraticCurveTo(-1.7 * s, -0.2 * s, -2.35 * s, -0.75 * s);
      ctx.quadraticCurveTo(-2.05 * s, -0.4 * s, -1.95 * s, -0.28 * s);
      ctx.quadraticCurveTo(-2.2 * s, -0.12 * s, -2.45 * s, 0.12 * s);
      ctx.quadraticCurveTo(-1.8 * s, 0.15 * s, -1.2 * s, 0.35 * s);
      ctx.closePath();
      ctx.fill();
      // The body: a big round head at the front, tapering back.
      ctx.fillStyle = WHALE;
      ctx.beginPath();
      ctx.moveTo(-1.35 * s, 0.1 * s);
      ctx.quadraticCurveTo(-1.45 * s, -0.75 * s, -0.55 * s, -0.95 * s);
      ctx.quadraticCurveTo(0.35 * s, -1.2 * s, 1.05 * s, -0.85 * s);
      ctx.quadraticCurveTo(1.55 * s, -0.5 * s, 1.45 * s, 0.1 * s);
      ctx.quadraticCurveTo(1.35 * s, 0.65 * s, 0.6 * s, 0.75 * s);
      ctx.quadraticCurveTo(-0.6 * s, 0.85 * s, -1.35 * s, 0.4 * s);
      ctx.closePath();
      ctx.fill();
      // A thin darker rim, so the back stands out against the wall tiles even when only the top shows.
      ctx.strokeStyle = WHALE_DARK;
      ctx.lineWidth = s * 0.06;
      ctx.stroke();
      // Cream belly with a few ridges, inside the body.
      ctx.save();
      ctx.clip();
      ctx.fillStyle = WHALE_BELLY;
      ctx.beginPath();
      ctx.ellipse(0.1 * s, 0.9 * s, 1.55 * s, 0.6 * s, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 150, 190, 0.35)';
      ctx.lineWidth = s * 0.035;
      for (const dy of [0.48, 0.6, 0.72]) {
        ctx.beginPath();
        ctx.moveTo(-1.2 * s, dy * s);
        ctx.lineTo(1.3 * s, dy * s);
        ctx.stroke();
      }
      ctx.restore();
      // Speckles on the back, a soft shine on the forehead, and the side fin.
      ctx.fillStyle = WHALE_DARK;
      for (const [dx, dy, r] of [
        [-0.35, -0.68, 0.07],
        [-0.1, -0.5, 0.05],
        [-0.5, -0.42, 0.05],
        [0.1, -0.78, 0.045],
        [-0.25, -0.32, 0.04],
      ] as const) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, r * s, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = s * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0.55 * s, -1.02 * s);
      ctx.quadraticCurveTo(0.95 * s, -0.98 * s, 1.2 * s, -0.7 * s);
      ctx.stroke();
      ctx.fillStyle = WHALE_DARK;
      ctx.beginPath();
      ctx.ellipse(0.45 * s, 0.45 * s, 0.4 * s, 0.17 * s, 0.45, 0, TAU);
      ctx.fill();
      // The blowhole: the little hole on top, the first thing that shows.
      ctx.fillStyle = '#1f4f8f';
      ctx.beginPath();
      ctx.ellipse(0.35 * s, -1.03 * s, 0.13 * s, 0.065 * s, 0, 0, TAU);
      ctx.fill();
      // The face: an eye that closes happily while it spouts, a pink cheek, and a smile that widens once it is up.
      if (spouting) {
        ctx.strokeStyle = EYE;
        ctx.lineWidth = s * 0.06;
        ctx.beginPath();
        ctx.arc(0.95 * s, -0.2 * s, 0.13 * s, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        this.eye(0.95 * s, -0.25 * s, 0.14 * s);
      }
      ctx.fillStyle = 'rgba(255, 120, 150, 0.4)';
      ctx.beginPath();
      ctx.arc(1.15 * s, 0.05 * s, 0.13 * s, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = EYE;
      ctx.lineWidth = s * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(1.0 * s, 0.05 * s, hidden ? 0.2 * s : 0.32 * s, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      if (spouting) {
        // The spout: a fan of white plumes rising from the blowhole (the drops fly on their own).
        const p = Math.min(1, g.stateAge / 0.9);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = s * 0.09;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(0.35 * s, -1.05 * s);
          ctx.quadraticCurveTo(0.35 * s + k * s * 0.25, -1.05 * s - s * 0.9 * p, 0.35 * s + k * s * 0.5, -1.05 * s - s * 1.5 * p);
          ctx.stroke();
        }
      }
      ctx.restore();
    };
    this.inWater(game, g.x, s * 2.7, hidden ? 0.08 : 0.35, body);
  }

  /** A big goldfish just under the water; it leaps in an arc, wriggles inside a bubble and tumbles when it falls. */
  private drawFish(g: Guest): void {
    const ctx = this.base.ctx;
    const s = g.size * 0.9;
    const jumping = g.state === 'act';
    const t = jumping ? Math.min(1, g.stateAge / FISH_JUMP_TIME) : 0;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.dir, 1);
    if (jumping) ctx.rotate(-(0.5 - t) * 1.4);
    else if (g.state === 'ride') ctx.rotate(Math.sin(g.phase * 0.5) * 0.25);
    else if (g.state === 'fall') ctx.rotate(g.stateAge * 5);
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
  }

  /** A red speedboat with a cow at the wheel, bouncing over the waves. */
  private drawBoat(game: BoblerGame, g: Guest): void {
    const { ctx, u } = this.base;
    const s = g.size;
    const slope = (game.surfaceY(g.x + 20 * u) - game.surfaceY(g.x - 20 * u)) / (40 * u);
    const hopTilt = g.hop > 0 ? Math.sin((1 - g.hop) * Math.PI) * 0.22 : 0;
    const body = () => {
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
    };
    this.inWater(game, g.x, s * 2.2, 0.45, body);
  }

  /** A yellow jet ski with a penguin holding the handlebar, spray flying. */
  private drawJetski(game: BoblerGame, g: Guest): void {
    const { ctx, u } = this.base;
    const s = g.size;
    const slope = (game.surfaceY(g.x + 20 * u) - game.surfaceY(g.x - 20 * u)) / (40 * u);
    const hopTilt = g.hop > 0 ? Math.sin((1 - g.hop) * Math.PI) * 0.35 : 0;
    const body = () => {
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
    };
    this.inWater(game, g.x, s * 2.3, 0.45, body);
  }

  /** The shower head on its hose from above: dripping while it waits, spraying hard when touched or carried. */
  private drawShower(g: Guest): void {
    const { ctx, u, time } = this.base;
    const s = g.size;
    const spraying = g.state === 'act';
    const sway = spraying ? Math.sin(time * 14) * s * 0.04 : 0;
    ctx.save();
    ctx.translate(sway, 0);
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
    if (spraying) {
      // The spray: streaks with running dashes (the drops themselves fly on their own).
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2.5 * u;
      ctx.setLineDash([10 * u, 12 * u]);
      ctx.lineDashOffset = -time * 400 * u;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(g.x + k * s * 0.2, g.y + s * 0.3);
        ctx.lineTo(g.x + k * s * 0.55, g.y + s * 3.0);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else {
      // Waiting: a drop slowly forming under the middle nozzle.
      const drip = (time * 0.7 + g.phase) % 1;
      ctx.fillStyle = 'rgba(210, 240, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + s * 0.3 + drip * s * 0.25, s * 0.06, s * 0.08 + drip * s * 0.06, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * A polar bear sitting on an ice floe, waving hello with a big paw: the arm and hand are deliberately large
   * and slow, because Theo is learning to wave himself.
   */
  private drawBear(game: BoblerGame, g: Guest): void {
    const { ctx, u } = this.base;
    const s = g.size;
    const slope = (game.surfaceY(g.x + 30 * u) - game.surfaceY(g.x - 30 * u)) / (60 * u);
    const tilt = Math.atan(slope) * 0.6;
    const floe = () => {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(tilt);
      const slab = (dy: number) => {
        ctx.beginPath();
        ctx.moveTo(-1.95 * s, dy - 0.05 * s);
        ctx.lineTo(-1.5 * s, dy - 0.36 * s);
        ctx.lineTo(-0.6 * s, dy - 0.42 * s);
        ctx.lineTo(0.5 * s, dy - 0.38 * s);
        ctx.lineTo(1.4 * s, dy - 0.45 * s);
        ctx.lineTo(1.95 * s, dy - 0.1 * s);
        ctx.lineTo(1.6 * s, dy + 0.18 * s);
        ctx.lineTo(-1.4 * s, dy + 0.2 * s);
        ctx.closePath();
      };
      ctx.fillStyle = ICE_SIDE;
      slab(0.3 * s);
      ctx.fill();
      ctx.fillStyle = ICE;
      slab(0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = s * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-1.45 * s, -0.3 * s);
      ctx.lineTo(-0.6 * s, -0.36 * s);
      ctx.stroke();
      ctx.restore();
    };
    this.inWater(game, g.x, s * 2.2, 0.5, floe);
    // The bear sits on top, facing us, so the wave is easy to see.
    const waving = g.state === 'act';
    const wt = waving ? Math.min(1, g.stateAge / WAVE_TIME) : 0;
    // The arm goes up fast, flaps side to side, and comes down at the end.
    const raise = waving ? Math.min(1, wt * 4) * (wt > 0.85 ? (1 - wt) / 0.15 : 1) : 0;
    const flap = Math.sin(wt * Math.PI * 6) * 0.6 * raise;
    ctx.save();
    ctx.translate(g.x, g.y - 0.38 * s);
    ctx.rotate(tilt);
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = BEAR_LINE;
    const blob = (x: number, y: number, rx: number, ry: number, fill = BEAR) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    };
    // The resting arm, the hind paws, the body and the belly.
    blob(-0.62 * s, -0.55 * s, 0.2 * s, 0.42 * s);
    blob(-0.45 * s, -0.08 * s, 0.32 * s, 0.2 * s);
    blob(0.45 * s, -0.08 * s, 0.32 * s, 0.2 * s);
    blob(0, -0.62 * s, 0.72 * s, 0.7 * s);
    ctx.fillStyle = BEAR_BELLY;
    ctx.beginPath();
    ctx.ellipse(0, -0.5 * s, 0.45 * s, 0.45 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = BEAR_PAD;
    for (const side of [-1, 1]) {
      for (const dx of [-0.1, 0, 0.1]) {
        ctx.beginPath();
        ctx.arc(side * 0.45 * s + dx * s, -0.13 * s, 0.035 * s, 0, TAU);
        ctx.fill();
      }
    }
    // The head, ears, muzzle, nose, eyes and cheeks; it tips a little towards the waving arm.
    ctx.save();
    ctx.rotate(0.1 * raise);
    blob(-0.4 * s, -1.85 * s, 0.17 * s, 0.17 * s);
    blob(0.4 * s, -1.85 * s, 0.17 * s, 0.17 * s);
    ctx.fillStyle = '#ffc6d0';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 0.4 * s, -1.85 * s, 0.08 * s, 0, TAU);
      ctx.fill();
    }
    blob(0, -1.42 * s, 0.52 * s, 0.5 * s);
    ctx.fillStyle = BEAR_BELLY;
    ctx.beginPath();
    ctx.ellipse(0, -1.25 * s, 0.3 * s, 0.22 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = EYE;
    ctx.beginPath();
    ctx.ellipse(0, -1.35 * s, 0.12 * s, 0.085 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(0, -1.24 * s, 0.11 * s, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    this.eye(-0.22 * s, -1.55 * s, 0.075 * s);
    this.eye(0.22 * s, -1.55 * s, 0.075 * s);
    ctx.fillStyle = 'rgba(255, 120, 150, 0.35)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 0.4 * s, -1.3 * s, 0.1 * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // The waving arm: upper arm from the shoulder, forearm, and a big paw with four fingers.
    const shoulderX = 0.55 * s;
    const shoulderY = -0.9 * s;
    const a = 1.25 + (-1.45 - 1.25) * raise;
    const elbowX = shoulderX + Math.cos(a) * 0.5 * s;
    const elbowY = shoulderY + Math.sin(a) * 0.5 * s;
    const b = a + flap;
    const pawX = elbowX + Math.cos(b) * 0.5 * s;
    const pawY = elbowY + Math.sin(b) * 0.5 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [color, width] of [
      [BEAR_LINE, 0.38],
      [BEAR, 0.3],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = s * width;
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(pawX, pawY);
      ctx.stroke();
    }
    ctx.strokeStyle = BEAR_LINE;
    ctx.lineWidth = s * 0.05;
    for (let k = -1.5; k <= 1.5; k++) {
      const fa = b + k * 0.42;
      blob(pawX + Math.cos(fa) * 0.3 * s, pawY + Math.sin(fa) * 0.3 * s, 0.1 * s, 0.1 * s);
    }
    blob(pawX, pawY, 0.3 * s, 0.3 * s);
    ctx.fillStyle = BEAR_PAD;
    ctx.beginPath();
    ctx.arc(pawX, pawY, 0.12 * s, 0, TAU);
    ctx.fill();
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
