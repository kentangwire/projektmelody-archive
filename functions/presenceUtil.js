export const PRESENCE_KEY = 'site/presence.json';
export const PRESENCE_TTL_MS = 120000;
export const PRESENCE_MAX_SESSIONS = 500;

export function emptyPresence() {
  return { version: 1, updatedAt: null, sessions: {} };
}

export function parseSessionId(raw) {
  const sid = String(raw || '').trim();
  if (!sid || sid.length < 8 || sid.length > 64) return '';
  if (!/^[a-zA-Z0-9_-]+$/.test(sid)) return '';
  return sid;
}

export function prunePresence(data, now = Date.now()) {
  const sessions = data?.sessions && typeof data.sessions === 'object' ? data.sessions : {};
  const out = {};
  for (const [sid, ts] of Object.entries(sessions)) {
    if (!parseSessionId(sid)) continue;
    if (Number(ts) > now - PRESENCE_TTL_MS) out[sid] = Number(ts);
  }
  return { version: 1, updatedAt: new Date(now).toISOString(), sessions: out };
}

export function countOnline(data, now = Date.now()) {
  return Object.keys(prunePresence(data, now).sessions).length;
}

export function touchSession(data, sid, now = Date.now()) {
  const id = parseSessionId(sid);
  if (!id) return prunePresence(data, now);

  const pruned = prunePresence(data, now);
  pruned.sessions[id] = now;

  const keys = Object.keys(pruned.sessions);
  if (keys.length > PRESENCE_MAX_SESSIONS) {
    keys.sort((a, b) => pruned.sessions[a] - pruned.sessions[b]);
    for (let i = 0; i < keys.length - PRESENCE_MAX_SESSIONS; i += 1) {
      delete pruned.sessions[keys[i]];
    }
  }

  pruned.updatedAt = new Date(now).toISOString();
  return pruned;
}

export async function readPresence(bucket) {
  if (!bucket) return emptyPresence();
  try {
    const obj = await bucket.get(PRESENCE_KEY);
    if (!obj) return emptyPresence();
    const data = JSON.parse(await obj.text());
    if (!data || typeof data !== 'object') return emptyPresence();
    if (!data.sessions || typeof data.sessions !== 'object') data.sessions = {};
    return data;
  } catch {
    return emptyPresence();
  }
}

export async function writePresence(bucket, data) {
  if (!bucket) return false;
  await bucket.put(PRESENCE_KEY, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' }
  });
  return true;
}
