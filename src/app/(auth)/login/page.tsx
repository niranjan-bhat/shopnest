import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { safeNextPath } from '@/features/auth/schemas';
import { getSessionUser } from '@/features/auth/session';

export const metadata: Metadata = {
  title: 'Sign in · ShopNest',
  robots: { index: false },
};

const LINK_ERRORS: Record<string, string> = {
  link: 'That sign-in link is invalid or has expired. Request a new code below.',
};

async function Login({
  searchParams,
}: Pick<PageProps<'/login'>, 'searchParams'>) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSessionUser()) redirect(next);
  const linkError =
    typeof params.error === 'string' ? LINK_ERRORS[params.error] : undefined;
  return (
    <>
      {linkError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {linkError}
        </p>
      )}
      <LoginForm next={next} />
    </>
  );
}

export default function LoginPage(props: PageProps<'/login'>) {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-6 py-20">
      <p className="text-sm tracking-widest text-muted-foreground uppercase">
        ShopNest
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-muted-foreground">
        We&apos;ll email you a 6-digit code. No password needed.
      </p>
      <Suspense>
        <Login searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
