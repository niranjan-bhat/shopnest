/** Shown on every page of a suspended store. Says nothing else about it. */
export function StoreUnavailable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        This store is currently unavailable
      </h1>
      <p className="mt-3 text-muted-foreground">
        Please check back later, or contact the store directly.
      </p>
    </main>
  );
}
