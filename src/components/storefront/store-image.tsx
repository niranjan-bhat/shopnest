import Image from 'next/image';
import type { MediaImage } from '@/features/catalog/types';
import { mediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

type StoreImageProps = {
  image: MediaImage;
  /** Responsive `sizes` hint; required so the browser picks the right width. */
  sizes: string;
  className?: string;
  /** Fill the (positioned) parent instead of using intrinsic size. */
  fill?: boolean;
  /** For the one image that is likely the LCP element on a page. */
  priority?: boolean;
  alt?: string;
};

/** next/image for a stored media key. */
export function StoreImage({
  image,
  sizes,
  className,
  fill = false,
  priority = false,
  alt,
}: StoreImageProps) {
  const common = {
    src: mediaUrl(image.key),
    sizes,
    className: cn('object-cover', className),
    ...(priority
      ? { preload: true, fetchPriority: 'high' as const }
      : { loading: 'lazy' as const }),
  };
  return fill ? (
    <Image {...common} alt={alt ?? image.alt} fill />
  ) : (
    <Image
      {...common}
      alt={alt ?? image.alt}
      width={image.width}
      height={image.height}
    />
  );
}
