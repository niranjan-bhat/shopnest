import { listStoreLinks } from '@/features/storefront/context';

/**
 * Platform index: links to the live stores, each on its own host name. Later
 * this becomes the marketing site.
 */
export default async function Home() {
  const stores = await listStoreLinks();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
      <p className="text-sm tracking-widest text-muted-foreground uppercase">
        Zarify
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Demo stores
      </h1>
      <p className="mt-3 text-muted-foreground">
        Two stores rendered by the same template, styled only by their theme
        config, each on its own host name.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {stores.map((store) => (
          <li key={store.slug}>
            <a
              href={store.url}
              className="block rounded-xl border p-6 transition-colors hover:bg-muted"
            >
              <span className="block text-xl font-medium">{store.name}</span>
              {store.tagline && (
                <span className="mt-1 block text-sm text-muted-foreground">
                  {store.tagline}
                </span>
              )}
              <span className="mt-4 block font-mono text-xs text-muted-foreground">
                {store.url.replace(/^https?:\/\//, '')}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
