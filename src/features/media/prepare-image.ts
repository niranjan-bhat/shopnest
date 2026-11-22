import {
  fitWithin,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_SIDE,
  type UploadType,
} from './rules';

// Runs in the browser: shrinks an image before upload, so a 6 MB phone photo
// becomes a few hundred KB and uploads quickly on mobile data.

export type PreparedImage<T extends UploadType = UploadType> = {
  blob: Blob;
  type: T;
  width: number;
  height: number;
};

/** A message a merchant can act on, shown next to the file name. */
export class ImageProblem extends Error {}

const QUALITY = 0.85;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Resizes so the longest side is at most `maxSide`, as WebP where the
 * browser can make it, otherwise `fallback` (older Safari): JPEG for photos,
 * PNG where transparency matters (logos).
 */
export async function prepareImage<
  F extends 'image/jpeg' | 'image/png' = 'image/jpeg',
>(
  file: File,
  {
    maxSide = MAX_IMAGE_SIDE,
    fallback = 'image/jpeg' as F,
  }: { maxSide?: number; fallback?: F } = {},
): Promise<PreparedImage<'image/webp' | F>> {
  if (!file.type.startsWith('image/')) {
    throw new ImageProblem('Not an image file.');
  }
  let bitmap: ImageBitmap;
  try {
    // Applies the camera's rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageProblem(
      'This browser cannot read this file. Use a JPEG, PNG or WebP image.',
    );
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageProblem('This browser cannot resize images.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await toBlob(canvas, 'image/webp');
  let type: 'image/webp' | F = 'image/webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, fallback);
    type = fallback;
  }
  if (!blob) throw new ImageProblem('This image could not be processed.');
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new ImageProblem('This image is too large even after resizing.');
  }
  return { blob, type, width, height };
}
