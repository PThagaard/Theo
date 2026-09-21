import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * "Kid lock": pins the app to the screen using Android's built-in screen pinning
 * (lock task mode), so Home, Back, Recents and the notification shade stop working
 * until the app is unpinned. The phone asks the parent to confirm once.
 * Implemented natively in android/.../KidLockPlugin.java; a no-op everywhere else.
 */

export interface KidLockStatus {
  supported: boolean;
  locked: boolean;
}

interface KidLockPlugin {
  status(): Promise<KidLockStatus>;
  lock(): Promise<{ locked: boolean }>;
  unlock(): Promise<{ locked: boolean }>;
}

const unsupported: KidLockPlugin = {
  status: async () => ({ supported: false, locked: false }),
  lock: async () => ({ locked: false }),
  unlock: async () => ({ locked: false }),
};

const plugin = registerPlugin<KidLockPlugin>('KidLock', { web: () => unsupported });

export interface KidLock {
  readonly available: boolean;
  status(): Promise<KidLockStatus>;
  /** Asks the system to pin the app. Resolves when the request is made, not when the parent confirms. */
  lock(): Promise<boolean>;
  unlock(): Promise<boolean>;
}

export const kidLock: KidLock = {
  available: Capacitor.getPlatform() === 'android',
  async status() {
    try {
      return await plugin.status();
    } catch {
      return { supported: false, locked: false };
    }
  },
  async lock() {
    try {
      return (await plugin.lock()).locked;
    } catch {
      return false;
    }
  },
  async unlock() {
    try {
      return (await plugin.unlock()).locked;
    } catch {
      return false;
    }
  },
};
