import { parseSessionId } from './presenceUtil.js';

export const VISITORS_KEY = 'site/visitors-daily.json';
export const VISITORS_MAX_SESSIONS = 20000;

export function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function emptyDailyVisitors(day = utcDayKey()) {
  return { version: 1, day, count: 0, sessions: {}, updatedAt: null };
}

export function rollDailyVisitors(data, now = new Date()) {
  const day = utcDayKey(now);
  if (!data || typeof data !== 'object' || data.day !== day) {
    return emptyDailyVisitors(day);
  }
  if (!data.sessions || typeof data.sessions !== 'object') data.sessions = {};
  data.count = Object.keys(data.sessions).length;
  return data;
}

export function recordVisitor(data, sid, now = new Date()) {
  const id = parseSessionId(sid);
  const rolled = rollDailyVisitors(data, now);
  if (!id) return rolled;

  if (!rolled.sessions[id]) {
    rolled.sessions[id] = 1;
    const keys = Object.keys(rolled.sessions);
    if (keys.length > VISITORS_MAX_SESSIONS) {
      keys.sort();
      for (let i = 0; i < keys.length - VISITORS_MAX_SESSIONS; i += 1) {
        delete rolled.sessions[keys[i]];
      }
    }
    rolled.count = Object.keys(rolled.sessions).length;
  }

  rolled.updatedAt = new Date(now).toISOString();
  return rolled;
}

export function visitorsTodayCount(data, now = new Date()) {
  return rollDailyVisitors(data, now).count;
}

export async function readDailyVisitors(bucket) {
  if (!bucket) return emptyDailyVisitors();
  try {
    const obj = await bucket.get(VISITORS_KEY);
    if (!obj) return emptyDailyVisitors();
    const data = JSON.parse(await obj.text());
    return rollDailyVisitors(data);
  } catch {
    return emptyDailyVisitors();
  }
}

export async function writeDailyVisitors(bucket, data) {
  if (!bucket) return false;
  const rolled = rollDailyVisitors(data);
  rolled.updatedAt = new Date().toISOString();
  await bucket.put(VISITORS_KEY, JSON.stringify(rolled), {
    httpMetadata: { contentType: 'application/json' }
  });
  return true;
}
