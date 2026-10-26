'use server';

import { revalidatePath } from 'next/cache';
import { getSession, requestPath } from '@/lib/authServer';
import { loadClientSurvey } from '@/lib/clientData';
import { isUuid } from '@/lib/invitationForm';
import { ensureTeamAddresses, parseTeamSize, setExpectedSize } from '@/lib/teamAddresses';
import { effectiveContext } from '@/lib/tenantAccess';
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
