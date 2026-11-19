'use client';

import { Children, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Scroll-snap slider for server-rendered slides. Swipe on touch, arrows and
 * dots elsewhere. No autoplay: moving content is distracting and hurts
 * accessibility.
 */
export function HeroSlider({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = (index + slides.length) % slides.length;
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative" aria-roledescription="carousel">
      <div
        ref={trackRef}
        onScroll={(event) => {
          const track = event.currentTarget;
          setActive(Math.round(track.scrollLeft / track.clientWidth));
        }}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="w-full shrink-0 snap-start"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            inert={i !== active}
          >
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === active}
                className="grid size-6 place-items-center"
              >
                <span
                  className={cn(
                    'block h-0.5 rounded-full bg-white transition-all',
                    i === active ? 'w-6 opacity-100' : 'w-3 opacity-60',
                  )}
                />
              </button>
            ))}
          </div>
          <div className="absolute right-4 bottom-4 hidden gap-2 md:flex">
            {[
              { label: 'Previous slide', step: -1, Icon: ChevronLeft },
              { label: 'Next slide', step: 1, Icon: ChevronRight },
            ].map(({ label, step, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => goTo(active + step)}
                aria-label={label}
                className="grid size-11 place-items-center rounded-full border border-white/50 text-white backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                <Icon className="size-5" aria-hidden />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
