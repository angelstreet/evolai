import { notFound } from 'next/navigation';
import { EmptyState, PageTitle } from '@evolai/ui';
import VisitNotes from '@/components/mission/VisitNotes';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { findMission } from '@/lib/missionData';
import { visitTab } from '@/lib/visitData';

export const dynamic = 'force-dynamic';

/**
 * Visit (TASK-AJ A6, ADR 0059): dated notes of the on-site interviews, observations and workshops,
 * anonymised on save, and "Write a finding from the notes". Staff only: a referent or a view-as
 * session is sent to the client surface by the staff guard before this runs.
 */
export default async function VisitPage({ params }: { params: { id: string } }) {
  const { t } = getT();
  if (!isUuid(params.id)) notFound();
  const mission = await findMission(await sessionTenantIds(), params.id);
  if (!mission) notFound();
  const { notes, teams } = await visitTab(mission.tenantId, mission.id);
  return (
    <section className="wide admin" aria-labelledby="visit-title" data-testid="visit-tab">
      <PageTitle
        level="h2"
        id="visit-title"
        title={t('admin.missions.tabs.visit')}
        subtitle={t('admin.visit.intro')}
      />
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
