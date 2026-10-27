import { NextResponse, type NextRequest } from 'next/server';
import { domainAcceptsMail, formatOwnerMessage, parseEmail } from '@/lib/auditRequest';
import { resolveEmailProvider } from '@/lib/emailProvider';
import { clientAddress } from '@/lib/loginThrottle';
import { hitPublicLimit } from '@/lib/publicThrottle';

export const dynamic = 'force-dynamic';

/**
 * POST /api/audit-request (TASK-AI L6): a visitor asks for an audit with a valid email. Asking again
 * is fine; a burst is not (the public limit). Fails closed: with no contact address or no email
 * provider nothing is accepted, so the visitor is never told a request arrived when it did not.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; locale?: unknown } | null;
  const email = parseEmail(body?.email);
  if (!email) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  const locale = body?.locale === 'fr' ? 'fr' : 'en';
  const mail = await domainAcceptsMail(email);
  if (mail === 'no_mail')
    return NextResponse.json({ ok: false, error: 'no_mail' }, { status: 400 });
  const to = process.env['CONTACT_EMAIL']?.trim();
  if (!to || mail === 'unknown')
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  // Shares the forgot-password counters (3 per address and 10 per network, per hour) with a prefix.
  if (await hitPublicLimit('forgot_password', `audit:${email}`, clientAddress(req.headers))) {
    return NextResponse.json({ ok: false, error: 'busy' }, { status: 429 });
  }
  try {
    await resolveEmailProvider().send({ to, ...formatOwnerMessage(email, locale) });
  } catch {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
