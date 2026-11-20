// Builds the Phase 1 mock images in public/mock-media/ from the real photos in
// photos/, at the same R2-style keys the mock data stores.
// Run: npm run mock:media
//
// photos/<n>/ (gitignored) holds the photos for the n-th product of every
// store, in display order (1 is the main image). Any format sharp reads;
// output is always WebP, cropped to fill.
//
// - Products: every photo, 3:4.
// - Category thumbnails: the main photo of the category's first active
//   product, square, cropped from the top.
// - Hero banners: photos/hero<store n>/ (1 is the first slide), cropped to
//   2:1. Without that folder, a collage as for promo banners.
// - Promo banners: main photos of the products in the category the banner
//   links to, side by side (two for promo banners, three for a hero
//   fallback).
//
// Every product needs a photo folder; the script fails rather than inventing
// an image.
//
// Node loads fixtures.ts directly (built-in TypeScript type stripping).
import { existsSync, readdirSync } from 'node:fs';
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
/** next/image keeps optimised copies by URL; our URLs never change. */
const NEXT_IMAGE_CACHE = join(ROOT, '.next', 'cache', 'images');
const PHOTOS = join(ROOT, 'photos');
const PHOTO_EXT = /\.(jpe?g|png|webp|avif)$/i;
const QUALITY = 78;
/** Photos side by side in a banner, by shape. */
const BANNER_TILES = { hero: 3, promo: 2 };

const byNumber = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Photo paths for product number `n` (1-based), in display order. */
function productPhotos(store, n) {
  const dir = join(PHOTOS, String(n));
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => PHOTO_EXT.test(f))
    : [];
  if (files.length === 0) {
    throw new Error(
      `${store.slug}: product ${n} (${store.products[n - 1].slug}) has no photos; add them to photos/${n}/`,
    );
  }
  return files.sort(byNumber).map((f) => join(dir, f));
}

const isActive = (product) => (product.status ?? 'active') === 'active';

/** Photo lists of the active products in a category, in store order. */
function categoryPhotos(store, slug) {
  return store.products
    .map((product, i) => ({ product, n: i + 1 }))
    .filter(({ product }) => isActive(product))
    .filter(({ product }) => !slug || product.categories.includes(slug))
    .map(({ n }) => productPhotos(store, n));
}

/** Hero photos for a store (photos/hero<store.n>/), in slide order. */
function heroPhotos(store) {
  const dir = join(PHOTOS, `hero${store.n}`);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => PHOTO_EXT.test(f))
    .sort(byNumber)
    .map((f) => join(dir, f));
}

/** `count` photos for a banner: main photos first, then second views, etc. */
function bannerPhotos(store, banner, count) {
  const slug = /^\/c\/([^/]+)/.exec(banner.link)?.[1];
  const lists = categoryPhotos(store, slug);
  if (lists.length === 0) {
    throw new Error(`${store.slug}: no photos for banner "${banner.heading}"`);
  }
  const picked = [];
  for (let view = 0; picked.length < count; view++) {
    const row = lists.filter((l) => l[view]).map((l) => l[view]);
    if (row.length === 0) view = -1; // ran out of views; start over
    picked.push(...row);
  }
  return picked.slice(0, count);
}

const crop = (source, width, height, position = 'centre') =>
  sharp(source).rotate().resize(width, height, { fit: 'cover', position });

async function save(key, image) {
  const file = join(OUT, key);
  await mkdir(dirname(file), { recursive: true });
  const webp = await image.webp({ quality: QUALITY }).toBuffer();
  await writeFile(file, webp);
  return webp.length;
}

/** Photos side by side, filling `width` x `height`. */
async function collage(sources, { width, height }) {
  const tile = Math.floor(width / sources.length);
  const tiles = await Promise.all(
    sources.map(async (source, i) => {
      const w = i === sources.length - 1 ? width - tile * i : tile;
      const input = await crop(source, w, height, 'top').toBuffer();
      return { input, left: tile * i, top: 0 };
    }),
  );
  return sharp({
    create: { width, height, channels: 3, background: '#000000' },
  }).composite(tiles);
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await rm(NEXT_IMAGE_CACHE, { recursive: true, force: true });
  let count = 0;
  let bytes = 0;
  const add = async (key, image) => {
    bytes += await save(key, await image);
    count += 1;
  };

  for (const store of fixtureStores) {
    const tenantId = fixtureId(store.n, 'tenant', 1);

    for (const [i, category] of store.categories.entries()) {
      const [photos] = categoryPhotos(store, category.slug);
      if (!photos) {
        throw new Error(`${store.slug}: category ${category.slug} is empty`);
      }
      const { width, height } = MEDIA_SIZE.category;
      await add(
        mediaKey.category(tenantId, fixtureId(store.n, 'category', i + 1)),
        crop(photos[0], width, height, 'top'),
      );
    }

    const heroes = heroPhotos(store);
    let heroIndex = 0;
    for (const [i, banner] of store.banners.entries()) {
      const key = mediaKey.banner(
        tenantId,
        fixtureId(store.n, 'banner', i + 1),
      );
      const size = MEDIA_SIZE[banner.shape];
      if (banner.shape === 'hero' && heroes.length > 0) {
        const source = heroes[heroIndex++ % heroes.length];
        await add(key, crop(source, size.width, size.height));
        continue;
      }
      const sources = bannerPhotos(store, banner, BANNER_TILES[banner.shape]);
      await add(key, collage(sources, size));
    }

    for (const [i, product] of store.products.entries()) {
      const id = fixtureId(store.n, 'product', i + 1);
      const photos = productPhotos(store, i + 1);
      if (photos.length !== product.images) {
        throw new Error(
          `${store.slug}/${product.slug}: photos/${i + 1} has ${photos.length} photos but the fixture says images: ${product.images}`,
        );
      }
      const { width, height } = MEDIA_SIZE.product;
      for (const [v, source] of photos.entries()) {
        await add(
          mediaKey.product(tenantId, id, v + 1),
          crop(source, width, height),
        );
      }
    }
  }

  console.log(
    `Wrote ${count} images (${(bytes / 1024).toFixed(0)} KB) to public/mock-media`,
  );
}

await main();
