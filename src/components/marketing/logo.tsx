/** Zarify's monogram: a Z drawn with one line, in gold. */
export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        stroke="#B68A35"
        strokeWidth="2"
      />
      <path
        d="M10 10.5h12l-12 11h12"
        stroke="#B68A35"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
