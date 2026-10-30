import { notFound, redirect } from 'next/navigation';
import type { InvitationId, MascotTier, TenantId } from '@evolai/contracts';
import {
  createTranslator,
  isSupportedLocale,
  type SupportedLocale,
  type Translator,
} from '@evolai/i18n';
import { withServiceAccount, withTenant } from './db';
import { MIN_GROUP_SIZE } from './invitationTracking';
import { getLocale, localeIsChosen } from './i18n';
import { InvalidInviteToken, verifyInviteToken } from './invitationToken';
import { getOrCreateState, setLocale, type SurveyState } from './surveyState';

/**
 * Shared loader for every `/s/[token]` page (PRD §4.2, §5, §16).
 *
 * - A malformed or unknown token is a 404 (no hint that the invitation exists).
 * - An expired or withdrawn invitation returns `{ kind: 'blocked' }` so the page can say so in
 *   plain words instead of a dead end.
 * - The respondent's interface language (header switcher cookie, else Accept-Language) is the
 *   survey language; it is written back to the submission so the stored locale matches what
 *   the person actually read. One switcher, no mixed-language screens.
 */

export interface InvitationRecord {
  readonly tenantId: TenantId;
  readonly invitationId: InvitationId;
  readonly engagementId: string;
  readonly teamId: string;
  readonly pseudonym: string;
  readonly status: string;
  readonly expiresAt: string;
}

export type InvitationGate = 'ok' | 'expired' | 'withdrawn';

export const gateFor = (invite: Pick<InvitationRecord, 'status' | 'expiresAt'>, now: Date) => {
  if (invite.status === 'revoked' || invite.status === 'declined') return 'withdrawn';
  // A submitted invitation stays readable after expiry: the person can still see team progress.
  if (invite.status === 'submitted') return 'ok';
  if (invite.status === 'expired' || new Date(invite.expiresAt).getTime() < now.getTime()) {
    return 'expired';
  }
  return 'ok';
};

export const findInvitation = async (reference: string): Promise<InvitationRecord | null> =>
  withServiceAccount(async (client) => {
    const { rows } = await client.query<{
      tenant_id: string;
      id: string;
      engagement_id: string;
      team_id: string;
      respondent_pseudonym: string;
      status: string;
      expires_at: Date | string;
    }>(
      `SELECT tenant_id, id, engagement_id, team_id, respondent_pseudonym, status, expires_at
         FROM invitations WHERE token_reference = $1 LIMIT 1`,
      [reference],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      tenantId: row.tenant_id as TenantId,
      invitationId: row.id as InvitationId,
      engagementId: row.engagement_id,
      teamId: row.team_id,
      pseudonym: row.respondent_pseudonym,
      status: row.status,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  });

export type RespondentContext =
  | { kind: 'blocked'; gate: Exclude<InvitationGate, 'ok'>; locale: SupportedLocale; t: Translator }
  | {
      kind: 'ok';
      token: string;
      invite: InvitationRecord;
      state: SurveyState;
      locale: SupportedLocale;
      t: Translator;
    };

/** Language of the engagement behind an invitation, or null. */
const engagementLocale = async (engagementId: string): Promise<SupportedLocale | null> =>
  withServiceAccount(async (client) => {
    const { rows } = await client.query<{ locale: string }>(
      `SELECT locale FROM engagements WHERE id = $1 LIMIT 1`,
      [engagementId],
    );
    const l = rows[0]?.locale;
    return l && isSupportedLocale(l) ? l : null;
  });

/**
 * Resolve the invitation behind a token, or 404. Pages call this first.
 *
 * Language (TASK-T, ADR 0038): the person's own choice (cookie) wins; otherwise the engagement
 * language; otherwise the browser. On the entry page (`rememberLocale`) a first visit without a
 * choice is sent through `/api/locale/init`, which stores the engagement language in the cookie so
 * the header and footer match the page; `?l=1` on the way back stops any loop when cookies are off.
 */
export const loadRespondent = async (
  token: string,
  opts: { rememberLocale?: boolean } = {},
): Promise<RespondentContext> => {
  try {
    verifyInviteToken(token);
  } catch (err) {
    if (err instanceof InvalidInviteToken) notFound();
    throw err;
  }
  const invite = await findInvitation(token.split('.')[0] as string);
  if (!invite) notFound();
  const chosen = localeIsChosen();
  const locale = chosen
    ? getLocale()
    : ((await engagementLocale(invite.engagementId)) ?? getLocale());
  const t = createTranslator(locale);
  if (!chosen && opts.rememberLocale) {
    redirect(`/api/locale/init?locale=${locale}&to=${encodeURIComponent(`/s/${token}`)}`);
  }
  const gate = gateFor(invite, new Date());
  if (gate !== 'ok') return { kind: 'blocked', gate, locale, t };
  const state = await getOrCreateState(invite.tenantId, invite.invitationId);
  if (state.submissionId && state.locale !== locale) {
    await setLocale(invite.tenantId, state.submissionId, locale);
    state.locale = locale;
  }
  return { kind: 'ok', token, invite, state, locale, t };
};

/** Index of the first question without an answer, or `total` when every question has one. */
export const firstUnanswered = (answers: SurveyState['answers'], total: number): number => {
  for (let i = 0; i < total; i += 1) if (!answers[i]) return i;
  return total;
};

export interface TeamProgress {
  readonly answered: number;
  readonly invited: number;
  readonly engagementStatus: string;
  readonly closesAt: string | null;
  readonly teamTier: MascotTier | null;
  /** Per-engagement contact for questions and deletion requests, or null. */
  readonly contact: string | null;
}

/**
 * What a respondent may see about their team: counts only (PRD §4.3, §15). No names, no answers,
 * no per-person mascots; the team mascot is the precomputed dominant tier (ADR 0015).
 */
export const teamProgress = async (invite: InvitationRecord): Promise<TeamProgress> =>
  withTenant(invite.tenantId, async (client) => {
    // With one shared address per team (ADR 0052) an invitation exists only once someone opens
    // it, so the team's headcount is the better total ("1 of 8", not "1 of 1").
    const counts = await client.query<{ invited: number; answered: number }>(
      `SELECT GREATEST(COUNT(*)::int,
                       COALESCE((SELECT expected_headcount FROM teams
                                  WHERE tenant_id = $1 AND id = $3), 0)) AS invited,
              COUNT(*) FILTER (WHERE status = 'submitted')::int AS answered
         FROM invitations
        WHERE tenant_id = $1 AND engagement_id = $2 AND team_id = $3 AND status <> 'revoked'`,
      [invite.tenantId, invite.engagementId, invite.teamId],
    );
    const engagement = await client.query<{
      status: string;
      closes_at: Date | string | null;
      contact: string | null;
    }>(
      `SELECT status, closes_at, privacy_json->>'respondentContact' AS contact FROM engagements WHERE tenant_id = $1 AND id = $2`,
      [invite.tenantId, invite.engagementId],
    );
    const badge = await client.query<{ dominant_tier: MascotTier }>(
      // Small-group guard (TASK-U): no team mascot under the minimum group.
      `SELECT dominant_tier FROM team_badges WHERE tenant_id = $1 AND team_id = $2
          AND member_count >= $3
        ORDER BY computed_at DESC LIMIT 1`,
      [invite.tenantId, invite.teamId, MIN_GROUP_SIZE],
    );
    const closes = engagement.rows[0]?.closes_at ?? null;
    return {
      invited: counts.rows[0]?.invited ?? 0,
      answered: counts.rows[0]?.answered ?? 0,
      engagementStatus: engagement.rows[0]?.status ?? 'in_field',
      // After answering, the person's own link no longer matters: the date is the mission's closing
      // date, the same one the referent sees in their space, or none (TASK-AI walkthrough).
      closesAt: closes ? new Date(closes).toISOString() : null,
      teamTier: badge.rows[0]?.dominant_tier ?? null,
      contact: engagement.rows[0]?.contact?.trim() || null,
    };
  });

/** Honest time estimate: about 20 seconds per one-tap question, rounded up, never under a minute. */
export const estimatedMinutes = (questions: number): number =>
  Math.max(1, Math.ceil((questions * 20) / 60));
