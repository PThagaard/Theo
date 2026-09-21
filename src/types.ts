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
  /** Pointer id of the swipe that last blew this balloon, so each swipe counts once. */
  blownBy?: number;
  /** Id of the creature hanging from this balloon's string, if any. */
  carrying?: number;
  /** The finger that made this balloon and is still holding it: the balloon keeps growing. */
  heldBy?: number;
  /** 0–1: how far past full size a held balloon has grown; at 1 it bursts. */
  overinflate: number;
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
  /** 0 = white, 1 = dark grey: grows while a finger holds the cloud, then it becomes the storm cloud. */
  dark: number;
  /** True while a finger is holding the cloud (the darkness fades again when it lets go). */
  holding: boolean;
}

export type VisitorKind = 'dog' | 'elephant' | 'bird' | 'butterfly' | 'snail' | 'star' | 'storm' | 'tractor';

/** What lightning can turn a visitor into for a little while. */
export type VisitorForm = 'hotdog' | 'mouse' | 'puffed';

export type VisitorState = 'enter' | 'idle' | 'react' | 'leave' | 'gone' | 'carried' | 'falling';

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
  /** Temporary shape after a lightning strike, and seconds left of it. */
  form: VisitorForm | null;
  formTimer: number;
  /** Seconds left of the current lightning flash (storm cloud). */
  lightning: number;
  /** Where the last bolt struck (storm cloud). */
  boltX: number;
  /** Seconds until the storm flashes by itself again. */
  nextLightning: number;
  /** Seconds left of dripping after being rained on. */
  wet: number;
  /** Id of the balloon carrying this creature on its string, while state is 'carried'. */
  carriedBy: number | null;
  /** Seconds until the carried creature calls for help again. */
  helpTimer: number;
  /** What the creature was doing before it was picked up, to carry on with afterwards. */
  resumeState: VisitorState;
  /** The finger currently dragging it around (storm cloud), or null. */
  grabbedBy: number | null;
}

/** A flower on the hills: spins and cycles colours when tapped, flies off when swiped, grows back. */
export interface Flower {
  id: number;
  /** Horizontal position as a fraction of the width. */
  fx: number;
  color: string;
  size: number;
  petals: number;
  phase: number;
  /** Rotation of the head (radians) and how fast it spins (rad/s). */
  angle: number;
  spin: number;
  /** Seconds left of colour cycling after a tap. */
  rainbow: number;
  /** 0 = just plucked, 1 = fully grown. */
  growth: number;
  /** Seconds until a plucked flower starts growing back. */
  regrow: number;
  /** The head while it flies through the air after being plucked. */
  flying: { x: number; y: number; vx: number; vy: number; life: number } | null;
  /** Extra size from rain (0 = normal), fades back slowly. */
  boost: number;
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

export type ParticleShape = 'rect' | 'circle' | 'star' | 'heart' | 'ring' | 'string' | 'sparkle' | 'drop' | 'photo' | 'smoke';

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
  | { type: 'pop'; x: number; y: number; size: number; kind: BalloonKind; photoId?: string }
  | { type: 'spawn'; x: number; y: number }
  | { type: 'sparkle'; x: number; y: number }
  | { type: 'celebrate'; pops: number }
  /** A swiping finger passed another step: play harp note `note` (0 = bottom of screen, high = top). */
  | { type: 'glide'; x: number; y: number; note: number }
  | { type: 'sun'; x: number; y: number }
  | { type: 'cloud'; x: number; y: number }
  /** The phone was shaken. */
  | { type: 'shake' }
  /** A visitor arrived, was touched, or (the storm) left. */
  | { type: 'visitor'; kind: VisitorKind; x: number; y: number; what: 'appear' | 'poke' | 'leave' }
  /** Lightning struck at x (from the storm cloud down to the ground). */
  | { type: 'lightning'; x: number; y: number }
  /** A visitor changed shape (or changed back: form null). */
  | { type: 'transform'; kind: VisitorKind; form: VisitorForm | null; x: number; y: number }
  /** A balloon picked a creature up, the creature called for help, was let go, or landed again. */
  | { type: 'carry'; kind: VisitorKind; x: number; y: number; what: 'hooked' | 'help' | 'released' | 'landed' }
  /** A finger held still: a cloud became the storm, a held balloon burst, or the sun let off a sunburst. */
  | { type: 'hold'; what: 'storm' | 'burst' | 'sunburst'; x: number; y: number }
  /** A balloon was blown away by a swipe (once per balloon per swipe). */
  | { type: 'blow' }
  /** A finger lifted after a real swipe of at least `length` px. */
  | { type: 'swipe'; length: number }
  /** A flower was tapped (spin) or swiped away (pluck). */
  | { type: 'flower'; x: number; y: number; what: 'spin' | 'pluck' };
