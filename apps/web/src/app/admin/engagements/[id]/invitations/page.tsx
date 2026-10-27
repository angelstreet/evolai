import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { EmptyState, PageTitle } from '@evolai/ui';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { getSettings, progress } from '@/lib/invitationData';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE, resolveBaseUrl } from '@/lib/invitationTracking';
import { listReferents } from '@/lib/referentData';
import { addressUrl, ensureTeamAddresses } from '@/lib/teamAddresses';
import TeamPanel from './TeamPanel';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
  searchParams: { tenant?: string };
}

/**
 * Team tab of a mission (TASK-AF, ADR 0052): the referent's welcome email, the survey address of
 * each team with its ending and size, and the contact line of the forwarded message. Counts are
 * aggregate and hidden under the minimum group (PRD §15, §25.1); no per-person link exists.
 */
export default async function TeamPage({ params, searchParams }: Props) {
  const { t } = getT();
  const tenants = await sessionTenantIds();
  const tenantId = tenants.find((id) => id === searchParams.tenant) ?? tenants[0];
  if (!tenantId) {
    return (
      <section className="wide admin" aria-labelledby="inv-title">
        <PageTitle level="h2" id="inv-title" title={t('admin.invitations.title')} />
        <EmptyState title={t('admin.common.noTenantsTitle')} />
      </section>
    );
  }
  const engagementId = params.id;
  if (!isUuid(engagementId)) notFound();
  const settings = await getSettings(tenantId, engagementId);
  if (!settings) notFound();

  const h = headers();
  const baseUrl = resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
  const [addresses, prog, referents] = await Promise.all([
    ensureTeamAddresses(tenantId, engagementId),
    progress(tenantId, engagementId),
    listReferents(tenantId),
  ]);
  const statusKey = {
    none: 'statusNone',
    ready: 'statusReady',
    disabled: 'statusDisabled',
  } as const;
  const teams = addresses.map((a) => {
    const row = prog.teams.find((r) => r.teamId === a.teamId);
    const visitors = row?.invited ?? 0;
    const total = Math.max(a.expectedSize ?? 0, visitors);
    const answers =
      !row || visitors === 0
        ? t('client.home.noAnswers')
        : row.suppressed
          ? t('admin.invitations.addresses.hidden', { n: MIN_GROUP_SIZE })
          : t('admin.invitations.addresses.answered', { done: row.completed, total });
    return {
      teamId: a.teamId,
      teamName: a.teamName,
      slug: a.slug,
      address: addressUrl(baseUrl, a.slug),
      expectedSize: a.expectedSize,
      answers,
    };
  });

  return (
    <section className="wide admin" aria-labelledby="inv-title">
      <PageTitle
        level="h2"
        id="inv-title"
        title={t('admin.invitations.title')}
        subtitle={t('admin.invitations.subtitle')}
      />
      <TeamPanel
        tenantId={tenantId}
        engagementId={engagementId}
        referents={referents.map((r) => ({
          userId: r.userId,
          name: r.name,
          teamName: r.teamName,
          status: t(`trust.referents.${statusKey[r.status]}`),
        }))}
        teams={teams}
        contact={settings.contact ?? ''}
        reminderDays={settings.reminderDays.join(', ')}
      />
    </section>
  );
}
