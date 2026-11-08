import { PageTitle } from '@evolai/ui';
import { EngagementForm } from '@/components/admin/SetupForms';
import { TeamsSection } from '@/components/mission/SettingsSections';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { listTeamsSetup, missionKindAvailable } from '@/lib/setupData';

export const dynamic = 'force-dynamic';

/** /admin/engagements/new: name, language, dates and teams of a new audit (TASK-T, ADR 0038). */
export default async function NewEngagementPage({
  searchParams,
}: {
  searchParams: { tenant?: string };
}) {
  const { t, locale } = getT();
  const tenants = await sessionTenantIds();
  const current = tenants.find((x) => x === searchParams.tenant) ?? tenants[0];
  if (!current) {
    return (
      <section className="wide admin" aria-labelledby="new-title">
        <PageTitle id="new-title" title={t('admin.common.noTenantsTitle')} />
      </section>
    );
  }
  const [teams, shapeChoice] = await Promise.all([
    listTeamsSetup(current),
    missionKindAvailable(current),
  ]);
  return (
    <section className="wide admin" aria-labelledby="new-title">
      <PageTitle
        id="new-title"
        title={t('admin.setup.form.newTitle')}
        subtitle={t('admin.setup.form.newIntro')}
      />
      <EngagementForm
        tenantId={current}
        teams={teams.map((x) => ({ id: x.id, name: x.name, size: x.expectedHeadcount }))}
        teamsHref="#teams"
        shapeChoice={shapeChoice}
        values={{ name: '', locale, opensOn: '', closesOn: '', teamIds: [] }}
      />
      <TeamsSection tenantId={current} />
    </section>
  );
}
