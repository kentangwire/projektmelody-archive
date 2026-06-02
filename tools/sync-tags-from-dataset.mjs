import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'tag-dataset', 'projekt_melody_tags.txt');
const text = readFileSync(src, 'utf8');
const tags = text
  .split(/\r?\n/)
  .map((line) => {
    const m = line.match(/`([^`]+)`/);
    return m ? m[1].trim() : '';
  })
  .filter(Boolean);

if (!tags.length) {
  console.error('No tags parsed from', src);
  process.exit(1);
}

const payload = { version: 2, tags };
const json = JSON.stringify(payload, null, 2) + '\n';
writeFileSync(join(root, 'public', 'tags.json'), json, 'utf8');

const allowlist = `/** Allowed community tags (sync with public/tags.json). */
export const TAG_ALLOWLIST = new Set(${JSON.stringify(tags, null, 2)});

export function normalizeTag(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\\s+/g, ' ');
  if (!s || s.length > 64) return '';
  return TAG_ALLOWLIST.has(s) ? s : '';
}

export const MAX_TAGS_PER_USER = 8;

export function filterPublicTags(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const tags = {};
  for (const [name, count] of Object.entries(src)) {
    if (!TAG_ALLOWLIST.has(String(name))) continue;
    const n = Number(count) || 0;
    if (n > 0) tags[String(name)] = n;
  }
  return tags;
}
`;

writeFileSync(join(root, 'functions', 'tagAllowlist.js'), allowlist, 'utf8');
console.log(`Synced ${tags.length} tags → public/tags.json + functions/tagAllowlist.js`);
