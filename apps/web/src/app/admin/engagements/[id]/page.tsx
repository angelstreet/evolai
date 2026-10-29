import Link from 'next/link';
import { notFound } from 'next/navigation';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { EngagementId } from '@evolai/contracts';
import { formatDate } from '@evolai/i18n';
import { EmptyState, PageTitle, StatusText } from '@evolai/ui';
import ChoiceBars from '@/components/mission/ChoiceBars';
import PrintReportButton from '@/components/report/PrintReportButton';
import { briefFor } from '@/lib/answersData';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { listEngagements } from '@/lib/adminData';
import { listFindings } from '@/lib/findingsData';
import { findMission } from '@/lib/missionData';
import { missionHref } from '@/lib/missionStatus';
import { sitePrompts } from '@/lib/sitePrompts';

export const dynamic = 'force-dynamic';

const CARD_SX = { p: { xs: 4, sm: 6 }, borderRadius: 3, mb: 5, breakInside: 'avoid-page' } as const;

/**
 * Overview = the pre-visit brief (TASK-AD2, review §3). Before a team reaches five answers it shows
 * only the counts (the next step is the header button); from five answers, per team: answers out
 * of headcount, closing date, one bar chart per choice question, the role mix and a link to the
 * free texts. Printable with the browser. Then "Ask on site" (TASK-AJ A7): one question per open
 * finding with the count behind it, and the standard question of the least documented axis.
 */
export default async function MissionOverviewPage({ params }: { params: { id: string } }) {
  const { t, locale } = getT();
  if (!isUuid(params.id)) notFound();
  const mission = await findMission(await sessionTenantIds(), params.id);
  if (!mission) notFound();
  const [teams, summaries, findings] = await Promise.all([
    briefFor(mission.tenantId, params.id as EngagementId),
    listEngagements(mission.tenantId),
    listFindings(mission.tenantId, params.id),
  ]);
  const links = summaries.find((s) => s.engagement.id === mission.id)?.invitationsTotal ?? 0;
  const anyShown = teams.some((x) => !x.hidden);
  const people = (n: number) => t('admin.answers.people', { n });
  const closes = mission.closesAt
    ? t('admin.brief.closes', { date: formatDate(locale, mission.closesAt) })
    : null;
  return (
    <section className="wide admin" aria-labelledby="brief-title" data-testid="mission-overview">
      <PageTitle
        level="h2"
        id="brief-title"
        title={t('admin.brief.title')}
        subtitle={
          anyShown ? t('admin.brief.intro') : t('admin.brief.beforeFive', { n: MIN_GROUP_SIZE })
        }
        actions={
          anyShown ? <PrintReportButton label={t('admin.brief.print')} variant="text" /> : undefined
        }
      />
      <Typography color="text.secondary" data-testid="brief-counts" sx={{ mb: 5 }}>
        {mission.expected >= mission.submitted
          ? t('admin.brief.counts', {
              links,
              submitted: mission.submitted,
              expected: mission.expected,
            })
          : t('admin.brief.countsOnly', { links, submitted: mission.submitted })}
        {closes ? ` ${closes}.` : null}
      </Typography>
      {anyShown && findings !== null ? (
        <Paper
          variant="outlined"
          component="section"
          aria-labelledby="ask-title"
          data-testid="brief-ask"
          sx={CARD_SX}
        >
          <Typography id="ask-title" variant="sectionTitle" component="h3" sx={{ m: 0 }}>
            {t('admin.brief.askTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
            {findings.some((f) => f.status !== 'rejected')
              ? t('admin.brief.askIntro')
              : t('admin.brief.askNone')}
          </Typography>
          <Stack component="ol" spacing={3} sx={{ m: 0, pl: 6 }}>
            {sitePrompts(t, findings).map((p, i) => (
              <li key={i} data-testid="brief-ask-item">
                <Typography variant="body1">{p.question}</Typography>
                {p.findings.length > 0 ? (
                  p.findings.map((f) => (
                    <Typography key={f.label} variant="body2" color="text.secondary">
                      {f.label} · {t('report.findings.people', { count: f.people })}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('admin.brief.askStandard')}
                  </Typography>
                )}
              </li>
            ))}
          </Stack>
        </Paper>
      ) : null}
      {teams.length === 0 ? (
        <EmptyState icon="team" title={t('admin.brief.noTeams')} />
      ) : (
        teams.map((team) => (
          <Paper
            key={team.teamId}
            variant="outlined"
            component="section"
            aria-labelledby={`team-${team.teamId}`}
            data-testid="brief-team"
            sx={CARD_SX}
          >
            <Typography
              id={`team-${team.teamId}`}
              variant="sectionTitle"
              component="h3"
              sx={{ m: 0 }}
            >
              {team.teamName}
            </Typography>
            <Stack direction="row" sx={{ gap: 4, flexWrap: 'wrap', mt: 1, mb: 4 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {team.expected >= team.submitted
                  ? t('admin.brief.teamAnswers', {
                      submitted: team.submitted,
                      expected: team.expected,
                    })
                  : t('admin.brief.teamAnswersOnly', { submitted: team.submitted })}
              </Typography>
              {closes ? (
                <Typography variant="body2" color="text.secondary">
                  {closes}
                </Typography>
              ) : null}
            </Stack>
            {team.hidden ? (
              <StatusText status="pending">
                {t('admin.brief.teamHidden', { n: MIN_GROUP_SIZE })}
              </StatusText>
            ) : (
              <>
                {team.choices.map((c) => (
                  <ChoiceBars
                    key={c.code}
                    choice={c}
                    peopleLabel={people}
                    headingLevel="h4"
                    ariaLabel={t('admin.answers.chartAria', { question: c.question })}
                  />
                ))}
                {team.roles ? (
                  <ChoiceBars
                    choice={{ ...team.roles, question: t('admin.brief.rolesTitle') }}
                    peopleLabel={people}
                    headingLevel="h4"
                    ariaLabel={t('admin.brief.rolesTitle')}
                  />
                ) : null}
                <Link href={`${missionHref(mission.id, 'answers', mission.tenantId)}#free-texts`}>
                  {t('admin.brief.freeTexts')}
                </Link>
              </>
            )}
          </Paper>
        ))
      )}
    </section>
  );
}
