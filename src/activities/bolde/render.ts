import { TAU } from '../../engine/rng';
import { BALLOON_COLORS } from '../balloner/palette';
import { Renderer } from '../balloner/render';
import type { Ball, BoldeGame, Sparkle } from './logic';

/**
 * Draws the playroom: a warm wall with soft dots, a green mat, and the balls with their faces, stripes and
 * shadows, squashing when they bump. Sparkles from touches, and the floor's trampoline bulge. Borrows the balloon
 * renderer's canvas handling, photo cache and night overlay. No game logic here.
 */

const WALL_TOP = '#fff7e0';
const WALL_BOTTOM = '#ffe6b8';
const WALL_DOT = 'rgba(255, 190, 120, 0.22)';
const MAT = '#5ed37a';
const MAT_DARK = '#3fae5c';
const EYE = '#3b2a4a';

export class BoldeRenderer {
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

  draw(game: BoldeGame, dt: number): void {
    const base = this.base;
    base.time += dt;
    this.drawRoom(game);
    // Shadows first, then the balls from the back (small y) to the front.
    for (const ball of game.balls) this.drawShadow(game, ball);
    for (const ball of [...game.balls].sort((a, b) => a.y - b.y)) this.drawBall(game, ball);
    for (const sparkle of game.sparkles) this.drawSparkle(sparkle);
    if (game.dusk > 0) base.drawNight(game.dusk);
  }

  private drawRoom(game: BoldeGame): void {
    const { ctx, W, H, u } = this.base;
    const wall = ctx.createLinearGradient(0, 0, 0, game.floorY);
    wall.addColorStop(0, WALL_TOP);
    wall.addColorStop(1, WALL_BOTTOM);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, game.floorY);
    // Soft dots on the wallpaper.
    ctx.fillStyle = WALL_DOT;
    const step = 70 * u;
    for (let row = 0; row * step < game.floorY; row++) {
      for (let x = (row % 2) * step * 0.5; x < W; x += step) {
        ctx.beginPath();
        ctx.arc(x, row * step + step * 0.5, 9 * u, 0, TAU);
        ctx.fill();
      }
    }
    // The mat, with the trampoline bulges where the floor was tapped.
    ctx.fillStyle = MAT;
    ctx.beginPath();
    ctx.moveTo(0, game.floorY);
    let x = 0;
    const segment = 8 * u;
    for (; x <= W; x += segment) {
      let y = game.floorY;
      for (const bump of game.bumps) {
        const t = bump.age / 0.6;
        const d = (x - bump.x) / (90 * u);
        y -= Math.exp(-d * d) * Math.sin(Math.min(1, t) * Math.PI) * 18 * u;
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, game.floorY);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = MAT_DARK;
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.moveTo(0, game.floorY + 2.5 * u);
    for (let sx = 0; sx <= W; sx += segment) {
      let y = game.floorY + 2.5 * u;
      for (const bump of game.bumps) {
        const t = bump.age / 0.6;
        const d = (sx - bump.x) / (90 * u);
        y -= Math.exp(-d * d) * Math.sin(Math.min(1, t) * Math.PI) * 18 * u;
      }
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(W, game.floorY + 2.5 * u);
    ctx.stroke();
  }

  private drawShadow(game: BoldeGame, ball: Ball): void {
    const ctx = this.base.ctx;
    const height = Math.max(0, game.floorY - ball.r - ball.y);
    const spread = Math.max(0.35, 1 - height / (game.height * 0.6));
    ctx.fillStyle = `rgba(40, 90, 50, ${0.28 * spread})`;
    ctx.beginPath();
    ctx.ellipse(ball.x, game.floorY + 4 * this.base.u, ball.r * 0.95 * spread, ball.r * 0.28 * spread, 0, 0, TAU);
    ctx.fill();
  }

  /** A soft ball: a lit sphere with a rolling stripe, squashed towards whatever it hit, and a face that looks where it goes. */
  private drawBall(game: BoldeGame, ball: Ball): void {
    const ctx = this.base.ctx;
    const color = BALLOON_COLORS[ball.color % BALLOON_COLORS.length];
    const r = ball.r;
    const asleep = game.dusk > 0.5;
    ctx.save();
    ctx.translate(ball.x, ball.y);
    // Squash: flatter along the direction of the bump, wider across it.
    ctx.rotate(ball.squashAngle);
    ctx.scale(1 - 0.22 * ball.squash, 1 + 0.16 * ball.squash);
    ctx.rotate(-ball.squashAngle);
    const image = this.base.photo(ball.photoId);
    if (ball.photoId && image) {
      // A family face fills the ball, inside a coloured rim.
      ctx.fillStyle = color.main;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.84, 0, TAU);
      ctx.clip();
      ctx.drawImage(image, -r * 0.84, -r * 0.84, r * 1.68, r * 1.68);
      ctx.restore();
    } else {
      const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      body.addColorStop(0, color.light);
      body.addColorStop(0.55, color.main);
      body.addColorStop(1, color.dark);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      // A rolling stripe, clipped to the ball.
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.clip();
      ctx.rotate(ball.angle);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      this.drawFace(ball, asleep);
    }
    // A glossy highlight.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.13, -0.7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawFace(ball: Ball, asleep: boolean): void {
    const ctx = this.base.ctx;
    const r = ball.r;
    const glad = ball.happy > 0;
    // The eyes look the way the ball is going.
    const look = Math.hypot(ball.vx, ball.vy);
    const lx = look > 1 ? (ball.vx / look) * r * 0.06 : 0;
    const ly = look > 1 ? (ball.vy / look) * r * 0.06 : 0;
    for (const side of [-1, 1]) {
      const ex = side * r * 0.3;
      const ey = -r * 0.12;
      if (asleep || glad) {
        // Closed, happy: an arch.
        ctx.strokeStyle = EYE;
        ctx.lineWidth = r * 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(ex, ey + r * 0.05, r * 0.12, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.16, r * 0.18, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = EYE;
      ctx.beginPath();
      ctx.arc(ex + lx, ey + ly, r * 0.09, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + lx - r * 0.03, ey + ly - r * 0.04, r * 0.03, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 120, 150, 0.4)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.5, r * 0.12, r * 0.1, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = EYE;
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (asleep) ctx.arc(0, r * 0.3, r * 0.12, Math.PI * 0.15, Math.PI * 0.85);
    else ctx.arc(0, r * 0.18, glad ? r * 0.3 : r * 0.2, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    if (glad && !asleep) {
      ctx.fillStyle = '#ff7a8a';
      ctx.beginPath();
      ctx.arc(0, r * 0.42, r * 0.08, 0, Math.PI);
      ctx.fill();
    }
  }

  private drawSparkle(sparkle: Sparkle): void {
    const { ctx, u } = this.base;
    const t = Math.max(0, sparkle.life / sparkle.maxLife);
    const color = BALLOON_COLORS[sparkle.color % BALLOON_COLORS.length];
    ctx.fillStyle = color.light;
    ctx.globalAlpha = t;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = (k % 2 === 0 ? 6 : 2.5) * u * (0.5 + t * 0.5);
      const a = (k / 8) * TAU;
      const px = sparkle.x + Math.cos(a) * rr;
      const py = sparkle.y + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
