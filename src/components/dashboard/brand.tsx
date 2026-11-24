import Link from 'next/link';
import { ZarifyLogo } from '@/components/zarify-logo';

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/dashboard" onClick={onNavigate} className="inline-flex">
      <ZarifyLogo className="h-7" />
    </Link>
  );
}
