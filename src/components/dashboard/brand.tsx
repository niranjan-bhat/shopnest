import Link from 'next/link';

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="text-lg font-semibold tracking-tight"
    >
      Zarify
    </Link>
  );
}
