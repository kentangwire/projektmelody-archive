import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('SEO sitemap and robots', () => {
  test('robots.txt allows crawlers and points to sitemap', () => {
    const robots = readFileSync('public/robots.txt', 'utf8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://projektmelody.cc/sitemap.xml');
  });

  test('sitemap.xml lists home and video deep links', () => {
    const xml = readFileSync('public/sitemap.xml', 'utf8');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://projektmelody.cc/</loc>');
    expect(xml).not.toContain('#recent');
    expect(xml).toContain('<loc>https://projektmelody.cc/vods</loc>');
    expect(xml).toContain('<loc>https://projektmelody.cc/vod/mouth-action-2026-05-30</loc>');
  });
});
