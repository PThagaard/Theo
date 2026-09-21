import type { Activity, ActivityContext } from '../engine/activity';
import { createBalloner } from './balloner';
import { createOrd } from './ord';

/** Every activity the shell can run, in the order the parent menu lists them. */
export const ACTIVITIES: ReadonlyArray<{ id: string; label: string; create(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity }> = [
  { id: 'balloner', label: '🎈 Balloner', create: createBalloner },
  { id: 'ord', label: '🗣️ Ord', create: createOrd },
];

export const DEFAULT_ACTIVITY = ACTIVITIES[0].id;

export function findActivity(id: string): (typeof ACTIVITIES)[number] {
  return ACTIVITIES.find((activity) => activity.id === id) ?? ACTIVITIES[0];
}
