import { StoreHomeLink } from '@/components/storefront/store-home-link';

/** Unknown category or product inside a store (rendered within its layout). */
export default function StoreNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-xs tracking-[0.22em] text-store-primary uppercase">
        Not found
      </p>
      <h1 className="mt-3 font-store-heading text-4xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 text-store-muted">
        It may have sold out or moved. Try the home page or one of our
        collections.
      </p>
      <StoreHomeLink className="mt-8 inline-block text-store-primary underline underline-offset-4">
        Back to the store
      </StoreHomeLink>
    </div>
  );
}
