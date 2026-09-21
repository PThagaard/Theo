import { SONGS, compileSong, midiToFreq, type CompiledSong, type Song, type SongEvent } from './music';
import { clamp } from './rng';

/**
 * Everything the app plays is synthesised with the Web Audio API, so there are
 * no sound files to ship: balloon pops, sparkles, a fanfare and a little
 * music-box band that plays children's songs in the background.
 */

export const MUSIC_LEVEL = 0.3;
const SFX_LEVEL = 0.8;
/** How far ahead of the audio clock music notes are scheduled. */
const LOOKAHEAD = 0.4;
const TICK_MS = 80;
/** Silence between two songs. */
const SONG_GAP = 2.0;

/** C major pentatonic: every pop plays one of these, so mashing the screen sounds musical. */
const POP_NOTES = [72, 74, 76, 79, 81, 84, 86, 88];

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 1.0);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buffer;
}

/** Quick attack, exponential decay. */
function envelope(param: AudioParam, when: number, peak: number, attack: number, decay: number): void {
  param.setValueAtTime(0.0001, when);
  param.linearRampToValueAtTime(peak, when + attack);
  param.exponentialRampToValueAtTime(0.0001, when + attack + decay);
}

interface ToneOptions {
  /** Glide the pitch to this frequency ... */
  to?: number;
  /** ... over this many seconds. */
  glide?: number;
  /** Optional low-pass cutoff to soften the sound. */
  filter?: number;
}

/** Small collection of synth voices shared by the sound effects and the music. */
class Synth {
  constructor(
    readonly ctx: BaseAudioContext,
    readonly noise: AudioBuffer,
  ) {}

  tone(
    out: AudioNode,
    type: OscillatorType,
    freq: number,
    when: number,
    peak: number,
    attack: number,
    decay: number,
    options: ToneOptions = {},
  ): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, when + (options.glide ?? decay));
    const gain = ctx.createGain();
    envelope(gain.gain, when, peak, attack, decay);
    let node: AudioNode = osc;
    if (options.filter) {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = options.filter;
      osc.connect(lowpass);
      node = lowpass;
    }
    node.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + attack + decay + 0.05);
  }

  noiseBurst(out: AudioNode, when: number, peak: number, decay: number, type: BiquadFilterType, freq: number, q = 1): void {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    envelope(gain.gain, when, peak, 0.002, decay);
    source.connect(filter).connect(gain).connect(out);
    source.start(when);
    source.stop(when + decay + 0.05);
  }

  /** Bell-like music box note built from a few sine partials. */
  musicBox(out: AudioNode, midi: number, when: number, seconds: number, volume: number): void {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const decay = clamp(seconds * 1.4, 0.7, 1.6);
    const gain = ctx.createGain();
    envelope(gain.gain, when, volume, 0.006, decay);
    gain.connect(out);
    const partials: Array<[number, number]> = [
      [1, 1],
      [2, 0.3],
      [3, 0.1],
      [5.4, 0.04],
    ];
    for (const [multiple, amplitude] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * multiple;
      const partialGain = ctx.createGain();
      partialGain.gain.value = amplitude;
      osc.connect(partialGain).connect(gain);
      osc.start(when);
      osc.stop(when + decay + 0.05);
    }
  }

  bass(out: AudioNode, midi: number, when: number, seconds: number): void {
    const f = midiToFreq(midi);
    this.tone(out, 'sine', f, when, 0.35, 0.01, Math.max(0.2, seconds * 0.9));
    this.tone(out, 'triangle', f, when, 0.1, 0.01, Math.max(0.2, seconds * 0.6), { filter: 900 });
  }

  pluck(out: AudioNode, midi: number, when: number): void {
    this.tone(out, 'triangle', midiToFreq(midi), when, 0.13, 0.005, 0.3, { filter: 1800 });
  }

  shaker(out: AudioNode, when: number): void {
    this.noiseBurst(out, when, 0.06, 0.06, 'highpass', 6500);
  }

  kick(out: AudioNode, when: number): void {
    this.tone(out, 'sine', 130, when, 0.35, 0.002, 0.14, { to: 45, glide: 0.08 });
  }
}

/** Walks through the playlist and schedules notes slightly ahead of the audio clock. */
class MusicPlayer {
  private song: Song | null = null;
  private compiled: CompiledSong | null = null;
  private cursor = 0;
  private songStart = 0;
  private secPerBeat = 0.5;
  private order: number[] = [];
  private orderIndex = 0;
  private playing = false;

  constructor(
    private readonly synth: Synth,
    private readonly out: AudioNode,
    private readonly songs: Song[],
  ) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentSong(): Song | null {
    return this.song;
  }

  start(at: number): void {
    this.playing = true;
    this.load(at);
  }

  stop(): void {
    this.playing = false;
  }

  /** Schedules every note that starts before `until` (seconds on the audio clock). */
  scheduleUntil(until: number): void {
    if (!this.playing || !this.compiled) return;
    for (;;) {
      if (this.cursor >= this.compiled.events.length) {
        const nextStart = this.songStart + this.compiled.totalBeats * this.secPerBeat + SONG_GAP;
        if (nextStart > until) return;
        this.load(nextStart);
        continue;
      }
      const event = this.compiled.events[this.cursor];
      const when = this.songStart + event.beat * this.secPerBeat;
      if (when >= until) return;
      this.play(event, when);
      this.cursor++;
    }
  }

  private load(at: number): void {
    if (this.orderIndex >= this.order.length) this.shuffle();
    const song = this.songs[this.order[this.orderIndex++]];
    this.song = song;
    this.compiled = compileSong(song);
    this.cursor = 0;
    this.songStart = at;
    this.secPerBeat = 60 / song.bpm;
  }

  private shuffle(): void {
    const previous = this.order.length ? this.order[this.order.length - 1] : -1;
    const order = this.songs.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Don't play the same song twice in a row when the playlist wraps around.
    if (order.length > 1 && order[0] === previous) [order[0], order[1]] = [order[1], order[0]];
    this.order = order;
    this.orderIndex = 0;
  }

  private play(event: SongEvent, when: number): void {
    const seconds = event.dur * this.secPerBeat;
    switch (event.kind) {
      case 'lead':
        this.synth.musicBox(this.out, event.midi, when, seconds, 0.5);
        break;
      case 'bass':
        this.synth.bass(this.out, event.midi, when, seconds);
        break;
      case 'arp':
        this.synth.pluck(this.out, event.midi, when);
        break;
      case 'shaker':
        this.synth.shaker(this.out, when);
        break;
      case 'kick':
        this.synth.kick(this.out, when);
        break;
    }
  }
}

export class AudioEngine {
  readonly ctx: BaseAudioContext;
  private readonly synth: Synth;
  private readonly master: GainNode;
  private readonly sfxBus: GainNode;
  private readonly musicBus: GainNode;
  private readonly music: MusicPlayer;
  private sfxOn = true;
  private musicOn = true;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 20;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;
    compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(compressor);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_LEVEL;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = MUSIC_LEVEL;
    this.musicBus.connect(this.master);

    this.synth = new Synth(ctx, makeNoise(ctx));
    this.music = new MusicPlayer(this.synth, this.musicBus, SONGS);
  }

  /** Creates an engine on a real, playing AudioContext. */
  static create(): AudioEngine {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio er ikke understøttet');
    return new AudioEngine(new Ctor({ latencyHint: 'interactive' }));
  }

  /** The realtime context, or null when rendering offline. */
  private get live(): AudioContext | null {
    if (typeof OfflineAudioContext !== 'undefined' && this.ctx instanceof OfflineAudioContext) return null;
    return this.ctx as AudioContext;
  }

  get state(): AudioContextState {
    return this.ctx.state;
  }

  get currentSongName(): string | null {
    return this.music.currentSong?.name ?? null;
  }

  /** Browsers only allow sound after a touch. Call this from every touch; it is cheap when already running. */
  async unlock(): Promise<void> {
    const ctx = this.live;
    if (!ctx) return;
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        // Not allowed yet. The next touch will try again.
      }
    }
    if (this.musicOn && !this.timer) this.startMusic();
  }

  /** App went to the background: stop scheduling music and release the audio hardware. */
  pause(): void {
    this.stopMusic();
    void this.live?.suspend().catch(() => undefined);
  }

  /** App came back: resume and start a fresh song. */
  async resume(): Promise<void> {
    await this.unlock();
  }

  setSfxEnabled(on: boolean): void {
    this.sfxOn = on;
    this.sfxBus.gain.value = on ? SFX_LEVEL : 0;
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  startMusic(): void {
    if (!this.musicOn || this.timer) return;
    const now = this.ctx.currentTime;
    this.fadeMusicBus(MUSIC_LEVEL, 0.3);
    this.music.start(now + 0.15);
    this.music.scheduleUntil(now + LOOKAHEAD);
    this.timer = setInterval(() => this.music.scheduleUntil(this.ctx.currentTime + LOOKAHEAD), TICK_MS);
  }

  stopMusic(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.music.stop();
    // Notes already scheduled inside the lookahead window fade out with the bus.
    this.fadeMusicBus(0, 0.2);
  }

  /** For offline rendering/tests: schedule `seconds` of music starting at `from`. */
  renderMusic(from: number, seconds: number): void {
    this.music.start(from);
    this.music.scheduleUntil(from + seconds);
    this.music.stop();
  }

  private fadeMusicBus(target: number, seconds: number): void {
    const now = this.ctx.currentTime;
    const gain = this.musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(target, now + seconds);
  }

  // ---- Sound effects -------------------------------------------------------

  /** A balloon burst. `size` 0..1: bigger balloons pop with a deeper, lower note. */
  pop(size: number, when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.sfxBus;
    // The sharp "pop" itself.
    this.synth.noiseBurst(out, when, 0.9, 0.1, 'bandpass', 900 + (1 - size) * 2200, 0.7);
    // A little thump underneath.
    this.synth.tone(out, 'sine', 190 - size * 70, when, 0.55, 0.002, 0.12, { to: 50, glide: 0.09 });
    // A musical plink on top so lots of pops make a tune.
    const index = clamp(Math.round((1 - size) * 5 + (Math.random() * 2 - 1)), 0, POP_NOTES.length - 1);
    const f = midiToFreq(POP_NOTES[index]);
    this.synth.tone(out, 'triangle', f * 1.5, when, 0.35, 0.004, 0.3, { to: f, glide: 0.04 });
  }

  /** Twinkly sound when touching empty sky. */
  sparkle(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [84, 88, 91].forEach((midi, i) => {
      this.synth.tone(this.sfxBus, 'sine', midiToFreq(midi), when + i * 0.06, 0.16, 0.003, 0.3);
    });
  }

  /** Rising "whoop" while a new balloon inflates. */
  inflate(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.tone(this.sfxBus, 'triangle', 220, when, 0.2, 0.02, 0.33, { to: 660, glide: 0.3, filter: 1600 });
  }

  /** Short happy fanfare for the celebration every ten pops. */
  fanfare(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [72, 76, 79, 84].forEach((midi, i) => {
      this.synth.musicBox(this.sfxBus, midi, when + i * 0.12, i === 3 ? 0.9 : 0.25, 0.4);
    });
    for (const midi of [60, 64, 67]) {
      this.synth.tone(this.sfxBus, 'sine', midiToFreq(midi), when + 0.36, 0.12, 0.01, 0.8);
    }
  }

  /** Springy "boing" for rainbow balloons. */
  boing(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, when);
    osc.frequency.exponentialRampToValueAtTime(160, when + 0.4);
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 9;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 35;
    vibrato.connect(vibratoDepth).connect(osc.frequency);
    const gain = ctx.createGain();
    envelope(gain.gain, when, 0.3, 0.005, 0.45);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(when);
    vibrato.start(when);
    osc.stop(when + 0.5);
    vibrato.stop(when + 0.5);
  }

  /** Ascending chime for the golden star balloons. */
  chime(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [84, 86, 88, 91, 93, 96].forEach((midi, i) => {
      this.synth.musicBox(this.sfxBus, midi, when + i * 0.055, 0.5, 0.22);
    });
  }

  /** Harp-like pluck while swiping. `note` 0 (bottom of the screen) .. 7 (top). */
  glide(note: number, when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const midi = POP_NOTES[clamp(Math.round(note), 0, POP_NOTES.length - 1)];
    this.synth.tone(this.sfxBus, 'triangle', midiToFreq(midi), when, 0.16, 0.004, 0.35, { filter: 2600 });
  }

  /** A happy "wiii!" when the sun is touched. */
  wee(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, when);
    osc.frequency.exponentialRampToValueAtTime(980, when + 0.32);
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 7;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = 25;
    vibrato.connect(vibratoDepth).connect(osc.frequency);
    const gain = ctx.createGain();
    envelope(gain.gain, when, 0.22, 0.02, 0.45);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(when);
    vibrato.start(when);
    osc.stop(when + 0.5);
    vibrato.stop(when + 0.5);
    this.sparkle(when + 0.12);
  }

  /** Bright "ta-daa!" when a family photo jumps out of a balloon. */
  tada(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.musicBox(this.sfxBus, 79, when, 0.25, 0.4);
    this.synth.musicBox(this.sfxBus, 84, when + 0.16, 1.0, 0.45);
    for (const midi of [72, 76, 79]) {
      this.synth.tone(this.sfxBus, 'sine', midiToFreq(midi), when + 0.16, 0.1, 0.02, 0.9);
    }
    this.sparkle(when + 0.3);
  }

  /** Maraca-like rattle with a little bell when the phone is shaken. */
  rattle(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    for (let i = 0; i < 4; i++) {
      this.synth.noiseBurst(this.sfxBus, when + i * 0.085, 0.35, 0.07, 'highpass', 3800);
    }
    [96, 100, 103].forEach((midi, i) => this.synth.musicBox(this.sfxBus, midi, when + 0.05 + i * 0.09, 0.5, 0.25));
  }

  // ---- Visitors ------------------------------------------------------------

  /** Two friendly "vov vov" barks. */
  bark(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    for (const offset of [0, 0.22]) {
      const t = when + offset;
      this.synth.tone(this.sfxBus, 'sawtooth', 190, t, 0.22, 0.01, 0.16, { to: 120, glide: 0.12, filter: 900 });
      this.synth.noiseBurst(this.sfxBus, t, 0.25, 0.08, 'bandpass', 700, 0.8);
    }
  }

  /** An elephant trumpet: a rising, wobbling blast. */
  trumpet(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, when);
    osc.frequency.exponentialRampToValueAtTime(440, when + 0.25);
    osc.frequency.exponentialRampToValueAtTime(330, when + 0.7);
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = 11;
    const depth = ctx.createGain();
    depth.gain.value = 18;
    vibrato.connect(depth).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    envelope(gain.gain, when, 0.28, 0.05, 0.7);
    osc.connect(filter).connect(gain).connect(this.sfxBus);
    osc.start(when);
    vibrato.start(when);
    osc.stop(when + 0.8);
    vibrato.stop(when + 0.8);
  }

  /** A low, friendly rumble when the elephant peeks up. */
  rumble(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.tone(this.sfxBus, 'triangle', 70, when, 0.25, 0.1, 0.6, { to: 55, glide: 0.5, filter: 300 });
  }

  /** "Tweet tweet" for the bird. */
  chirp(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    for (const offset of [0, 0.13, 0.3]) {
      this.synth.tone(this.sfxBus, 'sine', 2100, when + offset, 0.14, 0.005, 0.1, { to: 3000, glide: 0.07 });
    }
  }

  /** Tiny twinkle for the butterfly. */
  flutter(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [91, 95, 98, 103].forEach((midi, i) => {
      this.synth.tone(this.sfxBus, 'sine', midiToFreq(midi), when + i * 0.05, 0.1, 0.003, 0.25);
    });
  }

  /** Soft "blub" when the snail hides in its shell. */
  blub(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.tone(this.sfxBus, 'sine', 320, when, 0.25, 0.01, 0.25, { to: 140, glide: 0.2 });
  }

  /** Soft raindrops ("plip plip") when a cloud is touched. */
  rain(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [96, 93, 98, 91, 100, 95].forEach((midi, i) => {
      const f = midiToFreq(midi);
      this.synth.tone(this.sfxBus, 'sine', f * 1.25, when + i * 0.07, 0.12, 0.003, 0.22, { to: f, glide: 0.06 });
    });
  }
}
