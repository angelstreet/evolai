import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { AccountMenu, LanguageToggle, ThemeToggle } from '@/components/chrome/HeaderControls';
import { loadIdentity } from '@/components/chrome/SiteHeader';
import ViewAsBanner from '@/components/chrome/ViewAsBanner';

/**
 * The signed-in Workbench shell (TASK-AI L4, L7): the front page's side menu and header (logo,
 * where you are, FR | EN, theme, account), the view-as banner, then the page's own content.
 */
export default async function WorkbenchShell({
  menu,
  crumb,
  children,
  ...data
}: {
  menu: ReactNode;
  crumb: ReactNode;
  children: ReactNode;
  'data-testid': string;
  'data-tenant'?: string;
}) {
  const identity = await loadIdentity();
  return (
    <div className="ck ck-space" {...data}>
      <aside className="ck-side">{menu}</aside>
      <div className="ck-content">
        <header className="ck-top">
          <div className="ck-brand">
            <Logo size="menu" />
          </div>
          {crumb}
          <div className="ck-utils">
            <LanguageToggle />
            <ThemeToggle />
            {identity && <AccountMenu identity={identity} />}
          </div>
        </header>
        <ViewAsBanner />
        <main id="main" tabIndex={-1} className="ck-space-main">
          {children}
        </main>
      </div>
    </div>
  );
}
