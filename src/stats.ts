/**
 * Play statistics for the parents: how much Theo has popped, swiped, shaken and visited,
 * today and in total, plus play time. Everything stays on the phone (localStorage).
 */

export interface StatsSnapshot {
  today: Record<string, number>;
  total: Record<string, number>;
  playSecondsToday: number;
  playSecondsTotal: number;
  sessions: number;
  since: string;
}

interface StoredStats {
  total: Record<string, number>;
  today: { date: string; counts: Record<string, number>; playSeconds: number };
  playSeconds: number;
  sessions: number;
  since: string;
}

export interface StatsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'theos-balloner.stats';
const SAVE_INTERVAL_MS = 5000;

/** Local calendar date as YYYY-MM-DD. */
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function empty(date: string): StoredStats {
  return { total: {}, today: { date, counts: {}, playSeconds: 0 }, playSeconds: 0, sessions: 0, since: date };
}

export class Stats {
  private data: StoredStats;
  private dirty = false;
  private lastSave = 0;

  constructor(
    private readonly storage: StatsStorage | null = typeof localStorage === 'undefined' ? null : localStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.data = this.load();
    this.data.sessions += 1;
    this.dirty = true;
  }

  private load(): StoredStats {
    const date = localDate(this.clock());
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredStats>;
        const data = { ...empty(date), ...stored };
        if (!data.today || data.today.date !== date) data.today = { date, counts: {}, playSeconds: 0 };
        return data;
      }
    } catch {
      // Unreadable storage: start fresh.
    }
    return empty(date);
  }

  /** Rolls the "today" bucket over at midnight. */
  private rollover(): void {
    const date = localDate(this.clock());
    if (this.data.today.date !== date) {
      this.data.today = { date, counts: {}, playSeconds: 0 };
      this.dirty = true;
    }
  }

  bump(key: string, amount = 1): void {
    this.rollover();
    this.data.total[key] = (this.data.total[key] ?? 0) + amount;
    this.data.today.counts[key] = (this.data.today.counts[key] ?? 0) + amount;
    this.dirty = true;
    this.maybeSave();
  }

  addPlayTime(seconds: number): void {
    if (seconds <= 0) return;
    this.rollover();
    this.data.playSeconds += seconds;
    this.data.today.playSeconds += seconds;
    this.dirty = true;
    this.maybeSave();
  }

  get snapshot(): StatsSnapshot {
    this.rollover();
    return {
      today: { ...this.data.today.counts },
      total: { ...this.data.total },
      playSecondsToday: this.data.today.playSeconds,
      playSecondsTotal: this.data.playSeconds,
      sessions: this.data.sessions,
      since: this.data.since,
    };
  }

  reset(): void {
    this.data = empty(localDate(this.clock()));
    this.data.sessions = 1;
    this.dirty = true;
    this.save();
  }

  private maybeSave(): void {
    const now = Date.now();
    if (now - this.lastSave >= SAVE_INTERVAL_MS) this.save();
  }

  /** Writes to storage if anything changed. Call this when the app goes to the background. */
  save(): void {
    if (!this.dirty) return;
    this.lastSave = Date.now();
    this.dirty = false;
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or unavailable; the numbers live on in memory.
    }
  }
}

/** Danish labels for the counters shown in the parent menu, in display order. */
export const STAT_LABELS: Array<[key: string, label: string]> = [
  ['pops', 'Balloner poppet'],
  ['popsPhoto', '… heraf familie-balloner'],
  ['popsStar', '… heraf stjerneballoner'],
  ['popsRainbow', '… heraf regnbueballoner'],
  ['balloonsMade', 'Balloner pustet op'],
  ['blown', 'Balloner blæst væk'],
  ['swipes', 'Swipes'],
  ['harpNotes', 'Harpetoner'],
  ['skyTouches', 'Tryk på himlen'],
  ['flowersSpun', 'Blomster snurret'],
  ['flowersPlucked', 'Blomster plukket'],
  ['sun', 'Solen drejet'],
  ['clouds', 'Skyer regnet'],
  ['shakes', 'Rystet'],
  ['celebrations', 'Fester'],
  ['visitorsSeen', 'Besøg'],
  ['visitorsPoked', 'Besøg rørt'],
  ['visitor:dog', '… hunden'],
  ['visitor:elephant', '… elefanten'],
  ['visitor:bird', '… fuglen'],
  ['visitor:butterfly', '… sommerfuglen'],
  ['visitor:snail', '… sneglen'],
  ['visitor:star', '… stjerneskud'],
];

export function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return seconds > 0 ? 'under 1 min' : '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} t ${minutes % 60} min`;
}
