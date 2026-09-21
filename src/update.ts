import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * In-app updates for the private phase (Android): the app asks GitHub Releases for the newest
 * build (when the parent menu opens, on "Søg", and once a day shortly after start), fetches
 * the APK in the background and installs it with one tap. The web version updates itself
 * through the service worker, so this is a no-op there. See android/.../AppUpdatePlugin.java.
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
  download(options: { url: string; version: string }): Promise<{ path: string; cached: boolean }>;
  install(options: { url: string; version: string }): Promise<void>;
  addListener(event: 'progress', listener: (data: { percent: number; bytes: number }) => void): Promise<PluginListenerHandle>;
}

const unsupported: AppUpdatePlugin = {
  version: async () => ({ version: '' }),
  check: async () => {
    throw new Error('Opdatering sker automatisk i web-udgaven');
  },
  download: async () => ({ path: '', cached: false }),
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
  /** Fetches the APK into the cache (instant if it is there already), so installing needs no waiting. */
  download(url: string, version: string): Promise<{ cached: boolean }>;
  install(url: string, version: string): Promise<void>;
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
  download: (url, version) => plugin.download({ url, version }),
  install: (url, version) => plugin.install({ url, version }),
  async onProgress(listener) {
    const handle = await plugin.addListener('progress', (data) => listener(data.percent));
    return () => void handle.remove();
  },
};
