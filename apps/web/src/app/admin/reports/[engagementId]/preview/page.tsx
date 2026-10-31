import Link from 'next/link';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, EmptyState } from '@evolai/ui';
import ReportView from '@/components/report/ReportView';
import { sessionTenantFor } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { loadReportForEngagement, previewReport } from '@/lib/reportData';

export const dynamic = 'force-dynamic';

/**
 * Preview as the client (TASK-V): exactly the snapshot publishing would freeze now, run through the
 * same gate. When the gate refuses, the reason is shown instead, in plain words.
 */
export default async function ReportPreviewPage({
  params,
  searchParams,
}: {
  params: { engagementId: string };
  searchParams: { tenant?: string };
}) {
  const { t } = getT();
  const tenantId = await sessionTenantFor(searchParams.tenant);
  const editorHref = `/admin/engagements/${params.engagementId}/report${tenantId ? `?tenant=${tenantId}` : ''}`;
  const back = (
    <Button
      component={Link}
      href={editorHref}
      variant="text"
      startIcon={<AppIcon name="back" size={20} />}
      sx={{ minHeight: 44, displayPrint: 'none' }}
    >
      {t('report.editor.back')}
    </Button>
  );
  const bundle =
    tenantId && isUuid(params.engagementId)
      ? await loadReportForEngagement(tenantId, params.engagementId)
      : null;
  if (!tenantId || !bundle) {
    return (
      <section>
        {back}
        <EmptyState title={t('report.result.not_found')} />
      </section>
    );
  }
  const check = await previewReport(tenantId, bundle.report.id);
  return (
    <section aria-label={t('report.editor.preview')}>
      <Stack spacing={4}>
        {back}
        {check.ok ? (
          <>
            <Alert severity="info" sx={{ displayPrint: 'none' }}>
              {t('report.view.draftBanner')}
            </Alert>
            <ReportView snapshot={check.snapshot} />
          </>
        ) : (
          <Alert severity="warning" data-testid="report-gate">
            <AlertTitle>{t('report.view.gateTitle')}</AlertTitle>
            {t(`report.result.${check.code}` as MessageKey, {
              term: check.term ?? '',
              excerpt: check.excerpt ?? '',
            })}
          </Alert>
        )}
      </Stack>
    </section>
  );
}
