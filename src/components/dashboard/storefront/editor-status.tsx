'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// Lets the look form tell the publish bar it has edits not yet saved to
// the draft, so the bar can show the "Edit" step and hold back Publish.

type EditorStatus = {
  editing: boolean;
  setEditing: (editing: boolean) => void;
};

const EditorStatusContext = createContext<EditorStatus | null>(null);

export function EditorStatusProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <EditorStatusContext value={{ editing, setEditing }}>
      {children}
    </EditorStatusContext>
  );
}

/** True while a form on the page has unsaved edits. */
export function useEditing(): boolean {
  return useContext(EditorStatusContext)?.editing ?? false;
}

/** Reports a form's unsaved edits to the publish bar; a no-op without one. */
export function useReportEditing(dirty: boolean) {
  const setEditing = useContext(EditorStatusContext)?.setEditing;
  useEffect(() => {
    if (!setEditing) return;
    setEditing(dirty);
    return () => setEditing(false);
  }, [dirty, setEditing]);
}
