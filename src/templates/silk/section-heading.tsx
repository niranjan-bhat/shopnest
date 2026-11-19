import { cn } from '@/lib/utils';

/** Centred eyebrow + serif heading with a small accent rule. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  as: Heading = 'h2',
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  as?: 'h1' | 'h2';
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      {eyebrow && (
        <p className="mb-3 text-xs tracking-[0.22em] text-store-primary uppercase">
          {eyebrow}
        </p>
      )}
      <Heading className="font-store-heading text-4xl leading-tight md:text-5xl">
        {title}
      </Heading>
      <span
        aria-hidden
        className="mx-auto mt-5 block h-px w-14 bg-store-accent"
      />
      {subtitle && <p className="mt-5 text-lg text-store-muted">{subtitle}</p>}
    </div>
  );
}
