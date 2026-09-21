import { AGE_PROFILES, DEFAULT_AGE, type Age } from '../../engine/age';
import { Rng } from '../../engine/rng';
import { photoVoiceKey } from '../../engine/voices';
import type { VisitorKind } from '../balloner/types';

/**
 * "Ord": one thing at a time, big and calm, in the middle of the screen. Touch it and it reacts and
 * says its word (in a parent's voice, when recorded); swipe, and the next one slides in. Now and then a
 * thing hides behind a bush: touch the bush, and out it pops ("titte-bøh"). Pure logic, no DOM.
 */

export interface Thing {
  /** The word key (engine/voices.ts VOICE_WORDS), or `photo:<id>` for a family photo. */
  key: string;
  kind: 'creature' | 'balloon' | 'sun' | 'cloud' | 'flower' | 'photo';
  creature?: VisitorKind;
  photoId?: string;
}

export const BASE_THINGS: ReadonlyArray<Thing> = [
  { key: 'hund', kind: 'creature', creature: 'dog' },
  { key: 'elefant', kind: 'creature', creature: 'elephant' },
  { key: 'fugl', kind: 'creature', creature: 'bird' },
  { key: 'sommerfugl', kind: 'creature', creature: 'butterfly' },
  { key: 'snegl', kind: 'creature', creature: 'snail' },
  { key: 'traktor', kind: 'creature', creature: 'tractor' },
  { key: 'ballon', kind: 'balloon' },
  { key: 'sol', kind: 'sun' },
  { key: 'sky', kind: 'cloud' },
  { key: 'blomst', kind: 'flower' },
];

export type ThingState = 'enter' | 'idle' | 'react' | 'leave';

export type OrdEvent =
  | { type: 'touch'; key: string; x: number; y: number }
  | { type: 'peek'; key: string; x: number; y: number }
  | { type: 'next'; key: string }
  | { type: 'enter'; key: string }
  | { type: 'sparkle'; x: number; y: number };

/** A swipe this long (times unit) brings the next thing. */
const SWIPE_DISTANCE = 60;
const ENTER_TIME = 0.7;
const LEAVE_TIME = 0.5;
const REACT_TIME = 0.9;
/** Every n-th thing hides behind the bush, by age (object permanence is the game at 8–12 months). */
const HIDE_EVERY: Record<Age, number> = { '8-12': 3, '1-2': 3, '2+': 4 };
/** Seconds of no touching before the next thing comes by itself; 0 = never (the youngest decide themselves). */
const AUTO_NEXT: Record<Age, number> = { '8-12': 0, '1-2': 40, '2+': 25 };
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
  /** Where the thing is (its feet on the ground), and where it is heading. */
  x = 0;
  state: ThingState = 'enter';
  stateAge = 0;
  /** Behind the bush until touched. */
  hidden = false;
  /** 0 = the bush covers the thing, 1 = it has jumped aside. */
  bushOpen = 0;
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
    if (this.state === 'enter' && this.stateAge === 0) this.x = width + this.size * 2;
  }

  setAge(age: Age): void {
    this.age = age;
  }

  get currentAge(): Age {
    return this.age;
  }

  /** Family photos join the deck as things with a name. */
  setPhotos(ids: string[]): void {
    this.photoIds = [...ids];
    this.reshuffle();
  }

  /** Everything the deck can show, base things first. */
  get things(): Thing[] {
    return [...BASE_THINGS, ...this.photoIds.map((id) => ({ key: photoVoiceKey(id), kind: 'photo' as const, photoId: id }))];
  }

  private reshuffle(): void {
    const things = this.things;
    // Shuffle, but never show the same thing twice in a row.
    const shuffled = [...things];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (shuffled.length > 1 && shuffled[0].key === this.current?.key) shuffled.push(shuffled.shift() as Thing);
    this.deck = shuffled;
  }

  /** How big the thing is drawn (its body size, like a visitor's). */
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

  /** Where the thing can be touched: a generous circle around it. */
  get hit(): { x: number; y: number; r: number } {
    return { x: this.x, y: this.groundY - this.size * 0.9, r: this.size * 2.2 };
  }

  private pickNext(): Thing {
    if (this.deck.length === 0) this.reshuffle();
    return this.deck.shift() as Thing;
  }

  /** The current thing leaves and the next one comes in (hidden behind the bush every few times). */
  next(): void {
    if (this.state === 'leave') return;
    this.state = 'leave';
    this.stateAge = 0;
    this.emit({ type: 'next', key: this.current.key });
  }

  private bringNext(): void {
    this.current = this.pickNext();
    this.shown++;
    this.hidden = this.shown % HIDE_EVERY[this.age] === 0;
    this.bushOpen = this.hidden ? 0 : 1;
    this.x = this.width + this.size * 2;
    this.state = 'enter';
    this.stateAge = 0;
    this.idle = 0;
    this.emit({ type: 'enter', key: this.current.key });
  }

  press(id: number, x: number, y: number): void {
    if (this.asleep) {
      this.emit({ type: 'sparkle', x, y });
      return;
    }
    this.pointers.set(id, { x, y, startX: x, startY: y, swiped: false });
    this.idle = 0;
    if (this.state === 'leave') return;
    const hit = this.hit;
    const onThing = Math.hypot(x - hit.x, y - hit.y) <= hit.r;
    if (this.hidden) {
      if (onThing) {
        // Titte-bøh!
        this.hidden = false;
        this.state = 'react';
        this.stateAge = 0;
        this.emit({ type: 'peek', key: this.current.key, x, y });
      } else {
        this.emit({ type: 'sparkle', x, y });
      }
      return;
    }
    if (onThing) {
      this.state = 'react';
      this.stateAge = 0;
      this.emit({ type: 'touch', key: this.current.key, x, y });
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

  shake(): void {
    if (this.asleep || this.state === 'leave') return;
    this.state = 'react';
    this.stateAge = 0;
    this.emit({ type: 'touch', key: this.current.key, x: this.hit.x, y: this.hit.y });
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
    const target = this.centerX;
    switch (this.state) {
      case 'enter': {
        const t = Math.min(1, this.stateAge / ENTER_TIME);
        const ease = 1 - (1 - t) * (1 - t);
        this.x = this.width + this.size * 2 + (target - (this.width + this.size * 2)) * ease;
        if (t >= 1) {
          this.x = target;
          this.state = 'idle';
          this.stateAge = 0;
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
        this.x = target - (target + this.size * 2) * t * t;
        if (t >= 1) this.bringNext();
        break;
      }
      case 'idle': {
        const auto = AUTO_NEXT[this.age];
        if (!this.asleep && auto > 0 && this.idle >= auto) this.next();
        break;
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
    void AGE_PROFILES;
  }
}
