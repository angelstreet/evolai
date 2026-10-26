import { notFound, redirect } from 'next/navigation';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon } from '@evolai/ui';
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
  searchParams: { l?: string; closed?: string };
}) {
  // A team address (`/s/demo-sales`, TASK-AF): the route handler gives this browser its own
  // invitation and sends it back here with the signed token.
  if (looksLikeSlug(params.token)) {
    if (searchParams.closed === '1') return <LinkProblem gate="expired" t={getT().t} />;
    if (searchParams.closed === '0') notFound();
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
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="welcome-title"
      sx={{ p: { xs: 5, sm: 8 }, borderRadius: 4 }}
    >
      <Typography id="welcome-title" variant="pageTitle" component="h1" sx={{ m: 0 }}>
        {t('survey.title')}
      </Typography>
      <Typography variant="lede" component="p" color="text.secondary" sx={{ mt: 3, mb: 0 }}>
        {t('survey.lede')}
      </Typography>
      {notice?.controller ? (
        <Typography
          variant="body2"
          component="p"
          color="text.secondary"
          data-testid="who-is-asking"
          sx={{ mt: 3, mb: 0 }}
        >
          {t('trust.entry.asking', { org: notice.controller })}{' '}
          {notice.contact ? t('trust.entry.contact', { contact: notice.contact }) : null}{' '}
          {t('trust.entry.why', { purpose: notice.purpose ?? t('trust.notice.defaultPurpose') })}
        </Typography>
      ) : null}
      <Stack direction="row" sx={{ mt: 4, gap: 2, alignItems: 'center', color: 'text.secondary' }}>
        <AppIcon name="time" />
        <Typography variant="body2" component="p" sx={{ m: 0 }}>
          {answered > 0
            ? t('survey.resumeProgress', { done: answered, n: total })
            : t('survey.duration', { n: total, m: surveyEstimatedMinutes() })}
        </Typography>
      </Stack>
      <Button
        variant="contained"
        size="large"
        fullWidth
        href={`/s/${params.token}/q/${next}`}
        endIcon={<AppIcon name="forward" />}
        sx={{ mt: 6 }}
      >
        {answered > 0 ? t('survey.resume') : t('survey.start')}
      </Button>
      <Typography variant="body2" component="p" color="text.secondary" sx={{ mt: 4, mb: 4 }}>
        {t('survey.howItWorks')}
      </Typography>
      <PrivacyNotice t={t} engagementId={invite.engagementId} />
    </Paper>
  );
}
