import { getPublicEnv } from '@/lib/env.public';
import { normalizeHostname, originFor } from '@/lib/tenant';

/** Unknown host or path. Links to the platform site by absolute URL, since
 * "/" on an unknown store host would lead straight back here. */
export default function NotFound() {
  const rootDomain = getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN;
  const root = normalizeHostname(rootDomain);
  const home = root ? originFor(root, rootDomain) : '/';
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        There is no store or page at this address.
      </p>
      <a href={home} className="mt-6 underline underline-offset-4">
        Go to Zarify
      </a>
    </main>
  );
}
