/**
 * Post-build step: bake the real asset list into the service worker.
 *
 * Without this the worker only caches the HTML shell, because on a first visit
 * it installs *after* the page has already fetched its scripts — so the app
 * would only survive going offline from the second visit onwards. Precaching
 * the content-hashed build output makes it work immediately after install.
 *
 * Also stamps a per-build id into CACHE_VERSION so a deploy invalidates the
 * previous caches instead of leaving clients on a stale mixture.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'out');
const SW_PATH = path.join(OUT_DIR, 'sw.js');

/** Everything a cold start needs, on top of the crawled build output. */
const EXTRA_URLS = ['/', '/index.html', '/manifest.webmanifest'];

/** Precaching these would waste space without helping the app boot. */
const SKIP_EXTENSIONS = new Set(['.map', '.txt']);

async function collectFiles(dir, baseUrl = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const url = `${baseUrl}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full, url));
    } else if (!SKIP_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(url);
    }
  }

  return files;
}

async function main() {
  try {
    await stat(SW_PATH);
  } catch {
    console.error(`[sw] ${SW_PATH} not found — did \`next build\` run?`);
    process.exit(1);
  }

  const staticDir = path.join(OUT_DIR, '_next', 'static');
  const iconsDir = path.join(OUT_DIR, 'icons');

  const staticUrls = await collectFiles(staticDir, '/_next/static').catch(() => []);
  const iconUrls = await collectFiles(iconsDir, '/icons').catch(() => []);

  const urls = Array.from(new Set([...EXTRA_URLS, ...staticUrls, ...iconUrls])).sort();

  // Hash the list itself: identical output means identical cache, so an
  // unchanged rebuild does not needlessly evict clients' caches.
  const buildId = createHash('sha1').update(urls.join('\n')).digest('hex').slice(0, 12);

  let source = await readFile(SW_PATH, 'utf8');

  if (!source.includes('__BUILD_ID__') || !source.includes('__PRECACHE_URLS__')) {
    console.error('[sw] markers missing — public/sw.js and this script are out of sync.');
    process.exit(1);
  }

  source = source.replace('__BUILD_ID__', buildId);
  source = source.replace(
    /const SHELL_URLS = .*\/\* __PRECACHE_URLS__ \*\//,
    `const SHELL_URLS = ${JSON.stringify(urls)};`
  );

  await writeFile(SW_PATH, source, 'utf8');
  console.log(`[sw] precached ${urls.length} files · build ${buildId}`);
}

await main();
