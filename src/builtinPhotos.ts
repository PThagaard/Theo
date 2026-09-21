import { shrinkToSquare, type StoredPhoto } from './photos';

/**
 * Family pictures that ship inside the app: every image file in src/familie/ becomes a
 * photo balloon in every build. See src/familie/README.md for format and naming.
 */

const files = import.meta.glob('./familie/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export async function loadBuiltinPhotos(): Promise<StoredPhoto[]> {
  const photos: StoredPhoto[] = [];
  for (const [path, url] of Object.entries(files)) {
    const base = (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
    const name = base.charAt(0).toUpperCase() + base.slice(1);
    try {
      const blob = await (await fetch(url)).blob();
      photos.push({ id: `builtin:${base}`, name, dataUrl: await shrinkToSquare(blob), created: 0, builtin: true });
    } catch (error) {
      console.warn(`Indbygget billede kunne ikke læses: ${path}`, error);
    }
  }
  return photos;
}
