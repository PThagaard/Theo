/**
 * The parents' own music ("Jeres musik"): sound files picked on the phone, such as their own Baby Shark, kept in
 * IndexedDB on the phone and never in the repo (CLAUDE.md, principle 8: the app itself ships only free or
 * original music). The music player plays them like any other song: first in the list, with their own switch
 * and the speed setting. Nothing leaves the phone.
 */

export interface StoredTrack {
  id: string;
  /** The name shown in the menu (the file name without its extension). */
  name: string;
  blob: Blob;
  created: number;
}

export const MAX_TRACKS = 10;
/** Bigger than this is not a song for a toy, and would strain the phone when decoded. */
export const MAX_TRACK_BYTES = 40 * 1024 * 1024;
/** The loudness the player levels a track to, so a loud pop song sits with the app's own music box. */
export const TRACK_TARGET_RMS = 0.08;

/** The id the song list and the settings use for a track, so it can be switched off like a song. */
export function trackSongId(id: string): string {
  return `track:${id}`;
}

/** "Baby_Shark (Pinkfong).mp3" → "Baby Shark (Pinkfong)": no extension, no underscores, short enough for a menu row. */
export function trackName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  const name = base || 'Sang';
  return name.length > 40 ? `${name.slice(0, 39).trimEnd()}…` : name;
}

/**
 * The gain that brings a recording to the level of the app's own music (by its RMS), clamped so a quiet file is
 * helped a little and a loud one turned well down, but nothing is boosted absurdly.
 */
export function trackGain(rms: number): number {
  if (!(rms > 0)) return 1;
  return Math.min(3, Math.max(0.15, TRACK_TARGET_RMS / rms));
}

// ---- Storage (IndexedDB, with an in-memory fallback for the session) ----------

const DB_NAME = 'theos-musik';
const STORE = 'tracks';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB er ikke tilgængelig'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
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

let memory: Map<string, StoredTrack> | null = null;

export async function listTracks(): Promise<StoredTrack[]> {
  if (memory) return [...memory.values()].sort((a, b) => a.created - b.created);
  try {
    const db = await openDb();
    const all = (await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())) as StoredTrack[];
    db.close();
    return all.sort((a, b) => a.created - b.created);
  } catch {
    memory = new Map();
    return [];
  }
}

/** Keeps a picked file on the phone. Throws when the file is too big to be a song. */
export async function addTrack(file: File): Promise<StoredTrack> {
  if (file.size > MAX_TRACK_BYTES) throw new Error('Filen er for stor');
  const track: StoredTrack = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: trackName(file.name),
    blob: file,
    created: Date.now(),
  };
  if (memory) {
    memory.set(track.id, track);
    return track;
  }
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(track));
    db.close();
  } catch {
    memory = new Map([[track.id, track]]);
  }
  return track;
}

export async function removeTrack(id: string): Promise<void> {
  if (memory) {
    memory.delete(id);
    return;
  }
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
    db.close();
  } catch {
    // Nothing to remove, or storage is gone; either way it is not there any more.
  }
}
