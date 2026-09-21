import { describe, expect, it } from 'vitest';
import { BASE_THINGS } from '../src/activities/ord/logic';
import { VOICE_WORDS, photoVoiceKey } from '../src/engine/voices';

describe('the parents\' voices', () => {
  it('offers exactly the things of Titte-bøh og Ord plus the question, and nothing for the other games', () => {
    const keys = VOICE_WORDS.map((w) => w.key).sort();
    expect(keys).toEqual([...BASE_THINGS.map((t) => t.key), 'hvor-er'].sort());
  });

  it('keeps word keys unique and simple, and photo keys apart from them', () => {
    const keys = VOICE_WORDS.map((w) => w.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(photoVoiceKey('abc')).toBe('photo:abc');
    expect(keys).not.toContain(photoVoiceKey('abc'));
  });
});
