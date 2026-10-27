'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { MENU_ICONS } from '@/components/chrome/cockpit/icons';

const SECTIONS = [
  { href: '/admin/engagements', key: 'tabMissions', icon: 'survey' },
  { href: '/admin/settings', key: 'tabSettings', icon: 'settings' },
] as const;

/**
 * Admin side menu in the Workbench shell (TASK-AI L7, UI_RULES §5, §11): the current section is
 * tinted, as on the front page. The tenant query is carried across, so switching section keeps the
 * organisation. The last item goes back to the front page.
 */
export default function AdminTabs() {
  const { t } = useI18n();
  const pathname = usePathname() ?? '';
  const tenant = useSearchParams()?.get('tenant');
  const current = SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  return (
    <nav className="ck-menu" aria-label={t('admin.common.tabsAria')}>
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={tenant ? `${s.href}?tenant=${encodeURIComponent(tenant)}` : s.href}
          aria-current={current?.href === s.href ? 'page' : undefined}
          data-testid={`admin-tab-${s.key}`}
        >
          {MENU_ICONS[s.icon]}
          <span className="ck-label">{t(`admin.common.${s.key}`)}</span>
        </Link>
      ))}
      <Link href="/" data-testid="admin-tab-front">
        {MENU_ICONS['home']}
        <span className="ck-label">{t('admin.common.tabFront')}</span>
      </Link>
    </nav>
  );
}
