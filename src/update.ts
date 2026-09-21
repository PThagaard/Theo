import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * In-app updates for the private phase (Android): the parent menu asks GitHub Releases for
 * the newest build and installs it with one tap. The web version updates itself through the
 * service worker, so this is a no-op there. See android/.../AppUpdatePlugin.java.
 */

export interface UpdateCheck {
  current: string;
  latest: string;
  build: number;
  date: string;
  notes: string;
  apk: string;
}

interface AppUpdatePlugin {
  version(): Promise<{ version: string }>;
  check(): Promise<UpdateCheck>;
  install(options: { url: string }): Promise<void>;
  addListener(event: 'progress', listener: (data: { percent: number; bytes: number }) => void): Promise<PluginListenerHandle>;
}

const unsupported: AppUpdatePlugin = {
  version: async () => ({ version: '' }),
  check: async () => {
    throw new Error('Opdatering sker automatisk i web-udgaven');
  },
  install: async () => undefined,
  addListener: async () => ({ remove: async () => undefined }),
};

const plugin = registerPlugin<AppUpdatePlugin>('AppUpdate', { web: () => unsupported });

/** True when `latest` is a higher version than `current` (e.g. "1.0.12" > "1.0.9"). */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.trim().split('.').map((part) => parseInt(part, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export interface AppUpdate {
  readonly available: boolean;
  version(): Promise<string>;
  check(): Promise<UpdateCheck & { newer: boolean }>;
  install(url: string): Promise<void>;
  onProgress(listener: (percent: number) => void): Promise<() => void>;
}

export const appUpdate: AppUpdate = {
  available: Capacitor.getPlatform() === 'android',
  async version() {
    try {
      return (await plugin.version()).version;
    } catch {
      return '';
    }
  },
  async check() {
    const result = await plugin.check();
    return { ...result, newer: isNewer(result.latest, result.current) };
  },
  install: (url) => plugin.install({ url }),
  async onProgress(listener) {
    const handle = await plugin.addListener('progress', (data) => listener(data.percent));
    return () => void handle.remove();
  },
};
