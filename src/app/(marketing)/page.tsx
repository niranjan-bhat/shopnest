import type { Metadata } from 'next';
import { Landing } from '@/components/marketing/landing';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <Landing />;
}
