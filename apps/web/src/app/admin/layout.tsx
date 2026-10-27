import { Suspense, type ReactNode } from 'react';
import AdminTabs from '@/components/admin/AdminTabs';
import { loadIdentity } from '@/components/chrome/SiteHeader';
import WorkbenchShell from '@/components/chrome/WorkbenchShell';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';

/**
 * Every admin page in the Workbench shell (TASK-AI L7): the side menu says where you are (§11) and
 * the organisation is the header crumb.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // The organisation being worked on is always visible (ADR 0038): the switcher's choice first.
  const first = (await sessionTenantIds())[0];
  const organisation =
    (await loadIdentity())?.organisation ??
    (first ? await tenantLabel(first).catch(() => null) : null);
  return (
    <WorkbenchShell
      data-testid="admin-space"
      menu={
        <Suspense fallback={null}>
          <AdminTabs />
        </Suspense>
      }
      crumb={
        <div className="ck-crumb">
          {organisation ? <span data-testid="header-organisation">{organisation}</span> : null}
        </div>
      }
    >
      {children}
    </WorkbenchShell>
  );
}
