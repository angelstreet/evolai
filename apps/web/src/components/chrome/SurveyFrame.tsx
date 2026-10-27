import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LanguageToggle, ThemeToggle } from '@/components/chrome/HeaderControls';
import { getT } from '@/lib/i18n';

/**
 * The team survey in the Workbench frame (TASK-AI L3): the front page's header (logo, FR | EN,
 * theme) and one centred column. No side menu: a team member has one task here.
 */
export default function SurveyFrame({ children }: { children: ReactNode }) {
  const { t } = getT();
  return (
    <div className="ck ck-solo" data-testid="survey-frame">
      <div className="ck-content">
        <header className="ck-top">
          <div className="ck-brand">
            <Logo size="menu" />
          </div>
          <div className="ck-utils">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="ck-solo-main">
          {children}
        </main>
        <footer className="ck-footer">
          <span>{t('cockpit.footer.line')}</span>
          <span className="ck-links">
            <Link href="/privacy">{t('cockpit.footer.privacy')}</Link>
            <a href="https://github.com/angelstreet/evolai" rel="noopener noreferrer">
              {t('cockpit.footer.source')}
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
