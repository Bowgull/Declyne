/**
 * Generates iOS splash screen PNGs for all current iPhone sizes.
 * Uses sharp from the pnpm store — run via: node scripts/gen-splash.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dir, '../public');
const brandDir = join(publicDir, 'brand');
const splashDir = join(publicDir, 'splash');

// Resolve sharp from pnpm store
let sharp;
try {
  sharp = require('sharp');
} catch {
  // Walk up to find it in pnpm store
  const storePath = join(__dir, '../../../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js');
  sharp = require(storePath);
}

mkdirSync(splashDir, { recursive: true });

// Portrait splash sizes for all modern iPhones.
// Format: [width, height, deviceWidth, deviceHeight, pixelRatio, label]
const SIZES = [
  [1290, 2796, 430, 932, 3, 'iphone-15-pro-max'],
  [1179, 2556, 393, 852, 3, 'iphone-15-pro'],
  [1284, 2778, 428, 926, 3, 'iphone-14-plus'],
  [1170, 2532, 390, 844, 3, 'iphone-14'],
  [1080, 2340, 360, 780, 3, 'iphone-13-mini'],
  [750,  1334, 375, 667, 2, 'iphone-se'],
];

const BG = { r: 13, g: 10, b: 16 }; // #0D0A10

const mascotPath = join(brandDir, 'mascot-head.png');
if (!existsSync(mascotPath)) {
  console.error('mascot-head.png not found at', mascotPath);
  process.exit(1);
}

for (const [w, h, dw, dh, dpr, label] of SIZES) {
  const logoSize = Math.round(w * 0.22); // ~22% of canvas width
  const outPath = join(splashDir, `${label}.png`);

  const logo = await sharp(mascotPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: w, height: h, channels: 4, background: { ...BG, alpha: 1 } },
  })
    .composite([{
      input: logo,
      left: Math.round((w - logoSize) / 2),
      top: Math.round((h - logoSize) / 2),
    }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`✓ ${label}.png  ${w}×${h}  (device: ${dw}×${dh} @${dpr}x)`);
}

console.log(`\nDone. ${SIZES.length} splash screens → public/splash/`);
