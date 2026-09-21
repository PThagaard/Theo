import { TAU } from '../../engine/rng';
import { BALLOON_COLORS, HILLS } from '../balloner/palette';
import { Renderer } from '../balloner/render';
import { hillY } from '../balloner/terrain';
import type { Balloon, Visitor } from '../balloner/types';
import type { OrdGame, Thing } from './logic';

/**
 * Draws the Ord stage: the balloon world's sky and hills (borrowed from its renderer, so the dog is the
 * same dog), one big thing in the middle, and a bush for hiding behind. Calm: no sun, clouds or extras.
 */
export class OrdRenderer {
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

  draw(game: OrdGame, dt: number): void {
    const base = this.base;
    const ctx = base.ctx;
    base.beginFrame(dt);
    // The hills are lifted so the thing stands big in the middle of the screen, on the front hill's crest.
    const hillLine = hillY(game.centerX, base.W, base.H, base.u, 1);
    const shift = Math.max(0, hillLine - game.groundY);
    ctx.fillStyle = HILLS.front;
    ctx.fillRect(0, base.H - shift - 1, base.W, shift + 1);
    ctx.save();
    ctx.translate(0, -shift);
    base.drawHill(0);
    base.drawHill(1);

    const size = game.size;
    const y = hillLine; // on screen: game.groundY
    // A touched thing bounces once.
    const bounce = game.state === 'react' ? Math.sin(Math.min(1, game.stateAge / 0.9) * Math.PI) : 0;
    const lift = bounce * size * 0.5;

    this.drawThing(game.current, game, game.x, y, size, lift, bounce);

    // The bush: in front of the thing while it hides (rustling a little), jumped aside once it has been found.
    if (game.hidden || game.bushOpen < 1) {
      const open = game.hidden ? 0 : game.bushOpen;
      const eased = 1 - (1 - open) * (1 - open);
      const rustle = game.hidden ? Math.sin(base.time * 7) * size * 0.04 : 0;
      this.drawBush(game.x + eased * size * 2.8 + rustle, y + size * 0.1, size);
    }
    ctx.restore();
    if (game.dusk > 0) base.drawNight(game.dusk);
  }

  private drawThing(thing: Thing, game: OrdGame, x: number, y: number, size: number, lift: number, bounce: number): void {
    const base = this.base;
    const ctx = base.ctx;
    if (thing.kind === 'creature' && thing.creature) {
      const flying = thing.creature === 'bird' || thing.creature === 'butterfly';
      const visitor: Visitor = {
        id: 1,
        kind: thing.creature,
        x,
        y: flying ? y - size * 1.6 - lift + Math.sin(base.time * 2) * size * 0.15 : y - lift,
        vx: 0,
        vy: 0,
        dir: game.state === 'enter' || game.state === 'leave' ? -1 : 1,
        age: base.time,
        state: 'idle',
        stateAge: game.stateAge,
        size,
        pokes: bounce > 0 ? 1 : 0,
        lastPoke: 0,
        hue: 300,
        targetX: x,
        targetY: y,
        lift: thing.creature === 'elephant' ? size * 1.15 : 0,
        form: null,
        formTimer: 0,
        lightning: 0,
        flash: 0,
        lastFlash: 0,
        lastBolt: 0,
        boltX: 0,
        nextLightning: 0,
        wet: 0,
        carriedBy: null,
        helpTimer: 0,
        resumeState: 'idle',
        grabbedBy: null,
      };
      base.drawVisitor(visitor);
      return;
    }
    if (thing.kind === 'balloon') {
      const r = size * 0.95;
      const balloon: Balloon = {
        id: 1,
        x,
        y: y - size * 1.9 - lift,
        baseX: x,
        r,
        color: BALLOON_COLORS[0],
        kind: 'plain',
        face: 'happy',
        vy: 0,
        swayAmp: 0,
        swayFreq: 0,
        swayPhase: 0,
        scale: 1 + bounce * 0.08,
        inflate: 1,
        age: base.time,
        blinkTimer: 1,
        blink: Math.sin(base.time * 0.7) > 0.97 ? 0.1 : 0,
        tapped: false,
        vx: 0,
        vyImpulse: 0,
        overinflate: 0,
      };
      // Its string, down to the ground.
      ctx.strokeStyle = 'rgba(70, 50, 90, 0.55)';
      ctx.lineWidth = 2.2 * base.u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, balloon.y + r * 1.35);
      ctx.quadraticCurveTo(x + Math.sin(base.time * 2) * 8 * base.u, (balloon.y + r * 1.35 + y) / 2, x, y);
      ctx.stroke();
      base.drawBalloon(balloon);
      return;
    }
    // A family photo: round, with a white frame, standing on the grass.
    const image = base.photo(thing.photoId);
    const radius = size * 1.15;
    const cy = y - radius - lift;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 12 * base.u;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, cy, radius + 6 * base.u, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, cy, radius, 0, TAU);
    ctx.clip();
    if (image) {
      ctx.drawImage(image, x - radius, cy - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = '#ffe1a8';
      ctx.fillRect(x - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  /** A round green bush, big enough to hide any of the things completely (they are up to ~3 sizes tall). */
  private drawBush(x: number, y: number, size: number): void {
    const ctx = this.base.ctx;
    const blobs: Array<[number, number, number]> = [
      [-1.3, -1.0, 1.15],
      [1.3, -1.0, 1.15],
      [-0.7, -2.0, 1.1],
      [0.7, -2.0, 1.1],
      [0, -2.4, 1.2],
      [-0.8, -0.5, 1.1],
      [0.8, -0.5, 1.1],
      [0, -1.2, 1.4],
    ];
    for (const [dx, dy, r] of blobs) {
      ctx.fillStyle = dy < -1.5 ? HILLS.back : HILLS.front;
      ctx.beginPath();
      ctx.arc(x + dx * size, y + dy * size, r * size, 0, TAU);
      ctx.fill();
    }
    // A few darker leaves for depth.
    ctx.fillStyle = HILLS.frontDark;
    for (const [dx, dy] of [
      [-1.1, -0.4],
      [0.5, -1.6],
      [1.2, -0.3],
      [-0.4, -2.3],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * size, y + dy * size, size * 0.3, size * 0.17, 0.4, 0, TAU);
      ctx.fill();
    }
  }
}
