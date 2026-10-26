import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Translator } from '@evolai/i18n';
import { AppIcon, EmptyState, IconTile, PageTitle, StatusText } from '@evolai/ui';
import { requireClientContext } from '@/lib/clientContext';
import {
  earliestLinkExpiryOn,
  firstLinkOn,
  loadClientSurvey,
  loadPublishedResults,
  loadTeamNames,
  referentProgress,
} from '@/lib/clientData';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { longDate, prepareMessages } from '@/lib/referentMessages';
import {
  barValue,
  contactFor,
  daysUntil,
  effectiveCloseDay,
  nextStep,
  reminderPlan,
  type NextStep,
  type Participation,
} from '@/lib/referentView';
import { surveyEstimatedMinutes } from '@/lib/syntheticTemplate';
import HomeReminder from '@/components/client/HomeReminder';

export const dynamic = 'force-dynamic';

const STATUS_KEYS = new Set([
  'draft',
  'scheduled',
  'in_field',
  'analysis',
  'review',
  'closed',
  'archived',
]);

const CTA: Record<NextStep, string | null> = {
  create: '/client/invitations',
  share: '/client/invitations#links',
  remind: '/client/invitations#reminder',
  wait: null,
  results: '/client/results',
};

const ICON = {
  create: 'add',
  share: 'invite',
  remind: 'time',
  wait: 'pending',
  results: 'results',
} as const;

/** Words for one team's participation; never a number the minimum group rule hides. */
const participationText = (t: Translator, p: Participation): { main: string; hint?: string } => {
  if (p.invited === 0) return { main: t('client.home.noLinks') };
  if (p.kind === 'hidden') {
    return {
      main: t('client.home.hidden', { count: p.invited }),
      hint: t('client.home.hiddenHint', { n: MIN_GROUP_SIZE }),
    };
  }
  if (p.kind === 'band') {
    return {
      main: t(`client.home.band.${p.band}`),
      hint: t('client.home.bandHint', { n: MIN_GROUP_SIZE }),
    };
  }
  return {
    main: t('client.home.answered', { done: p.completed, total: p.invited }),
    hint: t('client.home.startedCount', { count: p.started }),
  };
};

/**
 * Team space home (TASK-P, TASK-S, ADR 0039): the survey and its closing date, answers per team
 * as a bar ("12 of 24 answered" only when the minimum group rules allow it), and the one thing to
 * do next. The reminder step appears only on a suggested day while the survey is open.
 */
export default async function ClientHome() {
  const { session, ctx } = await requireClientContext();
  const { t, locale } = getT();
  const minutes = surveyEstimatedMinutes();
  const teams = await loadTeamNames(ctx.tenantId, ctx.teamIds);
  const teamName = teams.join(', ');
  const header = (
    <PageTitle
      id="client-title"
      title={t('client.home.title')}
      subtitle={t('client.home.subtitle', { team: teamName })}
    />
  );
  const how = (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-how">
      <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 2 }}>
        {t('client.home.how.title')}
      </Typography>
      <Typography variant="body1" sx={{ m: 0, mb: 2 }}>
        {t('client.home.how.ask', { minutes })}
      </Typography>
      <Typography variant="body1" sx={{ m: 0, mb: 3 }}>
        {t('client.home.how.who', { n: MIN_GROUP_SIZE })}
      </Typography>
      <Box
        component="ol"
        aria-label={t('client.home.how.stepsLabel')}
        sx={{ m: 0, pl: 5, '& li': { py: 0.5 } }}
      >
        <li>{t('client.home.how.send')}</li>
        <li>{t('client.home.how.remind')}</li>
        <li>{t('client.home.how.report')}</li>
      </Box>
    </Paper>
  );
  const learn = (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-learn">
      <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start' }}>
        <IconTile name="info" />
        <div>
          <Typography variant="cardTitle" component="h2" sx={{ m: 0 }}>
            {t('learn.entry.cardTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ m: 0, mt: 1 }}>
            {t('learn.entry.cardBody')}
          </Typography>
        </div>
      </Stack>
      <Button
        variant="outlined"
        href="/learn"
        endIcon={<AppIcon name="forward" size={16} />}
        data-testid="client-learn-cta"
        sx={{ mt: 4, minHeight: 44 }}
      >
        {t('learn.entry.cardCta')}
      </Button>
    </Paper>
  );
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  if (!survey) {
    return (
      <section aria-labelledby="client-title">
        {header}
        <Stack spacing={4}>
          {how}
          {learn}
          <EmptyState icon="pending" title={t('client.home.noSurvey')} />
        </Stack>
      </section>
    );
  }
  const [rows, results, firstOn, expiryOn] = await Promise.all([
    referentProgress(ctx.tenantId, survey, ctx.teamIds),
    loadPublishedResults(ctx.tenantId, survey.engagementId),
    firstLinkOn(ctx.tenantId, survey.engagementId, ctx.teamIds),
    earliestLinkExpiryOn(ctx.tenantId, survey.engagementId, ctx.teamIds),
  ]);
  const closeDay = effectiveCloseDay(survey.closesOn, expiryOn);
  const today = new Date().toISOString().slice(0, 10);
  const plan = reminderPlan({
    closesOn: survey.closesOn,
    firstLinkOn: firstOn,
    schedule: survey.reminderDays,
    today,
  });
  const hasResults = results.themes.length > 0 || results.opportunities.length > 0;
  const step = nextStep({ status: survey.status, rows, hasResults, plan });
  const cta = CTA[step];
  const statusKey = STATUS_KEYS.has(survey.status) ? survey.status : 'none';
  const left = closeDay ? daysUntil(closeDay, today) : null;
  // The reminder is for an open survey with links out and a day still ahead (or today).
  const showReminder =
    (survey.status === 'in_field' || survey.status === 'scheduled') &&
    rows.some((r) => r.invited > 0) &&
    (plan.due || plan.next !== null);
  const reminder = prepareMessages(locale, {
    closesOn: closeDay,
    contact: contactFor(survey.contact, ctx.viewAs?.label ?? session.name),
    minutes,
  }).reminder;
  const nextText =
    step === 'share' && plan.next
      ? t('client.home.next.shareUntil', { date: longDate(locale, plan.next) })
      : t(`client.home.next.${step}`);

  return (
    <section aria-labelledby="client-title">
      {header}
      <Stack spacing={4}>
        {how}
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-survey">
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 3 }}>
            {t('client.home.surveyTitle')}
          </Typography>
          <Typography variant="body1" sx={{ m: 0 }} data-testid="client-status">
            <StatusText
              status={
                statusKey === 'in_field'
                  ? 'running'
                  : statusKey === 'closed'
                    ? 'success'
                    : 'pending'
              }
            >
              {survey.name} · {t(`client.home.status.${statusKey}` as 'client.home.status.none')}
            </StatusText>
          </Typography>
          <Stack
            direction="row"
            sx={{ mt: 2, gap: 2, alignItems: 'center', color: 'text.secondary' }}
            data-testid="client-closing"
          >
            <AppIcon name="date" />
            <Typography variant="body1" sx={{ m: 0 }}>
              {closeDay === null || left === null
                ? t('client.home.noClosingDate')
                : left < 0
                  ? t('client.home.closed', { date: longDate(locale, closeDay) })
                  : `${t('client.home.closes', { date: longDate(locale, closeDay) })} · ${t('client.home.daysLeft', { count: left })}`}
            </Typography>
          </Stack>
        </Paper>

        {learn}
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-progress">
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 3 }}>
            {t('client.home.progressTitle')}
          </Typography>
          <Stack spacing={4}>
            {rows.map((p) => {
              const text = participationText(t, p);
              const value = p.invited === 0 ? null : barValue(p);
              return (
                <Box key={p.teamId} data-testid="client-team-progress" data-kind={p.kind}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    sx={{ justifyContent: 'space-between', gap: 1, mb: 2 }}
                  >
                    <Typography variant="cardTitle" component="h3" sx={{ m: 0 }}>
                      {p.teamName}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ m: 0, fontVariantNumeric: 'tabular-nums' }}
                      data-testid="client-team-answered"
                    >
                      {text.main}
                    </Typography>
                  </Stack>
                  {value !== null ? (
                    <LinearProgress
                      variant="determinate"
                      value={value}
                      aria-label={t('client.home.progressAria', { team: p.teamName })}
                      aria-valuetext={text.main}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  ) : null}
                  {text.hint ? (
                    <Typography variant="body1" color="text.secondary" sx={{ m: 0, mt: 2 }}>
                      {text.hint}
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-next">
          <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start' }}>
            <IconTile name={ICON[step]} />
            <div>
              <Typography variant="cardTitle" component="h2" sx={{ m: 0 }}>
                {t('client.home.nextTitle')}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ m: 0, mt: 1 }}>
                {nextText}
              </Typography>
            </div>
          </Stack>
          {cta ? (
            <Button
              variant="contained"
              href={cta}
              endIcon={<AppIcon name="forward" size={16} />}
              data-testid={`client-cta-${step}`}
              sx={{ mt: 6, minHeight: 44 }}
            >
              {t(`client.home.cta.${step as Exclude<NextStep, 'wait'>}`)}
            </Button>
          ) : null}
        </Paper>
        {showReminder ? (
          <HomeReminder
            date={plan.next ? longDate(locale, plan.next) : null}
            today={plan.due}
            text={reminder.text}
          />
        ) : null}
      </Stack>
    </section>
  );
}
