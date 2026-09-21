// Re-encodes pictures through a canvas so all metadata (EXIF, GPS position, camera) is gone,
// centre-crops them to a square and saves them as 600x600 JPEGs.
// Usage: node scripts/strip-photos.mjs <input.jpg=output-name> ...   e.g. foto.jpg=mor
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/familie/', import.meta.url));
const jobs = process.argv.slice(2).map((arg) => {
  const [input, name] = arg.split('=');
  return { input, output: path.join(OUT, `${name ?? path.basename(input).replace(/\.[^.]+$/, '')}.jpg`) };
});
if (jobs.length === 0) {
  console.log('Brug: node scripts/strip-photos.mjs <billede.jpg=navn> ...');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage();
for (const job of jobs) {
  const b64 = fs.readFileSync(job.input).toString('base64');
  const out = await page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const side = Math.min(bitmap.width, bitmap.height);
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 600;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 600, 600);
    return { w: bitmap.width, h: bitmap.height, data: c.toDataURL('image/jpeg', 0.92).split(',')[1] };
  }, b64);
  fs.writeFileSync(job.output, Buffer.from(out.data, 'base64'));
  console.log(`${path.basename(job.input)} (${out.w}x${out.h}) -> ${path.relative(process.cwd(), job.output)} (${fs.statSync(job.output).size} bytes)`);
}
await browser.close();
