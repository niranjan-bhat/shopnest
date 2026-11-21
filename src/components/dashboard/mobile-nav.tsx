'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Brand } from './brand';
import { NavLinks } from './nav-links';

/** The sidebar navigation in a slide-in panel, for phones and tablets. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
          />
        }
      >
        <Menu aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0">
        <SheetHeader className="border-b">
          <SheetTitle render={<div />}>
            <Brand onNavigate={close} />
          </SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <NavLinks onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
