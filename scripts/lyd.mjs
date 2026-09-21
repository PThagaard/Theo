// Lydværktøj: ser på en lydfil, eller klipper, normaliserer og gemmer den som en lille MP3 i src/lyde/.
//
//   node scripts/lyd.mjs info  <fil.mp3> ...                 varighed, toppe og en lille kurve over lydstyrken
//   node scripts/lyd.mjs trim  <fil.mp3> <navn> [fra] [til]  klipper (sekunder), fjerner stilhed i enderne,
//                                                             normaliserer, toner ind/ud og skriver src/lyde/<navn>.mp3
//
// Afkodningen sker i Chromium (Playwright), så alt hvad en browser kan afspille (mp3, ogg, wav, m4a) kan læses.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lame from '@breezystack/lamejs';

const OUT = fileURLToPath(new URL('../src/lyde/', import.meta.url));
const RATE = 44100;
const [command, ...args] = process.argv.slice(2);

if (!command || (command !== 'info' && command !== 'trim') || args.length === 0) {
  console.log('Brug: node scripts/lyd.mjs info <fil> ...  |  node scripts/lyd.mjs trim <fil> <navn> [fra] [til]');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();

/** Decodes a sound file to mono float samples at RATE. */
async function decode(file) {
  const b64 = fs.readFileSync(file).toString('base64');
  const result = await page.evaluate(
    async ({ b64, rate }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const probe = new OfflineAudioContext(1, rate, rate);
      const buffer = await probe.decodeAudioData(bytes.buffer);
      // Mix down to mono.
      const mono = new Float32Array(buffer.length);
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
      }
      return { channels: buffer.numberOfChannels, sourceRate: buffer.sampleRate, samples: Array.from(mono) };
    },
    { b64, rate: RATE },
  );
  return { ...result, samples: Float32Array.from(result.samples) };
}

function envelopeChart(samples) {
  const win = Math.floor(RATE * 0.05);
  const lines = [];
  const bars = [];
  for (let i = 0; i < samples.length; i += win) {
    let m = 0;
    for (let k = i; k < Math.min(samples.length, i + win); k++) m = Math.max(m, Math.abs(samples[k]));
    bars.push(m);
  }
  for (let i = 0; i < bars.length; i += 20) {
    const chunk = bars.slice(i, i + 20);
    lines.push(`${(i * 0.05).toFixed(1).padStart(5)} s ${chunk.map((v) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor(v * 8))]).join('')}`);
  }
  return lines.join('\n');
}

function peakOf(samples) {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return peak;
}

if (command === 'info') {
  for (const file of args) {
    const { channels, sourceRate, samples } = await decode(file);
    console.log(`${path.basename(file)}: ${(samples.length / RATE).toFixed(2)} s, ${channels} kanal(er), ${sourceRate} Hz, top ${peakOf(samples).toFixed(2)}`);
    console.log(envelopeChart(samples));
  }
} else {
  const [file, name, fromArg, toArg] = args;
  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    console.log('Navnet må kun have små bogstaver, tal og bindestreg, fx elefant eller hund-hjaelp');
    process.exit(1);
  }
  const { samples } = await decode(file);
  const from = Math.max(0, Math.floor((Number(fromArg) || 0) * RATE));
  const to = Math.min(samples.length, toArg ? Math.floor(Number(toArg) * RATE) : samples.length);
  let cut = samples.subarray(from, to);
  // Trim silence at both ends (anything under -40 dB), keeping a hair of air.
  const floor = peakOf(cut) * 0.01;
  let start = 0;
  let end = cut.length;
  while (start < end && Math.abs(cut[start]) < floor) start++;
  while (end > start && Math.abs(cut[end - 1]) < floor) end--;
  start = Math.max(0, start - Math.floor(RATE * 0.005));
  end = Math.min(cut.length, end + Math.floor(RATE * 0.04));
  cut = cut.subarray(start, end);
  // Normalise to a healthy level, and fade the ends so nothing clicks.
  const gain = 0.89 / Math.max(1e-6, peakOf(cut));
  const fadeIn = Math.floor(RATE * 0.005);
  const fadeOut = Math.floor(RATE * 0.06);
  const pcm = new Int16Array(cut.length);
  for (let i = 0; i < cut.length; i++) {
    let v = cut[i] * gain;
    if (i < fadeIn) v *= i / fadeIn;
    if (i >= cut.length - fadeOut) v *= (cut.length - i) / fadeOut;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  const encoder = new lame.Mp3Encoder(1, RATE, 96);
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const part = encoder.encodeBuffer(pcm.subarray(i, i + 1152));
    if (part.length > 0) chunks.push(Buffer.from(part));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Buffer.from(tail));
  fs.mkdirSync(OUT, { recursive: true });
  const target = path.join(OUT, `${name}.mp3`);
  fs.writeFileSync(target, Buffer.concat(chunks));
  console.log(`${path.basename(file)} ${(from / RATE).toFixed(2)}–${(to / RATE).toFixed(2)} s -> ${path.relative(process.cwd(), target)}: ${(pcm.length / RATE).toFixed(2)} s, ${fs.statSync(target).size} bytes`);
  console.log(envelopeChart(Float32Array.from(pcm, (v) => v / 32767)));
}
await browser.close();
