import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ACTIVITIES, findActivity } from './activities/registry';
import type { Activity, ActivityContext } from './engine/activity';
import { AGE_PROFILES } from './engine/age';
import { AudioEngine } from './engine/audio';
import { attachInput, attachShake } from './engine/input';
import { kidLock } from './engine/kidlock';
import { ParentPanel, loadSettings, saveSettings } from './engine/parent';
import { MAX_PHOTOS, addCroppedPhoto, listPhotos, removePhoto, type StoredPhoto } from './engine/photos';
import { Stats } from './engine/stats';
import { appUpdate } from './engine/update';
import { listVoices, removeVoice, saveVoice, startRecording } from './engine/voices';

/**
 * The shell around every activity: canvas and loop, sound, the parents' menu, the lock, counters, the
 * pause and the family photos and voices. Activities (src/activities/) only play.
 */

const canvas = document.getElementById('game') as HTMLCanvasElement;
const settings = loadSettings();
const stats = new Stats();
let audio: AudioEngine | null = null;
/** When the child last touched the screen; play time only counts while someone is actually playing. */
let lastTouch = performance.now();

// Lets the stylesheet make small per-platform adjustments (e.g. camera cut-outs on Android).
document.documentElement.classList.add(`platform-${Capacitor.getPlatform()}`);

// ---- Sound -----------------------------------------------------------------

function ensureAudio(): void {
  if (!audio) {
    try {
      audio = AudioEngine.create();
      audio.setSfxEnabled(settings.sfx);
      audio.setMusicLevel(AGE_PROFILES[settings.age].music);
      audio.setMusicEnabled(settings.music);
      void loadVoicesIntoAudio();
    } catch (error) {
      console.warn('Lyd kunne ikke startes', error);
      return;
    }
  }
  void audio.unlock();
}

/** The parents' recorded words, decoded into the audio engine (again whenever they change). */
let loadedVoiceKeys: string[] = [];
async function loadVoicesIntoAudio(): Promise<void> {
  if (!audio) return;
  const engine = audio;
  const voices = await listVoices();
  for (const key of loadedVoiceKeys) if (!voices.some((voice) => voice.key === key)) engine.forgetVoice(key);
  await Promise.all(voices.map((voice) => engine.loadVoice(voice.key, voice.blob)));
  loadedVoiceKeys = voices.map((voice) => voice.key);
}

// Browsers only allow sound after a touch, so every kind of touch tries to unlock it.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, ensureAudio, { passive: true });
}
// In the native app there is no such restriction, so the music can start right away.
if (Capacitor.isNativePlatform()) ensureAudio();

let lastHaptic = 0;
function haptic(style: ImpactStyle): void {
  const now = performance.now();
  if (now - lastHaptic < 50) return;
  lastHaptic = now;
  Haptics.impact({ style }).catch(() => undefined);
}

// ---- The activity ------------------------------------------------------------

const context: ActivityContext = {
  audio: () => audio,
  stats,
  haptic,
  say: (key, delay, cooldown) => void audio?.say(key, delay, cooldown),
  settings: () => settings,
};

let familyPhotos: StoredPhoto[] = [];
let activity: Activity = findActivity(settings.activity).create(canvas, context);

function startActivity(id: string): void {
  const entry = findActivity(id);
  if (entry.id === activity.id) return;
  activity.dispose();
  activity = entry.create(canvas, context);
  settings.activity = entry.id;
  resize();
  activity.applySettings(settings);
  activity.setPhotos(familyPhotos);
}

// ---- Parent menu and kid lock ----------------------------------------------

const panel = new ParentPanel(settings, {
  onChange: (updated) => {
    saveSettings(updated);
    audio?.setSfxEnabled(updated.sfx);
    audio?.setMusicEnabled(updated.music);
    audio?.setMusicLevel(AGE_PROFILES[updated.age].music);
    if (updated.activity !== activity.id) startActivity(updated.activity);
    activity.applySettings(updated);
  },
  // Opening the menu (a two second hold by a parent) wakes the world after a pause.
  onOpen: () => wakeUp(),
  activities: ACTIVITIES.map((entry) => ({ id: entry.id, label: entry.label })),
  lock: kidLock,
  update: appUpdate,
  stats: {
    snapshot: () => stats.snapshot,
    reset: () => stats.reset(),
    photoNames: () => Object.fromEntries(familyPhotos.map((photo) => [photo.id, photo.name || 'Familie'])),
  },
  voices: {
    list: listVoices,
    save: saveVoice,
    remove: removeVoice,
    record: startRecording,
    play: (key) => audio?.say(key, 0, 0) ?? false,
    onChange: () => void loadVoicesIntoAudio(),
  },
  photos: {
    max: MAX_PHOTOS,
    list: listPhotos,
    add: addCroppedPhoto,
    remove: removePhoto,
    onChange: (photos) => {
      familyPhotos = photos;
      activity.setPhotos(familyPhotos);
    },
  },
});
activity.applySettings(settings);

// On the phone, a little after start, the app looks for a new version by itself (at most twice a day) and
// fetches it in the background; a dot on the corner button then tells the parents it is ready to install.
if (appUpdate.available) setTimeout(() => void panel.checkInBackground(), 8000);

// Ask to pin the app right away if the parent wants that (the phone shows a confirm dialog).
if (kidLock.available && settings.autoLock) {
  window.setTimeout(() => void kidLock.lock(), 1000);
}

// ---- Touch and motion ------------------------------------------------------

attachInput(canvas, {
  down: (id, x, y) => {
    if (panel.isOpen) return;
    // Create/unlock audio before the first pop so even the very first touch makes a sound.
    ensureAudio();
    void requestWakeLock();
    lastTouch = performance.now();
    activity.press(id, x, y);
  },
  move: (id, x, y) => activity.drag(id, x, y),
  up: (id) => activity.release(id),
});

attachShake(() => {
  if (panel.isOpen) return;
  lastTouch = performance.now();
  activity.shake();
});

// ---- Screen ----------------------------------------------------------------

function resize(): void {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect.height || window.innerHeight));
  // Two device pixels per CSS pixel is plenty for this art style and keeps old phones smooth.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  activity.resize(width, height, dpr);
}
resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

// ---- Pause after a long session -------------------------------------------
// Short sessions are what the research asks for (CLAUDE.md, "Alderssvarende"): after the chosen number of
// minutes of actual play, the world calmly goes to sleep until a parent wakes it by opening the menu.
let sessionSeconds = 0;
function wakeUp(): void {
  if (!activity.asleep) return;
  activity.wake();
  audio?.wake();
  sessionSeconds = 0;
  stats.bump('pauses');
}
function fallAsleep(): void {
  if (activity.asleep) return;
  activity.sleep();
  audio?.sleep();
}

let lastFrame = performance.now();
let loggedErrors = 0;
function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  try {
    activity.update(dt);
    activity.render(dt);
    // Play time: the half minute after every touch counts, so pauses don't inflate the numbers.
    const playing = !panel.isOpen && now - lastTouch < 30000 && !activity.asleep;
    if (playing) {
      stats.addPlayTime(dt);
      sessionSeconds += dt;
      if (settings.pauseAfter > 0 && sessionSeconds >= settings.pauseAfter * 60) fallAsleep();
    }
  } catch (error) {
    // Never let one bad frame freeze the game for a small child.
    if (loggedErrors++ < 5) console.error('Fejl i spil-loopet', error);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Keep the screen on while playing. The native projects also do this on their side.
let wakeLock: WakeLockSentinel | null = null;
async function requestWakeLock(): Promise<void> {
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    // Not allowed or not supported. Nothing to do.
  }
}
void requestWakeLock();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio?.pause();
    stats.save();
  } else {
    lastFrame = performance.now();
    void audio?.resume();
    void requestWakeLock();
  }
});

// Web version only: cache the whole game so it starts instantly and works offline once visited.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((error) => console.warn('Offline-cache kunne ikke aktiveres', error));
  });
}

// Handy for debugging and automated checks in a browser console. `game` is the balloon game while that
// activity runs (the smoke test drives it directly).
declare global {
  interface Window {
    __theo?: {
      readonly activity: Activity;
      readonly game: unknown;
      audio: () => AudioEngine | null;
      AudioEngine: typeof AudioEngine;
      stats: Stats;
      startActivity: (id: string) => void;
    };
  }
}
window.__theo = {
  get activity() {
    return activity;
  },
  get game() {
    return activity.debug.game;
  },
  audio: () => audio,
  AudioEngine,
  stats,
  startActivity,
};
