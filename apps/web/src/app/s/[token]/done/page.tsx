import LinkProblem from '@/components/respondent/LinkProblem';
import RespondentStatus from '@/components/respondent/RespondentStatus';
import { redirect } from 'next/navigation';
import FinishButton from '@/components/respondent/FinishButton';
import { firstUnanswered, loadRespondent, teamProgress } from '@/lib/respondent';
import { totalQuestionCount } from '@/lib/syntheticTemplate';
import { isSubmitted } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
}

export default async function DonePage({ params }: { params: Params }) {
  const ctx = await loadRespondent(params.token);
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { invite, state, locale, t } = ctx;

  // Read-only: this page never submits (a prefetch or reload must not change state). Submission
  // happens through POST /api/submit.
  if (!state.submissionId) redirect(`/s/${params.token}`);
  if (!(await isSubmitted(invite.tenantId, state.submissionId))) {
    const total = totalQuestionCount();
    const missing = firstUnanswered(state.answers, total);
    if (missing < total) redirect(`/s/${params.token}/q/${missing}`);
    return (
      <section className="ck-card ck-try" aria-labelledby="one-more-title">
        <div className="ck-try-body ck-status-body">
          <h1 id="one-more-title" className="ck-q">
            {t('survey.oneMoreTitle')}
          </h1>
          <p>{t('survey.oneMoreBody')}</p>
          <FinishButton
            token={params.token}
            label={t('survey.finish')}
            messages={{ failed: t('survey.finishFailed') }}
          />
        </div>
      </section>
    );
  }
  const team = await teamProgress(invite);

  return (
    <RespondentStatus
      engagementId={invite.engagementId}
      title={t('survey.thanksTitle')}
      team={team}
      locale={locale}
      t={t}
    />
  );
}
