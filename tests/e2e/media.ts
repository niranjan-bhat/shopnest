// Test helpers for photo uploads: small generated images, and direct access
// to the R2 bucket to check and clean up a test store's files.
import { crc32, deflateSync } from 'node:zlib';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

const env = process.env;

/** Upload tests need real R2 keys; they are skipped without them (e.g. CI). */
export const hasR2 = Boolean(
  env.R2_ACCOUNT_ID &&
  env.R2_ACCESS_KEY_ID &&
  env.R2_SECRET_ACCESS_KEY &&
  env.R2_BUCKET,
);

function r2() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

/** Keys of every file stored for a store. */
export async function storeMediaKeys(storeId: string): Promise<string[]> {
  const page = await r2().send(
    new ListObjectsV2Command({
      Bucket: env.R2_BUCKET,
      Prefix: `tenants/${storeId}/`,
    }),
  );
  return (page.Contents ?? []).map((o) => o.Key ?? '');
}

/** Removes every file stored for a store (test clean-up). */
export async function deleteStoreMedia(storeId: string) {
  const keys = await storeMediaKeys(storeId);
  if (keys.length === 0) return;
  await r2().send(
    new DeleteObjectsCommand({
      Bucket: env.R2_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A solid-colour PNG, for setInputFiles. */
export function pngFile(
  name: string,
  [r, g, b]: [number, number, number],
  width = 60,
  height = 80,
) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return { name, mimeType: 'image/png', buffer };
}
