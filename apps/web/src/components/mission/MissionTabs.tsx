'use client';

import { usePathname } from 'next/navigation';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { missionHref, type MissionTab } from '@/lib/missionStatus';

const TABS: readonly MissionTab[] = [
  'overview',
  'invitations',
  'answers',
  'visit',
  'report',
  'settings',
];

/** The tab a mission path belongs to; the questionnaire preview sits under Settings. */
export const tabOfPath = (pathname: string, engagementId: string): MissionTab => {
  const rest = pathname.split(`/admin/engagements/${engagementId}`)[1] ?? '';
  const seg = rest.split('/')[1] ?? '';
  if (seg === 'preview') return 'settings';
  return (TABS as readonly string[]).includes(seg) ? (seg as MissionTab) : 'overview';
};

interface Props {
  engagementId: string;
  tenantId: string;
}

/** Mission tabs (TASK-AD2): selection is colour and underline, never weight (UI_RULES §6). */
export function MissionTabs({ engagementId, tenantId }: Props) {
  const { t } = useI18n();
  const current = tabOfPath(usePathname() ?? '', engagementId);
  return (
    <Tabs
      component="nav"
      aria-label={t('admin.missions.tabsAria')}
      value={current}
      variant="scrollable"
      scrollButtons={false}
      sx={{ mb: 6, borderBottom: 1, borderColor: 'divider', displayPrint: 'none' }}
    >
      {TABS.map((tab) => (
        <Tab
          key={tab}
          value={tab}
          label={t(`admin.missions.tabs.${tab}`)}
          href={missionHref(engagementId, tab, tenantId)}
          aria-current={current === tab ? 'page' : undefined}
          data-testid={`mission-tab-${tab}`}
          sx={{ minHeight: 44 }}
        />
      ))}
    </Tabs>
  );
}

/**
 * The one next step in the mission header. Filled only on Overview, where the page has no other
 * primary action; outlined on the other tabs; hidden on the tab it opens (you are already there).
 */
export function NextStepButton({
  engagementId,
  tenantId,
  tab,
  label,
}: Props & { tab: MissionTab; label: string }) {
  const current = tabOfPath(usePathname() ?? '', engagementId);
  if (current === tab) return null;
  return (
    <Button
      variant={current === 'overview' ? 'contained' : 'outlined'}
      href={missionHref(engagementId, tab, tenantId)}
      endIcon={<AppIcon name="forward" size={20} />}
      data-testid="mission-next-step"
      sx={{ displayPrint: 'none' }}
    >
      {label}
    </Button>
  );
}
