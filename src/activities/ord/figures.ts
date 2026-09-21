import { TAU } from '../../engine/rng';

/**
 * The things that only live in Ord (the balloon world lends its dog, elephant, bird, butterfly, snail and
 * tractor): a cow, a cat and a little car. Each is drawn with its feet at the origin, facing right, in
 * the same flat, round, high-contrast style as the visitors, and each has one clear reaction to a touch.
 */

export interface FigureView {
  /** Body size (the game's `size`), like a visitor's. */
  s: number;
  /** Seconds, for the idle animation. */
  t: number;
  /** 0..1 while the thing answers a touch (the bounce curve), 0 when idle. */
  react: number;
  /** Sliding in or out: legs walk, wheels roll. */
  moving: boolean;
}

const EYE = '#3b2a4a';

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = EYE;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU);
  ctx.fill();
}

/** A black-and-white cow with a bell; lifts its head and opens its mouth for a "muuuh" when touched. */
export function drawCow(ctx: CanvasRenderingContext2D, view: FigureView): void {
  const { s, t, react, moving } = view;
  const white = '#f7f4ee';
  const shade = '#e4e0d6';
  const black = '#3a3a3a';
  // The head sticks out to the right, so the cow is shifted a little to stand in the middle, and it is
  // drawn a touch bigger than the others to look as big on the stage as they do.
  ctx.translate(-s * 0.25, 0);
  ctx.scale(1.12, 1.12);
  ctx.lineCap = 'round';
  // Legs with dark hooves; the far pair a touch greyer so the walk reads.
  ctx.lineWidth = s * 0.2;
  for (const [x, phase, colour] of [
    [-0.62, 0, shade],
    [0.42, Math.PI, shade],
    [-0.42, Math.PI, white],
    [0.62, 0, white],
  ] as const) {
    const swing = moving ? Math.sin(t * 7 + phase) * s * 0.2 : 0;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x * s, -s * 0.7);
    ctx.lineTo(x * s + swing, -s * 0.08);
    ctx.stroke();
    ctx.fillStyle = '#4a3f3f';
    ctx.beginPath();
    ctx.ellipse(x * s + swing, -s * 0.06, s * 0.12, s * 0.07, 0, 0, TAU);
    ctx.fill();
  }
  // Tail with a tuft, swishing faster when happy.
  const swish = Math.sin(t * (react > 0 ? 14 : 2.5)) * s * 0.18;
  ctx.strokeStyle = white;
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(-s * 0.95, -s * 1.05);
  ctx.quadraticCurveTo(-s * 1.3, -s * 0.9, -s * 1.28 + swish, -s * 0.5);
  ctx.stroke();
  ctx.fillStyle = black;
  ctx.beginPath();
  ctx.arc(-s * 1.28 + swish, -s * 0.45, s * 0.1, 0, TAU);
  ctx.fill();
  // Body with patches (clipped to the body) and a pink udder.
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.9, s * 1.0, s * 0.52, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = black;
  for (const [dx, dy, rx, ry] of [
    [-0.45, -0.95, 0.32, 0.26],
    [0.35, -0.7, 0.28, 0.2],
    [0.1, -1.28, 0.22, 0.14],
  ]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, dy * s, rx * s, ry * s, 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#ffb3c6';
  ctx.beginPath();
  ctx.ellipse(-s * 0.1, -s * 0.45, s * 0.26, s * 0.13, 0, 0, TAU);
  ctx.fill();
  // Head: nods up and calls when touched.
  const nod = react * s * 0.18;
  ctx.save();
  ctx.translate(s * 0.98, -s * 1.3 - nod);
  ctx.rotate(-react * 0.25);
  ctx.fillStyle = shade;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-s * 0.15 + side * s * 0.3, -s * 0.22, s * 0.2, s * 0.1, side * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#e8d5a6';
  ctx.lineWidth = s * 0.08;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.15 + side * s * 0.16, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.15 + side * s * 0.28, -s * 0.5, -s * 0.15 + side * s * 0.2, -s * 0.62);
    ctx.stroke();
  }
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.36, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = black;
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, -s * 0.3, s * 0.2, s * 0.1, 0.2, 0, TAU);
  ctx.fill();
  // Muzzle with nostrils, and the mouth: a smile, or wide open for the "muuuh".
  ctx.fillStyle = '#ffb3c6';
  ctx.beginPath();
  ctx.ellipse(s * 0.2, s * 0.14, s * 0.3, s * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d9788f';
  for (const dx of [0.1, 0.3]) {
    ctx.beginPath();
    ctx.ellipse(s * dx, s * 0.08, s * 0.04, s * 0.03, 0, 0, TAU);
    ctx.fill();
  }
  if (react > 0) {
    ctx.fillStyle = '#5a2d3a';
    ctx.beginPath();
    ctx.ellipse(s * 0.2, s * 0.22, s * 0.11, s * 0.07 + react * s * 0.05, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.arc(s * 0.2, s * 0.18, s * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  eye(ctx, -s * 0.18, -s * 0.1, s * 0.07);
  eye(ctx, s * 0.14, -s * 0.12, s * 0.07);
  ctx.restore();
  // A little bell under the chin, swinging with the call.
  ctx.strokeStyle = '#c94a3b';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(s * 0.8, -s * 1.05 - nod * 0.5);
  ctx.lineTo(s * 0.8, -s * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#ffd93d';
  ctx.beginPath();
  ctx.arc(s * 0.8 + Math.sin(t * 9) * react * s * 0.05, -s * 0.84, s * 0.09, 0, TAU);
  ctx.fill();
}

/** A sitting orange tabby; closes its eyes happily and says "mjav" when touched. */
export function drawCat(ctx: CanvasRenderingContext2D, view: FigureView): void {
  const { s, t, react } = view;
  const orange = '#f5a742';
  const stripe = '#d98a2b';
  ctx.lineCap = 'round';
  // Tail curled round the side, its tip flicking (faster when happy).
  const flick = Math.sin(t * (react > 0 ? 12 : 2)) * s * 0.12;
  ctx.strokeStyle = orange;
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 0.25);
  ctx.quadraticCurveTo(-s * 1.2, -s * 0.1, -s * 1.15, -s * 0.75 + flick);
  ctx.stroke();
  ctx.strokeStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(-s * 1.13, -s * 0.5 + flick * 0.6);
  ctx.lineTo(-s * 1.15, -s * 0.75 + flick);
  ctx.stroke();
  // Sitting body with a pale chest, stripes on the sides and two front paws.
  ctx.fillStyle = orange;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.72, s * 0.62, s * 0.74, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffe3b3';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.6, s * 0.34, s * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = stripe;
  for (const side of [-1, 1]) {
    for (const dy of [-0.98, -0.78]) {
      ctx.beginPath();
      ctx.ellipse(side * s * 0.5, dy * s, s * 0.12, s * 0.04, side * 0.5, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = orange;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * s * 0.25, -s * 0.1, s * 0.2, s * 0.11, 0, 0, TAU);
    ctx.fill();
  }
  // Head: ears with pink insides, forehead stripes, eyes, nose, mouth and whiskers.
  ctx.save();
  ctx.translate(0, -s * 1.55 - react * s * 0.08);
  ctx.rotate(Math.sin(t * 1.3) * 0.04);
  ctx.fillStyle = orange;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.16, -s * 0.28);
    ctx.lineTo(side * s * 0.5, -s * 0.72);
    ctx.lineTo(side * s * 0.55, -s * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffb3c6';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.24, -s * 0.32);
    ctx.lineTo(side * s * 0.46, -s * 0.62);
    ctx.lineTo(side * s * 0.49, -s * 0.22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = orange;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.55, s * 0.48, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = stripe;
  for (const dx of [-0.16, 0, 0.16]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, -s * 0.34, s * 0.04, s * 0.11, 0, 0, TAU);
    ctx.fill();
  }
  if (react > 0) {
    // Happy, closed eyes while it answers.
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.05;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * s * 0.22, -s * 0.02, s * 0.1, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    const blink = Math.sin(t * 0.9) > 0.98;
    for (const side of [-1, 1]) {
      if (blink) {
        ctx.strokeStyle = EYE;
        ctx.lineWidth = s * 0.04;
        ctx.beginPath();
        ctx.moveTo(side * s * 0.12, -s * 0.06);
        ctx.lineTo(side * s * 0.32, -s * 0.06);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#8fd36b';
      ctx.beginPath();
      ctx.ellipse(side * s * 0.22, -s * 0.06, s * 0.12, s * 0.13, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = EYE;
      ctx.beginPath();
      ctx.ellipse(side * s * 0.22, -s * 0.06, s * 0.05, s * 0.11, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(side * s * 0.19, -s * 0.1, s * 0.03, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#ff8fa8';
  ctx.beginPath();
  ctx.moveTo(-s * 0.07, s * 0.1);
  ctx.lineTo(s * 0.07, s * 0.1);
  ctx.lineTo(0, s * 0.18);
  ctx.closePath();
  ctx.fill();
  if (react > 0) {
    // "Mjav": the mouth opens.
    ctx.fillStyle = '#5a2d3a';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.3, s * 0.08, s * 0.07 + react * s * 0.04, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = EYE;
    ctx.lineWidth = s * 0.035;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * s * 0.09, s * 0.16, s * 0.09, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(59, 42, 74, 0.55)';
  ctx.lineWidth = s * 0.025;
  for (const side of [-1, 1]) {
    for (const dy of [-0.06, 0.02, 0.1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.25, s * (0.12 + dy * 0.5));
      ctx.lineTo(side * s * 0.75, s * (0.02 + dy * 2.2));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A friendly little blue car; honks, flashes its headlight and bounces on its wheels when touched. */
export function drawCar(ctx: CanvasRenderingContext2D, view: FigureView): void {
  const { s, t, react, moving } = view;
  const roll = moving ? t * 9 : react * 6;
  ctx.translate(0, moving ? Math.sin(t * 14) * s * 0.015 : 0);
  // Body, cabin and windows.
  ctx.fillStyle = '#4d96ff';
  ctx.beginPath();
  ctx.roundRect(-s * 1.15, -s * 0.95, s * 2.3, s * 0.72, s * 0.2);
  ctx.fill();
  ctx.fillStyle = '#3b7fe0';
  ctx.beginPath();
  ctx.roundRect(-s * 0.72, -s * 1.5, s * 1.3, s * 0.65, [s * 0.32, s * 0.32, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#dff3ff';
  ctx.beginPath();
  ctx.roundRect(-s * 0.62, -s * 1.4, s * 0.5, s * 0.45, s * 0.1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-s * 0.02, -s * 1.4, s * 0.52, s * 0.45, s * 0.1);
  ctx.fill();
  // Eyes in the windscreen: it looks where it drives.
  eye(ctx, s * 0.14, -s * 1.17, s * 0.06);
  eye(ctx, s * 0.34, -s * 1.17, s * 0.06);
  // A smile on the bumper, a headlight that glows when touched, a small tail light and the door.
  ctx.strokeStyle = EYE;
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.arc(s * 0.9, -s * 0.5, s * 0.1 + react * s * 0.03, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  if (react > 0) {
    ctx.fillStyle = `rgba(255, 244, 150, ${0.55 * react})`;
    ctx.beginPath();
    ctx.arc(s * 1.1, -s * 0.72, s * 0.28, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd93d';
  ctx.beginPath();
  ctx.arc(s * 1.1, -s * 0.72, s * 0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.arc(-s * 1.1, -s * 0.72, s * 0.07, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 60, 120, 0.35)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 0.9);
  ctx.lineTo(-s * 0.08, -s * 0.35);
  ctx.stroke();
  wheel(ctx, -s * 0.65, -s * 0.28, s * 0.3, roll);
  wheel(ctx, s * 0.65, -s * 0.28, s * 0.3, roll);
}

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#2f2a2a';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e9e9e9';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#b8b8b8';
  ctx.lineWidth = r * 0.12;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}
