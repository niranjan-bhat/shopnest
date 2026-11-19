'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { storeHref, storePaths } from '@/components/storefront/links';

type NavItem = { href: string; label: string };

/** Slide-in menu for small screens. */
export function MobileNav({
  storeName,
  basePath,
  items,
}: {
  storeName: string;
  basePath: string;
  items: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-store-subtle lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="m-0 h-dvh max-h-none w-[85vw] max-w-sm bg-store-bg p-0 font-store-body text-store-text backdrop:bg-black/45 open:animate-in open:slide-in-from-left"
      >
        <div className="flex items-center justify-between px-6 py-5">
          <span className="font-store-heading text-2xl">{storeName}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="-mr-2 grid size-10 place-items-center rounded-full hover:bg-store-subtle"
            aria-label="Close menu"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Categories">
          <ul className="border-t border-store-border">
            {[
              { href: storeHref(basePath, storePaths.home), label: 'Home' },
              ...items,
            ].map((item) => (
              <li key={item.href} className="border-b border-store-border">
                <Link
                  href={item.href}
                  className="block px-6 py-4 font-store-heading text-xl"
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </>
  );
}
