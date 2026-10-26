import { NextResponse, type NextRequest } from 'next/server';
import { ORG_COOKIE, ORG_HEADER, ORG_UUID } from '@/lib/orgShared';
import { readSessionCookie, verifySession } from '@/lib/session';

/** Origin the browser used (not the bind host), so cookie scope and redirects stay on one host. */
const requestOrigin = (req: NextRequest): string => {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
};

/**
 * Gate for the auditor and client surfaces (ADR 0023, ADR 0035). /intake joins them (ADR 0037). Respondent routes
 * (/s, /quiz, /welcome, /privacy, /about) are deliberately outside the matcher. Pages and actions re-check the
 * session themselves; this is the first line, not the only one.
 */
export async function middleware(req: NextRequest) {
  // "Open my space" (TASK-AF): /client?open=<token> is exchanged for a session by a route handler.
  const open = req.nextUrl.pathname === '/client' ? req.nextUrl.searchParams.get('open') : null;
  if (open) {
    return NextResponse.redirect(
      new URL(`/api/auth/open?token=${encodeURIComponent(open)}`, requestOrigin(req)),
    );
  }
  let session = null;
  try {
    session = await verifySession(readSessionCookie((n) => req.cookies.get(n)));
  } catch {
    // Missing secret outside local dev: fail closed.
  }
  if (session) {
    // The path travels to server components for the view-as trail (ADR 0035). Set here, after
    // any client-supplied value is overwritten, so it cannot be forged.
    const headers = new Headers(req.headers);
    headers.set('x-evolai-path', req.nextUrl.pathname);
    // The organisation chosen with ?tenant= is remembered in a cookie (ADR 0038); the header lets
    // this very request see it. Only the shape is checked here: pages honour it solely when the
    // session grants that organisation.
    headers.delete(ORG_HEADER);
    const asked = req.nextUrl.searchParams.get('tenant');
    const chosen = asked && ORG_UUID.test(asked) ? asked : null;
    if (chosen) headers.set(ORG_HEADER, chosen);
    const res = NextResponse.next({ request: { headers } });
    if (chosen && req.cookies.get(ORG_COOKIE)?.value !== chosen) {
      res.cookies.set(ORG_COOKIE, chosen, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 31536000,
      });
    }
    return res;
  }
  const next = req.nextUrl.pathname + req.nextUrl.search;
  // Build the redirect on the host the browser used (not req.nextUrl's bind host), so the
  // cookie scope stays the same and the Location is an absolute URL the middleware accepts.
  const login = new URL(`/login?next=${encodeURIComponent(next)}`, requestOrigin(req));
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/admin/:path*', '/board', '/intake', '/client/:path*', '/client'],
};
