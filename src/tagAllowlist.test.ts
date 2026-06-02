import { describe, expect, test } from 'vitest';
import { normalizeTag, TAG_ALLOWLIST } from '../functions/tagAllowlist.js';

describe('tagAllowlist', () => {
  test('includes dataset tags', () => {
    expect(TAG_ALLOWLIST.has('Squirt Mode')).toBe(true);
    expect(TAG_ALLOWLIST.has('Auto-Pilot (Hands-Free)')).toBe(true);
  });

  test('normalizeTag rejects unknown tags', () => {
    expect(normalizeTag('#Squirt Mode')).toBe('Squirt Mode');
    expect(normalizeTag('Lovense 100% Intensity')).toBe('Lovense 100% Intensity');
    expect(normalizeTag('NotARealTag')).toBe('');
    expect(normalizeTag('')).toBe('');
  });
});
