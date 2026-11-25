'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { signIn, type SignInState } from '@/features/auth/actions';
import { Turnstile } from './turnstile';

const inputClass =
  'mt-1.5 block w-full rounded-md border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Email → 6-digit code → signed in. */
export function LoginForm({
  next,
  siteKey,
}: {
  next: string;
  /** Turnstile's site key; without one there is no bot check. */
  siteKey?: string;
}) {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    { step: 'email' },
  );
  const [answeredFor, setAnsweredFor] = useState<SignInState | null>(null);
  const blocked = pending || (siteKey !== undefined && answeredFor !== state);

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.step === 'email' ? (
        <>
          <label className="block text-sm font-medium">
            Email
            <input
              key="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              defaultValue={state.email}
              className={inputClass}
            />
          </label>
          {state.error && <ErrorText>{state.error}</ErrorText>}
          <Button
            type="submit"
            name="intent"
            value="send"
            disabled={blocked}
            className="w-full"
          >
            {pending ? 'Sending…' : 'Email me a code'}
          </Button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          <p className="text-sm text-muted-foreground">
            If{' '}
            <span className="font-medium text-foreground">{state.email}</span>{' '}
            has access to Zarify, we&apos;ve sent it a 6-digit code.
          </p>
          <label className="block text-sm font-medium">
            Code
            <input
              key="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              className={`${inputClass} tracking-[0.4em]`}
            />
          </label>
          {state.error && <ErrorText>{state.error}</ErrorText>}
          <Button
            type="submit"
            name="intent"
            value="verify"
            disabled={blocked}
            className="w-full"
          >
            {pending ? 'Checking…' : 'Sign in'}
          </Button>
          <div className="flex justify-between text-sm">
            <button
              type="submit"
              name="intent"
              value="send"
              disabled={blocked}
              className="underline underline-offset-4"
            >
              Send a new code
            </button>
            <button
              type="submit"
              name="intent"
              value="restart"
              disabled={pending}
              className="underline underline-offset-4"
            >
              Use a different email
            </button>
          </div>
        </>
      )}
      {siteKey && (
        // Each answer works once: every reply from the server needs a new one.
        <Turnstile
          siteKey={siteKey}
          resetOn={state}
          onChange={setAnsweredFor}
        />
      )}
    </form>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}
