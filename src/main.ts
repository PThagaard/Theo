import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AudioEngine } from './audio';
import { Game } from './game';
import { attachInput, attachShake } from './input';
import { kidLock } from './kidlock';
import { ParentPanel, loadSettings, saveSettings } from './parent';
import { Renderer } from './render';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);
const settings = loadSettings();
let audio: AudioEngine | null = null;

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
      haptic(ImpactStyle.Medium);
      break;
    case 'spawn':
      audio?.inflate();
      break;
    case 'sparkle':
      audio?.sparkle();
      haptic(ImpactStyle.Light);
      break;
    case 'glide':
      audio?.glide(event.note);
      break;
    case 'sun':
      audio?.wee();
      haptic(ImpactStyle.Light);
      break;
    case 'cloud':
      audio?.rain();
      haptic(ImpactStyle.Light);
      break;
    case 'shake':
      audio?.rattle();
      haptic(ImpactStyle.Heavy);
      break;
    case 'celebrate':
      audio?.fanfare();
      haptic(ImpactStyle.Heavy);
      break;
  }
});

// ---- Parent menu and kid lock ----------------------------------------------

const panel = new ParentPanel(settings, {
  onChange: (updated) => {
    saveSettings(updated);
    audio?.setSfxEnabled(updated.sfx);
    audio?.setMusicEnabled(updated.music);
  },
  lock: kidLock,
});

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
    game.press(id, x, y);
  },
  move: (id, x, y) => game.drag(id, x, y),
  up: (id) => game.release(id),
});

attachShake(() => {
  if (panel.isOpen) return;
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
    __theo?: { game: Game; audio: () => AudioEngine | null; AudioEngine: typeof AudioEngine };
  }
}
window.__theo = { game, audio: () => audio, AudioEngine };
