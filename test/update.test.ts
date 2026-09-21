import { describe, expect, it } from 'vitest';
import { isNewer } from '../src/update';

describe('isNewer', () => {
  it('compares version numbers part by part, not as text', () => {
    expect(isNewer('1.0.12', '1.0.9')).toBe(true);
    expect(isNewer('1.0.9', '1.0.12')).toBe(false);
    expect(isNewer('1.1.0', '1.0.99')).toBe(true);
    expect(isNewer('2.0', '1.9.9')).toBe(true);
  });

  it('treats the same version as not newer', () => {
    expect(isNewer('1.0.7', '1.0.7')).toBe(false);
    expect(isNewer('1.0', '1.0.0')).toBe(false);
  });

  it('copes with odd input', () => {
    expect(isNewer('', '1.0.3')).toBe(false);
    expect(isNewer('1.0.4', '?')).toBe(true);
    expect(isNewer(' 1.0.5 ', '1.0.4')).toBe(true);
  });
});
