import { headers } from 'next/headers';
import QRCode from 'qrcode';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TenantId } from '@evolai/contracts';
import type { Translator } from '@evolai/i18n';
import { AppIcon, EmptyState, IconTile, PageTitle, StatusText } from '@evolai/ui';
import TeamCard from '@/components/client/TeamCard';
import { requireClientContext } from '@/lib/clientContext';
import {
  anyAnswerSubmitted,
  earliestLinkExpiryOn,
  firstLinkOn,
  loadClientSurvey,
  loadTeamNames,
  referentProgress,
} from '@/lib/clientData';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE, resolveBaseUrl } from '@/lib/invitationTracking';
import { longDate, prepareMessages } from '@/lib/referentMessages';
import {
  barValue,
  contactFor,
  daysUntil,
  effectiveCloseDay,
  reminderPlan,
  withLink,
  type Participation,
} from '@/lib/referentView';
import { loadProgress } from '@/lib/accountProgress';
import { loadPublishedReport } from '@/lib/reportData';
import { surveyEstimatedMinutes } from '@/lib/syntheticTemplate';
import { addressUrl, ensureTeamAddresses } from '@/lib/teamAddresses';

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

/** Words for one team's answers; never a number the minimum group rule hides. */
const answersText = (t: Translator, p: Participation): { main: string; hint?: string } => {
  if (p.invited === 0) return { main: t('client.home.noAnswers') };
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
  return { main: t('client.home.answered', { done: p.completed, total: p.invited }) };
};

/**
 * "My space" (TASK-AF, ADR 0052): one card per team with the team address, its QR code, Share
 * with the team, the questions, "N of M answered" and one reminder; then the report. No
 * per-person link and no password step: the referent opens this page from the welcome email.
 */
export default async function ClientHome() {
  const { session, ctx } = await requireClientContext();
  const { t, locale } = getT();
  const minutes = surveyEstimatedMinutes();
  const teams = await loadTeamNames(ctx.tenantId, ctx.teamIds);
  const header = (
    <PageTitle
      id="client-title"
      title={t('client.home.title')}
      subtitle={t('client.home.subtitle', { team: teams.join(', ') })}
    />
  );
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  if (!survey) {
    return (
      <section aria-labelledby="client-title">
        {header}
        <EmptyState icon="pending" title={t('client.home.noSurvey')} />
      </section>
    );
  }
  const h = headers();
  const baseUrl = resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
  const tenantId = ctx.tenantId as TenantId;
  const addresses = (await ensureTeamAddresses(tenantId, survey.engagementId)).filter((a) =>
    ctx.teamIds.includes(a.teamId),
  );
  const expected = new Map(addresses.map((a) => [a.teamId, a.expectedSize]));
  const [rows, published, anySubmitted, firstOn, expiryOn, own] = await Promise.all([
    referentProgress(ctx.tenantId, survey, ctx.teamIds, expected),
    loadPublishedReport(tenantId, survey.engagementId),
    anyAnswerSubmitted(ctx.tenantId, survey.engagementId, ctx.teamIds),
    firstLinkOn(ctx.tenantId, survey.engagementId, ctx.teamIds),
    earliestLinkExpiryOn(ctx.tenantId, survey.engagementId, ctx.teamIds),
    loadProgress(session),
  ]);
  const closeDay = effectiveCloseDay(survey.closesOn, expiryOn);
  const today = new Date().toISOString().slice(0, 10);
  const plan = reminderPlan({
    closesOn: survey.closesOn,
    firstLinkOn: firstOn,
    schedule: survey.reminderDays,
    today,
  });
  const open = survey.status === 'in_field' || survey.status === 'scheduled';
  const reminderHint = !open
    ? null
    : plan.due
      ? t('client.home.reminderDue')
      : plan.next
        ? t('client.home.reminderNext', { date: longDate(locale, plan.next) })
        : null;
  const hasResults = published !== null;
  // Only a yes/no leaves this page: no figure the minimum group rule hides.
  const noAnswersYet = !anySubmitted;
  const statusKey = STATUS_KEYS.has(survey.status) ? survey.status : 'none';
  const left = closeDay ? daysUntil(closeDay, today) : null;
  const contact = contactFor(survey.contact, ctx.viewAs?.label ?? session.name);

  const cards = await Promise.all(
    addresses.map(async (a, i) => {
      const url = addressUrl(baseUrl, a.slug);
      const facts = { closesOn: closeDay, contact, minutes, address: url };
      const fr = prepareMessages('fr', facts);
      const en = prepareMessages('en', facts);
      const row = rows.find((r) => r.teamId === a.teamId);
      const answers = row ? answersText(t, row) : { main: t('client.home.noAnswers') };
      return (
        <TeamCard
          key={a.id}
          teamId={a.teamId}
          teamName={a.teamName}
          address={url}
          qrSvg={await QRCode.toString(url, { type: 'svg', margin: 1 })}
          invite={{ fr: withLink(fr.invite.text, url), en: withLink(en.invite.text, url) }}
          reminder={{ fr: fr.reminder.text, en: en.reminder.text }}
          defaultLang={locale}
          expectedSize={a.expectedSize}
          primary={i === 0}
          answers={answers}
          bar={row && row.invited > 0 ? barValue(row) : null}
          reminderHint={reminderHint}
        />
      );
    }),
  );

  return (
    <section aria-labelledby="client-title">
      {header}
      <Stack spacing={4}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-survey">
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

        {/* The referent's own answers (TASK-AI L5): sent from the front page, or not yet. Only a
            yes/no from the account's progress; never which response is theirs (ADR 0055, 0056). */}
        {own.kind === 'ok' ? (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-own">
            <Typography variant="body1" sx={{ m: 0 }} data-testid="client-own-state">
              <StatusText status={own.progress.sent ? 'success' : 'pending'}>
                {own.progress.sent ? t('client.space.ownSent') : t('client.space.ownNotYet')}
              </StatusText>
            </Typography>
            {own.progress.sent ? null : (
              <Button
                variant="outlined"
                href="/?survey=1"
                endIcon={<AppIcon name="forward" size={16} />}
                data-testid="client-own-cta"
                sx={{ mt: 4, minHeight: 44 }}
              >
                {t('client.space.ownCta')}
              </Button>
            )}
          </Paper>
        ) : null}

        {noAnswersYet ? (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-learn">
            <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start' }}>
              <IconTile name="info" />
              <div>
                <Typography variant="cardTitle" component="h2" sx={{ m: 0 }}>
                  {t('client.space.learnTitle')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ m: 0, mt: 1 }}>
                  {t('client.space.learnNudge')}
                </Typography>
              </div>
            </Stack>
            <Button
              variant="outlined"
              href="/?learn=1"
              endIcon={<AppIcon name="forward" size={16} />}
              data-testid="client-learn-cta"
              sx={{ mt: 4, minHeight: 44 }}
            >
              {t('client.space.learnCta')}
            </Button>
          </Paper>
        ) : null}

        {cards}

        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-report">
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 2 }}>
            {t('client.home.reportLabel')}
          </Typography>
          <Typography variant="body1" sx={{ m: 0 }} data-testid="client-report-state">
            <StatusText status={hasResults ? 'success' : 'pending'}>
              {hasResults ? t('client.home.reportReady') : t('client.home.reportPending')}
            </StatusText>
          </Typography>
          {hasResults ? (
            <Button
              variant="outlined"
              href="/client/report"
              endIcon={<AppIcon name="forward" size={16} />}
              data-testid="client-report-open"
              sx={{ mt: 4, minHeight: 44 }}
            >
              {t('client.home.reportOpen')}
            </Button>
          ) : null}
        </Paper>
      </Stack>
    </section>
  );
}
