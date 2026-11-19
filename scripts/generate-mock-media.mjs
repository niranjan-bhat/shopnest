// Generates the Phase 1 placeholder images in public/mock-media/, at the same
// R2-style keys the mock data stores. Run: npm run mock:media
//
// Node loads fixtures.ts directly (built-in TypeScript type stripping).
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  fixtureId,
  fixtureStores,
  MEDIA_SIZE,
  mediaKey,
} from '../src/mocks/fixtures.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'mock-media');

// --- colour helpers --------------------------------------------------------

const toRgb = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) =>
  `#${rgb
    .map((c) =>
      Math.round(Math.max(0, Math.min(255, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
/** Mixes `hex` towards `target` by `amount` (0..1). */
const mix = (hex, target, amount) => {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((c, i) => c + (b[i] - c) * amount));
};
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const inkOn = (hex) => (luminance(hex) > 0.35 ? '#1E1A16' : '#FBF8F3');

const escapeXml = (text) =>
  text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

// --- SVG pieces ----------------------------------------------------------------

/** A repeating woven motif (small diamonds and dots) in the accent colour. */
function motifPattern(id, accent, size, opacity) {
  const h = size / 2;
  return `
    <pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
      <path d="M${h} ${h * 0.45} L${h * 1.35} ${h} L${h} ${h * 1.55} L${h * 0.65} ${h} Z"
            fill="${accent}" opacity="${opacity}"/>
      <circle cx="0" cy="0" r="${size * 0.06}" fill="${accent}" opacity="${opacity}"/>
      <circle cx="${size}" cy="${size}" r="${size * 0.06}" fill="${accent}" opacity="${opacity}"/>
    </pattern>`;
}

/** Horizontal zari-style border bands. */
function borderBands(y, width, accent, scale) {
  return `
    <rect x="0" y="${y}" width="${width}" height="${10 * scale}" fill="${accent}" opacity="0.9"/>
    <rect x="0" y="${y + 18 * scale}" width="${width}" height="${44 * scale}" fill="url(#band)"/>
    <rect x="0" y="${y + 70 * scale}" width="${width}" height="${4 * scale}" fill="${accent}" opacity="0.9"/>`;
}

function label(text, x, y, size, colour, anchor = 'middle') {
  return `<text x="${x}" y="${y}" font-family="Georgia, 'Times New Roman', serif"
    font-size="${size}" fill="${colour}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
}

function productSvg({ name, swatch, accent, view }) {
  const { width: w, height: h } = MEDIA_SIZE.product;
  const ink = inkOn(swatch);
  const motifSize = view === 2 ? 150 : 70;
  const bandY = view === 3 ? h * 0.35 : h * 0.72;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${mix(swatch, '#ffffff', 0.12)}"/>
        <stop offset="1" stop-color="${mix(swatch, '#000000', 0.28)}"/>
      </linearGradient>
      ${motifPattern('motif', accent, motifSize, 0.22)}
      ${motifPattern('band', accent, 44, 0.75)}
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#motif)"/>
    ${borderBands(bandY, w, accent, view === 3 ? 2.2 : 1)}
    ${label(name, w / 2, h - 110, 40, ink)}
    ${label(`Placeholder · view ${view}`, w / 2, h - 62, 24, ink)}
  </svg>`;
}

function categorySvg({ swatch, accent }) {
  const { width: w, height: h } = MEDIA_SIZE.category;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <radialGradient id="bg" cx="0.3" cy="0.3" r="0.9">
        <stop offset="0" stop-color="${mix(swatch, '#ffffff', 0.18)}"/>
        <stop offset="1" stop-color="${mix(swatch, '#000000', 0.25)}"/>
      </radialGradient>
      ${motifPattern('motif', accent, 90, 0.25)}
      ${motifPattern('band', accent, 44, 0.75)}
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#motif)"/>
    ${borderBands(h * 0.78, w, accent, 1)}
  </svg>`;
}

function bannerSvg({ swatch, accent, shape }) {
  const { width: w, height: h } = MEDIA_SIZE[shape];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${mix(swatch, '#000000', 0.45)}"/>
        <stop offset="0.55" stop-color="${swatch}"/>
        <stop offset="1" stop-color="${mix(swatch, '#ffffff', 0.15)}"/>
      </linearGradient>
      ${motifPattern('motif', accent, 120, 0.28)}
      ${motifPattern('band', accent, 44, 0.75)}
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0.35" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#fff" stop-opacity="1"/>
      </linearGradient>
      <mask id="right"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#motif)" mask="url(#right)"/>
    <g transform="rotate(-90 ${w - 120} ${h / 2}) translate(${w - 120 - h / 2} ${h / 2 - 37})">
      ${borderBands(0, h, accent, 1)}
    </g>
  </svg>`;
}

// --- generation ----------------------------------------------------------------

async function write(key, svg) {
  const file = join(OUT, key);
  await mkdir(dirname(file), { recursive: true });
  const webp = await sharp(Buffer.from(svg)).webp({ quality: 72 }).toBuffer();
  await writeFile(file, webp);
  return webp.length;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  let count = 0;
  let bytes = 0;
  const add = async (key, svg) => {
    bytes += await write(key, svg);
    count += 1;
  };

  for (const store of fixtureStores) {
    const tenantId = fixtureId(store.n, 'tenant', 1);
    const { accent } = store.theme.tokens.colors;

    for (const [i, category] of store.categories.entries()) {
      const id = fixtureId(store.n, 'category', i + 1);
      await add(
        mediaKey.category(tenantId, id),
        categorySvg({ ...category, accent }),
      );
    }

    for (const [i, banner] of store.banners.entries()) {
      const id = fixtureId(store.n, 'banner', i + 1);
      await add(
        mediaKey.banner(tenantId, id),
        bannerSvg({ ...banner, accent }),
      );
    }

    for (const [i, product] of store.products.entries()) {
      const id = fixtureId(store.n, 'product', i + 1);
      for (let view = 1; view <= product.images; view++) {
        await add(
          mediaKey.product(tenantId, id, view),
          productSvg({
            name: product.name,
            swatch: product.swatch,
            accent,
            view,
          }),
        );
      }
    }
  }

  console.log(
    `Wrote ${count} images (${(bytes / 1024).toFixed(0)} KB) to public/mock-media`,
  );
}

await main();
