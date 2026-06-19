import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

describe('frontend uses API', () => {
  test('public/index.html mirrors index.html', () => {
    expect(read('public/index.html')).toBe(read('index.html'));
  });

  test('public/index.html loads catalog from API', () => {
    const html = read('public/index.html');

    expect(html).toContain('/api/catalog');
    expect(html).toContain('videos.json must be an array');
  });

  test('frontend includes NSFW age gate before site content', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="ageGate"');
    expect(html).toContain('id="ageGateEnter"');
    expect(html).toContain('id="ageGateLeave"');
    expect(html).toContain('pm_age_verified');
    expect(html).toContain('function pmInitAgeGate');
    expect(html).toContain('function pmStartApp');
    expect(html).toContain('html.age-verified .age-gate');
  });

  test('site redirects www to apex and declares canonical URL', () => {
    expect(read('public/_redirects')).toContain('www.projektmelody.cc');
    expect(read('public/_redirects')).toContain('https://projektmelody.cc/');
    expect(read('public/index.html')).toContain('rel="canonical" href="https://projektmelody.cc/"');
    expect(read('public/index.html')).toContain("location.hostname === 'www.projektmelody.cc'");
    expect(read('public/index.html')).toContain('rel="sitemap"');
    expect(read('public/robots.txt')).toContain('Sitemap: https://projektmelody.cc/sitemap.xml');
    expect(read('public/sitemap.xml')).toContain('<loc>https://projektmelody.cc/vod/');
    expect(read('functions/_middleware.js')).toContain('serveSitemap');
  });

  test('catalog loads from no-cache API route', () => {
    const html = read('public/index.html');

    expect(html).toContain('/api/catalog');
    expect(html).toContain('function pmCatalogFetchUrl');
    expect(html).toContain('function reloadCatalogFromNetwork');
  });

  test('catalog fetch bypasses browser cache', () => {
    const html = read('public/index.html');

    expect(html).toContain('function pmCatalogFetchUrl');
    expect(html).toContain("return '/api/catalog?_=' + Date.now()");
    expect(html).toContain('cache: \'no-store\'');
    expect(html).toContain('function reloadCatalogFromNetwork');
  });

  test('frontend includes site thumbnail and social meta', () => {
    const html = read('public/index.html');

    expect(html).toContain('meta name="description"');
    expect(html).toContain('/assets/og-image.png');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('https://projektmelody.cc/assets/og-image.png');
    expect(html).toContain('name="twitter:image"');
  });

  test('landing page copy is not placeholder', () => {
    const html = read('public/index.html');

    expect(html).not.toContain('Placeholder design demo');
    expect(html).not.toContain('all content is fictional');
    expect(html).not.toContain('Est. 2019');
    expect(html).not.toContain('definitive archive');
  });

  test('catalog durations are populated', () => {
    const json = read('public/catalog-source.json');
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

  test('frontend includes NSFW closed captions', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="vpCc"');
    expect(html).toContain('id="ccBtn"');
    expect(html).toContain('id="ccChk"');
    expect(html).toContain('NSFW CC');
    expect(html).toContain('function vpToggleCc');
    expect(html).toContain('function vpCcLoadForVideo');
    expect(html).toContain('function vpCcGenerateFromVideo');
    expect(html).toContain('function vpCcCaptureSegment');
    expect(html).toContain('id="ccGenBtn"');
    expect(html).toContain('PM_CC_SEGMENT_SEC');
    expect(html).toContain('pm_cc_cache');
    expect(html).toContain('/nsfw.vtt');
  });

  test('TrafficStars slots and preroll skip are wired', () => {
    const html = read('public/index.html');

    expect(html).toContain('const PM_TRAFFICSTARS');
    expect(html).toContain('cdn.tsyndicate.com/sdk/v1/p.js');
    expect(html).toContain('tsyndicate.com/iframes2/');
    expect(html).toContain('id="tsHeaderSlot"');
    expect(html).toContain('id="tsFooterSlot"');
    expect(html).toContain('id="tsModalSlot"');
    expect(html).toContain('id="tsPrerollSlot"');
    expect(html).toContain('id="skipAdBtn"');
    expect(html).toContain('id="vpResumePrompt"');
    expect(html).toContain('id="vpUpNext"');
    expect(html).toContain('id="autoplayNextChk"');
    expect(html).toContain('function vpShouldOfferResume');
    expect(html).toContain('function vpPlayNextVideo');
    expect(html).toContain('xplayer-ads.js');
    expect(html).toContain("mode: 'vast'");
    expect(html).toContain('const PM_JUICYADS');
    expect(html).toContain('poweredby.jads.co/js/jads.js');
    expect(html).toContain('1119238');
    expect(html).toContain('name="admaven-placement" content="BqjY8qdw8"');
    expect(html).not.toContain('juicyads-site-verification');
    expect(html).not.toContain('PM_EXOCLICK');
    expect(html).not.toContain('a.magsrv.com/ad-provider.js');
    expect(html).toContain('id="video"');
    expect(html).not.toContain("getElementById('modalVideo')");
  });

  test('HLS uses native playback on iOS only and hls.js elsewhere', () => {
    const html = read('public/index.html');

    expect(html).toContain('function shouldUseNativeHls');
    expect(html).toContain('return vpIsIOS() && canNativeHls');
    expect(html).toContain('function createHlsInstance');
    expect(html).toContain('lowLatencyMode: false');
    expect(html).toContain('x5-playsinline');
    expect(html).toContain('function vpPlayWhenReady');
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
    expect(html).toContain('function pmSeoVideoPath');
    expect(html).toContain('u.pathname = pmSeoVideoPath(id)');
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
    expect(html).toContain('>Visitors today</span>');
    expect(html).toContain('id="heroTotalViewsNum"');
    expect(html).toContain('>Total views</span>');
    expect(html).toContain('visitorsToday');
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
    expect(html).toContain('id="kofiFooter"');
    expect(html).toContain('function renderKofi');
    expect(html).toContain('ko-fi.com/widgets/widget_2.js');
    expect(html).toContain('https://ko-fi.com/frds');
    expect(html).toContain('id="archiveSearchAnchor"');
    expect(html).toContain('function pmLayoutHeaderSearch');
    expect(html).toContain('grid-template-columns: minmax(4.8rem, auto) minmax(4.8rem, auto)');
    expect(html).toContain("matchMedia('(max-width: 900px)')");
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
    expect(html).toContain('id="aboutLegal"');
    expect(html).toContain('not affiliated with, endorsed by');
    expect(html).toContain('Watch live on Twitch');
  });

  test('player includes community comments UI', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="watcherComments"');
    expect(html).toContain('id="commentsBtn"');
    expect(html).toContain('id="wcsDrawer"');
    expect(html).toContain('class="wcs-drawer"');
    expect(html).toContain('id="wcsCommentInput"');
    expect(html).toContain('class="wcs-row"');
    expect(html).toContain('Your name (required)');
    expect(html).toContain('function vpCsOpenDrawer');
    expect(html).toContain('function refreshComments');
    expect(html).toContain('function renderComments');
    expect(html).toContain('function vpCsStartReply');
    expect(html).toContain('/comments');
  });

  test('comments support clickable time marks in player', () => {
    const html = read('public/index.html');

    expect(html).not.toContain('id="watcherTimestamps"');
    expect(html).not.toContain('class="wts-panel"');
    expect(html).toContain('id="wcsAtTimeBtn"');
    expect(html).toContain('▶ Mark time');
    expect(html).toContain('function vpCsOpenDrawer');
    expect(html).toContain('function vpCsRenderProgressMarkers');
    expect(html).toContain('id="progressChapters"');
    expect(html).toContain('function vpTsSeek');
    expect(html).toContain('data-cs-time');
    expect(html).toContain('timeInSec');
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

  test('touch player layout includes foldable viewport detection', () => {
    const html = read('public/index.html');

    expect(html).toContain('PM_TOUCH_PLAYER_MQ');
    expect(html).toContain('pm-touch-player');
    expect(html).toContain('pmBindViewportListeners');
    expect(html).toContain('visualViewport');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toMatch(/max-width: 900px\) and \(hover: hover\)/);
  });

  test('catalog thumbnails generate from middle HLS segment', () => {
    const html = read('public/index.html');

    expect(html).toContain('pm-thumbs-v2');
    expect(html).toContain('function pmThumbPickSeekSec');
    expect(html).toContain('return Math.max(4, dur / 2)');
    expect(html).toContain('function pmGenThumbFromHls');
    expect(html).toContain('function pmHlsPrepareMidSegmentLoad');
    expect(html).toContain('pmBuildSegmentPlaylist(seg)');
    expect(html).toContain('function pmEnsureThumbForId');
  });

  test('grid cards play sped-up mid-video hover preview on desktop', () => {
    const html = read('public/index.html');

    expect(html).toContain('class="vc-preview"');
    expect(html).toContain('function pmHoverPreviewStart');
    expect(html).toContain('function pmHoverPreviewTargets');
    expect(html).toContain('function pmBindHoverPreview');
    expect(html).toContain('function pmHoverPreviewSupported');
    expect(html).toContain('function pmHoverPreviewRate');
    expect(html).not.toMatch(/prefers-reduced-motion: reduce\)\)\s*return false/);
    expect(html).toContain('pmBindHoverPreview(card, v)');
    expect(html).toContain('pmBindHoverPreview(root, top)');
    expect(html).toContain('pmBindHoverPreview(row, v)');
    expect(html).toContain('.featured-video.previewing .vc-preview');
    expect(html).toContain('.si-thumb.previewing .vc-preview');
  });

  test('desktop modal uses wide layout with sidebar', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="modalSide"');
    expect(html).toContain('class="modal-layout-a modal-side"');
    expect(html).toContain('class="modal-col-main"');
    expect(html).toContain('class="modal-col-side"');
    expect(html).toContain('id="vpdSideRec"');
    expect(html).toContain('function isDesktop');
    expect(html).toContain('function refreshModalCommunity');
    expect(html).toContain('@media (min-width: 901px)');
    expect(html).not.toMatch(/\.modal\.modal-has-detail[\s\S]{0,80}max-width:\s*420px/);
  });

  test('header shows users currently online via presence API', () => {
    const html = read('public/index.html');

    expect(html).toContain('id="headerOnline"');
    expect(html).toContain('id="headerOnlineCount"');
    expect(html).toContain('class="header-online-dot"');
    expect(html).toContain('/api/presence');
    expect(html).toContain('function startPmPresence');
    expect(html).toContain('function pmPresenceHeartbeat');
    expect(html).toContain('function pmUuid');
  });

  test('hero shows daily site visitors from presence API', () => {
    const html = read('index.html');

    expect(html).toContain('id="heroVisitorsTodayNum"');
    expect(html).toContain('Visitors today');
    expect(html).toContain('visitorsToday');
    expect(html).toContain('visitorsDay');
  });

  test('SEO includes structured data, crawl links, and dynamic meta helpers', () => {
    const html = read('public/index.html');

    expect(html).toContain('"@type": "WebSite"');
    expect(html).toContain('SearchAction');
    expect(html).toContain('"@type": "CollectionPage"');
    expect(html).toContain('id="seoCatalog"');
    expect(html).toContain('function pmSeoApply');
    expect(html).toContain('function pmSeoApplyVideo');
    expect(html).toContain('function pmSeoRenderCatalogLinks');
    expect(html).toContain('function pmSeoVideoPath');
    expect(html).toContain('function pmSeoDeepVideoId');
    expect(html).toContain('href="/vods"');
    expect(html).toContain('Projekt Melody VOD Archive');
    expect(html).toContain('max-image-preview:large');
  });

  test('recent streams can optionally show Fansly link in video description', () => {
    const html = read('index.html');

    expect(html).toContain('FANSLY_DEFAULT_URL');
    expect(html).toContain('https://fansly.com/projektmelody');
    expect(html).toContain('function getFanslyUrl');
    expect(html).toContain('function vpDetailRenderFansly');
    expect(html).toContain('id="vpdFanslyLink"');
    expect(html).toContain('/assets/fansly-icon.svg');
    expect(html).toContain('fanslyUrl');
    expect(html).toContain('fanslyRedirect');
    expect(html).not.toContain('function openVideoEntry');
  });
});
