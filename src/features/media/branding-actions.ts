'use server';

import { randomUUID } from 'node:crypto';
import { requireStoreForAction } from '@/features/tenants/access';
import { isR2Configured, signedUploadUrl } from '@/lib/r2';
import { brandingKey, brandingUploadSchema, type UploadType } from './rules';

/**
 * A signed URL for one logo, favicon or banner image of the active store.
 * The browser uploads to it; the key is then saved with the theme (logo,
 * favicon) or the banner, whose save action checks the file arrived.
 */
export async function prepareBrandingUpload(
  input: unknown,
): Promise<
  | { ok: true; key: string; uploadUrl: string; contentType: UploadType }
  | { ok: false; error: string }
> {
  const { store } = await requireStoreForAction();
  if (!isR2Configured()) {
    return {
      ok: false,
      error: 'Image uploads are not set up for this site yet.',
    };
  }
  const parsed = brandingUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'That file cannot be uploaded.' };
  }
  const { kind, type, size } = parsed.data;
  const key = brandingKey(store.id, kind, randomUUID(), type);
  return {
    ok: true,
    key,
    uploadUrl: await signedUploadUrl(key, type, size),
    contentType: type,
  };
}
