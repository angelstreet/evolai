'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The shared header, banner and footer wrap every page except the front-page cockpit (TASK-AH)
 * the team survey `/s/*` (TASK-AI L3), the referent space `/client` (L4) and admin `/admin` (L7),
 * which draw the Workbench header themselves. Server components arrive as props, so they stay
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
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  const own = path === '/' || path.startsWith('/s/') || under('/client') || under('/admin');
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
