'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The shared header, banner and footer wrap every page except the front-page cockpit (TASK-AH)
 * and the team survey `/s/*` (TASK-AI L3), which draw the Workbench header themselves. Server components arrive as props, so they stay
 * server-rendered; this client part only decides whether to show them.
 */
export default function ChromeGate({
  header,
  banner,
  footer,
  children,
}: {
  header: ReactNode;
  banner: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const own = path === '/' || path.startsWith('/s/');
  if (own) return <>{children}</>;
  return (
    <>
      {header}
      {banner}
      <main id="main" tabIndex={-1} className="container">
        {children}
      </main>
      {footer}
    </>
  );
}
