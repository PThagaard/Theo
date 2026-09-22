import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ACTIVITIES, findActivity, type ActivityEntry } from './activities/registry';
import type { Activity, ActivityContext } from './engine/activity';
import { AGE_PROFILES } from './engine/age';
import { AudioEngine } from './engine/audio';
import { attachInput, attachShake, attachTilt } from './engine/input';
import { kidLock } from './engine/kidlock';
import { MUSIC_SPEEDS, ParentPanel, loadSettings, saveSettings } from './engine/parent';
import { MAX_PHOTOS, addCroppedPhoto, listPhotos, removePhoto, type StoredPhoto } from './engine/photos';
import { SessionClock } from './engine/session';
import { Stats } from './engine/stats';
import { appUpdate } from './engine/update';
import { listVoices, removeVoice, saveVoice, startRecording } from './engine/voices';
import { MAX_TRACKS, addTrack, listTracks, removeTrack } from './engine/tracks';

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
      audio.setSongsOff(settings.songsOff);
      audio.setMusicSpeed(MUSIC_SPEEDS[settings.musicSpeed]);
      audio.setMusicEnabled(settings.music);
      void loadVoicesIntoAudio();
      void loadTracksIntoAudio();
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

/** The parents' own music ("Jeres musik"), decoded into the audio engine; a just-added track plays at once. */
let loadedTrackIds: string[] = [];
async function loadTracksIntoAudio(playId?: string): Promise<void> {
  if (!audio) return;
  const engine = audio;
  const tracks = await listTracks();
  for (const id of loadedTrackIds) if (!tracks.some((track) => track.id === id)) engine.forgetTrack(id);
  const fresh = tracks.filter((track) => !loadedTrackIds.includes(track.id));
  loadedTrackIds = tracks.map((track) => track.id);
  await Promise.all(fresh.map((track) => engine.loadTrack(track.id, track.name, track.blob, track.id === playId)));
}

// Browsers only allow sound after a touch, so every kind of touch tries to unlock it.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, ensureAudio, { passive: true });
}

// The app is landscape only (the parents' wish): the native apps lock it in their manifests; the web app asks the
// browser too, which works once it runs full screen (installed). A refusal is fine: the games draw in any shape.
function lockLandscape(): void {
  const orientation = screen.orientation as ScreenOrientation & { lock?: (kind: string) => Promise<void> };
  if (typeof orientation?.lock !== 'function') return;
  orientation.lock('landscape').catch(() => undefined);
}
window.addEventListener('pointerdown', lockLandscape, { passive: true, once: true });
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
  say: (key, delay, cooldown) => audio?.say(key, delay, cooldown) ?? 0,
  settings: () => settings,
};

let familyPhotos: StoredPhoto[] = [];
/** The running game, or null while the start page is up. */
let activity: Activity | null = null;

// ---- The start page: the parents pick a game ----------------------------------

const startPage = document.getElementById('start-page') as HTMLElement;
const startTiles = document.getElementById('start-tiles') as HTMLElement;
startTiles.replaceChildren(
  ...ACTIVITIES.map((entry) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'start-tile';
    tile.dataset.activity = entry.id;
    const emoji = document.createElement('span');
    emoji.className = 'start-tile-emoji';
    emoji.textContent = entry.emoji;
    const text = document.createElement('span');
    const title = document.createElement('span');
    title.className = 'start-tile-title';
    title.textContent = entry.title;
    const blurb = document.createElement('span');
    blurb.className = 'start-tile-blurb';
    blurb.textContent = entry.blurb;
    text.append(title, blurb);
    tile.append(emoji, text);
    tile.addEventListener('click', () => startActivity(entry.id));
    return tile;
  }),
);

function showStartPage(): void {
  activity?.dispose();
  activity = null;
  startPage.hidden = false;
}

/** Starts a game (from the start page or the parent menu) and remembers it as the last one played. */
function startActivity(id: string): void {
  const entry: ActivityEntry = findActivity(id);
  if (activity?.id === entry.id) {
    startPage.hidden = true;
    return;
  }
  activity?.dispose();
  activity = entry.create(canvas, context);
  settings.activity = entry.id;
  saveSettings(settings);
  startPage.hidden = true;
  // Picking a game is a touch, so sound may start right away.
  ensureAudio();
  session.reset();
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
    audio?.setSongsOff(updated.songsOff);
    audio?.setMusicSpeed(MUSIC_SPEEDS[updated.musicSpeed]);
    activity?.applySettings(updated);
  },
  currentSong: () => audio?.currentSongName ?? null,
  onSkipSong: () => audio?.skipSong(),
  // Opening the menu (a two second hold by a parent) wakes the world after a pause.
  onOpen: () => wakeUp(),
  pauseStatus: () => {
    const left = session.left(settings.pauseAfter);
    if (left === null) return 'Verdenen falder ikke i søvn af sig selv.';
    const minutes = Math.ceil(left / 60);
    return minutes <= 1 ? 'Verdenen falder i søvn om under et minut.' : `Verdenen falder i søvn om ca. ${minutes} min.`;
  },
  currentGame: () => {
    const entry = activity ? findActivity(activity.id) : null;
    return entry ? { id: entry.id, title: entry.title, hasTempo: entry.hasTempo, hasVoices: entry.hasVoices, familyWhere: entry.familyWhere } : null;
  },
  onSwitchGame: () => showStartPage(),
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
    play: (key) => (audio?.say(key, 0, 0) ?? 0) > 0,
    onChange: () => void loadVoicesIntoAudio(),
  },
  tracks: {
    max: MAX_TRACKS,
    list: listTracks,
    add: addTrack,
    remove: removeTrack,
    onChange: (_tracks, added) => void loadTracksIntoAudio(added?.id),
  },
  photos: {
    max: MAX_PHOTOS,
    list: listPhotos,
    add: addCroppedPhoto,
    remove: removePhoto,
    onChange: (photos) => {
      familyPhotos = photos;
      activity?.setPhotos(familyPhotos);
    },
  },
});

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
    if (panel.isOpen || !activity) return;
    // Create/unlock audio before the first pop so even the very first touch makes a sound.
    ensureAudio();
    void requestWakeLock();
    lastTouch = performance.now();
    activity.press(id, x, y);
  },
  move: (id, x, y) => activity?.drag(id, x, y),
  up: (id) => activity?.release(id),
});

attachShake(() => {
  if (panel.isOpen || !activity) return;
  lastTouch = performance.now();
  activity.shake();
});
// Tilting the phone: the bath's water stays level with the world.
attachTilt((roll) => activity?.tilt?.(roll));

// ---- Screen ----------------------------------------------------------------

function resize(): void {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect.height || window.innerHeight));
  // Two device pixels per CSS pixel is plenty for this art style and keeps old phones smooth.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  activity?.resize(width, height, dpr);
}
resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

// ---- Pause after a long session -------------------------------------------
// Short sessions are what the research asks for (CLAUDE.md, "Alderssvarende"): after the chosen number of
// minutes with the world awake in front of the child, it calmly goes to sleep until a parent wakes it by
// opening the menu. Time in the menu does not count; a quiet stretch does (the screen is still on).
const session = new SessionClock();
// A small, faint countdown in the corner while a pause is set, so the parents can see how long there is left.
const countdown = document.getElementById('pause-countdown') as HTMLElement;
let countdownShown = '';
function renderCountdown(): void {
  const left = activity && !activity.asleep && !panel.isOpen && startPage.hidden ? session.left(settings.pauseAfter) : null;
  const text = left === null ? '' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  if (text === countdownShown) return;
  countdownShown = text;
  countdown.hidden = text === '';
  countdown.textContent = text;
}
function wakeUp(): void {
  if (!activity?.asleep) return;
  activity.wake();
  audio?.wake();
  session.reset();
  stats.bump('pauses');
}
function fallAsleep(): void {
  if (!activity || activity.asleep) return;
  activity.sleep();
  audio?.sleep();
}

let lastFrame = performance.now();
let loggedErrors = 0;
function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  try {
    if (!activity) {
      renderCountdown();
      requestAnimationFrame(frame);
      return;
    }
    activity.update(dt);
    activity.render(dt);
    // Play time: the half minute after every touch counts, so pauses don't inflate the numbers.
    const awake = !panel.isOpen && !activity.asleep;
    if (awake && now - lastTouch < 30000) stats.addPlayTime(dt);
    session.tick(dt, awake);
    if (awake && session.due(settings.pauseAfter)) fallAsleep();
    renderCountdown();
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
      readonly activity: Activity | null;
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
    return activity?.debug.game ?? null;
  },
  audio: () => audio,
  AudioEngine,
  stats,
  startActivity,
};
