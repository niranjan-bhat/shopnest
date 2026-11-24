import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import zarifyIcon from '@/assets/zarify-icon.svg';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Zarify',
  description: 'Online stores for Indian clothing brands.',
  // Not an icon file in app/: those are added to stores' own icons too.
  icons: { icon: zarifyIcon.src },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
