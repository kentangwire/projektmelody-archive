import { describe, expect, test } from 'vitest';
import { buildImportPlan } from './importPlan';

describe('buildImportPlan', () => {
  test('builds absolute hlsMasterUrl and createdAt from date', () => {
    const plan = buildImportPlan(
      [
        {
          id: 'v1',
          title: 'T1',
          date: '2026-05-19',
          tags: ['Stream'],
          hlsSrc: '/videos/v1/master.m3u8'
        }
      ],
      { pagesOrigin: 'https://projektmelody.cc' }
    );

    expect(plan.videos).toEqual([
      {
        id: 'v1',
        title: 'T1',
        description: '',
        hlsMasterUrl: 'https://projektmelody.cc/videos/v1/master.m3u8',
        createdAtIso: '2026-05-19T00:00:00.000Z',
        tagNames: ['Stream']
      }
    ]);
  });

  test('de-dupes tag names across videos', () => {
    const plan = buildImportPlan(
      [
        { id: 'v1', title: 'T1', date: '2026-05-19', tags: ['Stream'], hlsSrc: '/videos/v1/master.m3u8' },
        { id: 'v2', title: 'T2', date: '2026-05-20', tags: ['Stream', 'Clip'], hlsSrc: '/videos/v2/master.m3u8' }
      ],
      { pagesOrigin: 'https://projektmelody.cc' }
    );

    expect(plan.tagNames.sort()).toEqual(['Clip', 'Stream']);
  });
});

