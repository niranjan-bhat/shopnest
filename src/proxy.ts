import { NextResponse, type NextRequest } from 'next/server';
import { getPublicEnv } from '@/lib/env.public';
import { refreshSession } from '@/lib/supabase/proxy';
import { appOrigin, isAppPath, routeHost } from '@/lib/tenant';

/**
 * Routes every request by hostname (see src/lib/tenant.ts):
 *   - storefront hosts are rewritten to /sites/<hostname>/<path>; the
 *     /sites/[host] layout looks the store up and 404s unknown hosts;
 *   - the app host refreshes the auth session and serves /dashboard,
 *     /admin, /login and /auth;
 *   - the platform host serves the marketing page and sends app paths to
 *     the app host.
 * /sites is internal: it is only reachable through the rewrite.
 */
export async function proxy(request: NextRequest) {
  const rootDomain = getPublicEnv().NEXT_PUBLIC_ROOT_DOMAIN;
  const route = routeHost(request.headers.get('host'), rootDomain);
  const { pathname, search } = request.nextUrl;

  if (!route) return new NextResponse('Bad Request', { status: 400 });

  if (route.kind === 'store') {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${route.hostname}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === '/sites' || pathname.startsWith('/sites/')) {
    return NextResponse.rewrite(new URL('/_not-found', request.url));
  }

  if (route.kind === 'platform') {
    if (isAppPath(pathname)) {
      return NextResponse.redirect(
        new URL(`${pathname}${search}`, appOrigin(rootDomain)),
      );
    }
    return NextResponse.next();
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return refreshSession(request);
}

export const config = {
  // Everything except build assets, image optimisation and public files.
  matcher: ['/((?!_next/static|_next/image|mock-media/|favicon\\.ico).*)'],
};
