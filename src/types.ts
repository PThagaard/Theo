/** Shared data types for the balloon game. All positions are in CSS pixels. */

export interface BalloonColor {
  name: string;
  main: string;
  light: string;
  dark: string;
}

export type BalloonKind = 'plain' | 'dots' | 'stripes' | 'star' | 'rainbow';

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

export type ParticleShape = 'rect' | 'circle' | 'star' | 'heart' | 'ring' | 'string' | 'sparkle' | 'drop';

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
  | { type: 'shake' };
