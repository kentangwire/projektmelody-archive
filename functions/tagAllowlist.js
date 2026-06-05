/** Hidden from UI and rejected by the API (case-insensitive). */
export const TAG_BLOCKLIST = new Set(['2d', '3d']);

/** Allowed community tags (sync with public/tags.json). */
export const TAG_ALLOWLIST = new Set([
  "Squirt Mode",
  "Fluid Overflow",
  "The Great Flood",
  "Body Shaking Orgasm",
  "Infinite Orgasm Loop",
  "Ruined Climax",
  "Aggressive Rubbing",
  "Finger Action",
  "Two-Finger Deluxe",
  "Going Deep",
  "Backdoor Action",
  "Anal Toy Installed",
  "Hitting the Sweet Spot",
  "Suffering in 4K (Edging)",
  "Chat Remote Control",
  "Lovense 100% Intensity",
  "External Toy Play",
  "Internal Toy Play",
  "Dildo Action",
  "Auto-Pilot (Hands-Free)",
  "Down Bad Audio",
  "Heavy Panting",
  "Choking on Tokens",
  "Uncensored Moaning",
  "Pathetic Whimpering",
  "Begging Chat for Mercy",
  "Real World Mic Leak"
]);

export function isTagBlocked(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return !!key && TAG_BLOCKLIST.has(key);
}

export function normalizeTag(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ');
  if (!s || s.length > 64 || isTagBlocked(s)) return '';
  return TAG_ALLOWLIST.has(s) ? s : '';
}

export const MAX_TAGS_PER_USER = 8;

export function filterCatalogTags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(t => String(t || '').trim()).filter(t => t && !isTagBlocked(t));
}

export function filterPublicTags(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const tags = {};
  for (const [name, count] of Object.entries(src)) {
    if (isTagBlocked(name) || !TAG_ALLOWLIST.has(String(name))) continue;
    const n = Number(count) || 0;
    if (n > 0) tags[String(name)] = n;
  }
  return tags;
}
