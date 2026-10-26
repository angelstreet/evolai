import { NextResponse, type NextRequest } from 'next/server';
import { loadMemberships } from '@/lib/authProvider';
import { spendSpaceToken } from '@/lib/authTokens';
import {
  SESSION_COOKIE,
  newSessionPayload,
  sessionCookieOptions,
  signSession,
} from '@/lib/session';
import { CLIENT_ROLES } from '@/lib/tenantAccess';

export const dynamic = 'force-dynamic';

// Relative Location, like the sign-in route: behind a proxy the request host is not the browser's.
const redirectTo = (path: string) =>
  new NextResponse(null, { status: 303, headers: { location: path } });

/**
 * "Open my space" (TASK-AF, ADR 0051): `/client?open=<token>` lands here. A valid single-use
 * `space` token becomes the normal client session cookie; anything else goes to sign-in. The
 * token is only ever accepted for a team referent, never for staff.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const who = await spendSpaceToken(token);
  if (!who) return redirectTo('/login?error=link');
  const memberships = await loadMemberships(who.userId);
  const referent = memberships.some((m) => CLIENT_ROLES.has(m.role) && m.teamId);
  if (!referent) return redirectTo('/login?error=link');
  const session = await signSession(
    newSessionPayload({ id: who.userId, name: who.displayName }, memberships),
  );
  const res = redirectTo('/client');
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  return res;
}
