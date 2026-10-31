import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { EmptyState, PageTitle } from '@evolai/ui';
import VisitNotes from '@/components/mission/VisitNotes';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { findMission } from '@/lib/missionData';
import { visitGuide } from '@/lib/useCaseData';
import { visitTab } from '@/lib/visitData';

export const dynamic = 'force-dynamic';

/**
 * Visit (TASK-AJ A6, ADR 0059): dated notes of the on-site interviews, observations and workshops,
 * anonymised on save, and "Write a finding from the notes". Staff only: a referent or a view-as
 * session is sent to the client surface by the staff guard before this runs.
 */
export default async function VisitPage({ params }: { params: { id: string } }) {
  const { t, locale } = getT();
  if (!isUuid(params.id)) notFound();
  const mission = await findMission(await sessionTenantIds(), params.id);
  if (!mission) notFound();
  const { notes, teams } = await visitTab(mission.tenantId, mission.id);
  const guide = await visitGuide(mission.tenantId, mission.id);
  return (
    <section className="wide admin" aria-labelledby="visit-title" data-testid="visit-tab">
      <PageTitle
        level="h2"
        id="visit-title"
        title={t('admin.missions.tabs.visit')}
        subtitle={t('admin.visit.intro')}
      />
      {guide.length > 0 ? (
        <Paper
          component="section"
          variant="outlined"
          aria-labelledby="visit-guide-title"
          sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, mb: 4 }}
          data-testid="visit-guide"
        >
          <Typography id="visit-guide-title" variant="sectionTitle" component="h3" sx={{ m: 0 }}>
            {t('admin.visit.guideTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            {t('admin.visit.guideIntro')}
          </Typography>
          {guide.map(({ useCase: u }) => (
            <Box key={u.id} sx={{ mb: 3 }}>
              <Typography variant="cardTitle" component="h4" sx={{ m: 0 }}>
                {u.title[locale]}
              </Typography>
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 5 }}>
                {u.visitQuestions.map((q) => (
                  <Box component="li" key={q.en} sx={{ typography: 'body2' }}>
                    {q[locale]}
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Paper>
      ) : null}
      {notes === null ? (
        <EmptyState icon="pending" title={t('admin.visit.unavailable')} />
      ) : (
        <VisitNotes
          tenantId={mission.tenantId}
          engagementId={mission.id}
          notes={notes}
          teams={teams}
          minGroup={MIN_GROUP_SIZE}
          today={new Date().toISOString().slice(0, 10)}
        />
      )}
    </section>
  );
}
