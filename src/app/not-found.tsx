import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        There is no store or page at this address.
      </p>
      <Link href="/" className="mt-6 underline underline-offset-4">
        Go to ShopNest
      </Link>
    </main>
  );
}
