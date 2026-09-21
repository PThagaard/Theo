/**
 * Music theory helpers and song data. Pure functions, no Web Audio here.
 *
 * Melody notation: space separated tokens `NOTE[/duration]`, e.g. `C5`, `G5/2`, `E5/1/3`.
 * Duration is in beats (default 1); `a/b` gives a fraction. `R` is a rest.
 * Chord notation: `NAME[/beats]`, e.g. `C`, `F/2`, `Dm`. Default length is one bar.
 */

export interface Song {
  name: string;
  bpm: number;
  /** 4 for 4/4, 3 for a waltz, 2 for a 6/8 song counted in two. */
  beatsPerBar: number;
  /** Notes per beat in the accompaniment: 2 (straight) or 3 (6/8 feel). */
  subdivision: number;
  melody: string;
  chords: string;
}

export type SongEventKind = 'lead' | 'bass' | 'arp' | 'shaker' | 'kick';

export interface SongEvent {
  /** Start time in beats from the beginning of the song. */
  beat: number;
  kind: SongEventKind;
  midi: number;
  /** Length in beats. */
  dur: number;
}

export interface CompiledSong {
  events: SongEvent[];
  totalBeats: number;
  melodyBeats: number;
  chordBeats: number;
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** `C4` -> 60, `A4` -> 69, `F#5` -> 78. */
export function noteToMidi(name: string): number {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Ukendt node: ${name}`);
  let n = NOTE_INDEX[match[1]];
  if (match[2] === '#') n += 1;
  if (match[2] === 'b') n -= 1;
  return 12 * (parseInt(match[3], 10) + 1) + n;
}

function parseDuration(parts: string[], fallback: number): number {
  if (parts.length === 0) return fallback;
  const a = parseFloat(parts[0]);
  const b = parts.length > 1 ? parseFloat(parts[1]) : 1;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) throw new Error(`Ugyldig varighed: ${parts.join('/')}`);
  return a / b;
}

function chordInfo(name: string): { root: number; minor: boolean } {
  const match = /^([A-G])(#|b)?(m)?$/.exec(name);
  if (!match) throw new Error(`Ukendt akkord: ${name}`);
  return { root: noteToMidi(`${match[1]}${match[2] ?? ''}4`), minor: match[3] === 'm' };
}

/** Turns a song into a flat list of timed events, sorted by start beat. */
export function compileSong(song: Song): CompiledSong {
  const events: SongEvent[] = [];

  let beat = 0;
  for (const token of song.melody.split(/\s+/).filter(Boolean)) {
    const [note, ...durationParts] = token.split('/');
    const dur = parseDuration(durationParts, 1);
    if (note !== 'R') events.push({ beat, kind: 'lead', midi: noteToMidi(note), dur });
    beat += dur;
  }
  const melodyBeats = beat;

  let chordBeat = 0;
  const step = 1 / song.subdivision;
  for (const token of song.chords.split(/\s+/).filter(Boolean)) {
    const [name, ...durationParts] = token.split('/');
    const dur = parseDuration(durationParts, song.beatsPerBar);
    const { root, minor } = chordInfo(name);
    const third = root + (minor ? 3 : 4);
    const fifth = root + 7;

    if (song.beatsPerBar === 3) {
      // Waltz: bass on one, soft chord on two and three.
      events.push({ beat: chordBeat, kind: 'bass', midi: root - 12, dur: Math.min(dur, 3) });
      events.push({ beat: chordBeat, kind: 'kick', midi: 0, dur: 0 });
      for (let b = 1; b < dur; b++) {
        events.push({ beat: chordBeat + b, kind: 'arp', midi: third, dur: 1 });
        events.push({ beat: chordBeat + b, kind: 'arp', midi: fifth, dur: 1 });
        events.push({ beat: chordBeat + b, kind: 'shaker', midi: 0, dur: 0 });
      }
    } else {
      // Bass on the strong beats, a gentle arpeggio in between.
      for (let b = 0; b < dur; b += 2) {
        events.push({ beat: chordBeat + b, kind: 'bass', midi: root - 12, dur: Math.min(2, dur - b) });
        events.push({ beat: chordBeat + b, kind: 'kick', midi: 0, dur: 0 });
      }
      const pattern = song.subdivision === 3 ? [root, fifth, root + 12] : [root, fifth, root + 12, third + 12];
      let n = 0;
      for (let t = 0; t < dur - 1e-9; t += step, n++) {
        events.push({ beat: chordBeat + t, kind: 'arp', midi: pattern[n % pattern.length], dur: step });
        const inBeat = n % song.subdivision;
        if (inBeat === song.subdivision - 1) events.push({ beat: chordBeat + t, kind: 'shaker', midi: 0, dur: 0 });
      }
    }
    chordBeat += dur;
  }

  events.sort((a, b) => a.beat - b.beat);
  return { events, totalBeats: Math.max(melodyBeats, chordBeat), melodyBeats, chordBeats: chordBeat };
}

/** All songs are traditional public-domain children's tunes, plus one original waltz. */
export const SONGS: Song[] = [
  {
    name: 'Lille stjerne (Twinkle Twinkle)',
    bpm: 100,
    beatsPerBar: 4,
    subdivision: 2,
    melody:
      'C5 C5 G5 G5 A5 A5 G5/2 F5 F5 E5 E5 D5 D5 C5/2 ' +
      'G5 G5 F5 F5 E5 E5 D5/2 G5 G5 F5 F5 E5 E5 D5/2 ' +
      'C5 C5 G5 G5 A5 A5 G5/2 F5 F5 E5 E5 D5 D5 C5/2',
    chords: 'C F/2 C/2 F/2 C/2 G/2 C/2 C/2 F/2 C/2 G/2 C/2 F/2 C/2 G/2 C F/2 C/2 F/2 C/2 G/2 C/2',
  },
  {
    name: 'Mary havde et lille lam',
    bpm: 112,
    beatsPerBar: 4,
    subdivision: 2,
    melody: 'E5 D5 C5 D5 E5 E5 E5/2 D5 D5 D5/2 E5 G5 G5/2 E5 D5 C5 D5 E5 E5 E5 E5 D5 D5 E5 D5 C5/4',
    chords: 'C C G C C C G C',
  },
  {
    name: 'Ro, ro, ro din båd',
    bpm: 84,
    beatsPerBar: 2,
    subdivision: 3,
    melody:
      'C5 C5 C5/2/3 D5/1/3 E5 E5/2/3 D5/1/3 E5/2/3 F5/1/3 G5/2 ' +
      'C6/1/3 C6/1/3 C6/1/3 G5/1/3 G5/1/3 G5/1/3 E5/1/3 E5/1/3 E5/1/3 C5/1/3 C5/1/3 C5/1/3 ' +
      'G5/2/3 F5/1/3 E5/2/3 D5/1/3 C5/2',
    chords: 'C C C C C C G C',
  },
  {
    name: 'Mester Jakob',
    bpm: 104,
    beatsPerBar: 4,
    subdivision: 2,
    melody:
      'C5 D5 E5 C5 C5 D5 E5 C5 E5 F5 G5/2 E5 F5 G5/2 ' +
      'G5/1/2 A5/1/2 G5/1/2 F5/1/2 E5 C5 G5/1/2 A5/1/2 G5/1/2 F5/1/2 E5 C5 ' +
      'C5 G4 C5/2 C5 G4 C5/2',
    chords: 'C C C C C C C/1 G/1 C/2 C/1 G/1 C/2',
  },
  {
    name: 'Jens Hansen havde en bondegård',
    bpm: 112,
    beatsPerBar: 4,
    subdivision: 2,
    melody:
      'C5 C5 C5 G4 A4 A4 G4/2 E5 E5 D5 D5 C5/3 G4 ' +
      'C5 C5 C5 G4 A4 A4 G4/2 E5 E5 D5 D5 C5/3 G4/1/2 G4/1/2 ' +
      'C5 C5 C5 G4/1/2 G4/1/2 C5 C5 C5 G4/1/2 G4/1/2 ' +
      'C5/1/2 C5/1/2 C5 C5/1/2 C5/1/2 C5 C5/1/2 C5/1/2 C5 R/2 ' +
      'C5 C5 C5 G4 A4 A4 G4/2 E5 E5 D5 D5 C5/4',
    chords: 'C F/2 C/2 G C C F/2 C/2 G C C C C C C F/2 C/2 G C',
  },
  {
    name: 'Ballonvalsen',
    bpm: 150,
    beatsPerBar: 3,
    subdivision: 2,
    melody:
      'E5 G5 C6 B5/2 G5 A5 F5 A5 G5/3 ' +
      'E5 G5 C6 B5/2 D6 C6 B5 A5 G5/3 ' +
      'F5 A5 C6 E5 G5 C6 D5 F5 A5 G5/2 B5 ' +
      'C6 G5 E5 D5/2 F5 E5 D5 C5 C5/3',
    chords: 'C G F C C G F C F C Dm G C G C C',
  },
];
