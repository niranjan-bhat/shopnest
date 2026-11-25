'use client';

import { useEffect } from 'react';
import {
  countVisit,
  isTeamBrowser,
  setCounting,
} from '@/features/visitors/client';

/** Counts visitors on a live store, whichever template it uses. */
export function CountVisits({ appOrigin }: { appOrigin: string }) {
  useEffect(() => {
    if (isTeamBrowser(document.referrer, appOrigin)) return;
    setCounting(true);
    countVisit({ event: 'visit' });

    // Any WhatsApp link is a chat, except sending an order already placed.
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (
        link?.href.startsWith('https://wa.me/') &&
        !window.location.pathname.startsWith('/orders/')
      ) {
        countVisit({ event: 'chat' });
      }
    };
    document.addEventListener('click', onClick, true);
    return () => {
      setCounting(false);
      document.removeEventListener('click', onClick, true);
    };
  }, [appOrigin]);
  return null;
}

/** On a product page: this person looked at it. */
export function CountProductVisit({ productId }: { productId: string }) {
  useEffect(() => {
    // After <CountVisits> in the layout, whose effect runs later than ours.
    const timer = setTimeout(
      () => countVisit({ event: 'product', product: productId }),
      0,
    );
    return () => clearTimeout(timer);
  }, [productId]);
  return null;
}
