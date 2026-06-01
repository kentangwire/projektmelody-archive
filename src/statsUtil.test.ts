import { describe, expect, test } from 'vitest';
import { emptyStats, ensureVideo, parseVideoId, publicVideoRow, summarizeStats } from '../functions/statsUtil.js';

describe('statsUtil', () => {
  test('parseVideoId accepts catalog slugs', () => {
    expect(parseVideoId('mouth-action-2026-05-30')).toBe('mouth-action-2026-05-30');
    expect(parseVideoId('../bad')).toBe('');
  });

  test('ensureVideo initializes counters', () => {
    const stats = emptyStats();
    const row = ensureVideo(stats, 'v1');
    row.views = 2;
    row.likes = 1;
    row.tags = { Gamer: 3 };
    expect(summarizeStats(stats).totalViews).toBe(2);
    expect(publicVideoRow(row).tags.Gamer).toBe(3);
    expect(publicVideoRow(row).tagVoters).toBeUndefined();
  });
});
