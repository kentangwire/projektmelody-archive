import { describe, expect, it } from 'vitest';
import { r2LookupPlans } from '../functions/r2Resolve.js';

describe('r2LookupPlans', () => {
  it('routes my-videos URLs to R2_MY_VIDEOS with stripped key', () => {
    const plans = r2LookupPlans('my-videos/foo/master.m3u8');
    expect(plans[0]).toEqual({ binding: 'R2_MY_VIDEOS', key: 'foo/master.m3u8' });
  });

  it('routes recent-vods URLs to R2_RECENT_VODS with stripped key', () => {
    const plans = r2LookupPlans(
      'recent-vods/projektmelody-vods/video-2026-06-05T19-26-18.474Z/master.m3u8'
    );
    expect(plans[0]).toEqual({
      binding: 'R2_RECENT_VODS',
      key: 'projektmelody-vods/video-2026-06-05T19-26-18.474Z/master.m3u8',
    });
  });

  it('routes 20-vods URLs to R2_20_VODS with stripped key', () => {
    const plans = r2LookupPlans('20-vods/projektmelody_2020-08-21_23-58-06/master.m3u8');
    expect(plans[0]).toEqual({
      binding: 'R2_20_VODS',
      key: 'projektmelody_2020-08-21_23-58-06/master.m3u8',
    });
  });
});
