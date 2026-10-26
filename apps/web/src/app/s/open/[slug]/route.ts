import { NextResponse, type NextRequest } from 'next/server';
import { addressCookieName, openByAddress } from '@/lib/teamAddresses';

export const dynamic = 'force-dynamic';

const COOKIE_DAYS = 120;

// Relative Location, like the sign-in route: behind a proxy the request host is not the browser's.
const redirectTo = (path: string) =>
  new NextResponse(null, { status: 303, headers: { location: path } });

/**
 * A team address was opened (TASK-AF, ADR 0051). A browser without a cookie for this address gets
 * one new anonymous invitation; its signed token is kept in an httpOnly cookie scoped to `/s/`,
 * so the same browser lands on its own answers and a second browser gets its own.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const name = addressCookieName(slug);
  const out = await openByAddress(slug, req.cookies.get(name)?.value ?? null);
  if (out.kind === 'unknown') return redirectTo(`/s/${slug}?closed=0`);
  if (out.kind === 'closed') return redirectTo(`/s/${slug}?closed=1`);
  const res = redirectTo(`/s/${out.token}`);
  if (out.created) {
    res.cookies.set(name, out.token, {
      path: '/s/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_DAYS * 86_400,
    });
  }
  return res;
}
