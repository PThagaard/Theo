/**
 * Age profiles, shared by every activity (see CLAUDE.md, "Alderssvarende"): the younger the child, the fewer things
 * at once, the slower, and the less that happens by itself. Every activity scales itself by the active profile.
 */
export type Age = '8-12' | '1-2' | '2+';
export interface AgeProfile {
  /** Multiplies the tempo's target number of balloons. */
  balloons: number;
  /** Multiplies the time between natural balloon spawns. */
  spawn: number;
  /** Multiplies how fast balloons rise. */
  speed: number;
  /** Visitors on screen at once. */
  visitors: number;
  /** Multiplies the time between visits. */
  visitInterval: number;
  /** Whether the storm cloud may come by itself (a parent can always summon it by holding a cloud); true for all
   *  since the parents' rule that every feature exists for the youngest too, only later and more seldom. */
  storms: boolean;
  /** Whether lightning may light up the whole screen (the bolt and the sound always happen). */
  screenFlash: boolean;
  /** Music level, so a parent's voice wins over the music for the youngest. */
  music: number;
}
export const AGE_PROFILES: Record<Age, AgeProfile> = {
  '8-12': { balloons: 0.5, spawn: 1.6, speed: 0.75, visitors: 1, visitInterval: 1.6, storms: true, screenFlash: false, music: 0.6 },
  '1-2': { balloons: 0.8, spawn: 1.2, speed: 0.9, visitors: 2, visitInterval: 1.2, storms: true, screenFlash: true, music: 0.8 },
  '2+': { balloons: 1, spawn: 1, speed: 1, visitors: 2, visitInterval: 1, storms: true, screenFlash: true, music: 1 },
};
export const DEFAULT_AGE: Age = '8-12';
