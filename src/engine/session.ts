/**
 * The session clock behind the pause: how long the world has been awake and in front of the child.
 * It counts plain time while the app is visible and the parent menu is closed (a quiet stretch counts
 * too: the screen is still on), stops while a parent is in the menu, and starts over when the world is
 * woken. Short sessions are the point (CLAUDE.md, "Alderssvarende").
 */
export class SessionClock {
  seconds = 0;

  /** Adds a frame's worth of time when the world is awake and being looked at. */
  tick(dt: number, counting: boolean): void {
    if (counting) this.seconds += dt;
  }

  reset(): void {
    this.seconds = 0;
  }

  /** True when the world should go to sleep (`pauseAfter` in minutes; 0 = never). */
  due(pauseAfterMinutes: number): boolean {
    return pauseAfterMinutes > 0 && this.seconds >= pauseAfterMinutes * 60;
  }

  /** Seconds left before the pause, or null when there is none. */
  left(pauseAfterMinutes: number): number | null {
    if (pauseAfterMinutes <= 0) return null;
    return Math.max(0, pauseAfterMinutes * 60 - this.seconds);
  }
}
