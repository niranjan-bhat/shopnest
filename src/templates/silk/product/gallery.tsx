'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { StoreImage } from '@/components/storefront/store-image';
import type { MediaImage } from '@/features/catalog/types';
import { cn } from '@/lib/utils';

const MAIN_SIZES = '(min-width: 1024px) 50vw, 100vw';

/**
 * Product images: swipeable on mobile, thumbnails on desktop. Selecting an
 * image opens a full-screen viewer; tapping there toggles 2× zoom and the
 * zoomed image pans by scrolling (or pinch on touch screens).
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: MediaImage[];
  productName: string;
}) {
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const show = (index: number) => {
    setActive(index);
    const track = trackRef.current;
    track?.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  };

  if (images.length === 0) {
    return <div className="aspect-[3/4] rounded-store bg-store-subtle" />;
  }

  return (
    <div className="lg:grid lg:grid-cols-[80px_1fr] lg:gap-4">
      {images.length > 1 && (
        <ul
          className="hidden flex-col gap-3 lg:flex"
          aria-label="Product images"
        >
          {images.map((image, i) => (
            <li key={image.key}>
              <button
                type="button"
                onClick={() => show(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  'relative block aspect-[3/4] w-full overflow-hidden rounded-store ring-offset-2 transition',
                  i === active
                    ? 'ring-1 ring-store-text'
                    : 'opacity-70 hover:opacity-100',
                )}
              >
                <StoreImage image={image} alt="" fill sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <div
          ref={trackRef}
          onScroll={(event) => {
            const track = event.currentTarget;
            setActive(Math.round(track.scrollLeft / track.clientWidth));
          }}
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto rounded-store [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, i) => (
            <button
              key={image.key}
              type="button"
              onClick={() => setViewer(i)}
              className="group relative aspect-[3/4] w-full shrink-0 cursor-zoom-in snap-start bg-store-subtle"
              aria-label={`Zoom image ${i + 1} of ${productName}`}
            >
              <StoreImage
                image={image}
                fill
                sizes={MAIN_SIZES}
                priority={i === 0}
              />
              <span className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-store-bg/85 opacity-90 transition group-hover:opacity-100">
                <ZoomIn className="size-4" aria-hidden />
              </span>
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div
            className="mt-3 flex justify-center gap-1.5 lg:hidden"
            aria-hidden
          >
            {images.map((image, i) => (
              <span
                key={image.key}
                className={cn(
                  'h-1 rounded-full transition-all',
                  i === active ? 'w-5 bg-store-text' : 'w-1.5 bg-store-border',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {viewer !== null && (
        <ZoomViewer
          images={images}
          index={viewer}
          productName={productName}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function ZoomViewer({
  images,
  index,
  productName,
  onClose,
}: {
  images: MediaImage[];
  index: number;
  productName: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const image = images[current]!;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={`${productName}, image ${current + 1} of ${images.length}`}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="h-full w-full [touch-action:pinch-zoom_pan-x_pan-y] overflow-auto">
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          className={cn(
            'relative mx-auto block',
            zoomed
              ? 'w-[200vw] cursor-zoom-out md:w-[160vw]'
              : 'h-full w-full cursor-zoom-in',
          )}
          aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
        >
          {zoomed ? (
            <StoreImage image={image} sizes="200vw" className="h-auto w-full" />
          ) : (
            <StoreImage
              image={image}
              fill
              sizes="100vw"
              className="object-contain"
            />
          )}
        </button>
      </div>
      <div className="fixed top-4 right-4 flex gap-2">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur"
          aria-label="Close"
          autoFocus
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {images.length > 1 && (
        <div className="fixed inset-x-0 bottom-5 flex justify-center gap-2">
          {images.map((img, i) => (
            <button
              key={img.key}
              type="button"
              onClick={() => {
                setCurrent(i);
                setZoomed(false);
              }}
              aria-label={`Image ${i + 1}`}
              aria-current={i === current}
              className={cn(
                'size-3 rounded-full border border-white',
                i === current ? 'bg-white' : 'bg-transparent',
              )}
            />
          ))}
        </div>
      )}
    </dialog>
  );
}
