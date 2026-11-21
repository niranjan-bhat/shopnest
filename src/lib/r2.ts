import 'server-only';
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Env, r2EnvSchema } from './env';

// Cloudflare R2 through its S3-compatible API. Server-only: the keys never
// reach the browser. Browsers upload with short-lived signed URLs instead.

let client: S3Client | undefined;

function r2(): S3Client {
  if (!client) {
    const env = getR2Env();
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/** Whether R2 is configured here (uploads are off until it is). */
export function isR2Configured(): boolean {
  return r2EnvSchema.safeParse(process.env).success;
}

/** How long a signed upload URL stays valid. */
const UPLOAD_URL_SECONDS = 5 * 60;

/**
 * A URL the browser can PUT one file to. The content type and length are
 * signed, so the upload must be exactly the file that was announced.
 */
export function signedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: getR2Env().R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    {
      expiresIn: UPLOAD_URL_SECONDS,
      signableHeaders: new Set(['content-type', 'content-length']),
    },
  );
}

/** Size and type of a stored object, or null if there is none. */
export async function statObject(
  key: string,
): Promise<{ size: number; contentType: string | undefined } | null> {
  try {
    const head = await r2().send(
      new HeadObjectCommand({ Bucket: getR2Env().R2_BUCKET, Key: key }),
    );
    return { size: head.ContentLength ?? 0, contentType: head.ContentType };
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFound') return null;
    throw error;
  }
}

/** Deletes objects; keys that do not exist are ignored. */
export async function deleteObjects(keys: readonly string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const result = await r2().send(
      new DeleteObjectsCommand({
        Bucket: getR2Env().R2_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (result.Errors?.length) {
      throw new Error(
        `R2 could not delete ${result.Errors.length} object(s): ${result.Errors[0]?.Message ?? ''}`,
      );
    }
  }
}
