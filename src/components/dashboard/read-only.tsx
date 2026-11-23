'use client';

import {
  createContext,
  use,
  useEffect,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { toast } from 'sonner';

// Read-only mode for super admins viewing a store. The database refuses
// their changes anyway; this says so before they try.

type ReadOnlyState = {
  readOnly: boolean;
  setReadOnly: (value: boolean) => void;
};

const ReadOnlyContext = createContext<ReadOnlyState>({
  readOnly: false,
  setReadOnly: () => {},
});

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const [readOnly, setReadOnly] = useState(false);
  return (
    <ReadOnlyContext value={{ readOnly, setReadOnly }}>
      {children}
    </ReadOnlyContext>
  );
}

/** Reports whether the store on screen is read-only. */
export function useReportReadOnly(value: boolean) {
  const { setReadOnly } = use(ReadOnlyContext);
  useEffect(() => {
    setReadOnly(value);
    return () => setReadOnly(false);
  }, [value, setReadOnly]);
}

const CONTROLS =
  'button, [role="button"], [role="switch"], [role="checkbox"], [role="menuitem"], input[type="checkbox"], input[type="radio"], input[type="file"]';

/**
 * Wraps the dashboard's pages. While read-only, buttons and form submits do
 * nothing but explain; links and searches keep working.
 */
export function ReadOnlyGuard({ children }: { children: ReactNode }) {
  const { readOnly } = use(ReadOnlyContext);
  const refuse = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toast.info('Read only. Choose “Allow editing” above to make changes.', {
      id: 'read-only',
    });
  };
  const blocked = (target: EventTarget, selector: string) =>
    target instanceof Element &&
    target.closest('[role="search"]') === null &&
    target.closest(selector) !== null;

  return (
    <div
      className="contents"
      onClickCapture={(event) => {
        if (readOnly && blocked(event.target, CONTROLS)) refuse(event);
      }}
      onSubmitCapture={(event) => {
        if (readOnly && blocked(event.target, 'form')) refuse(event);
      }}
    >
      {children}
    </div>
  );
}
