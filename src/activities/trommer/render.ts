import { TAU } from '../../engine/rng';
import { BALLOON_COLORS } from '../balloner/palette';
import { Renderer } from '../balloner/render';
import type { Pad, Spark, TrommerGame, Wave } from './logic';

/**
 * Draws the drums: a deep blue room, big saturated pads with a taut skin and a darker rim, waves spreading from
 * every hit, and notes (now and then with a family face) floating up. Borrows the balloon renderer's canvas
 * handling, photo cache and night overlay. No game logic here.
 */

const ROOM_TOP = '#22306b';
const ROOM_BOTTOM = '#141c45';
const NOTE_WHITE = '#fff8e6';

export class TrommerRenderer {
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

  draw(game: TrommerGame, dt: number): void {
    const base = this.base;
    base.time += dt;
    const { ctx, W, H } = base;
    const room = ctx.createLinearGradient(0, 0, 0, H);
    room.addColorStop(0, ROOM_TOP);
    room.addColorStop(1, ROOM_BOTTOM);
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, W, H);
    for (const pad of game.pads) this.drawPad(pad);
    for (const wave of game.waves) this.drawWave(game, wave);
    for (const spark of game.sparks) this.drawSpark(spark);
    if (game.dusk > 0) base.drawNight(game.dusk);
  }

  /** A drum pad: a darker rim, a bright skin that dips when hit, a soft sheen, and a gentle bloom after a hit. */
  private drawPad(pad: Pad): void {
    const { ctx, u } = this.base;
    const color = BALLOON_COLORS[pad.color % BALLOON_COLORS.length];
    const w = pad.x1 - pad.x0;
    const h = pad.y1 - pad.y0;
    const cx = (pad.x0 + pad.x1) / 2;
    const cy = (pad.y0 + pad.y1) / 2;
    const radius = Math.min(w, h) * 0.24;
    ctx.save();
    ctx.translate(cx, cy);
    // Pushed in: a little wider and flatter, springing back.
    ctx.scale(1 + 0.025 * pad.squash, 1 - 0.06 * pad.squash);
    ctx.fillStyle = color.dark;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.fill();
    const inset = 7 * u;
    ctx.fillStyle = color.main;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + inset, -h / 2 + inset, w - 2 * inset, h - 2 * inset, radius * 0.8);
    ctx.fill();
    // A taut skin: a soft light from the top left, and a faint circle in the middle like a drum head.
    const sheen = ctx.createRadialGradient(-w * 0.25, -h * 0.3, 0, -w * 0.1, -h * 0.1, Math.max(w, h) * 0.75);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.strokeStyle = color.light;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.min(w, h) * 0.3, Math.min(w, h) * 0.3, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (pad.bloom > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * pad.bloom})`;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + inset, -h / 2 + inset, w - 2 * inset, h - 2 * inset, radius * 0.8);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Two rings spreading from where the hand landed, kept inside the pad. */
  private drawWave(game: TrommerGame, wave: Wave): void {
    const { ctx, u } = this.base;
    const pad = game.pads[wave.pad];
    if (!pad) return;
    const t = wave.age / 1.2;
    const fade = (1 - t) * wave.power;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pad.x0, pad.y0, pad.x1 - pad.x0, pad.y1 - pad.y0, Math.min(pad.x1 - pad.x0, pad.y1 - pad.y0) * 0.24);
    ctx.clip();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.75 * fade})`;
    ctx.lineWidth = (2 + 6 * (1 - t)) * u;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.age * 420 * u, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * fade})`;
    ctx.lineWidth = (1.5 + 3 * (1 - t)) * u;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.age * 260 * u, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** A note flying up (a filled head with a stem and flag), a star, or a family face on a big slow note. */
  private drawSpark(spark: Spark): void {
    const { ctx, u } = this.base;
    const t = Math.max(0, spark.life / spark.maxLife);
    ctx.save();
    ctx.translate(spark.x, spark.y);
    ctx.globalAlpha = Math.min(1, t * 1.6);
    if (spark.kind === 'photo') {
      const r = 26 * u;
      const image = this.base.photo(spark.photoId);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r + 3 * u, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.clip();
      if (image) ctx.drawImage(image, -r, -r, r * 2, r * 2);
      else {
        ctx.fillStyle = '#ffe1a8';
        ctx.fillRect(-r, -r, r * 2, r * 2);
      }
      ctx.restore();
      // The stem of the note the face rides on.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.9, 0);
      ctx.lineTo(r * 0.9, -r * 2.2);
      ctx.quadraticCurveTo(r * 1.5, -r * 2.0, r * 1.7, -r * 1.5);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.rotate(spark.spin * (spark.maxLife - spark.life) * 0.5);
    const color = BALLOON_COLORS[spark.color % BALLOON_COLORS.length];
    if (spark.kind === 'star') {
      ctx.fillStyle = NOTE_WHITE;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const rr = (k % 2 === 0 ? 7 : 3) * u;
        const a = (k / 10) * TAU - Math.PI / 2;
        if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    const r = 5.5 * u;
    ctx.fillStyle = spark.color % 2 === 0 ? NOTE_WHITE : color.light;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.85, -0.4, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r, -r * 0.3);
    ctx.lineTo(r, -r * 3.4);
    ctx.quadraticCurveTo(r * 2.2, -r * 3.2, r * 2.6, -r * 2.3);
    ctx.stroke();
    ctx.restore();
  }
}
