/**
 * Family photos for the photo balloons. Pictures are picked from the phone in the parent
 * menu, shrunk to a small square and stored in the browser's IndexedDB on the device.
 * Nothing ever leaves the phone.
 */

export interface StoredPhoto {
  id: string;
  /** Optional name (e.g. "Mor"), for later features such as saying the name aloud. */
  name: string;
  /** Small square JPEG as a data URL. */
  dataUrl: string;
  created: number;
  /** True for pictures that ship inside the app (src/familie/); they can't be removed from the menu. */
  builtin?: boolean;
}

export const MAX_PHOTOS = 8;
/** Photos are stored as squares of this size; plenty for a balloon, tiny on disk. */
const SIZE = 320;
const DB_NAME = 'theos-legeplads';
const STORE = 'photos';

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

/** In-memory fallback so the feature still works for the session if storage is unavailable. */
let memory: StoredPhoto[] | null = null;

export async function listPhotos(): Promise<StoredPhoto[]> {
  if (memory) return [...memory];
  try {
    const db = await openDb();
    const all = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
    db.close();
    return (all as StoredPhoto[]).sort((a, b) => a.created - b.created);
  } catch {
    memory = [];
    return [];
  }
}

export async function addPhoto(file: Blob, name = ''): Promise<StoredPhoto> {
  const photo: StoredPhoto = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    dataUrl: await shrinkToSquare(file),
    created: Date.now(),
  };
  if (memory) {
    memory.push(photo);
    return photo;
  }
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(photo));
    db.close();
  } catch {
    memory = [photo];
  }
  return photo;
}

/** Stores a picture the parent has already framed in the cropper (a square JPEG data URL). */
export async function addCroppedPhoto(dataUrl: string, name = ''): Promise<StoredPhoto> {
  const photo: StoredPhoto = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    dataUrl,
    created: Date.now(),
  };
  if (memory) {
    memory.push(photo);
    return photo;
  }
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(photo));
    db.close();
  } catch {
    memory = [photo];
  }
  return photo;
}

export async function removePhoto(id: string): Promise<void> {
  if (memory) {
    memory = memory.filter((p) => p.id !== id);
    return;
  }
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
    db.close();
  } catch {
    // Nothing stored, nothing to remove.
  }
}

export type LoadedImage = ImageBitmap | HTMLImageElement;

export function imageSize(image: LoadedImage): { width: number; height: number } {
  return 'naturalWidth' in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

export function releaseImage(image: LoadedImage): void {
  if ('close' in image) image.close();
}

/** Reads a picked file into something a canvas can draw, the right way up. */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` applies the photo's own rotation info, so selfies come out the right way up.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> route below.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Billedet kunne ikke læses'));
    };
    image.src = url;
  });
}

/** Centre-crops the picture to a square, shrinks it and returns a JPEG data URL. */
export async function shrinkToSquare(file: Blob): Promise<string> {
  const image = await loadImage(file);
  const { width, height } = imageSize(image);
  const side = Math.min(width, height);
  const dataUrl = cropToDataUrl(image, (width - side) / 2, (height - side) / 2, side);
  releaseImage(image);
  return dataUrl;
}

/** Cuts the square (sx, sy, side) out of the picture and returns it as a small JPEG data URL. */
export function cropToDataUrl(image: LoadedImage, sx: number, sy: number, side: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas er ikke understøttet');
  ctx.drawImage(image, sx, sy, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL('image/jpeg', 0.85);
}
