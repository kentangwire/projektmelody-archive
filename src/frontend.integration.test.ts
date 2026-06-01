import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

describe('frontend uses API', () => {
  test('public/index.html mirrors index.html', () => {
    expect(read('public/index.html')).toBe(read('index.html'));
  });

  test('public/index.html loads catalog from videos.json', () => {
    const html = read('public/index.html');

    expect(html).toContain('./videos.json');
    expect(html).toContain('videos.json must be an array');
  });

  test('landing page copy is not placeholder', () => {
    const html = read('public/index.html');

    expect(html).not.toContain('Placeholder design demo');
    expect(html).not.toContain('all content is fictional');
    expect(html).not.toContain('Est. 2019');
    expect(html).not.toContain('definitive archive');
  });

  test('catalog durations are populated', () => {
    const json = read('public/videos.json');
    const data = JSON.parse(json) as Array<{ duration?: unknown; hlsSrc?: unknown }>;
    expect(Array.isArray(data)).toBe(true);
    for (const v of data) {
      const hasHls = typeof v?.hlsSrc === 'string' && v.hlsSrc.length > 0;
      if (!hasHls) continue;
      expect(typeof v.duration).toBe('number');
      expect(v.duration as number).toBeGreaterThan(0);
    }
  });

  test('frontend includes quality UI hooks', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="qualityBtn"');
    expect(html).toContain('id="qualityPanel"');
    expect(html).toContain("pm_quality");
  });

  test('frontend includes rebuilt player UI hooks', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="playerWrap"');
    expect(html).toContain('id="video"');
    expect(html).toContain('id="controls"');
    expect(html).toContain('id="progressTrack"');
    expect(html).toContain('id="qualityPanel"');
    expect(html).toContain('id="settingsPanel"');
    expect(html).toContain('id="fsBtn"');
    expect(html).toContain("getElementById('progressTrack')");
    expect(html).toContain('function loadStream');
    expect(html).toContain('webkitDisplayingFullscreen');
    expect(html).toContain("removeAttribute('playsinline')");
    expect(html).toContain('pm_resume:');
  });

  test('exiting fullscreen restores player controls', () => {
    const html = read('public/index.html');

    expect(html).toContain('vpForceControlsVisible');
    expect(html).toContain('webkitendfullscreen');
    expect(html).toContain('vpOnFsChange');
  });

  test('tapping video shows controls in fullscreen', () => {
    const html = read('public/index.html');

    expect(html).toContain('vpIsFs');
    expect(html).toContain('pointerdown');
    expect(html).toContain('vpForceControlsVisible');
  });

  test('frontend includes mobile video detail panel', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="vpDetail"');
    expect(html).toContain('id="vpdRec"');
    expect(html).toContain('function vpDetailRender');
    expect(html).toContain('getRecommendedVideos');
    expect(html).toContain("searchParams.set('v'");
  });

  test('mobile fullscreen uses single player handler', () => {
    const html = read('public/index.html');

    expect(html).toContain('function vpToggleFullscreen');
    expect(html).toContain('body.vp-player-fs');
    expect(html).not.toMatch(/getElementById\('fsBtn'\)\?\.addEventListener\('click'[\s\S]*?fullscreen\(\)/);
  });

  test('frontend loads live stats from API', () => {
    const html = read('public/index.html');

    expect(html).toContain("fetch('/api/stats'");
    expect(html).toContain('function fetchPmStats');
    expect(html).toContain('function recordVideoView');
    expect(html).toContain('data-pm-views-id');
    expect(html).toContain('>Views</span>');
    expect(html).not.toContain('vpDetailSeedCounts');
  });

  test('frontend includes community tag picker', () => {
    const html = read('public/index.html');

    expect(html).toContain("fetch('/tags.json'");
    expect(html).toContain('id="vpdTagPicker"');
    expect(html).toContain('function getDisplayTags');
    expect(html).toContain('function pmPostTag');
    expect(html).toContain('/tags');
  });

  test('navigation follows VOD archive IA sections', () => {
    const html = read('public/index.html');

    expect(html).toContain('data-nav="home"');
    expect(html).toContain('data-nav="recent"');
    expect(html).toContain('data-nav="categories"');
    expect(html).toContain('data-nav="clips"');
    expect(html).toContain('data-nav="about"');
    expect(html).toContain('All VODs / Home');
    expect(html).toContain('Recent Streams');
    expect(html).toContain('Categories / Games');
    expect(html).toContain('Highlights &amp; Clips');
    expect(html).toContain('function navigateToSection');
    expect(html).toContain('id="categoryBrowser"');
    expect(html).toContain('id="about"');
  });

  test('header uses stacked branding and toolbar row', () => {
    const html = read('public/index.html');

    expect(html).toContain('class="logo logo-brand"');
    expect(html).toContain('class="header-toolbar"');
    expect(html).toContain('class="search-wrap header-search"');
    expect(html).toContain('class="btn-primary header-login"');
    expect(html).toContain('id="kofiHeader" class="header-kofi"');
    expect(html).toContain('.header-toolbar {');
    expect(html).toContain('grid-template-columns: 1fr 1fr');
    expect(html).toMatch(/#kofiHeader[\s\S]{0,120}display:\s*none/);
  });

  test('about section includes streamer info and dynamic hooks', () => {
    const html = read('public/index.html');

    expect(html).toContain('class="about-hero-panel"');
    expect(html).toContain('id="aboutStreamsNum"');
    expect(html).toContain('id="aboutLatestTitle"');
    expect(html).toContain('id="aboutPlayLatestBtn"');
    expect(html).toContain('function updateAboutSection');
    expect(html).toContain('function playLatestVod');
    expect(html).toContain('about-channel-grid');
    expect(html).toContain('Watch live on Twitch');
  });

  test('player includes community comments UI', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="watcherComments"');
    expect(html).toContain('class="wcs-panel"');
    expect(html).toContain('function refreshComments');
    expect(html).toContain('function renderComments');
    expect(html).toContain('function vpCsStartReply');
    expect(html).toContain('/comments');
  });

  test('player includes community timestamps UI', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="watcherTimestamps"');
    expect(html).toContain('class="wts-panel"');
    expect(html).toContain('Watcher timestamps');
    expect(html).toContain('id="tsList"');
    expect(html).toContain('id="tsForm"');
    expect(html).toContain('id="tsNowBtn"');
    expect(html).toContain('id="progressChapters"');
    expect(html).toContain('function refreshTimestamps');
    expect(html).toContain('function vpTsSeek');
    expect(html).toContain('function vpTsShareUrl');
    expect(html).toContain('function vpTsPanelShow');
    expect(html).toContain('function vpTsRenderMarkers');
  });

  test('player includes seek bar hover preview', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="seekPreview"');
    expect(html).toContain('id="seekPreviewCanvas"');
    expect(html).toContain('id="seekPreviewVideo"');
    expect(html).toContain('function vpSeekPreviewMove');
    expect(html).toContain('function vpSeekPreviewConfigure');
    expect(html).toContain('function vpSeekPreviewCanCaptureFrames');
    expect(html).toContain('function vpSeekPreviewUseLiveVideo');
    expect(html).toContain('function vpSeekPreviewShowAt');
    expect(html).toContain('function vpSeekPreviewEnsureEngine');
    expect(html).toContain('function vpSeekPreviewTouchScrub');
    expect(html).toContain('function vpScrubSchedule');
    expect(html).toContain('function vpScrubSeekDuringDrag');
    expect(html).toContain('function vpIsTouchUi');
    expect(html).not.toMatch(/vpForceControlsVisible\(\)[\s\S]{0,120}vp\.isDragging = false/);
    expect(html).toContain('function pmParseM3u8Segments');
    expect(html).toContain('function pmBuildSegmentPlaylist');
    expect(html).toContain('function vpSeekPreviewSeekTo');
    expect(html).toContain('function vpSeekPreviewEnsurePreviewHls');
    expect(html).toContain('function vpSeekPreviewEnsureCatalog');
    expect(html).toContain('function vpScrubAttachDoc');
    expect(html).toContain('.modal-screen .player-video');
    expect(html).not.toContain('function vpSeekPreviewUseMainVideo');
    expect(html).not.toContain('vpSeekPreviewOnMainSeeked');
    expect(html).toContain("addEventListener('pointerdown'");
  });

  test('desktop modal uses wide layout with sidebar', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="modalSide"');
    expect(html).toContain('class="modal-side"');
    expect(html).toContain('function isDesktop');
    expect(html).toContain('function refreshModalCommunity');
    expect(html).toContain('@media (min-width: 901px)');
    expect(html).not.toMatch(/\.modal\.modal-has-detail[\s\S]{0,80}max-width:\s*420px/);
  });
});
