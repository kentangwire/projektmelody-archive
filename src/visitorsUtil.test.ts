import { describe, expect, test } from 'vitest';
import {
  emptyDailyVisitors,
  recordVisitor,
  rollDailyVisitors,
  utcDayKey,
  visitorsTodayCount
} from '../functions/visitorsUtil.js';

describe('visitorsUtil', () => {
  test('utcDayKey uses ISO date', () => {
    expect(utcDayKey(new Date('2026-06-05T12:00:00Z'))).toBe('2026-06-05');
  });

  test('recordVisitor counts unique sessions per day', () => {
    let data = emptyDailyVisitors('2026-06-05');
    data = recordVisitor(data, 'session-abc-12345');
    data = recordVisitor(data, 'session-def-67890');
    data = recordVisitor(data, 'session-abc-12345');
    expect(visitorsTodayCount(data)).toBe(2);
  });

  test('rollDailyVisitors resets when UTC day changes', () => {
    const data = recordVisitor(
      emptyDailyVisitors('2026-06-04'),
      'session-abc-12345',
      new Date('2026-06-04T12:00:00Z')
    );
    const next = rollDailyVisitors(data, new Date('2026-06-05T01:00:00Z'));
    expect(next.day).toBe('2026-06-05');
    expect(visitorsTodayCount(next, new Date('2026-06-05T01:00:00Z'))).toBe(0);
  });
});
