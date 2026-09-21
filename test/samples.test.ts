import { describe, expect, it } from 'vitest';
import { SAMPLE_NAMES, SAMPLE_URLS } from '../src/engine/samples';

describe('recordings in src/lyde', () => {
  it('include the dog and the elephant', () => {
    expect(Object.keys(SAMPLE_URLS)).toEqual(expect.arrayContaining(['hund', 'elefant']));
  });

  it('only use file names the app listens for', () => {
    for (const name of Object.keys(SAMPLE_URLS)) {
      expect(Object.keys(SAMPLE_NAMES), `src/lyde/${name} matches no sound; see src/lyde/README.md`).toContain(name);
    }
  });
});
