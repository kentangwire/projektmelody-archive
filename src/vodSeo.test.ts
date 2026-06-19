import { describe, expect, test } from 'vitest';
import {
  buildVideoPage,
  buildVodsListPage,
  escHtml,
  findVideo,
  isSeoBot,
  parseVideoId,
  videoDescription
} from '../functions/vodSeoUtil.js';

describe('vodSeoUtil', () => {
  test('parseVideoId accepts catalog slugs', () => {
    expect(parseVideoId('mouth-action-2026-05-30')).toBe('mouth-action-2026-05-30');
    expect(parseVideoId('../bad')).toBe('');
  });

  test('findVideo returns catalog row', () => {
    const catalog = [{ id: 'a', title: 'A', date: '2026-01-01', duration: 120, ready: true }];
    expect(findVideo(catalog, 'a')?.title).toBe('A');
    expect(findVideo(catalog, 'missing')).toBeNull();
  });

  test('buildVideoPage includes title and canonical vod path', () => {
    const html = buildVideoPage({
      id: 'mouth-action-2026-05-30',
      title: 'MOUTH ACTION',
      date: '2026-05-30',
      duration: 3406,
      tags: ['Stream'],
      ready: true
    });
    expect(html).toContain('MOUTH ACTION');
    expect(html).toContain('https://projektmelody.cc/vod/mouth-action-2026-05-30');
    expect(html).toContain('"@type":"VideoObject"');
    expect(html).toContain('Watch full stream');
  });

  test('buildVodsListPage lists archive index', () => {
    const html = buildVodsListPage([
      { id: 'a', title: 'Alpha', date: '2026-01-01', duration: 60, ready: true }
    ]);
    expect(html).toContain('Projekt Melody VOD archive');
    expect(html).toContain('/vod/a');
    expect(html).toContain('"@type":"ItemList"');
  });

  test('escHtml escapes markup', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
  });

  test('videoDescription mentions Projekt Melody', () => {
    expect(videoDescription({ title: 'Test', date: '2026-01-01', duration: 90, tags: ['Gaming'] })).toContain(
      'Projekt Melody'
    );
  });

  test('isSeoBot detects crawlers but not normal browsers', () => {
    expect(isSeoBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isSeoBot('facebookexternalhit/1.1')).toBe(true);
    expect(
      isSeoBot(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });
});
