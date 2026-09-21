import type { VisitorKind } from './types';

/**
 * The parents' own voices: short recordings of words ("hund", "ballon") and of the names on the
 * family photos ("Mor!"), made in the parent menu and kept on the phone (IndexedDB). The app says
 * the word in that voice when Theo touches the thing. A voice he knows, answering his own action,
 * is the language support the research points to (CLAUDE.md, "Alderssvarende"). Nothing leaves
 * the phone.
 */

export interface StoredVoice {
  /** A word key from VOICE_WORDS, or `photo:<id>` for the name on a family photo. */
  key: string;
  blob: Blob;
  /** Length of the recording in seconds. */
  seconds: number;
  created: number;
}

/** The words the app can say, in the order the parent menu shows them. */
export const VOICE_WORDS: ReadonlyArray<{ key: string; label: string; emoji: string }> = [
  { key: 'ballon', label: 'Ballon', emoji: '🎈' },
  { key: 'hund', label: 'Hund', emoji: '🐶' },
  { key: 'elefant', label: 'Elefant', emoji: '🐘' },
  { key: 'fugl', label: 'Fugl', emoji: '🐦' },
  { key: 'sommerfugl', label: 'Sommerfugl', emoji: '🦋' },
  { key: 'snegl', label: 'Snegl', emoji: '🐌' },
  { key: 'traktor', label: 'Traktor', emoji: '🚜' },
  { key: 'sol', label: 'Sol', emoji: '☀️' },
  { key: 'sky', label: 'Sky', emoji: '☁️' },
  { key: 'blomst', label: 'Blomst', emoji: '🌸' },
  { key: 'regn', label: 'Regn', emoji: '🌧️' },
  { key: 'lyn', label: 'Lyn', emoji: '⚡' },
];

/** A recording never runs longer than this, whatever the finger does. */
export const MAX_VOICE_SECONDS = 2.5;
/** Shorter than this is a slip of the finger, not a word. */
export const MIN_VOICE_SECONDS = 0.3;

/** The word for a visitor, or null for those without one (the shooting star, the storm cloud itself). */
export function wordForVisitor(kind: VisitorKind): string | null {
  switch (kind) {
    case 'dog':
      return 'hund';
    case 'elephant':
      return 'elefant';
    case 'bird':
      return 'fugl';
    case 'butterfly':
      return 'sommerfugl';
    case 'snail':
      return 'snegl';
    case 'tractor':
      return 'traktor';
    default:
      return null;
  }
}

export function photoVoiceKey(photoId: string): string {
  return `photo:${photoId}`;
}

// ---- Storage (IndexedDB, with an in-memory fallback for the session) ----------

const DB_NAME = 'theos-stemmer';
const STORE = 'voices';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB er ikke tilgængelig'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Kunne ikke åbne databasen'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Databasefejl'));
  });
}

let memory: Map<string, StoredVoice> | null = null;

export async function listVoices(): Promise<StoredVoice[]> {
  if (memory) return [...memory.values()];
  try {
    const db = await openDb();
    const all = (await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())) as StoredVoice[];
    db.close();
    return all;
  } catch {
    memory = new Map();
    return [];
  }
}

export async function saveVoice(key: string, blob: Blob, seconds: number): Promise<StoredVoice> {
  const voice: StoredVoice = { key, blob, seconds, created: Date.now() };
  if (memory) {
    memory.set(key, voice);
    return voice;
  }
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(voice));
    db.close();
  } catch {
    memory = new Map([[key, voice]]);
  }
  return voice;
}

export async function removeVoice(key: string): Promise<void> {
  if (memory) {
    memory.delete(key);
    return;
  }
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key));
    db.close();
  } catch {
    // Nothing to remove, or storage is gone; either way it is not there any more.
  }
}

// ---- Recording ------------------------------------------------------------------

export interface Recording {
  /** Stops the recording (idempotent) and gives back what was recorded. */
  stop(): Promise<{ blob: Blob; seconds: number }>;
}

/** Starts recording from the microphone. The browser asks for permission the first time. */
export async function startRecording(): Promise<Recording> {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Optagelse er ikke understøttet her');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const started = performance.now();
  const release = () => stream.getTracks().forEach((track) => track.stop());
  let stopped: Promise<{ blob: Blob; seconds: number }> | null = null;
  const stop = () => {
    if (stopped) return stopped;
    stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        release();
        resolve({ blob: new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }), seconds: (performance.now() - started) / 1000 });
      };
      recorder.onerror = () => {
        release();
        reject(new Error('Optagelsen fejlede'));
      };
      try {
        recorder.stop();
      } catch (error) {
        release();
        reject(error instanceof Error ? error : new Error('Optagelsen fejlede'));
      }
    });
    return stopped;
  };
  recorder.start();
  setTimeout(() => void stop().catch(() => undefined), MAX_VOICE_SECONDS * 1000);
  return { stop };
}
