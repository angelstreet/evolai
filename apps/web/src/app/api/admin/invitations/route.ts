import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/authServer';
import { isTenantAllowed } from '@/lib/tenantAccess';
import {
  InvitationError,
  extend,
  getSettings,
  listOpen,
  markReminded,
  progress,
  regenerate,
  reminderList,
  revoke,
} from '@/lib/invitationData';
import { isUuid } from '@/lib/invitationForm';
import { resolveBaseUrl } from '@/lib/invitationTracking';
import type { TenantId, UserId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Session-authenticated JSON API for scripts and the runbook (TASK-N). No addresses in this
 * surface: email mode goes through the admin screen. The tenant id is a selector only; the session
 * must already grant it. Progress is aggregate; the only per-invitation lists are links not yet
 * completed. Nothing here joins an invitation to an answer.
 */
const base = (req: NextRequest): string =>
  resolveBaseUrl(
    process.env,
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
    req.headers.get('x-forwarded-proto'),
  );

const authorise = async (tenantId: string, engagementId: string) => {
  const session = await getSession();
  if (
    !session ||
    !isUuid(tenantId) ||
    !isUuid(engagementId) ||
    !isTenantAllowed(session, tenantId)
  ) {
    return null;
  }
  return { actor: session.sub as UserId, tenantId: tenantId as TenantId, engagementId };
};

const forbidden = () => new NextResponse(null, { status: 403 });
const bad = (code: string) => NextResponse.json({ ok: false, code }, { status: 400 });

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const a = await authorise(q.get('tenant') ?? '', q.get('engagement') ?? '');
  if (!a) return forbidden();
  const view = q.get('view') ?? 'progress';
  if (view === 'open') {
    return NextResponse.json({
      ok: true,
      open: await listOpen(a.tenantId, a.engagementId, base(req)),
    });
  }
  if (view === 'reminders') {
    return NextResponse.json({
      ok: true,
      due: await reminderList(a.tenantId, a.engagementId, base(req)),
    });
  }
  const [p, settings] = await Promise.all([
    progress(a.tenantId, a.engagementId),
    getSettings(a.tenantId, a.engagementId),
  ]);
  return NextResponse.json({ ok: true, settings, ...p });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad('bad_json');
  }
  const a = await authorise(String(body['tenantId'] ?? ''), String(body['engagementId'] ?? ''));
  if (!a) return forbidden();
  const op = String(body['op'] ?? '');
  try {
    const id = String(body['invitationId'] ?? '');
    if (op === 'remind') {
      return NextResponse.json({
        ok: true,
        count: await markReminded(a.tenantId, a.engagementId, a.actor),
      });
    }
    if (!isUuid(id)) return bad('bad_id');
    if (op === 'revoke') await revoke(a.tenantId, id, a.actor);
    else if (op === 'extend') await extend(a.tenantId, id, a.actor, Number(body['days'] ?? 7));
    else if (op === 'regenerate') {
      return NextResponse.json({
        ok: true,
        link: await regenerate(a.tenantId, id, a.actor, base(req)),
      });
    } else return bad('bad_op');
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InvitationError) return bad(err.code);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
