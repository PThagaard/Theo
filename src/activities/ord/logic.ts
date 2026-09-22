import { DEFAULT_AGE, type Age } from '../../engine/age';
import { Rng } from '../../engine/rng';
import { photoVoiceKey } from '../../engine/voices';
import type { VisitorKind } from '../balloner/types';

/**
 * "Titte-bøh og Ord" (docs/FORSKNING.md explains why it is shaped like this):
 * - 8–12 months: peek-a-boo. The family's faces and a few animals hide behind the bush most of the time; touching
 *   the bush brings the thing out with its sound and its name in a parent's voice. Nothing happens by itself and
 *   nothing is ever wrong.
 * - From 1 year: the whole deck, one thing at a time, and now and then a "Hvor er …?" round: two or three things
 *   stand side by side, a parent's recorded voice asks for one, everything touched answers with its own name, and
 *   the asked-for one celebrates. No mistakes, no timer, no score: the mechanic with evidence for word learning at
 *   two years, minus what would make it a test.
 * Pure logic, no DOM.
 */

export interface Thing {
  /** The word key (engine/voices.ts VOICE_WORDS), or `photo:<id>` for a family photo. */
  key: string;
  kind: 'creature' | 'balloon' | 'sun' | 'cloud' | 'flower' | 'cow' | 'cat' | 'car' | 'photo';
  creature?: VisitorKind;
  photoId?: string;
}

export const BASE_THINGS: ReadonlyArray<Thing> = [
  { key: 'hund', kind: 'creature', creature: 'dog' },
  { key: 'elefant', kind: 'creature', creature: 'elephant' },
  { key: 'fugl', kind: 'creature', creature: 'bird' },
  { key: 'sommerfugl', kind: 'creature', creature: 'butterfly' },
  { key: 'snegl', kind: 'creature', creature: 'snail' },
  { key: 'ko', kind: 'cow' },
  { key: 'kat', kind: 'cat' },
  { key: 'traktor', kind: 'creature', creature: 'tractor' },
  { key: 'bil', kind: 'car' },
  { key: 'ballon', kind: 'balloon' },
  { key: 'sol', kind: 'sun' },
  { key: 'sky', kind: 'cloud' },
  { key: 'blomst', kind: 'flower' },
];

/** Besides the family, the youngest profile only meets these: clear sounds, and likely first words. */
export const YOUNGEST_KEYS: ReadonlyArray<string> = ['hund', 'elefant', 'ko', 'kat'];

export type ThingState = 'enter' | 'idle' | 'react' | 'leave';

/** What happens with a thing when it comes: it stands there, hides behind the bush, or is asked for in a round. */
export type Step = 'show' | 'hide' | 'ask';

/**
 * The plan by age: what happens with the n-th thing. Peek-a-boo is the game at 8–12 months (three of four
 * hide); from 1 year most things simply stand there, a "Hvor er …?" round comes every few things, and the bush
 * now and then.
 */
export const PLAN: Record<Age, ReadonlyArray<Step>> = {
  '8-12': ['hide', 'hide', 'hide', 'show'],
  '1-2': ['show', 'ask', 'hide'],
  '2+': ['show', 'ask', 'hide', 'ask'],
};

/** A "Hvor er …?" round: a few things side by side, one of them asked for. */
export interface Round {
  things: Thing[];
  /** Index of the thing the question asks for. */
  asked: number;
  /** Seconds since each thing was touched (its bounce), Infinity when it has not been. */
  reactAge: number[];
  found: boolean;
  /** Seconds since the asked-for thing was found (the celebration). */
  foundAge: number;
  /** Seconds since the question was last asked. */
  sinceAsk: number;
  /** How many times the question has been asked in this round. */
  asks: number;
  /** 1 right after a repeated question (the asked-for thing wiggles), fading to 0. */
  hint: number;
}

export type OrdEvent =
  | { type: 'touch'; thing: Thing; x: number; y: number }
  | { type: 'peek'; thing: Thing; x: number; y: number }
  | { type: 'rustle'; thing: Thing; x: number; y: number }
  | { type: 'ask'; thing: Thing; repeat: boolean }
  | { type: 'found'; thing: Thing; x: number; y: number }
  | { type: 'next'; thing: Thing }
  | { type: 'enter'; thing: Thing; round: boolean }
  | { type: 'sparkle'; x: number; y: number };

/** A swipe this long (times unit) brings the next thing. */
const SWIPE_DISTANCE = 60;
const ENTER_TIME = 0.7;
const LEAVE_TIME = 0.5;
export const REACT_TIME = 0.9;
/** Things side by side in a "Hvor er …?" round (none for the youngest: no questions before 12 months). */
const ROUND_SIZE: Record<Age, number> = { '8-12': 0, '1-2': 2, '2+': 3 };
/**
 * Touches on the bush before it opens, by age. The youngest get the thing at once: a clear answer to the
 * touch is the whole point at 8–12 months. Older children enjoy a rustle of suspense first.
 */
const BUSH_TOUCHES: Record<Age, number> = { '8-12': 1, '1-2': 2, '2+': 2 };
const RUSTLE_TIME = 0.6;
/** Seconds of no touching before the next thing comes by itself: a whole minute for the youngest. */
const AUTO_NEXT: Record<Age, number> = { '8-12': 60, '1-2': 40, '2+': 25 };
/** Without an answer the question is asked again after this long, and the asked-for thing wiggles: a hint, never a correction. */
export const REASK_AFTER = 7;
const HINT_TIME = 1.2;
/** The celebration before the round makes way for the next thing. */
export const FOUND_TIME = 1.8;
const SLEEP_TIME = 8;
const WAKE_TIME = 2.5;

export class OrdGame {
  width = 1;
  height = 1;
  unit = 1;
  time = 0;
  private readonly rng: Rng;
  private age: Age = DEFAULT_AGE;
  private photoIds: string[] = [];
  private deck: Thing[] = [];
  private shown = 0;
  current: Thing = BASE_THINGS[0];
  /** The "Hvor er …?" round on stage, or null while one thing stands alone. */
  round: Round | null = null;
  /** Where the thing (or the middle of the round) is, and where it is heading. */
  x = 0;
  state: ThingState = 'enter';
  stateAge = 0;
  /** Behind the bush until touched. */
  hidden = false;
  /** 0 = the bush covers the thing, 1 = it has jumped aside. */
  bushOpen = 0;
  /** Touches on the bush since the thing hid there. */
  bushTouches = 0;
  /** 1 right after a touch that only made the bush rustle, fading to 0. */
  rustle = 0;
  /** Seconds since the last touch. */
  idle = 0;
  asleep = false;
  dusk = 0;
  private readonly listeners: Array<(event: OrdEvent) => void> = [];
  private readonly pointers = new Map<number, { x: number; y: number; startX: number; startY: number; swiped: boolean }>();

  constructor(seed = Date.now()) {
    this.rng = new Rng(seed);
    this.reshuffle();
    this.current = this.pickNext();
    this.place();
  }

  onEvent(listener: (event: OrdEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(event: OrdEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.unit = Math.max(0.5, Math.min(width, height) / 400);
    if (this.state === 'enter' && this.stateAge === 0) this.x = this.entryX;
  }

  setAge(age: Age): void {
    if (age === this.age) return;
    this.age = age;
    this.reshuffle();
    this.restartIfUnseen();
  }

  get currentAge(): Age {
    return this.age;
  }

  /** Family photos join the deck as things with a name. */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
    this.reshuffle();
    this.restartIfUnseen();
  }

  /** Everything that exists, base things first. */
  get things(): Thing[] {
    return [...BASE_THINGS, ...this.photoIds.map((id) => ({ key: photoVoiceKey(id), kind: 'photo' as const, photoId: id }))];
  }

  /** What this age gets to see: the family and a few animals for the youngest, everything from 1 year. */
  get deckThings(): Thing[] {
    const all = this.things;
    return this.age === '8-12' ? all.filter((thing) => thing.kind === 'photo' || YOUNGEST_KEYS.includes(thing.key)) : all;
  }

  private reshuffle(): void {
    // Shuffle, but never show the same thing twice in a row.
    const shuffled = [...this.deckThings];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (shuffled.length > 1 && shuffled[0].key === this.current?.key) shuffled.push(shuffled.shift() as Thing);
    this.deck = shuffled;
  }

  /** The deck changed before the child saw anything (the age or the photos arrived at start): begin afresh. */
  private restartIfUnseen(): void {
    if (this.state !== 'enter' || this.stateAge > 0) return;
    this.current = this.pickNext();
    this.place();
  }

  /** How big a lone thing is drawn (its body size, like a visitor's). */
  get size(): number {
    return Math.min(this.width, this.height) * 0.16;
  }

  /** The middle of the stage, where the thing stands. */
  get centerX(): number {
    return this.width / 2;
  }

  /** The stage's ground line on screen: high enough that the thing stands big in the middle. */
  get groundY(): number {
    return this.height * 0.78;
  }

  /** Where a lone thing can be touched: a generous circle around it. */
  get hit(): { x: number; y: number; r: number } {
    return { x: this.x, y: this.groundY - this.size * 0.9, r: this.size * 2.2 };
  }

  // ---- Round geometry ---------------------------------------------------------

  /** Things in a round share the stage, so each is drawn smaller. */
  get roundScale(): number {
    if (!this.round) return 1;
    return this.round.things.length >= 3 ? 0.55 : 0.72;
  }

  /** Distance between neighbours in a round: as wide as the screen allows. */
  get roundSpacing(): number {
    const n = this.round?.things.length ?? 1;
    if (n < 2) return 0;
    return Math.min(this.size * (n >= 3 ? 2.1 : 2.7), (this.width - this.size * 1.2) / (n - 1));
  }

  /** Where the i-th thing of the round stands (its feet). */
  itemX(i: number): number {
    const n = this.round?.things.length ?? 1;
    return this.x + (i - (n - 1) / 2) * this.roundSpacing;
  }

  /** Where the i-th thing of the round can be touched (for the smoke test; a press uses the whole stage band). */
  hitFor(i: number): { x: number; y: number; r: number } {
    const s = this.size * this.roundScale;
    return { x: this.itemX(i), y: this.groundY - s * 1.2, r: Math.max(s, this.roundSpacing * 0.5) };
  }

  private get entryX(): number {
    const n = this.round?.things.length ?? 1;
    return this.width + this.size * 2 + (this.roundSpacing * (n - 1)) / 2;
  }

  private get exitX(): number {
    const n = this.round?.things.length ?? 1;
    return -(this.size * 2 + (this.roundSpacing * (n - 1)) / 2);
  }

  // ---- The deck -----------------------------------------------------------------

  private pickNext(): Thing {
    if (this.deck.length === 0) this.reshuffle();
    return this.deck.shift() as Thing;
  }

  /** The current thing leaves and the next one comes in (following the age's plan). */
  next(): void {
    if (this.state === 'leave') return;
    this.state = 'leave';
    this.stateAge = 0;
    this.emit({ type: 'next', thing: this.current });
  }

  private bringNext(): void {
    this.current = this.pickNext();
    this.shown++;
    this.place();
    this.emit({ type: 'enter', thing: this.current, round: this.round !== null });
  }

  /** Puts the current thing at the edge, ready to slide in, as the plan says: shown, hidden or asked for. */
  private place(): void {
    this.state = 'enter';
    this.stateAge = 0;
    this.idle = 0;
    this.round = null;
    this.hidden = false;
    this.bushOpen = 1;
    const plan = PLAN[this.age];
    const step = plan[this.shown % plan.length];
    if (step === 'hide') this.hide();
    else if (step === 'ask' && ROUND_SIZE[this.age] >= 2 && this.deckThings.length >= 2) this.ask();
    this.x = this.entryX;
  }

  /** The current thing hides behind the bush (also used by the tests to force a titte-bøh). */
  hide(): void {
    this.round = null;
    this.hidden = true;
    this.bushOpen = 0;
    this.bushTouches = 0;
    this.rustle = 0;
  }

  /**
   * Starts a "Hvor er …?" round: the current thing and a few others from the deck, side by side, the current one
   * being asked for (also used by the smoke test). The question is asked once the things have slid in.
   */
  ask(): void {
    const count = Math.max(2, ROUND_SIZE[this.age]);
    const pool = this.deckThings.filter((thing) => thing.key !== this.current.key);
    const things: Thing[] = [];
    while (things.length < count - 1 && pool.length > 0) things.push(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]);
    if (things.length === 0) return;
    const asked = this.rng.int(0, things.length);
    things.splice(asked, 0, this.current);
    this.round = { things, asked, reactAge: things.map(() => Infinity), found: false, foundAge: 0, sinceAsk: 0, asks: 0, hint: 0 };
    this.hidden = false;
    this.bushOpen = 1;
    if (this.state !== 'enter') this.askQuestion(false);
  }

  private askQuestion(repeat: boolean): void {
    const round = this.round;
    if (!round) return;
    round.sinceAsk = 0;
    round.asks++;
    if (repeat) round.hint = 1;
    this.emit({ type: 'ask', thing: round.things[round.asked], repeat });
  }

  /** Which thing of the round a touch on the stage means: the nearest one, so there are no dead areas between them. */
  private roundThingAt(x: number, y: number): number | null {
    const round = this.round;
    if (!round) return null;
    const n = round.things.length;
    const s = this.size * this.roundScale;
    if (Math.abs(y - (this.groundY - s * 1.2)) > s * 2.6) return null;
    const margin = this.roundSpacing * 0.8;
    if (x < this.itemX(0) - margin || x > this.itemX(n - 1) + margin) return null;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x - this.itemX(i)) < Math.abs(x - this.itemX(best))) best = i;
    return best;
  }

  // ---- Touch --------------------------------------------------------------------

  press(id: number, x: number, y: number): void {
    if (this.asleep) {
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    this.pointers.set(id, { x, y, startX: x, startY: y, swiped: false });
    this.idle = 0;
    if (this.state === 'leave') return;
    if (this.round) {
      const i = this.roundThingAt(x, y);
      if (i === null) {
        this.emit({ type: 'sparkle', x, y });
        return;
      }
      const round = this.round;
      round.reactAge[i] = 0;
      const thing = round.things[i];
      if (i === round.asked && !round.found) {
        round.found = true;
        round.foundAge = 0;
        this.emit({ type: 'found', thing, x, y });
      } else {
        // Every thing answers with its own name. Nothing is wrong.
        this.emit({ type: 'touch', thing, x, y });
      }
      return;
    }
    const hit = this.hit;
    const onThing = Math.hypot(x - hit.x, y - hit.y) <= hit.r;
    if (this.hidden) {
      if (!onThing) {
        this.emit({ type: 'sparkle', x, y });
        return;
      }
      this.bushTouches++;
      if (this.bushTouches < BUSH_TOUCHES[this.age]) {
        // The bush shakes: "something is in there!" It opens on the next touch.
        this.rustle = 1;
        this.emit({ type: 'rustle', thing: this.current, x, y });
        return;
      }
      // Titte-bøh!
      this.hidden = false;
      this.state = 'react';
      this.stateAge = 0;
      this.emit({ type: 'peek', thing: this.current, x, y });
      return;
    }
    if (onThing) {
      this.state = 'react';
      this.stateAge = 0;
      this.emit({ type: 'touch', thing: this.current, x, y });
    } else {
      // Touching the sky is not wrong: a little sparkle, and the thing wiggles to say "here I am".
      this.emit({ type: 'sparkle', x, y });
      if (this.state === 'idle') {
        this.state = 'react';
        this.stateAge = REACT_TIME * 0.5;
      }
    }
  }

  drag(id: number, x: number, y: number): void {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    pointer.x = x;
    pointer.y = y;
    if (!pointer.swiped && Math.abs(x - pointer.startX) >= SWIPE_DISTANCE * this.unit) {
      pointer.swiped = true;
      this.idle = 0;
      this.next();
    }
  }

  release(id: number): void {
    this.pointers.delete(id);
  }

  /** A shake: everything on stage bounces, and in a round the question is asked again. */
  shake(): void {
    if (this.asleep || this.state === 'leave') return;
    this.idle = 0;
    if (this.round) {
      this.round.reactAge.fill(0);
      this.askQuestion(true);
      return;
    }
    if (this.hidden) return;
    this.state = 'react';
    this.stateAge = 0;
    this.emit({ type: 'touch', thing: this.current, x: this.hit.x, y: this.hit.y });
  }

  sleep(): void {
    this.asleep = true;
    this.pointers.clear();
  }

  wake(): void {
    this.asleep = false;
  }

  update(dt: number): void {
    this.time += dt;
    this.stateAge += dt;
    this.idle += dt;
    this.dusk = this.asleep ? Math.min(1, this.dusk + dt / SLEEP_TIME) : Math.max(0, this.dusk - dt / WAKE_TIME);
    this.rustle = Math.max(0, this.rustle - dt / RUSTLE_TIME);
    const target = this.centerX;
    switch (this.state) {
      case 'enter': {
        const t = Math.min(1, this.stateAge / ENTER_TIME);
        const ease = 1 - (1 - t) * (1 - t);
        const from = this.entryX;
        this.x = from + (target - from) * ease;
        if (t >= 1) {
          this.x = target;
          this.state = 'idle';
          this.stateAge = 0;
          if (this.round) this.askQuestion(false);
        }
        break;
      }
      case 'react':
        if (this.stateAge >= REACT_TIME) {
          this.state = 'idle';
          this.stateAge = 0;
        }
        break;
      case 'leave': {
        const t = Math.min(1, this.stateAge / LEAVE_TIME);
        this.x = target + (this.exitX - target) * t * t;
        if (t >= 1) this.bringNext();
        break;
      }
      case 'idle': {
        const auto = AUTO_NEXT[this.age];
        if (!this.asleep && auto > 0 && this.idle >= auto && !this.round?.found) this.next();
        break;
      }
    }
    const round = this.round;
    if (round) {
      for (let i = 0; i < round.reactAge.length; i++) round.reactAge[i] += dt;
      round.hint = Math.max(0, round.hint - dt / HINT_TIME);
      if (this.state === 'idle') {
        round.sinceAsk += dt;
        if (round.found) {
          round.foundAge += dt;
          if (round.foundAge >= FOUND_TIME) this.next();
        } else if (!this.asleep && round.sinceAsk >= REASK_AFTER) {
          this.askQuestion(true);
        }
      }
    }
    // The bush jumps aside once the thing has been found (and stays put while it hides).
    if (!this.hidden) this.bushOpen = Math.min(1, this.bushOpen + dt / 0.35);
    // Asleep: the thing goes home and nothing new comes until a parent wakes the world.
    if (this.asleep && this.state !== 'leave' && this.dusk > 0.3 && this.x === target) {
      this.state = 'leave';
      this.stateAge = 0;
    }
    if (this.asleep && this.state === 'enter') this.stateAge = 0; // wait at the edge
  }
}
