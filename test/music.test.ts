import { describe, expect, it } from 'vitest';
import { SONGS, compileSong, midiToFreq, noteToMidi } from '../src/engine/music';

describe('noteToMidi', () => {
  it('maps note names to MIDI numbers', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C5')).toBe(72);
    expect(noteToMidi('F#5')).toBe(78);
    expect(noteToMidi('Bb3')).toBe(58);
  });

  it('rejects nonsense', () => {
    expect(() => noteToMidi('H2')).toThrow();
  });
});

describe('midiToFreq', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
  });
});

describe('songs', () => {
  for (const song of SONGS) {
    it(`"${song.name}" has a melody and chords of the same length, in whole bars`, () => {
      const compiled = compileSong(song);
      expect(compiled.melodyBeats).toBeCloseTo(compiled.chordBeats, 6);
      expect(compiled.melodyBeats % song.beatsPerBar).toBeCloseTo(0, 6);
      expect(compiled.events.length).toBeGreaterThan(20);
      // Events come out sorted and none start after the song ends.
      for (let i = 1; i < compiled.events.length; i++) {
        expect(compiled.events[i].beat).toBeGreaterThanOrEqual(compiled.events[i - 1].beat);
      }
      for (const event of compiled.events) expect(event.beat).toBeLessThan(compiled.totalBeats);
    });
  }

  it('starts every song with a melody note on beat one', () => {
    for (const song of SONGS) {
      const first = compileSong(song).events.find((e) => e.kind === 'lead');
      expect(first?.beat).toBe(0);
    }
  });
});
