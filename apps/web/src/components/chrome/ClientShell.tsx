import type { ReactNode } from 'react';
import { getT } from '@/lib/i18n';
import ClientMenu from './ClientMenu';
import WorkbenchShell from './WorkbenchShell';

/** The referent space in the Workbench shell (TASK-AI L4); the organisation is the header crumb. */
export default function ClientShell({
  organisation,
  tenantId,
  children,
}: {
  organisation: string;
  tenantId: string;
  children: ReactNode;
}) {
  const { t } = getT();
  return (
    <WorkbenchShell
      data-testid="client-space"
      data-tenant={tenantId}
      menu={<ClientMenu />}
      crumb={
        <div className="ck-crumb" data-testid="client-organisation">
          <span>{t('client.organisation', { tenant: organisation })}</span>
        </div>
      }
    >
      {children}
    </WorkbenchShell>
  );
}
