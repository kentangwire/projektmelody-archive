import { describe, expect, test } from 'vitest';
import {
  countOnline,
  emptyPresence,
  parseSessionId,
  prunePresence,
  touchSession
} from '../functions/presenceUtil.js';

describe('presenceUtil', () => {
  test('parseSessionId accepts uuid-like ids', () => {
    expect(parseSessionId('abc12345-uuid')).toBe('abc12345-uuid');
    expect(parseSessionId('../bad')).toBe('');
    expect(parseSessionId('short')).toBe('');
  });

  test('prunePresence drops stale sessions', () => {
    const now = 1_000_000;
    const data = {
      version: 1,
      updatedAt: null,
      sessions: {
        'session-fresh-12345678': now - 30_000,
        'session-stale-12345678': now - 200_000
      }
    };
    const pruned = prunePresence(data, now);
    expect(Object.keys(pruned.sessions)).toEqual(['session-fresh-12345678']);
    expect(countOnline(data, now)).toBe(1);
  });

  test('touchSession updates and caps sessions', () => {
    let data = emptyPresence();
    data = touchSession(data, 'session-one-12345678', 1000);
    data = touchSession(data, 'session-two-12345678', 2000);
    expect(countOnline(data, 2000)).toBe(2);
  });
});
