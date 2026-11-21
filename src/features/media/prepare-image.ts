import { fitWithin, MAX_IMAGE_BYTES, type ImageType } from './rules';

// Runs in the browser: shrinks a photo before upload, so a 6 MB phone photo
// becomes a few hundred KB and uploads quickly on mobile data.

export type PreparedImage = {
  blob: Blob;
  type: ImageType;
  width: number;
  height: number;
};

/** A message a merchant can act on, shown next to the file name. */
export class ImageProblem extends Error {}

const QUALITY = 0.85;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageProblem('Not an image file.');
  }
  let bitmap: ImageBitmap;
  try {
    // Applies the camera's rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageProblem(
      'This browser cannot read this file. Use a JPEG, PNG or WebP photo.',
    );
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageProblem('This browser cannot resize photos.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // WebP where the browser can make it (older Safari falls back to JPEG).
  let blob = await toBlob(canvas, 'image/webp');
  let type: ImageType = 'image/webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg');
    type = 'image/jpeg';
  }
  if (!blob) throw new ImageProblem('This photo could not be processed.');
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new ImageProblem('This photo is too large even after resizing.');
  }
  return { blob, type, width, height };
}
