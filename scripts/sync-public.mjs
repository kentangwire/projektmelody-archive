import { copyFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

copyFileSync('index.html', 'public/index.html');

try {
  mkdirSync('public/assets', { recursive: true });
  copyFileSync('assets/og-image.png', 'public/assets/og-image.png');
} catch (err) {
  process.stderr.write(`og-image sync skipped: ${err instanceof Error ? err.message : err}\n`);
}

try {
  mkdirSync('public/vendor', { recursive: true });
  copyFileSync('node_modules/hls.js/dist/hls.min.js', 'public/vendor/hls.min.js');
} catch (err) {
  process.stderr.write(`hls.js vendor sync skipped: ${err instanceof Error ? err.message : err}\n`);
}

try {
  const root = readFileSync('videos.json', 'utf8');
  let pub = '';
  try { pub = readFileSync('public/catalog-source.json', 'utf8'); } catch {}
  if (root !== pub) {
    process.stderr.write('Syncing videos.json → public/catalog-source.json\n');
    copyFileSync('videos.json', 'public/catalog-source.json');
  }
  try {
    unlinkSync('public/videos.json');
    process.stderr.write('Removed legacy public/videos.json (catalog served via /api/catalog)\n');
  } catch {}
} catch (err) {
  process.stderr.write(`catalog sync skipped: ${err instanceof Error ? err.message : err}\n`);
}

try {
  execFileSync(process.execPath, ['scripts/generate-sitemap.mjs'], { stdio: 'inherit' });
} catch (err) {
  process.stderr.write(`sitemap generation skipped: ${err instanceof Error ? err.message : err}\n`);
}

process.stdout.write('public/ sync complete\n');
