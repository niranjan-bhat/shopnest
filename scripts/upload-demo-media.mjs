// Copies the demo store images (public/mock-media/) into an R2 bucket under
// the same keys, so the seeded demo stores keep their photos once media is
// served from the bucket instead of /mock-media. Files already in the bucket
// are skipped, so it is safe to run again.
//
//   npm run media:upload-demo                      # bucket from .env.local
//   node --env-file=<file> scripts/upload-demo-media.mjs   # another bucket
//
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const ROOT = join(import.meta.dirname, '..', 'public', 'mock-media');
const TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const env = process.env;
for (const name of [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
]) {
  if (!env[name]) {
    console.error(`Missing ${name}. Fill it in .env.local first.`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
    ),
  );
  return nested.flat();
}

async function existingKeys() {
  const keys = new Set();
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: env.R2_BUCKET,
        Prefix: 'tenants/',
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) keys.add(object.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

const files = await filesUnder(ROOT);
const have = await existingKeys();
let uploaded = 0;
let skipped = 0;

// A few at a time: fast, without flooding the connection.
const queue = [...files];
async function worker() {
  for (let file = queue.shift(); file; file = queue.shift()) {
    const key = relative(ROOT, file).split(sep).join('/');
    if (have.has(key)) {
      skipped += 1;
      continue;
    }
    const type = TYPES[key.slice(key.lastIndexOf('.'))];
    if (!type) throw new Error(`Unexpected file type: ${key}`);
    await client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: await readFile(file),
        ContentType: type,
        // Keys never change content (new uploads get new keys).
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    uploaded += 1;
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

console.log(
  `${uploaded} uploaded, ${skipped} already there, to bucket ${env.R2_BUCKET}.`,
);
