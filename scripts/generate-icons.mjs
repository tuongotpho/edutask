/**
 * Regenerates the PWA icon set from a single SVG source.
 *
 *   node scripts/generate-icons.mjs
 *
 * The output PNGs are committed, so this only needs running when the brand
 * changes. `sharp` ships with Next.js, so there is no extra dependency.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

const BRAND = '#4f46e5';

/**
 * @param {number} size
 * @param {number} inset Fraction of the canvas left empty around the tile.
 *   Maskable icons get a generous inset so the launcher can crop to a circle
 *   without clipping the letter.
 */
function svg(size, inset) {
  const pad = Math.round(size * inset);
  const tile = size - pad * 2;
  const radius = Math.round(tile * 0.22);
  const fontSize = Math.round(tile * 0.58);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BRAND}"/>
  <rect x="${pad}" y="${pad}" width="${tile}" height="${tile}" rx="${radius}" fill="${BRAND}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        font-size="${fontSize}" font-weight="800" fill="#ffffff">E</text>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, inset: 0 },
  { file: 'icon-512.png', size: 512, inset: 0 },
  // Maskable icons are cropped by the launcher; keep the glyph inside the
  // safe zone (the middle 80%) so it is never cut off.
  { file: 'icon-maskable-192.png', size: 192, inset: 0.1 },
  { file: 'icon-maskable-512.png', size: 512, inset: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0 },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, size, inset } of targets) {
  await sharp(Buffer.from(svg(size, inset)))
    .png()
    .toFile(path.join(OUT_DIR, file));
  console.log(`generated ${file} (${size}x${size})`);
}
