/**
 * Regenerates the whole icon set from a single source image.
 *
 *   node scripts/generate-icons.mjs
 *
 * The output PNGs are committed, so this only needs running when the brand
 * changes. `sharp` ships with Next.js, so there is no extra dependency.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SOURCE = path.join(process.cwd(), 'assets', 'icon-source.png');
const ICON_DIR = path.join(process.cwd(), 'public', 'icons');
const APP_DIR = path.join(process.cwd(), 'app');

export const BRAND = '#50b042';

/**
 * The source is a green rounded square centred on an opaque white card. Only
 * the square is wanted, so everything is cropped to it.
 */
const CROP = { left: 44, top: 44, width: 168, height: 168 };

/** Corner radius of the square in the source, as a fraction of its width. */
const RADIUS_RATIO = 0.125;

/**
 * The crop edge carries an anti-aliased white fringe from the card behind it.
 * Rendering slightly larger than the target and trimming back pushes that
 * fringe out of frame — without it the maskable icons show a white halo where
 * the rounded mask and the artwork's own corner fail to line up exactly.
 */
const BLEED_RATIO = 0.012;

function roundedMask(size) {
  const r = Math.round(size * RADIUS_RATIO);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/>` +
      `</svg>`
  );
}

/** The artwork at `size` px, corners rounded, everything outside transparent. */
async function tile(size) {
  const bleed = Math.max(1, Math.ceil(size * BLEED_RATIO));
  const oversized = size + bleed * 2;

  const trimmed = await sharp(SOURCE)
    .extract(CROP)
    .resize(oversized, oversized, { fit: 'fill' })
    .extract({ left: bleed, top: bleed, width: size, height: size })
    .png()
    .toBuffer();

  return sharp(trimmed)
    .composite([{ input: roundedMask(size), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/** Full-bleed brand green behind the artwork, scaled to `scale` of the canvas. */
async function onBrand(size, scale) {
  const inner = Math.round(size * scale);
  const offset = Math.round((size - inner) / 2);

  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: await tile(inner), left: offset, top: offset }])
    .png()
    .toBuffer();
}

const targets = [
  // Transparent outside the tile: browsers and launchers place these on their
  // own background.
  { dir: ICON_DIR, file: 'icon-192.png', render: () => tile(192) },
  { dir: ICON_DIR, file: 'icon-512.png', render: () => tile(512) },
  // Android crops maskable icons to the launcher shape, so the artwork stays
  // inside the safe zone (the middle 80%) with green running to the edges.
  { dir: ICON_DIR, file: 'icon-maskable-192.png', render: () => onBrand(192, 0.8) },
  { dir: ICON_DIR, file: 'icon-maskable-512.png', render: () => onBrand(512, 0.8) },
  // iOS composites transparency onto black and applies its own mask, so this
  // one is filled edge to edge instead.
  { dir: ICON_DIR, file: 'apple-touch-icon.png', render: () => onBrand(180, 1) },
  // Picked up by Next as the favicon.
  { dir: APP_DIR, file: 'icon.png', render: () => tile(32) },
];

await mkdir(ICON_DIR, { recursive: true });

for (const { dir, file, render } of targets) {
  await sharp(await render()).toFile(path.join(dir, file));
  console.log(`generated ${path.relative(process.cwd(), path.join(dir, file))}`);
}
