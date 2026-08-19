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
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const APP_DIR = path.join(process.cwd(), 'app');

/**
 * The navy of the crest's outer ring, sampled from the artwork itself.
 *
 * Used as the full-bleed ground for the icons that need one. The ring then
 * disappears into that ground and what reads at launcher size is the gold disc
 * and its emblem — which is the strongest, most recognisable part of the mark.
 * The alternative, white, keeps the ring visible but goes soft against the pale
 * backgrounds most launchers use.
 */
export const BRAND = '#232570';

/**
 * The crest, squared up.
 *
 * The source is a circular crest on an opaque white card, and it is not quite
 * centred: measuring the non-white pixels gives x 7–494 against y 1–495. These
 * numbers are that measurement, not a guess — a centred crop would shave one
 * edge of the ring.
 */
const CROP = { left: 3, top: 0, width: 495, height: 495 };

/**
 * The mask is drawn a whisker inside the frame.
 *
 * The crest was saved as JPEG, so its edge is anti-aliased against the white
 * card behind it. A mask cut exactly at the circumference keeps that pale
 * fringe, which shows up as a dirty halo on any dark background. Cutting just
 * inside removes it; the sliver of ring lost is invisible at every size used.
 */
const INSET_RATIO = 0.012;

function circleMask(size) {
  const inset = Math.max(1, Math.round(size * INSET_RATIO));
  const r = size / 2 - inset;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#fff"/>` +
      `</svg>`
  );
}

/** The crest at `size` px, circular, everything outside it transparent. */
async function crest(size) {
  const squared = await sharp(SOURCE)
    .extract(CROP)
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp(squared)
    .composite([{ input: circleMask(size), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/** Full-bleed brand navy behind the crest, scaled to `scale` of the canvas. */
async function onBrand(size, scale) {
  const inner = Math.round(size * scale);
  const offset = Math.round((size - inner) / 2);

  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: await crest(inner), left: offset, top: offset }])
    .png()
    .toBuffer();
}

const targets = [
  // The logo the app itself shows, in the navbar and above the sign-in form.
  // Transparent outside the circle so it sits correctly on both the dark
  // sign-in page and the white navbar. 320 px, not 512: it is displayed at
  // 84 px at most, so a 3x screen asks for 252 — this clears that with headroom
  // instead of landing 4 px short of it, and the sign-in page loads this file
  // with `priority` so the weight is not free.
  { dir: PUBLIC_DIR, file: 'brand-logo.png', render: () => crest(320) },

  // Transparent outside the crest: browsers and launchers place these on their
  // own background.
  { dir: ICON_DIR, file: 'icon-192.png', render: () => crest(192) },
  { dir: ICON_DIR, file: 'icon-512.png', render: () => crest(512) },

  // Android crops maskable icons to the launcher shape, so the artwork stays
  // inside the safe zone (the middle 80%) with brand navy running to the edges.
  { dir: ICON_DIR, file: 'icon-maskable-192.png', render: () => onBrand(192, 0.8) },
  { dir: ICON_DIR, file: 'icon-maskable-512.png', render: () => onBrand(512, 0.8) },

  // iOS composites transparency onto black and applies its own mask, so this
  // one is filled edge to edge instead.
  { dir: ICON_DIR, file: 'apple-touch-icon.png', render: () => onBrand(180, 0.92) },

  // Picked up by Next as the favicon. Filled rather than transparent: at 32 px
  // a transparent crest on a browser's own dark tab strip loses its ring.
  { dir: APP_DIR, file: 'icon.png', render: () => onBrand(32, 0.94) },
];

await mkdir(ICON_DIR, { recursive: true });

/**
 * Palette-encoded, not 24-bit.
 *
 * The crest is flat colour — navy, gold, white — but it arrived as a JPEG, so
 * every region carries compression noise that a lossless 24-bit PNG then
 * preserves faithfully and expensively: the 512 px render came to 372 KB, a
 * file the sign-in page loads with `priority` and therefore blocks on.
 * Quantising to a palette throws away noise nobody can see and takes it under
 * 40 KB. Anything genuinely photographic would be the wrong candidate for this.
 */
for (const { dir, file, render } of targets) {
  await sharp(await render())
    .png({ palette: true, quality: 90, effort: 9 })
    .toFile(path.join(dir, file));
  console.log(`generated ${path.relative(process.cwd(), path.join(dir, file))}`);
}
