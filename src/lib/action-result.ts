/**
 * What a dashboard Server Action returns. Expected problems (validation, a
 * taken slug) come back as data for the form to show; anything unexpected
 * throws and is reported by the caller.
 */
export type ActionResult<Field extends string = never> =
  | { ok: true }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Partial<Record<Field, string>>;
    };
