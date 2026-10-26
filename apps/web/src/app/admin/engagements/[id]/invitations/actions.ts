'use server';

import { revalidatePath } from 'next/cache';
import { resolveActor } from '@/lib/authServer';
import { getSettings, updateSettings } from '@/lib/invitationData';
import { isUuid } from '@/lib/invitationForm';
import { parseReminderDays } from '@/lib/invitationTracking';
import { parseContact } from '@/lib/referentView';
import { parseTeamSize, setExpectedSize, setSlug } from '@/lib/teamAddresses';

/**
 * Team tab actions (TASK-AF). The actor and the tenant come from the session (`resolveActor`);
 * the form's tenant id is only a selector. Results are codes the page maps to words.
 */
export interface TeamActionState {
  readonly ok: boolean;
  readonly code: string;
}

export const teamIdle: TeamActionState = { ok: false, code: 'idle' };

const guard = async (fd: FormData) => {
  const tenantId = String(fd.get('tenantId') ?? '');
  const engagementId = String(fd.get('engagementId') ?? '');
  if (!isUuid(tenantId) || !isUuid(engagementId)) return null;
  const who = await resolveActor(tenantId);
  return who.ok ? { who, engagementId } : null;
};

/** Save one team's address ending and expected size. */
export async function saveTeamAddressAction(
  _prev: TeamActionState,
  fd: FormData,
): Promise<TeamActionState> {
  const g = await guard(fd);
  if (!g) return { ok: false, code: 'forbidden' };
  const teamId = String(fd.get('teamId') ?? '');
  if (!isUuid(teamId)) return { ok: false, code: 'not_found' };
  const size = parseTeamSize(fd.get('size'));
  if (size === undefined) return { ok: false, code: 'bad_size' };
  try {
    const slug = await setSlug(
      g.who.tenantId,
      g.engagementId,
      teamId,
      String(fd.get('slug') ?? ''),
    );
    if (!slug.ok) return { ok: false, code: slug.reason };
    if (!(await setExpectedSize(g.who.tenantId, g.engagementId, teamId, size))) {
      return { ok: false, code: 'not_found' };
    }
    revalidatePath('/admin/engagements', 'layout');
    revalidatePath('/client', 'layout');
    return { ok: true, code: 'saved' };
  } catch {
    return { ok: false, code: 'error' };
  }
}

/** Save the contact person and the reminder days; the other options stay as they are. */
export async function saveTeamMessagesAction(
  _prev: TeamActionState,
  fd: FormData,
): Promise<TeamActionState> {
  const g = await guard(fd);
  if (!g) return { ok: false, code: 'forbidden' };
  try {
    const current = await getSettings(g.who.tenantId, g.engagementId);
    if (!current) return { ok: false, code: 'error' };
    const days = String(fd.get('reminderDays') ?? '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    await updateSettings(g.who.tenantId, g.engagementId, g.who.actor, {
      emailDelivery: current.emailDelivery,
      reminderDays: parseReminderDays(days),
      closesOn: current.closesOn,
      contact: parseContact(fd.get('contact')),
    });
    revalidatePath('/admin/engagements', 'layout');
    revalidatePath('/client', 'layout');
    return { ok: true, code: 'saved' };
  } catch {
    return { ok: false, code: 'error' };
  }
}
