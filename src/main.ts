import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AudioEngine } from './audio';
import { loadBuiltinPhotos } from './builtinPhotos';
import { Game } from './game';
import { attachInput, attachShake } from './input';
import { kidLock } from './kidlock';
import { ParentPanel, loadSettings, saveSettings } from './parent';
import { MAX_PHOTOS, addCroppedPhoto, listPhotos, removePhoto, type StoredPhoto } from './photos';
import { Renderer } from './render';
import { Stats } from './stats';
import type { VisitorKind } from './types';
import { appUpdate } from './update';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);
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
      audio.setMusicEnabled(settings.music);
    } catch (error) {
      console.warn('Lyd kunne ikke startes', error);
      return;
    }
  }
  void audio.unlock();
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

game.onEvent((event) => {
  switch (event.type) {
    case 'pop':
      audio?.pop(event.size);
      if (event.kind === 'star') audio?.chime();
      else if (event.kind === 'rainbow') audio?.boing();
      else if (event.kind === 'photo') audio?.tada();
      haptic(ImpactStyle.Medium);
      stats.bump('pops');
      if (event.kind === 'star') stats.bump('popsStar');
      if (event.kind === 'rainbow') stats.bump('popsRainbow');
      if (event.kind === 'photo') {
        stats.bump('popsPhoto');
        if (event.photoId) stats.bump(`photo:${event.photoId}`);
      }
      break;
    case 'spawn':
      audio?.inflate();
      stats.bump('balloonsMade');
      break;
    case 'sparkle':
      audio?.sparkle();
      haptic(ImpactStyle.Light);
      stats.bump('skyTouches');
      break;
    case 'glide':
      audio?.glide(event.note);
      stats.bump('harpNotes');
      break;
    case 'blow':
      stats.bump('blown');
      break;
    case 'swipe':
      stats.bump('swipes');
      break;
    case 'sun':
      audio?.wee();
      haptic(ImpactStyle.Light);
      stats.bump('sun');
      break;
    case 'cloud':
      audio?.rain();
      haptic(ImpactStyle.Light);
      stats.bump('clouds');
      break;
    case 'shake':
      audio?.rattle();
      haptic(ImpactStyle.Heavy);
      stats.bump('shakes');
      break;
    case 'flower':
      if (event.what === 'spin') {
        audio?.twirl();
        stats.bump('flowersSpun');
      } else {
        audio?.pluck();
        stats.bump('flowersPlucked');
      }
      haptic(ImpactStyle.Light);
      break;
    case 'visitor':
      visitorSound(event.kind, event.what);
      if (event.what === 'poke') {
        haptic(ImpactStyle.Light);
        stats.bump('visitorsPoked');
        stats.bump(`visitor:${event.kind}`);
      } else if (event.what === 'appear') {
        stats.bump(event.kind === 'storm' ? 'storms' : 'visitorsSeen');
      }
      break;
    case 'lightning':
      audio?.thunder();
      haptic(ImpactStyle.Heavy);
      stats.bump('lightning');
      break;
    case 'transform':
      if (event.form === 'hotdog') audio?.sizzle();
      else if (event.form === 'mouse') audio?.squeak();
      else if (event.form === 'puffed') audio?.chirp();
      else audio?.sparkle();
      if (event.form) stats.bump('transformations');
      break;
    case 'celebrate':
      audio?.fanfare();
      haptic(ImpactStyle.Heavy);
      stats.bump('celebrations');
      break;
  }
});

/** Each visitor has a sound when it appears and another when it is touched. */
function visitorSound(kind: VisitorKind, what: 'appear' | 'poke' | 'leave'): void {
  if (!audio) return;
  switch (kind) {
    case 'storm':
      if (what === 'appear') {
        audio.rumble();
        audio.startRain();
      } else if (what === 'leave') {
        audio.stopRain();
        audio.clearing();
      }
      break;
    case 'dog':
      audio.bark();
      break;
    case 'elephant':
      if (what === 'appear') audio.rumble();
      else audio.trumpet();
      break;
    case 'bird':
      audio.chirp();
      break;
    case 'butterfly':
      audio.flutter();
      break;
    case 'snail':
      if (what === 'poke') audio.blub();
      break;
    case 'star':
      if (what === 'appear') audio.sparkle();
      else audio.chime();
      break;
  }
}

// ---- Parent menu and kid lock ----------------------------------------------

/** Pictures bundled in src/familie/ are always part of the family, next to the ones picked on the phone. */
const builtinPhotos = loadBuiltinPhotos();

game.setTempo(settings.tempo);
const panel = new ParentPanel(settings, {
  onChange: (updated) => {
    saveSettings(updated);
    audio?.setSfxEnabled(updated.sfx);
    audio?.setMusicEnabled(updated.music);
    game.setTempo(updated.tempo);
    applyFamilyPhotos();
  },
  lock: kidLock,
  update: appUpdate,
  stats: {
    snapshot: () => stats.snapshot,
    reset: () => stats.reset(),
    photoNames: () => Object.fromEntries(familyPhotos.map((photo) => [photo.id, photo.name || 'Familie'])),
  },
  photos: {
    max: MAX_PHOTOS,
    list: async () => [...(await builtinPhotos), ...(await listPhotos())],
    add: addCroppedPhoto,
    remove: removePhoto,
    onChange: (photos) => {
      familyPhotos = photos;
      applyFamilyPhotos();
    },
  },
});

let familyPhotos: StoredPhoto[] = [];
/** Photo balloons only appear when the parents have them switched on. */
function applyFamilyPhotos(): void {
  renderer.setPhotos(familyPhotos);
  game.setPhotos(settings.familyBalloons ? familyPhotos.map((photo) => photo.id) : []);
}

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
    game.press(id, x, y);
  },
  move: (id, x, y) => game.drag(id, x, y),
  up: (id) => game.release(id),
});

attachShake(() => {
  if (panel.isOpen) return;
  lastTouch = performance.now();
  game.shake();
});

// ---- Screen ----------------------------------------------------------------

function resize(): void {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || window.innerWidth));
  const height = Math.max(1, Math.round(rect.height || window.innerHeight));
  // Two device pixels per CSS pixel is plenty for this art style and keeps old phones smooth.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  game.resize(width, height);
  renderer.resize(width, height, dpr);
}
resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

let lastFrame = performance.now();
let loggedErrors = 0;
function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  try {
    game.update(dt);
    renderer.draw(game, dt);
    // Play time: the half minute after every touch counts, so pauses don't inflate the numbers.
    if (!panel.isOpen && now - lastTouch < 30000) stats.addPlayTime(dt);
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

// Handy for debugging and automated checks in a browser console.
declare global {
  interface Window {
    __theo?: { game: Game; audio: () => AudioEngine | null; AudioEngine: typeof AudioEngine; stats: Stats };
  }
}
window.__theo = { game, audio: () => audio, AudioEngine, stats };
