import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

describe('frontend uses API', () => {
  test('public/index.html loads catalog from videos.json', () => {
    const html = read('public/index.html');

    expect(html).toContain('./videos.json');
    expect(html).toContain('videos.json must be an array');
  });

  test('frontend includes timestamp UI hooks', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="tsList"');
    expect(html).toContain('id="tsForm"');
    expect(html).toContain('id="tsTime"');
    expect(html).toContain('id="tsDesc"');
    expect(html).toContain('/api/videos/');
    expect(html).toContain('id="qualityBtn"');
    expect(html).toContain('id="qualityMenu"');
    expect(html).toContain("pm_quality");
  });

  test('frontend includes rebuilt player UI hooks', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="playerOverlay"');
    expect(html).toContain('id="playerCenterPlay"');
    expect(html).toContain('id="playerSeek"');
    expect(html).toContain('id="playerTime"');
    expect(html).toContain('id="playerFullscreenBtn"');
    expect(html).toContain('id="playerPipBtn"');
    expect(html).toContain('pm_resume:');
  });
});
