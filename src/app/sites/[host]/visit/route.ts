import { getStoreByHost } from '@/features/tenants/queries';
import { recordVisit } from '@/features/visitors/record';
import { visitSchema } from '@/features/visitors/schema';

/** Is the request from a page of this same store? */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return (
    origin !== null &&
    URL.canParse(origin) &&
    new URL(origin).host === request.headers.get('host')
  );
}

/** Store pages report visits here (POST /visit on the store's address). */
export async function POST(
  request: Request,
  { params }: RouteContext<'/sites/[host]/visit'>,
) {
  // Always the same answer: nobody is waiting for it.
  const done = new Response(null, { status: 204 });
  if (!sameOrigin(request)) return done;
  if (Number(request.headers.get('content-length') ?? 0) > 500) return done;
  try {
    const visit = visitSchema.safeParse(JSON.parse(await request.text()));
    if (!visit.success) return done;
    const store = await getStoreByHost((await params).host);
    if (store) await recordVisit(store.id, visit.data, request.headers);
  } catch (error) {
    if (!(error instanceof SyntaxError)) console.error(error);
  }
  return done;
}
