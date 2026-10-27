import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/authServer';
import {
  cleanLessons,
  loadProgress,
  saveProgress,
  type ProgressOutcome,
} from '@/lib/accountProgress';

export const dynamic = 'force-dynamic';

const STATUS = { ok: 200, signin: 401, unavailable: 503 };
const reply = (out: ProgressOutcome) => NextResponse.json(out, { status: STATUS[out.kind] });

/**
 * GET/PUT /api/progress (TASK-AI L1, ADR 0056): the signed-in account's "Your path". PUT merges and
 * never removes. Signed out gets 401; the page then keeps its browser state.
 */
export async function GET() {
  return reply(await loadProgress(await getSession()));
}

export async function PUT(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as {
    lessons?: unknown;
    surveyDone?: unknown;
    sent?: unknown;
  } | null;
  if (!b || !Array.isArray(b.lessons) || b.lessons.length > 20)
    return NextResponse.json({ kind: 'invalid' }, { status: 400 });
  return reply(
    await saveProgress(await getSession(), {
      lessons: cleanLessons(b.lessons),
      surveyDone: b.surveyDone === true,
      sent: b.sent === true,
    }),
  );
}
