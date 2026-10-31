import { notFound, redirect } from 'next/navigation';
import Button from '@mui/material/Button';
import { ARROW_RIGHT, EDIT } from '@/components/chrome/cockpit/icons';
import LinkProblem from '@/components/respondent/LinkProblem';
import PrivacyNotice from '@/components/respondent/PrivacyNotice';
import RespondentStatus from '@/components/respondent/RespondentStatus';
import { firstUnanswered, loadRespondent, teamProgress } from '@/lib/respondent';
import { getPublicNotice } from '@/lib/privacyNotice';
import { surveyEstimatedMinutes, totalQuestionCount } from '@/lib/syntheticTemplate';
import { isSubmitted } from '@/lib/surveyState';
import { getT } from '@/lib/i18n';
import { looksLikeSlug } from '@/lib/teamAddresses';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

/**
 * Invitation landing. First visit: what this is, how long, privacy in one line, one Start button.
 * Interrupted visit: the same, with "continue where you left off". After submitting: the
 * respondent's status view (team progress, what happens next).
 */
export default async function WelcomePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: { l?: string; closed?: string; opens?: string };
}) {
  // A team address (`/s/demo-sales`, TASK-AF): the route handler gives this browser its own
  // invitation and sends it back here with the signed token.
  if (looksLikeSlug(params.token)) {
    if (searchParams.closed === '1') return <LinkProblem gate="expired" t={getT().t} />;
    if (searchParams.closed === '0') notFound();
    if (/^\d{4}-\d{2}-\d{2}$/.test(searchParams.opens ?? '')) {
      const { t, locale } = getT();
      return <LinkProblem gate="not_yet" t={t} opensOn={searchParams.opens} locale={locale} />;
    }
    redirect(`/s/open/${params.token}`);
  }
  const ctx = await loadRespondent(params.token, { rememberLocale: searchParams.l !== '1' });
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { invite, state, locale, t } = ctx;
  const total = totalQuestionCount();

  if (state.submissionId && (await isSubmitted(invite.tenantId, state.submissionId))) {
    const team = await teamProgress(invite);
    return (
      <RespondentStatus
        engagementId={invite.engagementId}
        title={t('survey.alreadyTitle')}
        team={team}
        locale={locale}
        t={t}
      />
    );
  }

  const notice = (await getPublicNotice(invite.engagementId))?.notice ?? null;
  const answered = Object.keys(state.answers).length;
  const next = Math.min(firstUnanswered(state.answers, total), total - 1);
  return (
    <section
      className="ck-card ck-try"
      aria-labelledby="welcome-title"
      data-testid="survey-welcome"
    >
      <div className="ck-try-head">
        <h2>
          {EDIT}
          <span>{t('cockpit.menu.survey')}</span>
        </h2>
        <span className="ck-count">
          {answered > 0
            ? t('survey.resumeProgress', { done: answered, n: total })
            : t('survey.duration', { n: total, m: surveyEstimatedMinutes() })}
        </span>
      </div>
      <div className="ck-try-body ck-status-body">
        <h1 id="welcome-title" className="ck-q">
          {t('survey.title')}
        </h1>
        <p className="ck-lede">{t('survey.lede')}</p>
        {notice?.controller ? (
          <p className="ck-muted ck-small" data-testid="who-is-asking">
            {t('trust.entry.asking', { org: notice.controller })}{' '}
            {notice.contact ? t('trust.entry.contact', { contact: notice.contact }) : null}{' '}
            {t('trust.entry.why', { purpose: notice.purpose ?? t('trust.notice.defaultPurpose') })}
          </p>
        ) : null}
        <Button
          variant="contained"
          size="large"
          fullWidth
          href={`/s/${params.token}/q/${next}`}
          sx={{ minHeight: 48 }}
        >
          {answered > 0 ? t('survey.resume') : t('survey.start')}
          {ARROW_RIGHT}
        </Button>
        <p className="ck-muted ck-small">{t('survey.howItWorks')}</p>
        <PrivacyNotice t={t} engagementId={invite.engagementId} />
      </div>
    </section>
  );
}
