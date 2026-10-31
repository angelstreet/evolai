'use server';

import { revalidatePath } from 'next/cache';
import { getSession, requestPath } from '@/lib/authServer';
import { loadClientSurvey } from '@/lib/clientData';
import { FindingError, reviewFinding } from '@/lib/findingsData';
import { isUuid } from '@/lib/invitationForm';
import { ensureTeamAddresses, parseTeamSize, setExpectedSize } from '@/lib/teamAddresses';
import { effectiveContext } from '@/lib/tenantAccess';
import { setClientRanks, UseCaseError } from '@/lib/useCaseData';
import { auditViewAs } from '@/lib/viewAsAudit';
import type { TenantId } from '@evolai/contracts';

export interface TeamSizeState {
  readonly ok: boolean;
  readonly code: 'idle' | 'saved' | 'bad_size' | 'read_only' | 'forbidden' | 'failed';
}

/**
 * Team size for the "N of M answered" line (TASK-AF). Tenant, team and engagement come from the
 * signed session and the database; the form only carries the team and the number. A view-as
 * session is refused: read only.
 */
export async function setTeamSizeAction(
  _prev: TeamSizeState,
  fd: FormData,
): Promise<TeamSizeState> {
  const session = await getSession();
  if (!session) return { ok: false, code: 'forbidden' };
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return { ok: false, code: 'forbidden' };
  if (ctx.viewAs || ctx.readOnly) {
    if (ctx.viewAs) {
      await auditViewAs(session, ctx.viewAs, 'view_as.refused', { path: requestPath() }).catch(
        () => undefined,
      );
    }
    return { ok: false, code: 'read_only' };
  }
  const size = parseTeamSize(fd.get('size'));
  if (size === undefined) return { ok: false, code: 'bad_size' };
  const teamId = String(fd.get('teamId') ?? '');
  if (!isUuid(teamId) || !ctx.teamIds.includes(teamId)) return { ok: false, code: 'forbidden' };
  try {
    const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
    if (!survey || !survey.teams.some((t) => t.id === teamId))
      return { ok: false, code: 'forbidden' };
    await ensureTeamAddresses(ctx.tenantId as TenantId, survey.engagementId);
    const ok = await setExpectedSize(ctx.tenantId as TenantId, survey.engagementId, teamId, size);
    if (!ok) return { ok: false, code: 'failed' };
    revalidatePath('/client');
    return { ok: true, code: 'saved' };
  } catch {
    return { ok: false, code: 'failed' };
  }
}

export interface ReviewState {
  readonly ok: boolean;
  readonly code: string;
}

/**
 * The referent confirms or disputes a finding before the report is published (TASK-AJ A8, ADR
 * 0059). Tenant and engagement come from the session's teams; the form carries only the finding,
 * the verdict and one line. A view-as session is refused: read only.
 */
export async function reviewFindingAction(_prev: ReviewState, fd: FormData): Promise<ReviewState> {
  const session = await getSession();
  if (!session) return { ok: false, code: 'forbidden' };
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return { ok: false, code: 'forbidden' };
  if (ctx.viewAs || ctx.readOnly) {
    if (ctx.viewAs) {
      await auditViewAs(session, ctx.viewAs, 'view_as.refused', { path: requestPath() }).catch(
        () => undefined,
      );
    }
    return { ok: false, code: 'read_only' };
  }
  const findingId = String(fd.get('findingId') ?? '');
  const verdict = String(fd.get('verdict') ?? '');
  const comment = String(fd.get('comment') ?? '').slice(0, 300);
  if (!isUuid(findingId) || (verdict !== 'confirmed' && verdict !== 'disputed')) {
    return { ok: false, code: 'forbidden' };
  }
  try {
    const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
    if (!survey) return { ok: false, code: 'forbidden' };
    await reviewFinding(
      ctx.tenantId as TenantId,
      session.sub,
      survey.engagementId,
      findingId,
      verdict,
      comment,
    );
    revalidatePath('/client/report');
    return { ok: true, code: verdict };
  } catch (err) {
    if (err instanceof FindingError) return { ok: false, code: err.code };
    return { ok: false, code: 'error' };
  }
}

/**
 * The referent puts the use cases in order of priority while the report is in review (ADR 0064).
 * Each use case comes with `rank_<id>` = 1..n; ties keep the page order. Read only in view-as.
 */
export async function rankUseCasesAction(_prev: ReviewState, fd: FormData): Promise<ReviewState> {
  const session = await getSession();
  if (!session) return { ok: false, code: 'forbidden' };
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return { ok: false, code: 'forbidden' };
  if (ctx.viewAs || ctx.readOnly) {
    if (ctx.viewAs) {
      await auditViewAs(session, ctx.viewAs, 'view_as.refused', { path: requestPath() }).catch(
        () => undefined,
      );
    }
    return { ok: false, code: 'read_only' };
  }
  const ranked = [...fd.entries()]
    .filter(([k]) => k.startsWith('rank_'))
    .map(([k, v], i) => ({ id: k.slice(5), rank: Number(v), i }))
    .filter((x) => isUuid(x.id) && Number.isInteger(x.rank) && x.rank >= 1)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.id);
  if (ranked.length === 0) return { ok: false, code: 'forbidden' };
  try {
    const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
    if (!survey) return { ok: false, code: 'forbidden' };
    await setClientRanks(ctx.tenantId as TenantId, session.sub, survey.engagementId, ranked);
    revalidatePath('/client/report');
    return { ok: true, code: 'ranked' };
  } catch (err) {
    if (err instanceof UseCaseError) return { ok: false, code: err.code };
    return { ok: false, code: 'error' };
  }
}
