import { notFound } from 'next/navigation';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { PageTitle, StatusText } from '@evolai/ui';
import { EngagementForm } from '@/components/admin/SetupForms';
import NoticeForm from '@/components/admin/NoticeForm';
import { NamesToHideSection, TeamsSection } from '@/components/mission/SettingsSections';
import StatusPanel from '@/components/admin/StatusPanel';
import { sessionTenantIds } from '@/lib/authServer';
import { enumLabel, getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { getNoticeForAdmin } from '@/lib/privacyNotice';
import { getEngagementSetup, listTeamsSetup } from '@/lib/setupData';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
  searchParams: { tenant?: string; done?: string };
}

/** /admin/engagements/[id]/settings: edit an engagement and launch or close it (TASK-T, ADR 0038). */
export default async function EngagementSettingsPage({ params, searchParams }: Props) {
  const { t } = getT();
  if (!isUuid(params.id)) notFound();
  const tenants = await sessionTenantIds();
  const current = tenants.find((x) => x === searchParams.tenant) ?? tenants[0];
  if (!current) notFound();
  const [setup, teams, notice] = await Promise.all([
    getEngagementSetup(current, params.id),
    listTeamsSetup(current),
    getNoticeForAdmin(current, params.id),
  ]);
  if (!setup) notFound();
  const q = `tenant=${current}`;
  const locked = setup.status === 'closed' || setup.status === 'archived';
  return (
    <section className="wide admin" aria-labelledby="settings-title">
      <PageTitle
        level="h2"
        id="settings-title"
        title={t('admin.missions.tabs.settings')}
        subtitle={t('admin.setup.form.editIntro')}
        actions={
          <Button variant="outlined" href={`/admin/engagements/${setup.id}/preview?${q}`}>
            {t('admin.setup.preview.link')}
          </Button>
        }
      />
      {searchParams.done === 'created' ? (
        <StatusText status="success">{t('admin.setup.result.created')}</StatusText>
      ) : null}
      <Paper variant="outlined" component="section" sx={{ p: 4, borderRadius: 3, mb: 5 }}>
        <Typography variant="sectionTitle" component="h2" sx={{ mb: 2 }}>
          {t('admin.setup.status.title')}
          {': '}
          {enumLabel(t, 'engagementStatus', setup.status)}
        </Typography>
        <StatusPanel
          tenantId={current}
          engagementId={setup.id}
          status={setup.status}
          hasTeams={setup.teamIds.length > 0}
        />
      </Paper>
      <Paper variant="outlined" component="section" sx={{ p: 4, borderRadius: 3, mb: 5 }}>
        <EngagementForm
          tenantId={current}
          teams={teams.map((x) => ({ id: x.id, name: x.name, size: x.expectedHeadcount }))}
          teamsHref="#teams"
          values={{
            engagementId: setup.id,
            name: setup.name ?? setup.organisationName,
            locale: setup.locale,
            opensOn: setup.opensOn,
            closesOn: setup.closesOn,
            teamIds: setup.teamIds,
            locked,
            shape: setup.shape,
          }}
        />
      </Paper>
      {notice ? (
        <Paper variant="outlined" component="section" sx={{ p: 4, borderRadius: 3, mb: 5 }}>
          <NoticeForm
            tenantId={current}
            engagementId={setup.id}
            organisation={notice.organisation}
            stored={notice.stored}
            gaps={notice.resolved.gaps}
            retentionDays={notice.resolved.retentionDays}
            publicHref={`/privacy?e=${setup.id}`}
          />
        </Paper>
      ) : null}
      <TeamsSection tenantId={current} />
      <NamesToHideSection tenantId={current} />
    </section>
  );
}
