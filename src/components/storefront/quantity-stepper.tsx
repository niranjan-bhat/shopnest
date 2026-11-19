'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type QuantityStepperProps = {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Minimum quantity; 0 lets the minus button remove a cart line. */
  min?: number;
  label: string;
  size?: 'sm' | 'md';
};

export function QuantityStepper({
  value,
  max,
  onChange,
  min = 1,
  label,
  size = 'md',
}: QuantityStepperProps) {
  const button = cn(
    'grid place-items-center text-store-text transition-colors hover:bg-store-subtle disabled:opacity-35 disabled:hover:bg-transparent',
    size === 'sm' ? 'size-8' : 'size-11',
  );
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-store border border-store-border"
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <output
        aria-live="polite"
        className={cn(
          'text-center tabular-nums',
          size === 'sm' ? 'w-7 text-sm' : 'w-10',
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
