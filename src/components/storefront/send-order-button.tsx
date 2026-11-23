'use client';

import { MessageCircle } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

// The full WhatsApp message (with the shopper's address) is only kept in
// this tab's sessionStorage, never in the confirmation page itself: anyone
// with the page's link can open it.

const key = (orderId: string) => `zarify-order:${orderId}`;

type Saved = { url: string; opened: boolean };

function read(orderId: string): string | null {
  try {
    return window.sessionStorage.getItem(key(orderId));
  } catch {
    return null;
  }
}

function write(orderId: string, saved: Saved) {
  try {
    window.sessionStorage.setItem(key(orderId), JSON.stringify(saved));
  } catch {
    // Private mode or storage off: the button falls back to a short message.
  }
}

/** Called by the checkout before it moves to the confirmation page. */
export function rememberOrderMessage(orderId: string, url: string) {
  write(orderId, { url, opened: false });
}

function parse(raw: string | null): Saved | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<Saved>;
    return typeof saved.url === 'string' &&
      saved.url.startsWith('https://wa.me/')
      ? { url: saved.url, opened: Boolean(saved.opened) }
      : null;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};

/**
 * Sends the order on WhatsApp. Straight after checkout it opens WhatsApp
 * once by itself with the full order written out; the button opens it again.
 * Opened later or elsewhere, it sends a short message with the order number.
 */
export function SendOrderButton({
  orderId,
  fallbackUrl,
  className,
}: {
  orderId: string;
  fallbackUrl: string;
  className?: string;
}) {
  const raw = useSyncExternalStore(
    noSubscribe,
    () => read(orderId),
    () => null,
  );
  const saved = parse(raw);

  useEffect(() => {
    // Read again, not from `raw`: effects can run twice (React's dev check),
    // and the second run must see that WhatsApp was already opened.
    const pending = parse(read(orderId));
    if (!pending || pending.opened) return;
    write(orderId, { ...pending, opened: true });
    window.location.assign(pending.url);
  }, [orderId, raw]);

  return (
    <a
      href={saved?.url ?? fallbackUrl}
      className={className}
      data-testid="send-order"
    >
      <MessageCircle className="size-4" aria-hidden />
      Send order on WhatsApp
    </a>
  );
}
