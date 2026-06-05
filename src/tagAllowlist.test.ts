import { describe, expect, test } from 'vitest';
import { filterCatalogTags, isTagBlocked, normalizeTag, TAG_ALLOWLIST } from '../functions/tagAllowlist.js';

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

  test('blocks 2d and 3d tags', () => {
    expect(isTagBlocked('2d')).toBe(true);
    expect(isTagBlocked('3D')).toBe(true);
    expect(normalizeTag('2d')).toBe('');
    expect(normalizeTag('3D')).toBe('');
    expect(filterCatalogTags(['Stream', '2D', 'Gaming', '3d'])).toEqual(['Stream', 'Gaming']);
  });
});
