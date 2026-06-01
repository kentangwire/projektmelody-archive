import { describe, expect, test } from 'vitest';
import { normalizeTag, TAG_ALLOWLIST } from '../functions/tagAllowlist.js';

describe('tagAllowlist', () => {
  test('includes dataset tags', () => {
    expect(TAG_ALLOWLIST.has('VTuber')).toBe(true);
    expect(TAG_ALLOWLIST.has('ProjektMelody')).toBe(true);
  });

  test('normalizeTag rejects unknown tags', () => {
    expect(normalizeTag('#Gamer')).toBe('Gamer');
    expect(normalizeTag('NotARealTag')).toBe('');
    expect(normalizeTag('')).toBe('');
  });
});
