import { TAU } from '../../engine/rng';
import { BALLOON_COLORS, HILLS, SPARKLE_COLORS } from '../balloner/palette';
import { Renderer } from '../balloner/render';
import { hillY } from '../balloner/terrain';
import type { Balloon, Cloud, Flower, Visitor } from '../balloner/types';
import { drawCar, drawCat, drawCow } from './figures';
import { FOUND_TIME, REACT_TIME, type OrdGame, type Thing } from './logic';

/** How one thing is drawn this frame: where, how big, and how much it is answering a touch. */
interface ThingView {
  x: number;
  /** The ground under its feet. */
  y: number;
  size: number;
  /** How high it has jumped. */
  lift: number;
  /** 0..1, the bounce of a touch (0 when idle). */
  bounce: number;
  /** Seconds since it was touched, Infinity when it was not. */
  reactAge: number;
  /** Sliding in or out. */
  moving: boolean;
}

/**
 * Draws the stage: the balloon world's sky and hills (borrowed from its renderer, so the dog is the same dog),
 * one big thing in the middle or a few side by side in a "Hvor er …?" round, and a bush for hiding behind.
 * Calm: nothing else moves.
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
    const moving = game.state === 'enter' || game.state === 'leave';
    const round = game.round;
    if (round) {
      const s = size * game.roundScale;
      round.things.forEach((thing, i) => {
        const age = round.reactAge[i];
        let bounce = age < REACT_TIME ? Math.sin((age / REACT_TIME) * Math.PI) : 0;
        let x = game.itemX(i);
        const asked = i === round.asked;
        if (asked && round.found) {
          // The celebration: a few happy hops, fading out.
          const hop = Math.abs(Math.sin((round.foundAge * Math.PI) / 0.45)) * Math.max(0, 1 - round.foundAge / FOUND_TIME);
          bounce = Math.max(bounce, hop);
        }
        // A repeated question: the asked-for thing wiggles, a hint that never says "wrong".
        if (asked && round.hint > 0) x += Math.sin(base.time * 28) * s * 0.08 * round.hint;
        this.drawThing(thing, { x, y, size: s, lift: bounce * s * 0.5, bounce, reactAge: age, moving }, dt);
        if (asked && round.found) this.drawStars(x, y - s * 1.4, s, round.foundAge);
      });
    } else {
      // A touched thing bounces once.
      const reacting = game.state === 'react';
      const bounce = reacting ? Math.sin(Math.min(1, game.stateAge / REACT_TIME) * Math.PI) : 0;
      this.drawThing(game.current, { x: game.x, y, size, lift: bounce * size * 0.5, bounce, reactAge: reacting ? game.stateAge : Infinity, moving }, dt);

      // The bush: in front of the thing while it hides (rustling a little), jumped aside once it has been found.
      if (game.hidden || game.bushOpen < 1) {
        const open = game.hidden ? 0 : game.bushOpen;
        const eased = 1 - (1 - open) * (1 - open);
        // Hiding: a small idle rustle; after a touch that did not open it, a big shake and a hop ("hmm?").
        const shake = game.hidden ? Math.sin(base.time * 7) * size * 0.04 + Math.sin(base.time * 34) * size * 0.14 * game.rustle : 0;
        const hop = game.hidden && game.rustle > 0 ? Math.sin((1 - game.rustle) * Math.PI) * size * 0.18 : 0;
        this.drawBush(game.x + eased * size * 2.8 + shake, y + size * 0.1 - hop, size);
      }
    }
    ctx.restore();
    if (game.dusk > 0) base.drawNight(game.dusk);
  }

  private drawThing(thing: Thing, view: ThingView, dt: number): void {
    const base = this.base;
    const ctx = base.ctx;
    const { x, y, size, lift, bounce, moving } = view;
    if (thing.kind === 'sun') {
      // Hangs in the sky above the stage; spins and squints when touched, like in the balloon world.
      base.drawSun(
        {
          sun: { x, y: y - size * 2.4 - lift, r: size * 1.1 },
          sinceCelebration: 1e9,
          sunHit: Number.isFinite(view.reactAge) ? view.reactAge : 1e9,
          sunCharge: 0,
        },
        dt,
      );
      return;
    }
    if (thing.kind === 'cloud') {
      const cloud: Cloud = { x, y: y - size * 2.2 - lift, scale: size / 40, speed: 0, shape: 1, vx: 0, wobble: bounce, dark: 0, holding: false };
      base.drawCloud(cloud);
      return;
    }
    if (thing.kind === 'flower') {
      // One big flower growing from the stage; it spins in rainbow colours when touched.
      const flower: Flower = {
        id: 1,
        fx: x / base.W,
        color: '#ff6b8a',
        size: size * 0.55,
        petals: 6,
        phase: 0,
        angle: bounce * TAU,
        spin: 0,
        rainbow: bounce > 0 ? 1 : 0,
        growth: 1,
        regrow: 0,
        flying: null,
        boost: 0,
      };
      base.drawFlower(flower, base.time);
      return;
    }
    if (thing.kind === 'cow' || thing.kind === 'cat' || thing.kind === 'car') {
      // Ord's own figures (figures.ts): feet at the origin, facing the way they move.
      ctx.save();
      ctx.translate(x, y - lift);
      ctx.scale(moving ? -1 : 1, 1);
      const figure = { s: size, t: base.time, react: bounce, moving };
      if (thing.kind === 'cow') drawCow(ctx, figure);
      else if (thing.kind === 'cat') drawCat(ctx, figure);
      else drawCar(ctx, figure);
      ctx.restore();
      return;
    }
    if (thing.kind === 'creature' && thing.creature) {
      const flying = thing.creature === 'bird' || thing.creature === 'butterfly' || thing.creature === 'bee';
      // The frog's tongue and the rabbit's alert ears come with the 'react' state; the older creatures answer
      // through `lift` and `pokes` as they always have.
      const reacts = bounce > 0 && (thing.creature === 'frog' || thing.creature === 'rabbit');
      const visitor: Visitor = {
        id: 1,
        kind: thing.creature,
        x,
        y: flying ? y - size * 1.6 - lift + Math.sin(base.time * 2) * size * 0.15 : y - lift,
        vx: 0,
        vy: 0,
        dir: moving ? -1 : 1,
        age: base.time,
        state: reacts ? 'react' : 'idle',
        stateAge: Number.isFinite(view.reactAge) ? view.reactAge : 0,
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
        hopTimer: 0,
      clearing: 0,
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

  /** The celebration when the asked-for thing is found: a ring of little stars drifting outwards and fading. */
  private drawStars(x: number, y: number, s: number, age: number): void {
    const ctx = this.base.ctx;
    const alpha = Math.max(0, 1 - age / (FOUND_TIME * 0.9));
    if (alpha <= 0) return;
    const radius = s * (1.3 + age * 1.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + age * 1.2;
      const cx = x + Math.cos(a) * radius;
      const cy = y + Math.sin(a) * radius * 0.7;
      const r = s * 0.16;
      ctx.fillStyle = SPARKLE_COLORS[i % SPARKLE_COLORS.length];
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const rr = k % 2 === 0 ? r : r * 0.45;
        const b = (k / 8) * TAU - Math.PI / 2 + age * 3;
        const px = cx + Math.cos(b) * rr;
        const py = cy + Math.sin(b) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
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
