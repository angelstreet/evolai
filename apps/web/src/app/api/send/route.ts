import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/authServer';
import { sendCockpitAnswers, type BrowserAnswers } from '@/lib/cockpitSend';

export const dynamic = 'force-dynamic';

const STATUS = { ok: 200, signin: 401, no_team: 403, read_only: 403, closed: 410, choose: 409 };

const parse = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as { answers?: unknown; locale?: unknown; slug?: unknown };
  if (!b.answers || typeof b.answers !== 'object' || Array.isArray(b.answers)) return null;
  const answers: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(b.answers as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isInteger(v)) answers[k] = v;
    else if (typeof v === 'string' && v.length <= 2000) answers[k] = v;
  }
  return {
    answers: answers as BrowserAnswers,
    locale: b.locale === 'fr' ? ('fr' as const) : ('en' as const),
    slug: typeof b.slug === 'string' && b.slug.length <= 120 ? b.slug : null,
  };
};

/**
 * POST /api/send: the front page's last step (ADR 0055). Signed in only: the answers kept in the
 * browser become one anonymous response of the referent's own team. Signed out gets `signin`.
 */
export async function POST(req: NextRequest) {
  const body = parse(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ kind: 'invalid' }, { status: 400 });
  const out = await sendCockpitAnswers(await getSession(), body.answers, body.locale, body.slug);
  return NextResponse.json(out, { status: STATUS[out.kind] });
}
