import type { ReactNode } from 'react';
import ClientShell from '@/components/chrome/ClientShell';
import { clientContextOrRedirect } from '@/lib/clientContext';

export const dynamic = 'force-dynamic';

/**
 * Team space (TASK-P, ADR 0035): what a team referent sees, and what the platform owner sees while
 * viewing as one, in the Workbench shell (TASK-AI L4). The organisation is stated in the header;
 * there is no organisation switcher.
 */
export default async function ClientLayout({ children }: { children: ReactNode }) {
  const { ctx, organisation } = await clientContextOrRedirect();
  return (
    <ClientShell organisation={organisation} tenantId={ctx.tenantId}>
      {children}
    </ClientShell>
  );
}
