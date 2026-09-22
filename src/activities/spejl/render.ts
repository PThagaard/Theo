import { TAU, clamp, easeOutBack } from '../../engine/rng';
import { Renderer } from '../balloner/render';
import type { Charge, Glitter, PhotoBubble, SpejlGame, Sticker } from './logic';

/**
 * Draws the mirror: the camera picture flipped like a real mirror (or a soft pastel backdrop when there is no
 * camera), a golden frame, the stickers with white edges so they read on any picture, glitter drawn additively,
 * the growing star under a still finger, and the family bubbles. Borrows the balloon renderer's canvas handling
 * and photo cache. No game logic here.
 */

const BACKDROP_TOP = '#ffd9e6';
const BACKDROP_BOTTOM = '#cde6ff';
const FRAME = '#ffd166';
const FRAME_DARK = '#e0a52b';
const EDGE = '#ffffff';
const COLORS: Array<{ fill: string; glow: [number, number, number] }> = [
  { fill: '#ff5c8a', glow: [255, 120, 160] },
  { fill: '#ffc233', glow: [255, 210, 90] },
  { fill: '#4d96ff', glow: [120, 170, 255] },
  { fill: '#5ed37a', glow: [130, 230, 150] },
  { fill: '#b96bff', glow: [200, 140, 255] },
  { fill: '#ff8a3d', glow: [255, 170, 90] },
];

export class SpejlRenderer {
  private readonly base: Renderer;
  private readonly glows = new Map<string, HTMLCanvasElement>();
  private video: HTMLVideoElement | null = null;
  private backdrop: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.base = new Renderer(canvas);
  }

  /** The live camera picture, or null when there is none (then the backdrop shows). */
  setVideo(video: HTMLVideoElement | null): void {
    this.video = video;
  }

  setPhotos(photos: Array<{ id: string; dataUrl: string }>): void {
    this.base.setPhotos(photos);
  }

  resize(width: number, height: number, dpr: number): void {
    this.base.resize(width, height, dpr);
    const gradient = this.base.ctx.createLinearGradient(0, 0, 0, this.base.H);
    gradient.addColorStop(0, BACKDROP_TOP);
    gradient.addColorStop(1, BACKDROP_BOTTOM);
    this.backdrop = gradient;
  }

  draw(game: SpejlGame, dt: number): void {
    const base = this.base;
    const { ctx, W, H } = base;
    base.time += dt;
    this.drawMirror();
    this.drawFrame();
    for (const bubble of game.bubbles) this.drawBubble(bubble);
    for (const sticker of game.stickers) this.drawSticker(sticker);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of game.glitter) this.drawGlitter(g);
    ctx.restore();
    if (game.charge) this.drawCharge(game.charge);
    if (game.dusk > 0) {
      ctx.fillStyle = `rgba(20, 10, 40, ${0.6 * game.dusk})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** The camera picture, flipped and filling the screen like a mirror; a calm backdrop without a camera. */
  private drawMirror(): void {
    const { ctx, W, H, u, time } = this.base;
    const video = this.video;
    if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
      const dw = video.videoWidth * scale;
      const dh = video.videoHeight * scale;
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
      return;
    }
    ctx.fillStyle = this.backdrop ?? BACKDROP_BOTTOM;
    ctx.fillRect(0, 0, W, H);
    // Soft drifting circles, so the backdrop is alive but calm.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 0.618 + 0.2) % 1) * W + Math.sin(time * 0.3 + i) * 20 * u;
      const y = ((i * 0.382 + 0.1) % 1) * H + Math.cos(time * 0.25 + i * 2) * 14 * u;
      ctx.beginPath();
      ctx.arc(x, y, (40 + (i % 3) * 22) * u, 0, TAU);
      ctx.fill();
    }
  }

  private drawFrame(): void {
    const { ctx, W, H, u } = this.base;
    const inset = 7 * u;
    ctx.lineWidth = 14 * u;
    ctx.strokeStyle = FRAME;
    this.roundRect(inset, inset, W - inset * 2, H - inset * 2, 26 * u);
    ctx.stroke();
    ctx.lineWidth = 2.5 * u;
    ctx.strokeStyle = FRAME_DARK;
    this.roundRect(inset + 7 * u, inset + 7 * u, W - (inset + 7 * u) * 2, H - (inset + 7 * u) * 2, 20 * u);
    ctx.stroke();
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

  // ---- Stickers ----------------------------------------------------------------------

  private drawSticker(sticker: Sticker): void {
    const { ctx, u } = this.base;
    const style = COLORS[sticker.color];
    const pop = easeOutBack(clamp(sticker.scale, 0, 1));
    const alpha = sticker.life < 1.5 ? clamp(sticker.life / 1.5, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sticker.x, sticker.y);
    ctx.rotate(sticker.spin + Math.sin(sticker.sway) * 0.1);
    ctx.scale(pop, pop);
    this.stickerPath(sticker.kind, sticker.size);
    ctx.lineWidth = 5 * u;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.fillStyle = style.fill;
    ctx.fill();
    // A little shine on every sticker.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-sticker.size * 0.3, -sticker.size * 0.35, sticker.size * 0.16, sticker.size * 0.1, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private stickerPath(kind: Sticker['kind'], s: number): void {
    const ctx = this.base.ctx;
    ctx.beginPath();
    switch (kind) {
      case 'star':
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? s : s * 0.48;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'heart':
        ctx.moveTo(0, s * 0.85);
        ctx.bezierCurveTo(-s * 1.3, s * 0.05, -s * 0.7, -s * 0.95, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.7, -s * 0.95, s * 1.3, s * 0.05, 0, s * 0.85);
        ctx.closePath();
        break;
      case 'flower':
        for (let i = 0; i < 5; i++) {
          const a = (i * TAU) / 5;
          ctx.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
          ctx.ellipse(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, s * 0.42, s * 0.3, a, 0, TAU);
        }
        ctx.moveTo(s * 0.3, 0);
        ctx.arc(0, 0, s * 0.3, 0, TAU);
        break;
      case 'balloon':
        ctx.ellipse(0, -s * 0.15, s * 0.72, s * 0.9, 0, 0, TAU);
        ctx.moveTo(-s * 0.16, s * 0.72);
        ctx.lineTo(s * 0.16, s * 0.72);
        ctx.lineTo(0, s * 0.95);
        ctx.closePath();
        ctx.moveTo(0, s * 0.95);
        ctx.quadraticCurveTo(s * 0.2, s * 1.3, 0, s * 1.6);
        break;
    }
  }

  // ---- Glitter, the growing star and the family bubbles ------------------------------------

  private glow(color: [number, number, number]): HTMLCanvasElement | null {
    const key = color.join(',');
    const cached = this.glows.get(key);
    if (cached) return cached;
    const size = 64;
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const g = sprite.getContext('2d');
    if (!g) return null;
    const [r, gr, b] = color;
    const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(${r}, ${gr}, ${b}, 0.9)`);
    gradient.addColorStop(0.4, `rgba(${r}, ${gr}, ${b}, 0.35)`);
    gradient.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
    g.fillStyle = gradient;
    g.fillRect(0, 0, size, size);
    this.glows.set(key, sprite);
    return sprite;
  }

  private drawGlitter(g: Glitter): void {
    const { ctx, u } = this.base;
    const alpha = clamp(g.life / g.maxLife, 0, 1);
    const sprite = this.glow(COLORS[g.color].glow);
    const radius = 9 * u * g.size;
    if (sprite) {
      ctx.globalAlpha = alpha * 0.8;
      ctx.drawImage(sprite, g.x - radius, g.y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 2.4 * u * g.size, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawCharge(charge: Charge): void {
    const { ctx, u, time } = this.base;
    const radius = (22 + 56 * charge.size) * u;
    const sprite = this.glow(COLORS[1].glow);
    if (sprite) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.3 * charge.size;
      ctx.drawImage(sprite, charge.x - radius * 1.8, charge.y - radius * 1.8, radius * 3.6, radius * 3.6);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(charge.x, charge.y);
    ctx.rotate(time * 0.8);
    const pulse = 1 + 0.06 * Math.sin(time * 6);
    ctx.scale(pulse, pulse);
    this.stickerPath('star', radius);
    ctx.lineWidth = 5 * u;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.fillStyle = COLORS[1].fill;
    ctx.fill();
    ctx.restore();
  }

  private drawBubble(bubble: PhotoBubble): void {
    const { ctx, u } = this.base;
    const image = this.base.photo(bubble.photoId);
    const r = bubble.r;
    ctx.save();
    ctx.translate(bubble.x, bubble.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, TAU);
    ctx.clip();
    if (image) ctx.drawImage(image, -r, -r, r * 2, r * 2);
    else {
      ctx.fillStyle = '#ffe1a8';
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.restore();
    const glass = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
    glass.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    glass.addColorStop(0.75, 'rgba(255, 255, 255, 0.12)');
    glass.addColorStop(0.9, 'rgba(255, 255, 255, 0.6)');
    glass.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}
