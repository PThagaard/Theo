import { SONGS, compileSong, midiToFreq, type CompiledSong, type Song, type SongEvent } from './music';
import { clamp } from './rng';
import { SAMPLE_URLS, type SampleName } from './samples';
import { trackGain, trackSongId } from './tracks';

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
/** Effects starting within this many seconds of each other count as one crowd, and the later ones play quieter. */
const CROWD_WINDOW = 0.15;
/** Level for the 1st, 2nd, 3rd … effect in a crowd (never 0). */
const CROWD_LEVELS = [1, 1, 0.6, 0.4, 0.25];

/** The loudness of a recording (RMS over a sparse sample of every channel), to level the parents' tracks. */
function rmsOf(buffer: AudioBuffer): number {
  let sum = 0;
  let count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 61) {
      sum += data[i] * data[i];
      count++;
    }
  }
  return count ? Math.sqrt(sum / count) : 0;
}

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

/** A recording the parents added ("Jeres musik"), decoded and levelled to the music box. */
export interface Track {
  /** The playlist id ("track:<storage id>"), so it can be switched off like a song. */
  id: string;
  name: string;
  buffer: AudioBuffer;
  /** Gain that brings it to the level of the app's own music. */
  gain: number;
}

/** Something the playlist can play: one of the app's own songs, or a track from the parents. */
interface Playable {
  id: string;
  name: string;
  song?: Song;
  track?: Track;
}

/**
 * Walks through the playlist: schedules the notes of the app's own songs slightly ahead of the audio clock, and
 * plays the parents' tracks as they are (at the chosen speed).
 */
class MusicPlayer {
  private current: Playable | null = null;
  private compiled: CompiledSong | null = null;
  private cursor = 0;
  private songStart = 0;
  private secPerBeat = 0.5;
  /** The playlist order (ids), shuffled anew every time it runs out. */
  private order: string[] = [];
  private orderIndex = 0;
  private playing = false;
  /** Playback speed, 1 = the song's own tempo. */
  private speed = 1;
  /** Ids of the songs the parents have switched off. */
  private off = new Set<string>();
  private firstRun = true;
  private tracks: Track[] = [];
  /** The source playing a track right now, and when it ends. */
  private trackSource: AudioBufferSourceNode | null = null;
  private trackEnd = 0;

  constructor(
    private readonly synth: Synth,
    private readonly out: AudioNode,
    private readonly songs: Song[],
  ) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentName(): string | null {
    return this.current?.name ?? null;
  }

  /** The parents' tracks first (their favourite plays first), then the app's own songs. */
  private get entries(): Playable[] {
    return [...this.tracks.map((track) => ({ id: track.id, name: track.name, track })), ...this.songs.map((song) => ({ id: song.id, name: song.name, song }))];
  }

  /** The ids the parents have left on (all of them when they switch off every one, so music is never silent). */
  private get enabled(): string[] {
    const on = this.entries.filter((entry) => !this.off.has(entry.id)).map((entry) => entry.id);
    return on.length > 0 ? on : this.entries.map((entry) => entry.id);
  }

  setOff(ids: Iterable<string>): void {
    this.off = new Set(ids);
    this.order = this.order.filter((id) => this.enabled.includes(id));
    this.orderIndex = Math.min(this.orderIndex, this.order.length);
  }

  /** The parents' tracks changed: the playlist follows, and a track that is playing but gone gives way. */
  setTracks(tracks: Track[], now: number): void {
    this.tracks = tracks;
    const ids = new Set(this.entries.map((entry) => entry.id));
    this.order = this.order.filter((id) => ids.has(id));
    this.orderIndex = Math.min(this.orderIndex, this.order.length);
    if (this.playing && this.current?.track && !ids.has(this.current.id)) this.load(now + 0.05);
  }

  /** Plays this entry now: the parents just added it and want to hear that it works. */
  playNow(id: string, at: number): void {
    const entry = this.entries.find((candidate) => candidate.id === id);
    if (!entry || !this.playing) return;
    this.order = this.order.filter((candidate) => candidate !== id);
    this.orderIndex = Math.min(this.orderIndex, this.order.length);
    this.loadEntry(entry, at);
  }

  /** Changes the speed now, keeping the place in the song. */
  setSpeed(speed: number, now: number): void {
    const next = clamp(speed, 0.5, 1.6);
    if (this.current?.song) {
      const beatsElapsed = (now - this.songStart) / this.secPerBeat;
      this.secPerBeat = 60 / this.current.song.bpm / next;
      this.songStart = now - beatsElapsed * this.secPerBeat;
    } else if (this.trackSource) {
      const remaining = Math.max(0, this.trackEnd - now);
      this.trackSource.playbackRate.setValueAtTime(next, now);
      this.trackEnd = now + (remaining * this.speed) / next;
    }
    this.speed = next;
  }

  start(at: number): void {
    this.playing = true;
    this.load(at);
  }

  /** Jumps to the next song (what is already scheduled of the current one finishes playing). */
  skip(at: number): void {
    if (!this.playing) return;
    this.load(at);
  }

  /** Stops scheduling; a playing track stops behind the bus fade (not at all when only rendering offline). */
  stop(stopTrack = true): void {
    this.playing = false;
    if (stopTrack) this.stopTrack(this.synth.ctx.currentTime + 0.3);
  }

  /** Schedules every note that starts before `until` (seconds on the audio clock); tracks play by themselves. */
  scheduleUntil(until: number): void {
    if (!this.playing || !this.current) return;
    for (;;) {
      if (this.current.track) {
        const nextStart = this.trackEnd + SONG_GAP;
        if (nextStart > until) return;
        this.load(nextStart);
        continue;
      }
      if (!this.compiled) return;
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
    const id = this.order[this.orderIndex++];
    const entry = this.entries.find((candidate) => candidate.id === id) ?? this.entries[0];
    this.loadEntry(entry, at);
  }

  private loadEntry(entry: Playable, at: number): void {
    this.stopTrack(at);
    this.current = entry;
    this.songStart = at;
    this.cursor = 0;
    if (entry.song) {
      this.compiled = compileSong(entry.song);
      this.secPerBeat = 60 / entry.song.bpm / this.speed;
      return;
    }
    this.compiled = null;
    if (!entry.track) return;
    const ctx = this.synth.ctx;
    const source = ctx.createBufferSource();
    source.buffer = entry.track.buffer;
    source.playbackRate.value = this.speed;
    const gain = ctx.createGain();
    gain.gain.value = entry.track.gain;
    source.connect(gain).connect(this.out);
    source.start(at);
    this.trackSource = source;
    this.trackEnd = at + entry.track.buffer.duration / this.speed;
  }

  private stopTrack(when: number): void {
    const source = this.trackSource;
    if (!source) return;
    this.trackSource = null;
    try {
      source.stop(when);
    } catch {
      // Already stopped.
    }
  }

  private shuffle(): void {
    const previous = this.order.length ? this.order[this.order.length - 1] : null;
    const order = [...this.enabled];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Don't play the same song twice in a row when the playlist wraps around.
    if (order.length > 1 && order[0] === previous) [order[0], order[1]] = [order[1], order[0]];
    // The first song of a session is the first in the list (the parents' own track, when they have one), when it is on.
    if (this.firstRun) {
      this.firstRun = false;
      const favourite = order.indexOf(this.enabled[0]);
      if (favourite > 0) [order[0], order[favourite]] = [order[favourite], order[0]];
    }
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
  /** The parents' recorded words play here, louder than effects and on top of the (ducked) music. */
  private readonly voiceBus: GainNode;
  private readonly voices = new Map<string, AudioBuffer>();
  /** The parents' own music, decoded (see tracks.ts). */
  private readonly tracks = new Map<string, Track>();
  /** When recent effects started, so a crowd of fingers does not become a wall of sound (see voice()). */
  private readonly recentVoices: number[] = [];
  private readonly lastSaid = new Map<string, number>();
  /** How many words have been said (the smoke test checks that touching the dog says "hund"). */
  voicesSaid = 0;
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

    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1;
    this.voiceBus.connect(this.master);

    this.synth = new Synth(ctx, makeNoise(ctx));
    this.music = new MusicPlayer(this.synth, this.musicBus, SONGS);
    this.ready = this.loadSamples();
  }

  // ---- The parents' voices -----------------------------------------------------

  /** Decodes a recording from the parent menu so it can be said at once later. */
  async loadVoice(key: string, blob: Blob): Promise<void> {
    try {
      this.voices.set(key, await this.ctx.decodeAudioData(await blob.arrayBuffer()));
    } catch (error) {
      this.voices.delete(key);
      console.warn(`Stemmen "${key}" kunne ikke afkodes`, error);
    }
  }

  forgetVoice(key: string): void {
    this.voices.delete(key);
  }

  // ---- The parents' own music ("Jeres musik") ----------------------------------

  /**
   * Decodes a song the parents added, levels it to the music box and puts it first in the playlist; with
   * `playNow` it starts at once, so they hear that it works. False when the file cannot be decoded.
   */
  async loadTrack(id: string, name: string, blob: Blob, playNow = false): Promise<boolean> {
    let buffer: AudioBuffer;
    try {
      buffer = await this.ctx.decodeAudioData(await blob.arrayBuffer());
    } catch (error) {
      console.warn(`Sangen "${name}" kunne ikke afkodes`, error);
      return false;
    }
    const trackId = trackSongId(id);
    this.tracks.set(trackId, { id: trackId, name, buffer, gain: trackGain(rmsOf(buffer)) });
    this.music.setTracks([...this.tracks.values()], this.ctx.currentTime);
    if (playNow && this.timer) this.music.playNow(trackId, this.ctx.currentTime + 0.1);
    return true;
  }

  forgetTrack(id: string): void {
    this.tracks.delete(trackSongId(id));
    this.music.setTracks([...this.tracks.values()], this.ctx.currentTime);
  }

  /**
   * Where an effect plays. Many fingers at once (a whole hand, two hands) must not become a wall of sound: every
   * touch still answers, but when several effects start within the same moment, the later ones are quieter.
   * Never silent, so the rule "everything answers with sound" holds.
   */
  private voice(when: number): AudioNode {
    const recent = this.recentVoices;
    while (recent.length && recent[0] < when - 1) recent.shift();
    const crowd = recent.filter((t) => Math.abs(t - when) <= CROWD_WINDOW).length;
    recent.push(when);
    if (recent.length > 40) recent.shift();
    const level = CROWD_LEVELS[Math.min(crowd, CROWD_LEVELS.length - 1)];
    if (level >= 1) return this.sfxBus;
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    gain.connect(this.sfxBus);
    return gain;
  }

  hasVoice(key: string): boolean {
    return this.voices.has(key);
  }

  /**
   * Says a word in a parent's voice a moment after the touch (so the effect sound leads), at most once per
   * `cooldown` seconds for that word, with the music turned down while it speaks. Returns the length of the
   * recording in seconds, or 0 when nothing will be said (no recording for the word, or said too recently).
   */
  say(key: string, delay = 0.35, cooldown = 1.5): number {
    const buffer = this.voices.get(key);
    if (!buffer || !this.sfxOn) return 0;
    const now = this.ctx.currentTime;
    if (now - (this.lastSaid.get(key) ?? -Infinity) < cooldown) return 0;
    this.lastSaid.set(key, now);
    const when = now + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.voiceBus);
    source.start(when);
    if (this.timer) {
      // Duck the music under the voice, then bring it back.
      const gain = this.musicBus.gain;
      const level = MUSIC_LEVEL * this.musicLevel;
      gain.cancelScheduledValues(when);
      gain.setValueAtTime(gain.value, when);
      gain.linearRampToValueAtTime(level * 0.25, when + 0.15);
      gain.setValueAtTime(level * 0.25, when + buffer.duration);
      gain.linearRampToValueAtTime(level, when + buffer.duration + 0.6);
    }
    this.voicesSaid++;
    return buffer.duration;
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
  private sample(name: SampleName, when: number, options: { gain?: number; rate?: number; vary?: boolean } = {}, out: AudioNode = this.sfxBus): boolean {
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
    source.connect(gain).connect(out);
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
    return this.music.currentName;
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

  /** Which songs the parents have switched off (by id). */
  setSongsOff(ids: Iterable<string>): void {
    this.music.setOff(ids);
  }

  /** Playback speed for every song, 1 = as written. */
  setMusicSpeed(speed: number): void {
    this.music.setSpeed(speed, this.ctx.currentTime);
  }

  /** The parents' "next song" button. */
  skipSong(): void {
    if (!this.timer) return;
    this.music.skip(this.ctx.currentTime + 0.1);
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
    this.music.stop(false);
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
    const out = this.voice(when);
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
    const out = this.voice(when);
    [84, 88, 91].forEach((midi, i) => {
      this.synth.tone(out, 'sine', midiToFreq(midi), when + i * 0.06, 0.16, 0.003, 0.3);
    });
  }

  /** Rising "whoop" while a new balloon inflates. */
  inflate(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.tone(out, 'triangle', 220, when, 0.2, 0.02, 0.33, { to: 660, glide: 0.3, filter: 1600 });
  }

  /** Short happy fanfare for the celebration every ten pops. */
  fanfare(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    [72, 76, 79, 84].forEach((midi, i) => {
      this.synth.musicBox(out, midi, when + i * 0.12, i === 3 ? 0.9 : 0.25, 0.4);
    });
    for (const midi of [60, 64, 67]) {
      this.synth.tone(out, 'sine', midiToFreq(midi), when + 0.36, 0.12, 0.01, 0.8);
    }
  }

  /** Springy "boing" for rainbow balloons. */
  boing(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
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
    osc.connect(gain).connect(out);
    osc.start(when);
    vibrato.start(when);
    osc.stop(when + 0.5);
    vibrato.stop(when + 0.5);
  }

  /** Ascending chime for the golden star balloons. */
  chime(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    [84, 86, 88, 91, 93, 96].forEach((midi, i) => {
      this.synth.musicBox(out, midi, when + i * 0.055, 0.5, 0.22);
    });
  }

  /** Harp-like pluck while swiping. `note` 0 (bottom of the screen) .. 7 (top). */
  glide(note: number, when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    const midi = POP_NOTES[clamp(Math.round(note), 0, POP_NOTES.length - 1)];
    this.synth.tone(out, 'triangle', midiToFreq(midi), when, 0.16, 0.004, 0.35, { filter: 2600 });
  }

  /** A happy "wiii!" when the sun is touched. */
  wee(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
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
    osc.connect(gain).connect(out);
    osc.start(when);
    vibrato.start(when);
    osc.stop(when + 0.5);
    vibrato.stop(when + 0.5);
    this.sparkle(when + 0.12);
  }

  /** Bright "ta-daa!" when a family photo jumps out of a balloon. */
  tada(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.musicBox(out, 79, when, 0.25, 0.4);
    this.synth.musicBox(out, 84, when + 0.16, 1.0, 0.45);
    for (const midi of [72, 76, 79]) {
      this.synth.tone(out, 'sine', midiToFreq(midi), when + 0.16, 0.1, 0.02, 0.9);
    }
    this.sparkle(when + 0.3);
  }

  /** Maraca-like rattle with a little bell when the phone is shaken. */
  rattle(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    for (let i = 0; i < 4; i++) {
      this.synth.noiseBurst(out, when + i * 0.085, 0.35, 0.07, 'highpass', 3800);
    }
    [96, 100, 103].forEach((midi, i) => this.synth.musicBox(out, midi, when + 0.05 + i * 0.09, 0.5, 0.25));
  }

  // ---- Carried creatures -----------------------------------------------------

  /** A creature dangling from a balloon calls for help in its own voice. */
  help(kind: string, when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    switch (kind) {
      case 'dog':
        if (this.sample('hund-hjaelp', when, {}, out) || this.sample('hund', when, { rate: 1.3, gain: 0.85 }, out)) return;
        // Two quick worried yelps.
        for (const offset of [0, 0.16]) {
          this.synth.tone(out, 'sawtooth', 620, when + offset, 0.3, 0.01, 0.13, { to: 860, glide: 0.1, filter: 2600 });
        }
        break;
      case 'elephant':
        if (this.sample('elefant-hjaelp', when, {}, out) || this.sample('elefant', when, { rate: 1.25, gain: 0.85 }, out)) return;
        this.synth.tone(out, 'sawtooth', 330, when, 0.28, 0.03, 0.45, { to: 520, glide: 0.35, filter: 1800 });
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
    const out = this.voice(when);
    this.synth.tone(out, 'sine', 240, when, 0.3, 0.01, 0.18, { to: 120, glide: 0.15 });
    this.synth.noiseBurst(out, when, 0.15, 0.1, 'lowpass', 800, 0.6);
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
    const out = this.voice(when);
    if (this.sample('torden', when, { vary: false }, out)) return;
    this.zap(when);
    this.synth.noiseBurst(out, when + 0.12, 0.3, 0.7, 'lowpass', 450, 0.6);
    [91, 96].forEach((midi, i) => this.synth.musicBox(out, midi, when + 0.3 + i * 0.1, 0.5, 0.25));
  }

  /** Just the zap and the crack: for bolts that follow each other quickly, so tapping away stays crisp, not booming. */
  zap(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.tone(out, 'sawtooth', 1500, when, 0.26, 0.004, 0.2, { to: 220, glide: 0.18, filter: 3200 });
    this.synth.noiseBurst(out, when, 0.4, 0.06, 'highpass', 2500, 0.7);
  }

  /** Sizzle and boing: the dog just became a hotdog. */
  sizzle(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.noiseBurst(out, when, 0.25, 0.6, 'bandpass', 4200, 1.2);
    this.boing(when + 0.15);
  }

  /** Mouse squeaks. */
  squeak(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    for (const offset of [0, 0.18]) {
      this.synth.tone(out, 'sine', 1900, when + offset, 0.18, 0.005, 0.13, { to: 2700, glide: 0.06 });
    }
  }

  /** The storm has passed: a bright little chime for the rainbow. */
  clearing(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    [72, 76, 79, 84, 88].forEach((midi, i) => this.synth.musicBox(out, midi, when + i * 0.12, 0.6, 0.3));
  }

  // ---- Flowers -------------------------------------------------------------

  /** Sparkly upward twirl when a flower is tapped and starts spinning. */
  twirl(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    [84, 88, 91, 96].forEach((midi, i) => {
      this.synth.tone(out, 'triangle', midiToFreq(midi), when + i * 0.06, 0.16, 0.004, 0.32, { filter: 3000 });
    });
  }

  /** A quick "plop" and a whoosh when a flower is plucked and flies off. */
  pluck(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.tone(out, 'sine', 320, when, 0.28, 0.005, 0.14, { to: 760, glide: 0.09 });
    this.synth.noiseBurst(out, when + 0.02, 0.12, 0.28, 'lowpass', 900, 0.6);
  }

  /** A balloon that grew until it burst: a deeper bang than a pop, with a puff of air. */
  burst(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.tone(out, 'sine', 180, when, 0.5, 0.004, 0.35, { to: 60, glide: 0.3 });
    this.synth.noiseBurst(out, when, 0.45, 0.16, 'lowpass', 1400, 0.7);
    this.synth.noiseBurst(out, when + 0.02, 0.25, 0.5, 'bandpass', 700, 0.5);
  }

  /** A sunburst: a bright rising shimmer of music-box notes. */
  sunburst(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    [72, 76, 79, 84, 88, 91, 96].forEach((midi, i) => this.synth.musicBox(out, midi, when + i * 0.07, 0.6, 0.3));
    this.synth.noiseBurst(out, when, 0.12, 0.6, 'highpass', 5000);
  }

  // ---- Visitors ------------------------------------------------------------

  /**
   * Two friendly "vov vov" barks. Phone speakers hardly reproduce anything below ~300 Hz, so the
   * bark lives in the 250-500 Hz range with a bright, noisy attack that carries on a small speaker.
   */
  bark(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('hund', when, {}, out)) return;
    for (const offset of [0, 0.3]) {
      const t = when + offset;
      this.synth.tone(out, 'sawtooth', 460, t, 0.4, 0.012, 0.22, { to: 250, glide: 0.16, filter: 2400 });
      this.synth.tone(out, 'square', 230, t, 0.12, 0.012, 0.16, { to: 125, glide: 0.12, filter: 1200 });
      this.synth.noiseBurst(out, t, 0.35, 0.07, 'bandpass', 1500, 0.9);
    }
  }

  /**
   * An elephant trumpet: a long, brassy blast (about 1.6 s) that rises, wavers and falls, with two
   * detuned sawtooth voices, formant filters for the brass colour and a breathy rasp on top.
   */
  trumpet(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('elefant', when, {}, out)) return;
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
    formant1.connect(formant2).connect(lowpass).connect(gain).connect(out);
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
    breath.connect(breathFilter).connect(breathGain).connect(out);
    breath.start(when);
    breath.stop(when + length + 0.05);
  }

  /** The tractor's horn: a cheerful two-note "tut-tuuut". */
  honk(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('traktor', when, {}, out)) return;
    this.synth.tone(out, 'sawtooth', 370, when, 0.24, 0.01, 0.2, { filter: 1400 });
    this.synth.tone(out, 'square', 370, when, 0.08, 0.01, 0.2, { filter: 900 });
    this.synth.tone(out, 'sawtooth', 466, when + 0.24, 0.24, 0.01, 0.42, { filter: 1400 });
    this.synth.tone(out, 'square', 466, when + 0.24, 0.08, 0.01, 0.42, { filter: 900 });
  }

  /** The old engine starting up: a short "put-put-put" as the tractor drives out. */
  putter(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('traktor-motor', when, {}, out)) return;
    for (let i = 0; i < 7; i++) {
      const t = when + i * 0.11;
      this.synth.tone(out, 'sine', 95, t, 0.22, 0.004, 0.07, { to: 60, glide: 0.06 });
      this.synth.noiseBurst(out, t, 0.14, 0.04, 'bandpass', 420, 1.2);
    }
  }

  /** A friendly grumble when the elephant peeks up (kept above the range a phone speaker loses). */
  rumble(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('elefant-brum', when, {}, out)) return;
    this.synth.tone(out, 'sawtooth', 180, when, 0.22, 0.08, 0.8, { to: 120, glide: 0.7, filter: 700 });
    this.synth.tone(out, 'triangle', 90, when, 0.25, 0.08, 0.8, { to: 60, glide: 0.7, filter: 400 });
  }

  /** "Tweet tweet" for the bird. */
  chirp(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('fugl', when, {}, out)) return;
    for (const offset of [0, 0.13, 0.3]) {
      this.synth.tone(out, 'sine', 2100, when + offset, 0.14, 0.005, 0.1, { to: 3000, glide: 0.07 });
    }
  }

  /** Tiny twinkle for the butterfly. */
  flutter(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('sommerfugl', when, {}, out)) return;
    [91, 95, 98, 103].forEach((midi, i) => {
      this.synth.tone(out, 'sine', midiToFreq(midi), when + i * 0.05, 0.1, 0.003, 0.25);
    });
  }

  /** Soft "blub" when the snail hides in its shell. */
  blub(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('snegl', when, {}, out)) return;
    this.synth.tone(out, 'sine', 320, when, 0.25, 0.01, 0.25, { to: 140, glide: 0.2 });
  }

  /** Soft rain when a cloud is touched: a hush of drops and a few bubbly "plops", nothing bird-like. */
  rain(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.noiseBurst(out, when, 0.12, 0.5, 'lowpass', 1400, 0.5);
    [0, 0.11, 0.2, 0.32, 0.41, 0.55].forEach((offset, i) => {
      const f = [620, 520, 700, 480, 580, 440][i];
      this.synth.tone(out, 'sine', f * 1.5, when + offset, 0.2, 0.004, 0.16, { to: f, glide: 0.1 });
    });
  }

  // ---- Ord's own things ------------------------------------------------------

  /**
   * A friendly "muuuh" for the cow: a held, nasal call around 200–300 Hz (a phone speaker loses anything
   * lower), the "m" opening into the vowel, then falling away.
   */
  moo(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('ko', when, {}, out)) return;
    const ctx = this.ctx;
    const length = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.2, when + 0.12);
    gain.gain.setValueAtTime(0.2, when + 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    const formant = ctx.createBiquadFilter();
    formant.type = 'peaking';
    formant.frequency.value = 620;
    formant.Q.value = 2;
    formant.gain.value = 8;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(700, when);
    lowpass.frequency.linearRampToValueAtTime(1500, when + 0.25);
    formant.connect(lowpass).connect(gain).connect(out);
    for (const [type, base, detune] of [
      ['sawtooth', 240, -6],
      ['sawtooth', 240, 6],
      ['triangle', 120, 0],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(base * 1.15, when);
      osc.frequency.exponentialRampToValueAtTime(base, when + 0.3);
      osc.frequency.setValueAtTime(base, when + 0.7);
      osc.frequency.exponentialRampToValueAtTime(base * 0.8, when + length);
      osc.connect(formant);
      osc.start(when);
      osc.stop(when + length + 0.05);
    }
  }

  /** "Mjav" for the cat: a quick rise and a longer fall, bright enough to carry on a small speaker. */
  meow(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('kat', when, {}, out)) return;
    const ctx = this.ctx;
    const length = 0.65;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.4, when + 0.06);
    gain.gain.setValueAtTime(0.4, when + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    // The mouth shape: "mj" opening into "a", closing towards "v".
    const mouth = ctx.createBiquadFilter();
    mouth.type = 'bandpass';
    mouth.Q.value = 1.2;
    mouth.frequency.setValueAtTime(900, when);
    mouth.frequency.linearRampToValueAtTime(2200, when + 0.15);
    mouth.frequency.linearRampToValueAtTime(1300, when + length);
    mouth.connect(gain).connect(out);
    for (const detune of [-5, 5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(520, when);
      osc.frequency.exponentialRampToValueAtTime(880, when + 0.16);
      osc.frequency.setValueAtTime(880, when + 0.3);
      osc.frequency.exponentialRampToValueAtTime(430, when + length);
      osc.connect(mouth);
      osc.start(when);
      osc.stop(when + length + 0.05);
    }
  }

  /** The little car's horn: two short "dyt dyt" chords (a major third, like a real horn). */
  beep(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('bil', when, {}, out)) return;
    for (const offset of [0, 0.22]) {
      for (const freq of [440, 554]) {
        this.synth.tone(out, 'square', freq, when + offset, 0.07, 0.008, 0.18, { filter: 1600 });
        this.synth.tone(out, 'sawtooth', freq, when + offset, 0.08, 0.008, 0.18, { filter: 2200 });
      }
    }
  }

  // ---- Bobler ------------------------------------------------------------------

  /** A soap bubble popping: a wet "plop", quick and high for a small bubble, deeper for a big one. */
  plop(size: number, when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    const f = 1100 - size * 650;
    this.synth.tone(out, 'sine', f, when, 0.5, 0.003, 0.14 + size * 0.1, { to: f * 0.35, glide: 0.09 + size * 0.06 });
    this.synth.noiseBurst(out, when, 0.35, 0.03, 'bandpass', 2600 - size * 1200, 1.2);
    // A little "bloop" of water after a big one.
    if (size > 0.4) this.synth.tone(out, 'sine', 300, when + 0.06, 0.2 * size, 0.01, 0.2, { to: 520, glide: 0.15 });
  }

  /** A splash: a wash of water and a few drops pinging down again. */
  splash(big = false, when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.noiseBurst(out, when, big ? 0.45 : 0.3, big ? 0.4 : 0.25, 'lowpass', 1600, 0.6);
    this.synth.tone(out, 'sine', 240, when, big ? 0.3 : 0.18, 0.005, 0.2, { to: 90, glide: 0.18 });
    const drops = big ? [0.12, 0.2, 0.27, 0.36, 0.45] : [0.1, 0.18, 0.28];
    drops.forEach((offset, i) => {
      const f = [1500, 1150, 1700, 1300, 1900][i];
      this.synth.tone(out, 'sine', f, when + offset, 0.12, 0.003, 0.12, { to: f * 0.7, glide: 0.08 });
    });
  }

  /** The rubber duck: two cheerful, nasal "kvæk"s, short enough to stay friendly. */
  quack(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('and', when, {}, out)) return;
    for (const [offset, base] of [
      [0, 430],
      [0.2, 470],
    ] as const) {
      const t = when + offset;
      this.synth.tone(out, 'sawtooth', base, t, 0.28, 0.01, 0.17, { to: base * 0.72, glide: 0.14, filter: 1900 });
      this.synth.tone(out, 'square', base / 2, t, 0.08, 0.01, 0.15, { to: base * 0.36, glide: 0.14, filter: 900 });
      this.synth.noiseBurst(out, t, 0.12, 0.05, 'bandpass', 1400, 1.5);
    }
  }

  /** The bath being shaken: a bubbly gurgle of plops tumbling upwards. */
  gurgle(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.noiseBurst(out, when, 0.2, 0.45, 'bandpass', 600, 2);
    for (let i = 0; i < 7; i++) {
      const f = 380 + i * 95 + (i % 2) * 40;
      this.synth.tone(out, 'sine', f, when + i * 0.06, 0.22, 0.004, 0.12, { to: f * 1.5, glide: 0.08 });
    }
  }

  /** The toy whale surfacing: a soft, friendly two-note call with a slow vibrato. */
  whaleCall(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('hval', when, {}, out)) return;
    const ctx = this.ctx;
    const length = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.22, when + 0.2);
    gain.gain.setValueAtTime(0.22, when + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1400;
    lowpass.connect(gain).connect(out);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 12;
    vibrato.connect(depth);
    for (const [type, base] of [
      ['sine', 330],
      ['triangle', 165],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(base * 0.8, when);
      osc.frequency.exponentialRampToValueAtTime(base * 1.25, when + 0.5);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, when + length);
      depth.connect(osc.frequency);
      osc.connect(lowpass);
      osc.start(when);
      osc.stop(when + length + 0.05);
    }
    vibrato.start(when);
    vibrato.stop(when + length + 0.05);
  }

  /** The whale's spout: a breathy "pfff-shhh" with a few drops pattering down afterwards. */
  spout(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.noiseBurst(out, when, 0.4, 0.12, 'highpass', 2500, 0.7);
    this.synth.noiseBurst(out, when + 0.08, 0.3, 0.6, 'bandpass', 1800, 0.8);
    [0.5, 0.62, 0.7, 0.85].forEach((offset, i) => {
      this.synth.tone(out, 'sine', [1500, 1200, 1700, 1300][i], when + offset, 0.1, 0.003, 0.12, { to: 900, glide: 0.08 });
    });
  }

  /** The penguin: two short, bright squawks. */
  squawk(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('pingvin', when, {}, out)) return;
    for (const [offset, base] of [
      [0, 760],
      [0.16, 900],
    ] as const) {
      this.synth.tone(out, 'sawtooth', base, when + offset, 0.2, 0.01, 0.12, { to: base * 1.3, glide: 0.06, filter: 2600 });
      this.synth.noiseBurst(out, when + offset, 0.1, 0.05, 'bandpass', 2200, 1.2);
    }
  }

  /** A jet ski buzzing past: the tractor engine recording sped up, or a quick synthetic buzz. */
  whine(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('traktor-motor', when, { rate: 1.7, gain: 0.7 }, out)) return;
    for (let i = 0; i < 12; i++) {
      this.synth.tone(out, 'sawtooth', 220 + i * 6, when + i * 0.07, 0.12, 0.004, 0.06, { filter: 1500 });
    }
  }

  /** A single drop from the shower head: a short, high "plip". */
  drip(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.tone(out, 'sine', 1900, when, 0.16, 0.002, 0.09, { to: 1100, glide: 0.07 });
    this.synth.noiseBurst(out, when, 0.06, 0.02, 'highpass', 4000);
  }

  /** The polar bear's friendly "brum-brum" hello (a recording if there is one): low, soft and round, never a growl. */
  bearHello(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    if (this.sample('isbjoern', when, {}, out)) return;
    for (const [offset, base] of [
      [0, 150],
      [0.28, 190],
    ] as const) {
      const t = when + offset;
      this.synth.tone(out, 'triangle', base, t, 0.28, 0.03, 0.26, { to: base * 1.12, glide: 0.2, filter: 700 });
      this.synth.tone(out, 'sawtooth', base * 0.5, t, 0.1, 0.03, 0.22, { filter: 500 });
      this.synth.noiseBurst(out, t, 0.05, 0.2, 'lowpass', 600, 0.5);
    }
  }

  /** "Ding-ding?": two soft rising notes that stand in for the question "Hvor er …?" when it is not recorded. */
  question(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    this.synth.tone(out, 'sine', 659, when, 0.16, 0.01, 0.3);
    this.synth.tone(out, 'sine', 1318, when, 0.04, 0.01, 0.2);
    this.synth.tone(out, 'sine', 880, when + 0.22, 0.16, 0.01, 0.45, { to: 990, glide: 0.4 });
    this.synth.tone(out, 'sine', 1760, when + 0.22, 0.04, 0.01, 0.25);
  }

  /** Leaves rustling when the bush is touched but not yet opened: dry and light, with a little "hmm?" */
  rustle(when = this.ctx.currentTime): void {
    if (!this.sfxOn) return;
    const out = this.voice(when);
    for (const [offset, freq] of [
      [0, 2600],
      [0.07, 3400],
      [0.15, 2900],
      [0.24, 3800],
    ] as const) {
      this.synth.noiseBurst(out, when + offset, 0.16, 0.09, 'bandpass', freq, 0.8);
    }
    // Two rising notes, so it sounds like a question, never a warning.
    this.synth.tone(out, 'sine', 660, when + 0.1, 0.08, 0.01, 0.16, { to: 880, glide: 0.12 });
  }
}
