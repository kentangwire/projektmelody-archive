#!/usr/bin/env node
/**
 * Local full-site preview: static files + Cloudflare Pages Functions.
 * Edit index.html → auto-sync to public/ → refresh browser.
 */
import { spawn, execSync } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = String(process.env.PORT || '8788');
const host = process.env.HOST || '127.0.0.1';

function sync() {
  execSync('node scripts/sync-public.mjs', { cwd: root, stdio: 'pipe' });
}

function banner() {
  console.log('');
  console.log('  Local site (Pages + Functions)');
  console.log(`  → http://${host}:${port}`);
  console.log('  Edit index.html — changes copy to public/ on save');
  console.log('  Refresh the browser to see layout updates');
  console.log('  Optional: copy .dev.vars.example → .dev.vars for Neon API');
  console.log('');
}

sync();
banner();

let debounce;
function scheduleSync(label) {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    process.stdout.write(`[dev] sync (${label})…\n`);
    sync();
  }, 180);
}

for (const file of ['index.html', 'videos.json']) {
  const full = path.join(root, file);
  watch(full, () => scheduleSync(file));
}

const child = spawn(
  'npx',
  ['wrangler', 'pages', 'dev', 'public', '--port', port, '--ip', host],
  { cwd: root, stdio: 'inherit', shell: true }
);

child.on('exit', (code) => process.exit(code ?? 1));

function shutdown() {
  child.kill('SIGINT');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
