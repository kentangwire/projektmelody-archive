import { copyFileSync, readFileSync } from 'node:fs';

copyFileSync('index.html', 'public/index.html');

try {
  const root = readFileSync('videos.json', 'utf8');
  const pub = readFileSync('public/videos.json', 'utf8');
  if (root !== pub) {
    process.stderr.write('Syncing videos.json → public/videos.json\n');
    copyFileSync('videos.json', 'public/videos.json');
  }
} catch (err) {
  process.stderr.write(`videos.json sync skipped: ${err instanceof Error ? err.message : err}\n`);
}

process.stdout.write('public/ sync complete\n');
