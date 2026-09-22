import { describe, expect, it } from 'vitest';
import { MAX_TRACKS, TRACK_TARGET_RMS, trackGain, trackName, trackSongId } from '../src/engine/tracks';

describe('Jeres musik (the parents\' own tracks)', () => {
  it('names a track after its file, without the extension or underscores, and never too long for a row', () => {
    expect(trackName('Baby Shark.mp3')).toBe('Baby Shark');
    expect(trackName('baby_shark_pinkfong.m4a')).toBe('baby shark pinkfong');
    expect(trackName('  .mp3')).toBe('Sang');
    expect(trackName('x'.repeat(60) + '.wav')).toHaveLength(40);
  });

  it('levels a recording to the music box: loud files down, quiet files a little up, nothing absurd', () => {
    expect(trackGain(TRACK_TARGET_RMS)).toBeCloseTo(1);
    expect(trackGain(0.3)).toBeLessThan(0.3);
    expect(trackGain(0.3)).toBeGreaterThanOrEqual(0.15);
    expect(trackGain(0.02)).toBeGreaterThan(1);
    expect(trackGain(0.001)).toBe(3);
    expect(trackGain(0)).toBe(1);
    expect(trackGain(Number.NaN)).toBe(1);
  });

  it('gives tracks song ids the settings can switch off, and leaves room for ten', () => {
    expect(trackSongId('abc')).toBe('track:abc');
    expect(MAX_TRACKS).toBe(10);
  });
});
