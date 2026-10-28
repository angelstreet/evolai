import { notFound } from 'next/navigation';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { EngagementId } from '@evolai/contracts';
import { AppIcon, EmptyState, PageTitle } from '@evolai/ui';
import ChoiceBars from '@/components/mission/ChoiceBars';
import FindingPicker from '@/components/mission/FindingPicker';
import { answersViewFor } from '@/lib/answersData';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { findMission } from '@/lib/missionData';

export const dynamic = 'force-dynamic';

const CARD_SX = { p: { xs: 4, sm: 6 }, borderRadius: 3, mb: 5 } as const;

/**
 * Answers (TASK-AD2, ADR 0049): counts per choice and the anonymised free texts by question, with
 * no link to a person, from five answers only. Staff only: a referent or a view-as session is sent
 * to the client surface by the staff guard before this runs.
 */
export default async function AnswersPage({ params }: { params: { id: string } }) {
  const { t } = getT();
  if (!isUuid(params.id)) notFound();
  const mission = await findMission(await sessionTenantIds(), params.id);
  if (!mission) notFound();
  const view = await answersViewFor(mission.tenantId, params.id as EngagementId);
  const csvHref = `/admin/engagements/${mission.id}/answers/export?tenant=${mission.tenantId}`;
  const tooFew = 'tooFew' in view;
  const people = (n: number) => t('admin.answers.people', { n });
  return (
    <section className="wide admin" aria-labelledby="answers-title" data-testid="answers-tab">
      <PageTitle
        level="h2"
        id="answers-title"
        title={t('admin.missions.tabs.answers')}
        subtitle={
          tooFew
            ? t('admin.answers.exportLater', { n: MIN_GROUP_SIZE })
            : t('admin.answers.intro', { n: view.submitted })
        }
        actions={
          tooFew ? undefined : (
            <Button
              variant="outlined"
              href={csvHref}
              startIcon={<AppIcon name="download" size={20} />}
              data-testid="answers-csv"
            >
              {t('admin.answers.exportCsv')}
            </Button>
          )
        }
      />
      {tooFew ? (
        <>
          <EmptyState icon="privacy" title={t('admin.answers.tooFew', { n: MIN_GROUP_SIZE })} />
          <Typography color="text.secondary" data-testid="answers-so-far" sx={{ mt: 3 }}>
            {t('admin.answers.soFar', { n: view.tooFew })}
          </Typography>
        </>
      ) : (
        <>
          <Paper
            variant="outlined"
            component="section"
            aria-labelledby="choices-title"
            sx={CARD_SX}
          >
            <Typography
              id="choices-title"
              variant="sectionTitle"
              component="h3"
              sx={{ mt: 0, mb: 4 }}
            >
              {t('admin.answers.choicesTitle')}
            </Typography>
            {view.choices.map((c) => (
              <ChoiceBars
                key={c.code}
                choice={c}
                peopleLabel={people}
                headingLevel="h4"
                ariaLabel={t('admin.answers.chartAria', { question: c.question })}
              />
            ))}
          </Paper>
          <FindingPicker
            tenantId={mission.tenantId}
            engagementId={mission.id}
            choices={view.choices}
            texts={view.texts}
            minGroup={MIN_GROUP_SIZE}
          />
        </>
      )}
    </section>
  );
}
