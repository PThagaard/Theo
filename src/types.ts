/** Shared data types for the balloon game. All positions are in CSS pixels. */

export interface BalloonColor {
  name: string;
  main: string;
  light: string;
  dark: string;
}

export type BalloonKind = 'plain' | 'dots' | 'stripes' | 'star' | 'rainbow' | 'photo';

export type Face = 'happy' | 'surprised' | 'sleepy' | 'wink';

export interface Balloon {
  id: number;
  x: number;
  y: number;
  /** Horizontal centre the balloon sways around. */
  baseX: number;
  /** Half width of the balloon body. The body is an ellipse 1.15x taller than wide. */
  r: number;
  color: BalloonColor;
  kind: BalloonKind;
  face: Face;
  /** Rise speed in px/s. */
  vy: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  /** Visual scale, 0..1 (with a little overshoot) while inflating. */
  scale: number;
  /** Inflate progress 0..1. Balloons spawned from the bottom start at 1. */
  inflate: number;
  /** Seconds alive. */
  age: number;
  /** Seconds until the next blink. */
  blinkTimer: number;
  /** Seconds left of the current blink (0 = eyes open). */
  blink: number;
  /** True for balloons the child made by touching empty sky. */
  tapped: boolean;
  /** Sideways push from swipes (px/s), fades out by itself. */
  vx: number;
  /** Vertical push from swipes (px/s, positive = down), fades out by itself. */
  vyImpulse: number;
  /** For photo balloons: which family photo is on it. */
  photoId?: string;
}

export interface Cloud {
  x: number;
  y: number;
  scale: number;
  /** Natural drift speed (px/s). */
  speed: number;
  /** Which of the cloud shapes to draw. */
  shape: number;
  /** Extra push from swipes (px/s), fades out by itself. */
  vx: number;
  /** 1 right after being touched, fades to 0. */
  wobble: number;
}

export type VisitorKind = 'dog' | 'elephant' | 'bird' | 'butterfly' | 'snail' | 'star';

export type VisitorState = 'enter' | 'idle' | 'react' | 'leave' | 'gone';

/** A creature that drops by now and then: walks, flies or peeks, and reacts when touched. */
export interface Visitor {
  id: number;
  kind: VisitorKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Facing direction: 1 = to the right. */
  dir: 1 | -1;
  /** Seconds since it appeared. */
  age: number;
  state: VisitorState;
  /** Seconds in the current state. */
  stateAge: number;
  /** Body size, in unit px. */
  size: number;
  /** How many times it has been touched. */
  pokes: number;
  /** Game time of the last touch, so a sliding finger doesn't trigger it every few milliseconds. */
  lastPoke: number;
  /** Butterfly colour. */
  hue: number;
  /** Where a wandering visitor is heading. */
  targetX: number;
  targetY: number;
  /** Height above ground while jumping (dog), or how far up it has risen (elephant). */
  lift: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  /** Game time when the point was recorded. */
  t: number;
}

/** The glowing ribbon a finger leaves behind while swiping. */
export interface Trail {
  id: number;
  hue: number;
  points: TrailPoint[];
  /** False once the finger has lifted; the ribbon then fades away. */
  active: boolean;
}

export type ParticleShape = 'rect' | 'circle' | 'star' | 'heart' | 'ring' | 'string' | 'sparkle' | 'drop' | 'photo';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds remaining. */
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: ParticleShape;
  rot: number;
  spin: number;
  gravity: number;
  drag: number;
  /** For 'photo' particles: the family photo that jumps out of a popped photo balloon. */
  photoId?: string;
}

export type GameEvent =
  | { type: 'pop'; x: number; y: number; size: number; kind: BalloonKind }
  | { type: 'spawn'; x: number; y: number }
  | { type: 'sparkle'; x: number; y: number }
  | { type: 'celebrate'; pops: number }
  /** A swiping finger passed another step: play harp note `note` (0 = bottom of screen, high = top). */
  | { type: 'glide'; x: number; y: number; note: number }
  | { type: 'sun'; x: number; y: number }
  | { type: 'cloud'; x: number; y: number }
  /** The phone was shaken. */
  | { type: 'shake' }
  /** A visitor arrived, or was touched. */
  | { type: 'visitor'; kind: VisitorKind; x: number; y: number; what: 'appear' | 'poke' };
