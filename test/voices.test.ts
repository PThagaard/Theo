import { describe, expect, it } from 'vitest';
import { wordForVisitor } from '../src/activities/balloner/sounds';
import { VOICE_WORDS, photoVoiceKey } from '../src/engine/voices';
import type { VisitorKind } from '../src/activities/balloner/types';

describe('the parents\' voices', () => {
  it('has a word for every creature that can be touched, and none for the star or the storm itself', () => {
    const kinds: VisitorKind[] = ['dog', 'elephant', 'bird', 'butterfly', 'snail', 'tractor'];
    for (const kind of kinds) {
      const word = wordForVisitor(kind);
      expect(word, kind).not.toBeNull();
      expect(VOICE_WORDS.map((w) => w.key)).toContain(word);
    }
    expect(wordForVisitor('star')).toBeNull();
    expect(wordForVisitor('storm')).toBeNull();
  });

  it('keeps word keys unique and simple, and photo keys apart from them', () => {
    const keys = VOICE_WORDS.map((w) => w.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(photoVoiceKey('abc')).toBe('photo:abc');
    expect(keys).not.toContain(photoVoiceKey('abc'));
  });
});
