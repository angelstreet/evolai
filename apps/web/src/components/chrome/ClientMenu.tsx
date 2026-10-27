'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { MENU_ICONS } from './cockpit/icons';

const SPACE = [
  { href: '/client', key: 'home', icon: 'home' },
  { href: '/client/results', key: 'results', icon: 'results' },
  { href: '/client/report', key: 'report', icon: 'report' },
] as const;

// The lessons and the survey are the front page's (TASK-AI L2, L4): one set for everyone.
const FRONT = [
  { href: '/?learn=1', key: 'learn', icon: 'learn' },
  { href: '/?survey=1', key: 'survey', icon: 'survey' },
] as const;

/**
 * Side menu of the referent space in the Workbench shell (TASK-AI L4): the space's three sections,
 * then Learn and Survey on the front page. Current section by tint, as on the front page.
 */
export default function ClientMenu() {
  const { t } = useI18n();
  const pathname = usePathname() ?? '';
  const current = [...SPACE]
    .reverse()
    .find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))?.href;
  return (
    <nav className="ck-menu" aria-label={t('client.nav.aria')}>
      {[...SPACE, ...FRONT].map((s) => (
        <Link
          key={s.href}
          href={s.href}
          data-k={s.key}
          aria-current={current === s.href ? 'page' : undefined}
          data-testid={`client-tab-${s.key}`}
        >
          {MENU_ICONS[s.icon]}
          <span className="ck-label">{t(`client.nav.${s.key}`)}</span>
        </Link>
      ))}
    </nav>
  );
}
