import { SONGS, compileSong, midiToFreq, type CompiledSong, type Song, type SongEvent } from './music';
import { clamp } from './rng';
import { SAMPLE_URLS, type SampleName } from './samples';

/**
 * Nearly everything the app plays is synthesised with the Web Audio API: balloon pops,
 * sparkles, a fanfare and a little music-box band that plays children's songs in the
 * background. The animals use real recordings from src/lyde/ when a file is there
 * (see samples.ts), with a synthesised voice as the fallback.
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
  /** Age profile factor on the music level, so a parent's voice wins over the music for the youngest. */
  private musicLevel = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Decoded recordings from src/lyde/, by file name. */
  private readonly samples = new Map<string, AudioBuffer>();
  /** Resolves once every recording has been decoded (or given up on). */
  readonly ready: Promise<void>;
  /** Cycles through small pitch variations so repeated recordings do not sound like a machine. */
  private variation = 0;

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
    this.ready = this.loadSamples();
  }

  // ---- Recordings ----------------------------------------------------------

  private async loadSamples(): Promise<void> {
    await Promise.all(
      Object.entries(SAMPLE_URLS).map(async ([name, url]) => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          this.samples.set(name, await this.ctx.decodeAudioData(await response.arrayBuffer()));
        } catch (error) {
          console.warn(`Lydfilen "${name}" kunne ikke bruges; den syntetiserede lyd bruges i stedet`, error);
        }
      }),
    );
  }

  /** File names of the recordings that are loaded and used instead of the synth. */
  get loadedSamples(): string[] {
    return [...this.samples.keys()].sort();
  }

  /**
   * Plays a recording if there is one, a little varied in pitch each time. Returns false when
   * there is no such file, so the caller plays its synthesised voice instead.
   */
  private sample(name: SampleName, when: number, options: { gain?: number; rate?: number; vary?: boolean } = {}): boolean {
    const buffer = this.samples.get(name);
    if (!buffer) return false;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const variations = [1, 1.05, 0.96, 1.02, 0.98];
    const vary = options.vary === false ? 1 : variations[this.variation++ % variations.length];
    source.playbackRate.value = (options.rate ?? 1) * vary;
    const gain = ctx.createGain();
    gain.gain.value = options.gain ?? 1;
    source.connect(gain).connect(this.sfxBus);
    source.start(when);
    return true;
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
    if (this.rainLoop) this.rainLoop.gain.gain.value = on ? (this.samples.has('regn') ? 0.35 : 0.055) : 0;
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** 0–1 on top of the normal music level (age profiles turn the music down for the youngest). */
  setMusicLevel(factor: number): void {
    this.musicLevel = clamp(factor, 0, 1);
    if (this.timer) this.fadeMusicBus(MUSIC_LEVEL * this.musicLevel, 0.5);
  }

  /** The world goes to sleep: the music fades out and a slow music-box lullaby plays once. */
  sleep(): void {
    this.stopMusic();
    if (!this.sfxOn) return;
    const when = this.ctx.currentTime + 1.5;
    // "Lille stjerne": the first line, slow and soft.
    const notes = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60];
    notes.forEach((midi, i) => this.synth.musicBox(this.sfxBus, midi, when + i * 0.62, i === 6 || i === 13 ? 1.4 : 0.6, 0.16));
  }

  /** A parent woke the world up: the music comes back. */
  wake(): void {
    this.startMusic();
  }

  startMusic(): void {
    if (!this.musicOn || this.timer) return;
    const now = this.ctx.currentTime;
    this.fadeMusicBus(MUSIC_LEVEL * this.musicLevel, 0.3);
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

  // ---- Carried creatures -----------------------------------------------------

  /** A creature dangling from a balloon calls for help in its own voice. */
  help(kind: string, when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    switch (kind) {
      case 'dog':
        if (this.sample('hund-hjaelp', when) || this.sample('hund', when, { rate: 1.3, gain: 0.85 })) return;
        // Two quick worried yelps.
        for (const offset of [0, 0.16]) {
          this.synth.tone(this.sfxBus, 'sawtooth', 620, when + offset, 0.3, 0.01, 0.13, { to: 860, glide: 0.1, filter: 2600 });
        }
        break;
      case 'elephant':
        if (this.sample('elefant-hjaelp', when) || this.sample('elefant', when, { rate: 1.25, gain: 0.85 })) return;
        this.synth.tone(this.sfxBus, 'sawtooth', 330, when, 0.28, 0.03, 0.45, { to: 520, glide: 0.35, filter: 1800 });
        break;
      case 'bird':
        this.chirp(when);
        break;
      case 'butterfly':
        this.flutter(when);
        break;
      case 'snail':
        this.blub(when);
        break;
      case 'tractor':
        this.honk(when);
        break;
      default:
        this.boing(when);
    }
  }

  /** Soft "flump" when a creature lands under its parachute. */
  land(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.tone(this.sfxBus, 'sine', 240, when, 0.3, 0.01, 0.18, { to: 120, glide: 0.15 });
    this.synth.noiseBurst(this.sfxBus, when, 0.15, 0.1, 'lowpass', 800, 0.6);
  }

  // ---- Storm ---------------------------------------------------------------

  private rainLoop: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Soft rain in the background while the storm cloud is on screen. */
  startRain(): void {
    if (this.rainLoop) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    const recording = this.samples.get('regn');
    source.buffer = recording ?? this.synth.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = recording ? 8000 : 1500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.sfxOn ? (recording ? 0.35 : 0.055) : 0, ctx.currentTime + 1.5);
    source.connect(filter).connect(gain).connect(this.sfxBus);
    source.start();
    this.rainLoop = { source, gain };
  }

  stopRain(): void {
    const loop = this.rainLoop;
    if (!loop) return;
    this.rainLoop = null;
    const now = this.ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
    loop.gain.gain.linearRampToValueAtTime(0.0001, now + 2);
    loop.source.stop(now + 2.1);
  }

  /**
   * Lightning for a baby: a bright "zap", a crack and a short, friendly boom, then a little sparkle.
   * Loud-ish and exciting, never harsh or long enough to frighten.
   */
  thunder(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('torden', when, { vary: false })) return;
    this.zap(when);
    this.synth.noiseBurst(this.sfxBus, when + 0.12, 0.3, 0.7, 'lowpass', 450, 0.6);
    [91, 96].forEach((midi, i) => this.synth.musicBox(this.sfxBus, midi, when + 0.3 + i * 0.1, 0.5, 0.25));
  }

  /** Just the zap and the crack: for bolts that follow each other quickly, so tapping away stays crisp, not booming. */
  zap(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.tone(this.sfxBus, 'sawtooth', 1500, when, 0.26, 0.004, 0.2, { to: 220, glide: 0.18, filter: 3200 });
    this.synth.noiseBurst(this.sfxBus, when, 0.4, 0.06, 'highpass', 2500, 0.7);
  }

  /** Sizzle and boing: the dog just became a hotdog. */
  sizzle(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.noiseBurst(this.sfxBus, when, 0.25, 0.6, 'bandpass', 4200, 1.2);
    this.boing(when + 0.15);
  }

  /** Mouse squeaks. */
  squeak(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    for (const offset of [0, 0.18]) {
      this.synth.tone(this.sfxBus, 'sine', 1900, when + offset, 0.18, 0.005, 0.13, { to: 2700, glide: 0.06 });
    }
  }

  /** The storm has passed: a bright little chime for the rainbow. */
  clearing(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [72, 76, 79, 84, 88].forEach((midi, i) => this.synth.musicBox(this.sfxBus, midi, when + i * 0.12, 0.6, 0.3));
  }

  // ---- Flowers -------------------------------------------------------------

  /** Sparkly upward twirl when a flower is tapped and starts spinning. */
  twirl(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [84, 88, 91, 96].forEach((midi, i) => {
      this.synth.tone(this.sfxBus, 'triangle', midiToFreq(midi), when + i * 0.06, 0.16, 0.004, 0.32, { filter: 3000 });
    });
  }

  /** A quick "plop" and a whoosh when a flower is plucked and flies off. */
  pluck(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.tone(this.sfxBus, 'sine', 320, when, 0.28, 0.005, 0.14, { to: 760, glide: 0.09 });
    this.synth.noiseBurst(this.sfxBus, when + 0.02, 0.12, 0.28, 'lowpass', 900, 0.6);
  }

  /** A balloon that grew until it burst: a deeper bang than a pop, with a puff of air. */
  burst(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.tone(this.sfxBus, 'sine', 180, when, 0.5, 0.004, 0.35, { to: 60, glide: 0.3 });
    this.synth.noiseBurst(this.sfxBus, when, 0.45, 0.16, 'lowpass', 1400, 0.7);
    this.synth.noiseBurst(this.sfxBus, when + 0.02, 0.25, 0.5, 'bandpass', 700, 0.5);
  }

  /** A sunburst: a bright rising shimmer of music-box notes. */
  sunburst(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    [72, 76, 79, 84, 88, 91, 96].forEach((midi, i) => this.synth.musicBox(this.sfxBus, midi, when + i * 0.07, 0.6, 0.3));
    this.synth.noiseBurst(this.sfxBus, when, 0.12, 0.6, 'highpass', 5000);
  }

  // ---- Visitors ------------------------------------------------------------

  /**
   * Two friendly "vov vov" barks. Phone speakers hardly reproduce anything below ~300 Hz, so the
   * bark lives in the 250-500 Hz range with a bright, noisy attack that carries on a small speaker.
   */
  bark(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('hund', when)) return;
    for (const offset of [0, 0.3]) {
      const t = when + offset;
      this.synth.tone(this.sfxBus, 'sawtooth', 460, t, 0.4, 0.012, 0.22, { to: 250, glide: 0.16, filter: 2400 });
      this.synth.tone(this.sfxBus, 'square', 230, t, 0.12, 0.012, 0.16, { to: 125, glide: 0.12, filter: 1200 });
      this.synth.noiseBurst(this.sfxBus, t, 0.35, 0.07, 'bandpass', 1500, 0.9);
    }
  }

  /**
   * An elephant trumpet: a long, brassy blast (about 1.6 s) that rises, wavers and falls, with two
   * detuned sawtooth voices, formant filters for the brass colour and a breathy rasp on top.
   */
  trumpet(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('elefant', when)) return;
    const ctx = this.ctx;
    const length = 1.95;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.3, when + 0.08);
    gain.gain.setValueAtTime(0.3, when + 1.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    // Brass colour: two resonances on top of the raw sawtooth.
    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'peaking';
    formant1.frequency.value = 1100;
    formant1.Q.value = 2.5;
    formant1.gain.value = 7;
    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'peaking';
    formant2.frequency.value = 2300;
    formant2.Q.value = 3;
    formant2.gain.value = 5;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3800;
    formant1.connect(formant2).connect(lowpass).connect(gain).connect(this.sfxBus);
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(5, when);
    vibrato.frequency.linearRampToValueAtTime(7, when + length);
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.setValueAtTime(0, when);
    vibratoDepth.gain.linearRampToValueAtTime(28, when + 0.6);
    vibrato.connect(vibratoDepth);
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(260, when);
      osc.frequency.exponentialRampToValueAtTime(560, when + 0.3);
      osc.frequency.setValueAtTime(560, when + 1.25);
      osc.frequency.exponentialRampToValueAtTime(380, when + length);
      vibratoDepth.connect(osc.frequency);
      osc.connect(formant1);
      osc.start(when);
      osc.stop(when + length + 0.05);
    }
    vibrato.start(when);
    vibrato.stop(when + length + 0.05);
    // Breathy rasp that follows the blast.
    const breath = ctx.createBufferSource();
    breath.buffer = this.synth.noise;
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 1800;
    breathFilter.Q.value = 1.5;
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, when);
    breathGain.gain.linearRampToValueAtTime(0.12, when + 0.1);
    breathGain.gain.setValueAtTime(0.12, when + 1.25);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    breath.connect(breathFilter).connect(breathGain).connect(this.sfxBus);
    breath.start(when);
    breath.stop(when + length + 0.05);
  }

  /** The tractor's horn: a cheerful two-note "tut-tuuut". */
  honk(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('traktor', when)) return;
    this.synth.tone(this.sfxBus, 'sawtooth', 370, when, 0.24, 0.01, 0.2, { filter: 1400 });
    this.synth.tone(this.sfxBus, 'square', 370, when, 0.08, 0.01, 0.2, { filter: 900 });
    this.synth.tone(this.sfxBus, 'sawtooth', 466, when + 0.24, 0.24, 0.01, 0.42, { filter: 1400 });
    this.synth.tone(this.sfxBus, 'square', 466, when + 0.24, 0.08, 0.01, 0.42, { filter: 900 });
  }

  /** The old engine starting up: a short "put-put-put" as the tractor drives out. */
  putter(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('traktor-motor', when)) return;
    for (let i = 0; i < 7; i++) {
      const t = when + i * 0.11;
      this.synth.tone(this.sfxBus, 'sine', 95, t, 0.22, 0.004, 0.07, { to: 60, glide: 0.06 });
      this.synth.noiseBurst(this.sfxBus, t, 0.14, 0.04, 'bandpass', 420, 1.2);
    }
  }

  /** A friendly grumble when the elephant peeks up (kept above the range a phone speaker loses). */
  rumble(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('elefant-brum', when)) return;
    this.synth.tone(this.sfxBus, 'sawtooth', 180, when, 0.22, 0.08, 0.8, { to: 120, glide: 0.7, filter: 700 });
    this.synth.tone(this.sfxBus, 'triangle', 90, when, 0.25, 0.08, 0.8, { to: 60, glide: 0.7, filter: 400 });
  }

  /** "Tweet tweet" for the bird. */
  chirp(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('fugl', when)) return;
    for (const offset of [0, 0.13, 0.3]) {
      this.synth.tone(this.sfxBus, 'sine', 2100, when + offset, 0.14, 0.005, 0.1, { to: 3000, glide: 0.07 });
    }
  }

  /** Tiny twinkle for the butterfly. */
  flutter(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('sommerfugl', when)) return;
    [91, 95, 98, 103].forEach((midi, i) => {
      this.synth.tone(this.sfxBus, 'sine', midiToFreq(midi), when + i * 0.05, 0.1, 0.003, 0.25);
    });
  }

  /** Soft "blub" when the snail hides in its shell. */
  blub(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    if (this.sample('snegl', when)) return;
    this.synth.tone(this.sfxBus, 'sine', 320, when, 0.25, 0.01, 0.25, { to: 140, glide: 0.2 });
  }

  /** Soft rain when a cloud is touched: a hush of drops and a few bubbly "plops", nothing bird-like. */
  rain(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    this.synth.noiseBurst(this.sfxBus, when, 0.12, 0.5, 'lowpass', 1400, 0.5);
    [0, 0.11, 0.2, 0.32, 0.41, 0.55].forEach((offset, i) => {
      const f = [620, 520, 700, 480, 580, 440][i];
      this.synth.tone(this.sfxBus, 'sine', f * 1.5, when + offset, 0.2, 0.004, 0.16, { to: f, glide: 0.1 });
    });
  }
}
