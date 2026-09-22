import type { Activity, ActivityContext } from '../engine/activity';
import { createBalloner } from './balloner';
import { createBobler } from './bobler';
import { createOrd } from './ord';
import { createTrommer } from './trommer';

export interface ActivityEntry {
  id: string;
  /** The name on the start page and in the parent menu. */
  title: string;
  emoji: string;
  /** One line for the parents about what the game is. */
  blurb: string;
  /** Whether the balloon tempo setting applies. */
  hasTempo: boolean;
  /** Whether the game says the parents' recorded words (so the menu shows "Jeres stemmer"). */
  hasVoices: boolean;
  /** Where the family photos appear in this game, for the menu's wording ("på balloner", "i boblerne"). */
  familyWhere: string;
  create(canvas: HTMLCanvasElement, ctx: ActivityContext): Activity;
}

/** Every game the shell can run, in the order the start page shows them. */
export const ACTIVITIES: ReadonlyArray<ActivityEntry> = [
  { id: 'balloner', title: 'Theos Balloner', emoji: '🎈', blurb: 'Pop og swipe, dyr, uvejr og gården', hasTempo: true, hasVoices: false, familyWhere: 'på balloner', create: createBalloner },
  { id: 'bobler', title: 'Theos Badekar', emoji: '🛁', blurb: 'Bobler, plask og ænder: tryk, swipe, ryst og hold', hasTempo: true, hasVoices: false, familyWhere: 'i boblerne', create: createBobler },
  { id: 'trommer', title: 'Theos Trommer', emoji: '🥁', blurb: 'Slå på de store farveflader: hver tone passer', hasTempo: false, hasVoices: false, familyWhere: 'på noderne', create: createTrommer },
  { id: 'ord', title: 'Theos Titte-bøh og Ord', emoji: '🙈', blurb: '8–12 mdr: titte-bøh med familien. Fra 1 år: ord og "hvor er …?"', hasTempo: false, hasVoices: true, familyWhere: 'i Ord', create: createOrd },
];

export const DEFAULT_ACTIVITY = ACTIVITIES[0].id;

export function findActivity(id: string): ActivityEntry {
  return ACTIVITIES.find((activity) => activity.id === id) ?? ACTIVITIES[0];
}
