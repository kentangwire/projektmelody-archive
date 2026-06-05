#!/usr/bin/env node
/**
 * Fast local preview for layout/CSS only (no Cloudflare Functions).
 * API calls (/api/stats, comments, etc.) will not work — use npm run dev for full stack.
 */
import http from 'node:http';
import fs, { watch as watchFile } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t'
};

function sync() {
  execSync('node scripts/sync-public.mjs', { cwd: root, stdio: 'pipe' });
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.normalize(path.join(publicDir, rel));
  if (!resolved.startsWith(publicDir)) return null;
  return resolved;
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

sync();

let debounce;
function scheduleSync(label) {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    process.stdout.write(`[layout] sync (${label})…\n`);
    sync();
  }, 180);
}

for (const file of ['index.html', 'videos.json']) {
  watchFile(path.join(root, file), () => scheduleSync(file));
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url || '/');
  if (!filePath) return send(res, 403, 'Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (filePath.endsWith('.html') || req.url === '/') {
        return fs.readFile(path.join(publicDir, 'index.html'), (e2, index) => {
          if (e2) return send(res, 404, 'Not found');
          send(res, 200, index, MIME['.html']);
        });
      }
      return send(res, 404, 'Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
});

server.listen(port, host, () => {
  console.log('');
  console.log('  Layout preview (static only)');
  console.log(`  → http://${host}:${port}`);
  console.log('  Edit index.html — auto-synced to public/ on save');
  console.log('  For API + video proxy locally, use: npm run dev');
  console.log('');
});
