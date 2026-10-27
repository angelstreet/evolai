import { NextResponse, type NextRequest } from 'next/server';
import { PILOT_QUESTIONNAIRE } from '@evolai/contracts';
import { resolveEmailProvider } from '@/lib/emailProvider';
import { clientAddress } from '@/lib/loginThrottle';
import { hitPublicLimit } from '@/lib/publicThrottle';
import { formatOwnerMessage, parseSendRequest } from '@/lib/sendRequest';

export const dynamic = 'force-dynamic';

const CODES: ReadonlySet<string> = new Set(PILOT_QUESTIONNAIRE.questions.map((q) => q.code));

/**
 * POST /api/send: the last step of the front-page survey (ADR 0051, 0053). Public, throttled,
 * fails closed: with no contact address or no email provider nothing is accepted, so the visitor
 * is never told a request was received when it was not.
 */
export async function POST(req: NextRequest) {
  const parsed = parseSendRequest(await req.json().catch(() => null), CODES);
  if (!parsed) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  const to = process.env['CONTACT_EMAIL']?.trim();
  if (!to) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  // Shares the forgot-password counters (3 per address and 10 per network, per hour) with a prefix.
  if (await hitPublicLimit('forgot_password', `send:${parsed.email}`, clientAddress(req.headers))) {
    return NextResponse.json({ ok: false, error: 'busy' }, { status: 429 });
  }
  try {
    await resolveEmailProvider().send({ to, ...formatOwnerMessage(parsed) });
  } catch {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
