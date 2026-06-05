import {
  countOnline,
  parseSessionId,
  readPresence,
  touchSession,
  writePresence
} from '../presenceUtil.js';
import {
  readDailyVisitors,
  recordVisitor,
  utcDayKey,
  visitorsTodayCount,
  writeDailyVisitors
} from '../visitorsUtil.js';
import { json } from '../statsUtil.js';

function newSessionId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return 'pm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

function visitorPayload(data) {
  const rolled = data && typeof data === 'object' ? data : null;
  return {
    visitorsToday: visitorsTodayCount(rolled),
    visitorsDay: rolled?.day || utcDayKey()
  };
}

export async function onRequestGet({ env }) {
  const bucket = env.R2_VIDEOS;
  if (!bucket) return json({ ok: false, online: 0, visitorsToday: 0, visitorsDay: utcDayKey() });

  const visitors = await readDailyVisitors(bucket);
  return json({
    ok: true,
    online: countOnline(await readPresence(bucket)),
    ...visitorPayload(visitors)
  });
}

export async function onRequestPost({ request, env }) {
  const bucket = env.R2_VIDEOS;
  if (!bucket) return json({ ok: false, online: 0, visitorsToday: 0 }, 503);

  let sid = '';
  try {
    const body = await request.json();
    sid = parseSessionId(body?.sid);
  } catch {}

  if (!sid) sid = newSessionId();

  const presence = touchSession(await readPresence(bucket), sid);
  await writePresence(bucket, presence);

  const visitors = recordVisitor(await readDailyVisitors(bucket), sid);
  await writeDailyVisitors(bucket, visitors);

  return json({
    ok: true,
    online: countOnline(presence),
    sid,
    ...visitorPayload(visitors)
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400'
    }
  });
}
