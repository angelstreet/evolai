import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Stack from '@mui/material/Stack';
import { AppIcon, EmptyState, PageTitle, StatusText, type Status } from '@evolai/ui';
import { MissionTabs, NextStepButton } from '@/components/mission/MissionTabs';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { findMission } from '@/lib/missionData';
import { missionShapeKey, missionTabs, type MissionStatus } from '@/lib/missionStatus';

export const dynamic = 'force-dynamic';

const STATUS_ICON: Record<MissionStatus, Status> = {
  draft: 'pending',
  open: 'running',
  closed: 'info',
  published: 'success',
};

/**
 * Mission page frame (TASK-AD2, ADR 0049): client name, status as icon plus word, the one next
 * step, then the tabs Overview, Links, Answers, Report, Settings. The organisation is the one the
 * session is working on (the `?tenant=` of every mission link, remembered by the middleware).
 */
export default async function MissionLayout({
  params,
  children,
}: {
  params: { id: string };
  children: ReactNode;
}) {
  const { t } = getT();
  if (!isUuid(params.id)) notFound();
  const tenants = await sessionTenantIds();
  const mission = await findMission(tenants, params.id);
  if (!mission) {
    return (
      <section className="wide admin">
        <Link href="/admin/engagements">{t('admin.missions.back')}</Link>
        <EmptyState title={t('admin.missions.notFound')} />
      </section>
    );
  }
  const q = `?tenant=${mission.tenantId}`;
  return (
    <>
      <div className="wide admin">
        <Link href={`/admin/engagements${q}`} className="back-link">
          <Stack direction="row" component="span" sx={{ alignItems: 'center', gap: 1 }}>
            <AppIcon name="back" size={16} />
            {t('admin.missions.back')}
          </Stack>
        </Link>
        <PageTitle
          id="mission-title"
          title={mission.client}
          subtitle={
            <Stack direction="row" component="span" sx={{ alignItems: 'center', gap: 3 }}>
              <StatusText status={STATUS_ICON[mission.status]}>
                {t(`admin.missions.status.${mission.status}`)}
              </StatusText>
              <span data-testid="mission-shape">{t(missionShapeKey(mission.shape))}</span>
            </Stack>
          }
          actions={
            <NextStepButton
              engagementId={mission.id}
              tenantId={mission.tenantId}
              tab={mission.next.tab}
              label={t(`admin.missions.next.${mission.next.step}`)}
            />
          }
        />
        <MissionTabs
          engagementId={mission.id}
          tenantId={mission.tenantId}
          tabs={missionTabs(mission.shape)}
        />
      </div>
      {children}
    </>
  );
}
