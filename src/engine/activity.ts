import type { ImpactStyle } from '@capacitor/haptics';
import type { AudioEngine } from './audio';
import type { Settings } from './parent';
import type { StoredPhoto } from './photos';
import type { Stats } from './stats';

/** What the shell gives every activity: sound, counters, vibration, the parents' voices and the settings. */
export interface ActivityContext {
  audio(): AudioEngine | null;
  readonly stats: Stats;
  haptic(style: ImpactStyle): void;
  /**
   * Says a word in a parent's voice, if one is recorded (engine/voices.ts). Returns how many seconds the
   * recording lasts, or 0 when nothing will be said (no recording, or said too recently).
   */
  say(key: string, delay?: number, cooldown?: number): number;
  settings(): Settings;
}

/**
 * One activity ("Balloner", "Ord", …): its logic and drawing, behind the shared baby-safe shell (main.ts),
 * which owns the canvas, the loop, the audio, the parent menu, the lock, the counters and the pause.
 */
export interface Activity {
  readonly id: string;
  resize(width: number, height: number, dpr: number): void;
  update(dt: number): void;
  render(dt: number): void;
  press(id: number, x: number, y: number): void;
  drag(id: number, x: number, y: number): void;
  release(id: number): void;
  shake(): void;
  /** The phone's roll from the motion sensor (radians, positive = right side down), for water that stays level. */
  tilt?(roll: number): void;
  /** Settings changed in the parent menu (age, tempo, family balloons, …). */
  applySettings(settings: Settings): void;
  /** The family photos, for whatever the activity does with faces. */
  setPhotos(photos: StoredPhoto[]): void;
  /** The world goes to sleep (the pause) and wakes up again. */
  sleep(): void;
  wake(): void;
  readonly asleep: boolean;
  /** What the activity exposes for the smoke test and the console (e.g. its game object). */
  readonly debug: Record<string, unknown>;
  dispose(): void;
}
