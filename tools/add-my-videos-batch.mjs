import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const folders = [
  'projektmelody_2020-06-27_00-07-12',
  'projektmelody_2020-06-27_00-35-12',
  'projektmelody_2020-06-28_00-10-03',
  'projektmelody_2020-07-04_23-53-50',
  'projektmelody_2020-07-06_19-57-12',
  'projektmelody_2020-07-06_21-55-12',
  'projektmelody_2020-07-07_20-57-56',
  'projektmelody_2020-07-07_23-15-57',
  'projektmelody_2020-07-10_23-56-24',
  'projektmelody_2020-07-15_00-23-33',
  'projektmelody_2020-07-18_01-11-56',
  'projektmelody_2020-07-24_23-57-38',
  'projektmelody_2020-07-29_19-57-47',
  'projektmelody_2020-07-31_23-55-24',
  'projektmelody_2020-08-01_00-21-24',
  'projektmelody_2020-08-05_19-47-13',
  'projektmelody_2020-08-05_21-53-13',
  'projektmelody_2020-08-11_22-58-03',
  'projektmelody_2020-08-14_22-24-20',
  'projektmelody_2020-08-19_20-56-38',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'videos.json');
const publicCatalogPath = join(root, 'public', 'catalog-source.json');
const base = 'https://projektmelody.cc/videos/my-videos/';

async function fetchText(u) {
  const r = await fetch(u, { headers: { 'cache-control': 'no-store' } });
  if (!r.ok) throw new Error(String(r.status));
  const text = await r.text();
  if (!text.includes('#EXTM3U')) throw new Error('not-hls');
  return text;
}

function pickVariant(master, baseUrl) {
  const lines = String(master).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  let best = null;
  let bestBw = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
    const attrsStr = lines[i].split(':').slice(1).join(':');
    const bw = Number((attrsStr.match(/BANDWIDTH=(\d+)/) || [])[1] || 0);
    const uri = lines[i + 1];
    if (!uri || uri.startsWith('#')) continue;
    if (bw > bestBw) {
      bestBw = bw;
      best = new URL(uri, baseUrl).toString();
    }
  }
  return best;
}

function sumExtinf(txt) {
  let sum = 0;
  let endlist = false;
  for (const line of String(txt).split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('#EXTINF:')) {
      const v = parseFloat(t.slice(8));
      if (Number.isFinite(v) && v > 0) sum += v;
    } else if (t === '#EXT-X-ENDLIST') {
      endlist = true;
    }
  }
  return { sum: Math.round(sum), endlist };
}

async function hlsDurationSeconds(url) {
  const txt = await fetchText(url);
  if (txt.includes('#EXT-X-STREAM-INF')) {
    const variant = pickVariant(txt, url);
    if (!variant) throw new Error('no-variant');
    return hlsDurationSeconds(variant);
  }
  const r = sumExtinf(txt);
  if (!r.endlist) return null;
  return r.sum;
}

function folderToId(folder) {
  return folder.replace(/_/g, '-');
}

function folderToDate(folder) {
  const m = folder.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '2020-01-01';
}

function makeEntry(folder, duration, ready) {
  return {
    id: folderToId(folder),
    title: folder,
    date: folderToDate(folder),
    duration: duration || 0,
    views: 0,
    tags: ['Stream'],
    pinned: false,
    ready,
    thumbClass: 't1',
    monogram: 'PM',
    hlsSrc: `/videos/my-videos/${folder}/master.m3u8`,
  };
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const byId = new Map(catalog.map((v) => [String(v.id), v]));
const byFolder = new Map(
  catalog
    .filter((v) => String(v.hlsSrc || '').includes('/my-videos/'))
    .map((v) => {
      const m = String(v.hlsSrc).match(/my-videos\/([^/]+)\//);
      return [m?.[1], v];
    })
);

let added = 0;
let updated = 0;

for (const folder of folders) {
  const url = `${base}${folder}/master.m3u8`;
  let duration = 0;
  let ready = false;
  try {
    const dur = await hlsDurationSeconds(url);
    if (dur != null) {
      duration = dur;
      ready = true;
      process.stdout.write(`OK\t${duration}\t${folder}\n`);
    } else {
      process.stdout.write(`LIVE\t—\t${folder}\n`);
    }
  } catch (e) {
    process.stdout.write(`MISS\t${e.message}\t${folder}\n`);
  }

  const id = folderToId(folder);
  const existing = byFolder.get(folder) || byId.get(id);
  if (existing) {
    let changed = false;
    if (existing.hlsSrc !== `/videos/my-videos/${folder}/master.m3u8`) {
      existing.hlsSrc = `/videos/my-videos/${folder}/master.m3u8`;
      changed = true;
    }
    if (ready && existing.ready !== true) {
      existing.ready = true;
      changed = true;
    }
    if (duration && existing.duration !== duration) {
      existing.duration = duration;
      changed = true;
    }
    if (changed) updated++;
    continue;
  }

  catalog.push(makeEntry(folder, duration, ready));
  added++;
}

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(publicCatalogPath, JSON.stringify(catalog, null, 2) + '\n');
process.stdout.write(`\nAdded ${added}, updated ${updated}, total ${catalog.length}\n`);
