import Link from 'next/link';
import { listDemoStores, storeBasePath } from '@/features/storefront/context';

/**
 * Phase 1 index: links to the demo stores. In Phase 2 storefronts move to
 * their own hostnames and this becomes the marketing site.
 */
export default async function Home() {
  const stores = await listDemoStores();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
      <p className="text-sm tracking-widest text-muted-foreground uppercase">
        ShopNest · Phase 1
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Demo stores
      </h1>
      <p className="mt-3 text-muted-foreground">
        Two stores rendered by the same template, styled only by their theme
        config. Data is mocked until Phase 2.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {stores.map((store) => (
          <li key={store.slug}>
            <Link
              href={storeBasePath(store.slug)}
              className="block rounded-xl border p-6 transition-colors hover:bg-muted"
            >
              <span className="block text-xl font-medium">{store.name}</span>
              {store.tagline && (
                <span className="mt-1 block text-sm text-muted-foreground">
                  {store.tagline}
                </span>
              )}
              <span className="mt-4 block font-mono text-xs text-muted-foreground">
                {storeBasePath(store.slug)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
