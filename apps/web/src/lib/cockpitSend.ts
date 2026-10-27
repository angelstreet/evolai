import type { SubmissionId, TenantId } from '@evolai/contracts';
import { isAllowedInput, parseAnswerValue } from './answerParser';
import { anonymiseForStorage } from './answerAnonymiser';
import { loadClientSurvey } from './clientData';
import { finishSurvey } from './finishSurvey';
import { ensureQuestionItemId } from './questionItems';
import { findInvitation, gateFor } from './respondent';
import type { SessionPayload } from './session';
import { getOrCreateState, isSubmitted, recordAnswer, recordSkip } from './surveyState';
import { SYNTHETIC_QUESTIONS, totalQuestionCount } from './syntheticTemplate';
import { ensureTeamAddresses, openByAddress } from './teamAddresses';
import { effectiveContext } from './tenantAccess';

/** Answers as the front page keeps them in the browser: an option index, or the person's words. */
export type BrowserAnswers = Readonly<Record<string, number | string>>;

export type CockpitSendResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'signin' }
  | { readonly kind: 'no_team' }
  | { readonly kind: 'read_only' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'choose'; readonly teams: readonly { slug: string; name: string }[] };

/** Map the browser's answers onto the survey's inputs: option value or text; null = skipped. */
export const toInputs = (answers: BrowserAnswers): (string | null)[] =>
  SYNTHETIC_QUESTIONS.map((q) => {
    const v = answers[q.code];
    if (q.kind === 'short_text') {
      return typeof v === 'string' && isAllowedInput(q, v) ? v.trim() : null;
    }
    const value = typeof v === 'number' ? q.options[v]?.value : undefined;
    return value !== undefined && isAllowedInput(q, value) ? value : null;
  });

/**
 * The front page's last step for a signed-in referent (ADR 0055): the answers kept in the browser
 * become one new anonymous response of the referent's team, exactly as if the team address had been
 * opened in a fresh browser (ADR 0052). Nothing links the response to the account. The team is
 * taken from the session; a slug from the request is only a selector among the referent's teams.
 */
export const sendCockpitAnswers = async (
  session: SessionPayload | null,
  answers: BrowserAnswers,
  locale: 'fr' | 'en',
  slug: string | null,
): Promise<CockpitSendResult> => {
  if (!session) return { kind: 'signin' };
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return { kind: 'no_team' };
  if (ctx.readOnly) return { kind: 'read_only' };
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  if (!survey) return { kind: 'no_team' };
  const tenantId = ctx.tenantId as TenantId;
  const addresses = (await ensureTeamAddresses(tenantId, survey.engagementId)).filter((a) =>
    ctx.teamIds.includes(a.teamId),
  );
  const chosen = slug
    ? addresses.find((a) => a.slug === slug)
    : addresses.length === 1
      ? addresses[0]
      : undefined;
  if (!chosen) {
    if (addresses.length === 0) return { kind: 'no_team' };
    return { kind: 'choose', teams: addresses.map((a) => ({ slug: a.slug, name: a.teamName })) };
  }

  const opened = await openByAddress(chosen.slug, null);
  if (opened.kind !== 'ok') return { kind: 'closed' };
  const invite = await findInvitation(opened.token.split('.')[0] as string);
  if (!invite || gateFor(invite, new Date()) !== 'ok') return { kind: 'closed' };
  const state = await getOrCreateState(invite.tenantId, invite.invitationId);
  const submissionId = state.submissionId as SubmissionId;
  if (await isSubmitted(invite.tenantId, submissionId)) return { kind: 'ok' };

  const inputs = toInputs(answers);
  for (const [index, q] of SYNTHETIC_QUESTIONS.entries()) {
    const itemId = await ensureQuestionItemId(invite.tenantId, q.code);
    if (!itemId) return { kind: 'closed' };
    const input = inputs[index] ?? null;
    if (input === null) {
      await recordSkip(invite.tenantId, submissionId, itemId, index);
      continue;
    }
    // Free text is anonymised before it is written, as on the survey pages.
    const stored =
      q.kind === 'short_text'
        ? ((await anonymiseForStorage(invite.tenantId, input, locale)) ?? input)
        : input;
    await recordAnswer(
      invite.tenantId,
      submissionId,
      itemId,
      index,
      parseAnswerValue(q.kind, stored),
    );
  }
  const done = await finishSurvey(invite.tenantId, invite.invitationId, totalQuestionCount());
  return done.ok ? { kind: 'ok' } : { kind: 'closed' };
};
