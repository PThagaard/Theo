import { describe, expect, it } from 'vitest';
import { Stats, formatMinutes, localDate } from '../src/engine/stats';

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

describe('Stats', () => {
  it('counts today and in total, and survives a restart', () => {
    const storage = new MemoryStorage();
    const stats = new Stats(storage, () => new Date(2026, 8, 21, 10));
    stats.bump('pops');
    stats.bump('pops');
    stats.bump('visitor:dog');
    stats.addPlayTime(90);
    stats.save();
    const again = new Stats(storage, () => new Date(2026, 8, 21, 12));
    const snapshot = again.snapshot;
    expect(snapshot.today.pops).toBe(2);
    expect(snapshot.total.pops).toBe(2);
    expect(snapshot.total['visitor:dog']).toBe(1);
    expect(snapshot.playSecondsToday).toBe(90);
    expect(snapshot.sessions).toBe(2);
  });

  it('starts a fresh "today" after midnight but keeps the totals', () => {
    const storage = new MemoryStorage();
    let now = new Date(2026, 8, 21, 23, 59);
    const stats = new Stats(storage, () => now);
    stats.bump('pops', 5);
    now = new Date(2026, 8, 22, 0, 1);
    stats.bump('pops');
    expect(stats.snapshot.today.pops).toBe(1);
    expect(stats.snapshot.total.pops).toBe(6);
  });

  it('can be reset', () => {
    const stats = new Stats(new MemoryStorage());
    stats.bump('pops', 3);
    stats.addPlayTime(30);
    stats.reset();
    expect(stats.snapshot.total.pops).toBeUndefined();
    expect(stats.snapshot.playSecondsTotal).toBe(0);
  });

  it('works without any storage', () => {
    const stats = new Stats(null);
    stats.bump('pops');
    expect(stats.snapshot.total.pops).toBe(1);
  });

  it('formats play time for parents', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(20)).toBe('under 1 min');
    expect(formatMinutes(150)).toBe('3 min');
    expect(formatMinutes(3900)).toBe('1 t 5 min');
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
