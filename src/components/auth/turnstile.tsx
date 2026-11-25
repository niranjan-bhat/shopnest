'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      appearance: 'interaction-only';
      callback(token: string): void;
      'expired-callback'(): void;
      'timeout-callback'(): void;
      'error-callback'(): boolean;
    },
  ): string | undefined;
  reset(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare's bot check, shown only when it needs the visitor to do
 * something. It adds its answer to the form around it as a hidden field and
 * starts over whenever `resetOn` changes. `onChange` gets the `resetOn` value
 * the answer is for, or null when there is none, so an answer already used is
 * never taken for a new one.
 */
export function Turnstile<T>({
  siteKey,
  resetOn,
  onChange,
}: {
  siteKey: string;
  resetOn: T;
  onChange: (answeredFor: T | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const answeredFor = useRef(resetOn);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const api = window.turnstile;
    if (!ready || !api || !container.current) return;
    const id = api.render(container.current, {
      sitekey: siteKey,
      appearance: 'interaction-only',
      callback: () => {
        setFailed(false);
        onChange(answeredFor.current);
      },
      'expired-callback': () => onChange(null),
      'timeout-callback': () => onChange(null),
      'error-callback': () => {
        setFailed(true);
        onChange(null);
        return true;
      },
    });
    widget.current = id;
    return () => {
      widget.current = undefined;
      onChange(null);
      if (id) api.remove(id);
    };
  }, [ready, siteKey, onChange]);

  useEffect(() => {
    if (answeredFor.current === resetOn) return;
    answeredFor.current = resetOn;
    onChange(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetOn, onChange]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      <div ref={container} />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          The security check could not load. Turn off any ad blocker for this
          page and reload it.
        </p>
      )}
    </>
  );
}
