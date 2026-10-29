import type { TenantId } from '@evolai/contracts';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { AppIcon, EmptyState, PageTitle } from '@evolai/ui';
import FindingReview from '@/components/report/FindingReview';
import PrintReportButton from '@/components/report/PrintReportButton';
import ReportView from '@/components/report/ReportView';
import { requireClientContext } from '@/lib/clientContext';
import { loadClientSurvey } from '@/lib/clientData';
import { reviewItems } from '@/lib/findingsData';
import { getT } from '@/lib/i18n';
import { longDate } from '@/lib/referentMessages';
import { loadPublishedReport } from '@/lib/reportData';

export const dynamic = 'force-dynamic';

/**
 * The published audit report in the team space (TASK-V, ADR 0041). Read only. The engagement comes
 * from the session's teams, never from the URL, and only a published, not withdrawn snapshot is
 * read: a draft or a report in review never reaches this page. View-as sees the same thing.
 * While the working report is in review, the referent checks the findings (labels and counts
 * only) and confirms or disputes each one (TASK-AJ A8).
 */
export default async function ClientReportPage() {
  const { ctx } = await requireClientContext();
  const { t, locale } = getT();
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  const published = survey
    ? await loadPublishedReport(ctx.tenantId as TenantId, survey.engagementId)
    : null;
  const toReview = survey ? await reviewItems(ctx.tenantId as TenantId, survey.engagementId) : [];
  return (
    <section aria-labelledby="client-report-title">
      <PageTitle
        id="client-report-title"
        title={t('report.view.clientTitle')}
        subtitle={t('report.view.clientSubtitle')}
      />
      <Paper
        variant="outlined"
        sx={{ p: 4, borderRadius: 3, mb: 4 }}
        data-testid="client-report-info"
      >
        <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 2 }}>
          {t('report.view.receiveTitle')}
        </Typography>
        <Typography variant="body1" sx={{ m: 0, mb: 2 }}>
          {t('report.view.receiveWhat')}
        </Typography>
        {published ? null : (
          <Typography variant="body1" sx={{ m: 0, mb: 2 }} data-testid="client-report-when">
            {survey?.closesOn
              ? t('report.view.receiveWhenDate', { date: longDate(locale, survey.closesOn) })
              : t('report.view.receiveWhen')}
          </Typography>
        )}
        <Typography variant="body1" sx={{ m: 0 }}>
          {t('report.view.receiveForward')}
        </Typography>
      </Paper>
      {toReview.length > 0 ? (
        <FindingReview items={toReview} readOnly={ctx.readOnly || ctx.viewAs !== null} />
      ) : null}
      {published ? (
        <ReportView
          snapshot={published.snapshot}
          actions={
            <>
              <Button
                href="/client/report/pdf"
                variant="contained"
                startIcon={<AppIcon name="download" size={20} />}
                sx={{ minHeight: 44 }}
                data-testid="report-download"
              >
                {t('report.view.download')}
              </Button>
              <PrintReportButton label={t('report.view.print')} />
            </>
          }
        />
      ) : (
        <EmptyState icon="pending" title={t('report.view.empty')} />
      )}
    </section>
  );
}
