/** Shown while a store's layout resolves (first visit to an unlisted host). */
export function StoreShellFallback() {
  return <div className="min-h-dvh" aria-busy="true" />;
}

/** Shown while a storefront page streams in. */
export function StorePageFallback() {
  return (
    <div
      className="mx-auto max-w-7xl animate-pulse px-4 py-10 md:px-8"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="mx-auto h-10 w-64 rounded bg-store-subtle" />
      <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[3/4] rounded bg-store-subtle" />
        ))}
      </div>
    </div>
  );
}
