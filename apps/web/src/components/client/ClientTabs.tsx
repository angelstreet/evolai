'use client';

import { usePathname } from 'next/navigation';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';

const SECTIONS = [
  { href: '/client', key: 'home', icon: 'home' },
  { href: '/client/results', key: 'results', icon: 'results' },
  { href: '/client/report', key: 'report', icon: 'report' },
] as const;

/**
 * Team space navigation (TASK-P, TASK-V, TASK-AF): three sections only, no admin or auditor link and no
 * organisation switcher. The current section is marked by colour and underline (UI_RULES §6).
 * Full width tabs from `sm` up; on phones the icons are dropped and the strip scrolls, so no label clips.
 */
export default function ClientTabs() {
  const { t } = useI18n();
  const pathname = usePathname() ?? '';
  const current =
    [...SECTIONS].reverse().find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
      ?.href ?? false;
  return (
    <Tabs
      component="nav"
      aria-label={t('client.nav.aria')}
      value={current}
      // Three sections may not fit a 360 px phone without clipping a word: the strip scrolls there
      // (like the admin tabs) and stretches to the full width from `sm` up (TASK-V).
      variant="scrollable"
      scrollButtons={false}
      sx={{
        mb: 6,
        borderBottom: 1,
        borderColor: 'divider',
        displayPrint: 'none',
        '& .MuiTab-root': { flex: { sm: 1 } },
      }}
    >
      {SECTIONS.map((s) => (
        <Tab
          key={s.href}
          value={s.href}
          href={s.href}
          icon={<AppIcon name={s.icon} size={20} />}
          iconPosition="start"
          label={t(`client.nav.${s.key}`)}
          aria-current={current === s.href ? 'page' : undefined}
          data-testid={`client-tab-${s.key}`}
          sx={{
            minHeight: 44,
            minWidth: 0,
            px: { xs: 1, sm: 3 },
            whiteSpace: 'nowrap',
            // Phones: words only, so no label is ever clipped (TASK-S, feedback item 14).
            '& .MuiTab-icon': { display: { xs: 'none', sm: 'inline-flex' } },
          }}
        />
      ))}
    </Tabs>
  );
}
