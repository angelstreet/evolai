import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { formatDate } from '@evolai/i18n';
import { AppIcon, EmptyState, PageTitle, StatTiles, StatusText } from '@evolai/ui';
import {
  AddStepForm,
  AiDraftCard,
  PlanEditor,
  SectionsForm,
  StartReportForm,
  StepCard,
  SuggestForm,
} from '@/components/report/ReportForms';
import { AuditQualityCard } from '@/components/report/AuditQualityCard';
import { FindingsPanel } from '@/components/report/FindingsPanel';
import { WorkflowBar } from '@/components/report/WorkflowBar';
import { qualityOf } from '@/lib/auditQualityFacts';
import { sessionTenantFor } from '@/lib/authServer';
import { enumLabelOf } from '@/lib/enumLabel';
import { getT } from '@/lib/i18n';
import { canEditFindings, listFindings } from '@/lib/findingsData';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import {
  canRecordFollowUpValue,
  loadReportForEngagement,
  loadReportInputs,
  rankForScreen,
} from '@/lib/reportData';
import { followUpsDue, weightsSentence } from '@/lib/reportModel';

export const dynamic = 'force-dynamic';

function Card({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper
      component="section"
      aria-labelledby={id}
      variant="outlined"
      sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3 }}
    >
      <Typography id={id} variant="sectionTitle" component="h2" sx={{ m: 0 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4, maxWidth: '72ch' }}>
          {subtitle}
        </Typography>
      ) : (
        <Box sx={{ mb: 4 }} />
      )}
      {children}
    </Paper>
  );
}

/**
 * Report editor (TASK-V, ADR 0041): the auditor builds the deliverable section by section,
 * accepts or rejects suggested steps, builds the 30/60/90 plan, previews it as the client will see
 * it and publishes it behind a confirmation. Staff only; the session picks the organisation.
 */
export default async function ReportEditorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tenant?: string };
}) {
  const { t, locale } = getT();
  const tenantId = await sessionTenantFor(searchParams.tenant);
  if (!tenantId || !isUuid(params.id)) {
    return (
      <section className="wide admin">
        <EmptyState title={t('report.result.not_found')} />
      </section>
    );
  }
  const [bundle, findings, canEdit, followUpReady] = await Promise.all([
    loadReportForEngagement(tenantId, params.id),
    listFindings(tenantId, params.id),
    canEditFindings(tenantId),
    canRecordFollowUpValue(tenantId),
  ]);
  const findingsCard = (
    <Card
      id="report-findings"
      title={t('report.findings.work.title')}
      subtitle={t('report.findings.work.subtitle', { n: MIN_GROUP_SIZE })}
    >
      <FindingsPanel
        ids={{ tenantId, engagementId: params.id }}
        findings={findings}
        minGroup={MIN_GROUP_SIZE}
        disabled={false}
        canEdit={canEdit}
      />
    </Card>
  );
  if (!bundle) {
    const inputs = await loadReportInputs(tenantId, params.id);
    return (
      <section className="wide admin" aria-labelledby="report-title">
        <PageTitle
          level="h2"
          id="report-title"
          title={t('report.list.title')}
          subtitle={t('report.list.subtitle')}
        />
        {inputs ? (
          <Stack spacing={4}>
            <StartReportForm tenantId={tenantId} engagementId={params.id} primary />
            {findingsCard}
          </Stack>
        ) : (
          <EmptyState title={t('report.result.not_found')} />
        )}
      </section>
    );
  }

  const { report: r, steps, inputs, visibleVersion } = bundle;
  const locked = r.status === 'published';
  const ids = { tenantId, reportId: r.id, engagementId: params.id };
  const ranked = rankForScreen(inputs, steps).filter((o) =>
    steps.some((s) => s.opportunityId === o.id && s.status === 'accepted'),
  );
  const o = inputs.readiness.overall;
  const due = followUpsDue(steps, new Date().toISOString().slice(0, 10));
  const dueIds = new Set(due.map((s) => s.id));
  const lvl = (l: 'low' | 'medium' | 'high') => t(`report.steps.level.${l}`).toLowerCase();

  return (
    <section className="wide admin" aria-labelledby="report-title" data-testid="report-editor">
      <PageTitle
        level="h2"
        id="report-title"
        title={r.title}
        subtitle={t('report.editor.subtitle', { version: r.version })}
        actions={
          <>
            {visibleVersion ? (
              <Button
                href={`/admin/reports/${params.id}/pdf?tenant=${tenantId}`}
                variant="outlined"
                startIcon={<AppIcon name="download" size={20} />}
                sx={{ minHeight: 44 }}
                data-testid="report-admin-download"
              >
                {t('report.view.download')}
              </Button>
            ) : (
              <Tooltip title={t('report.editor.pdfLater')}>
                <span>
                  <Button
                    variant="outlined"
                    disabled
                    startIcon={<AppIcon name="download" size={20} />}
                    sx={{ minHeight: 44 }}
                    data-testid="report-admin-download-later"
                  >
                    {t('report.view.download')}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Button
              component={Link}
              href={`/admin/reports/${params.id}/preview?tenant=${tenantId}`}
              variant="outlined"
              startIcon={<AppIcon name="visibility" size={20} />}
              sx={{ minHeight: 44 }}
              data-testid="report-preview-link"
            >
              {t('report.editor.preview')}
            </Button>
          </>
        }
      />
      <Stack spacing={4}>
        <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3 }}>
          <Stack spacing={2}>
            <StatusText status={r.status === 'published' ? 'success' : 'pending'}>
              <span data-testid="report-state">{t(`report.state.${r.status}`)}</span>
            </StatusText>
            <Typography variant="body2" color="text.secondary">
              {visibleVersion
                ? t('report.editor.visibleNow', { version: visibleVersion })
                : t('report.editor.visibleNothing')}{' '}
              {t('report.editor.language', { language: t(`common.language.${r.locale}`) })}
            </Typography>
            <WorkflowBar
              ids={ids}
              status={r.status}
              version={r.version}
              visibleVersion={visibleVersion}
              readOnly={false}
            />
          </Stack>
        </Paper>
        {locked ? <Alert severity="info">{t('report.editor.locked')}</Alert> : null}
        {due.length > 0 ? (
          <Alert severity="warning" data-testid="report-follow-ups-due">
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {t('report.steps.measure.dueTitle', { count: due.length })}
            </Typography>
            <Typography variant="body2">{due.map((s) => s.title).join(' · ')}</Typography>
            <Typography variant="body2">{t('report.steps.measure.dueBody')}</Typography>
          </Alert>
        ) : null}
        {inputs.answered < MIN_GROUP_SIZE ? (
          <Alert severity="warning" data-testid="report-few-people">
            {t('report.editor.fewPeople', { count: inputs.answered, n: MIN_GROUP_SIZE })}
          </Alert>
        ) : null}

        <AuditQualityCard
          t={t}
          minGroup={MIN_GROUP_SIZE}
          quality={qualityOf({
            expected: inputs.expected,
            answered: inputs.answered,
            minGroup: MIN_GROUP_SIZE,
            readiness: inputs.readiness,
            visit: inputs.visit,
            timeShown: inputs.repeatedTime.overall !== null,
            risksNote: r.risksNote,
            findings: findings ?? [],
            steps,
          })}
        />

        <Card
          id="report-readiness"
          title={t('report.readiness.title')}
          subtitle={t('report.readiness.subtitle', { n: MIN_GROUP_SIZE })}
        >
          {o && o.overall !== null && o.level ? (
            <StatTiles
              items={[
                {
                  label: t('report.readiness.overall'),
                  value: t('report.readiness.scoreOf', { score: o.overall }),
                  hint: t('report.readiness.people', { count: o.people }),
                },
                {
                  label: t(`report.readiness.level.${o.level}`),
                  value: o.level,
                  hint: t(`report.readiness.levelMeaning.${o.level}`),
                },
                ...o.axes.map((a) => ({
                  label: t(`report.readiness.axis.${a.axis}`),
                  value:
                    a.score === null
                      ? t('report.readiness.noAxis')
                      : t('report.readiness.scoreOf', { score: a.score }),
                  hint: t(`report.readiness.axisHelp.${a.axis}`),
                })),
              ]}
            />
          ) : (
            <Typography variant="body1">
              {t('report.readiness.noScore', { n: MIN_GROUP_SIZE })}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {inputs.readiness.hiddenTeams > 0
              ? `${t('report.readiness.hiddenTeams', { count: inputs.readiness.hiddenTeams })} `
              : ''}
            {weightsSentence(t, inputs.readiness)}
          </Typography>
        </Card>

        {findingsCard}

        <Card
          id="report-summary"
          title={t('report.sections.summary')}
          subtitle={t('report.sections.summaryHelp')}
        >
          <Stack spacing={4}>
            {r.aiDraft ? (
              <AiDraftCard
                ids={ids}
                disabled={locked}
                text={r.aiDraft.text}
                meta={t('report.ai.meta', {
                  route: r.aiDraft.route,
                  prompt: r.aiDraft.promptVersion,
                  date: r.aiDraft.generatedAt
                    ? formatDate(locale, r.aiDraft.generatedAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—',
                })}
              />
            ) : null}
            <SectionsForm
              ids={ids}
              disabled={locked}
              title={r.title}
              summary={r.summary}
              citations={r.summaryCitations}
              risksNote={r.risksNote}
              methodology={r.methodology}
              findings={inputs.findings}
              minGroupSize={MIN_GROUP_SIZE}
            />
          </Stack>
        </Card>

        <Card
          id="report-steps"
          title={t('report.steps.title')}
          subtitle={t('report.steps.subtitle')}
        >
          {inputs.opportunities.length === 0 ? (
            <Stack spacing={3}>
              <Typography variant="body1">{t('report.steps.noOpportunity')}</Typography>
              <AddStepForm ids={ids} opportunityId="" disabled={locked} taken={[]} customOnly />
            </Stack>
          ) : (
            <Stack spacing={4}>
              <SuggestForm ids={ids} disabled={locked} />
              {inputs.opportunities.map((opp) => {
                const own = steps.filter((s) => s.opportunityId === opp.id);
                return (
                  <Box
                    key={opp.id}
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: { xs: 3, sm: 4 } }}
                    data-testid="report-opportunity"
                  >
                    <Typography variant="cardTitle" component="h3" sx={{ m: 0 }}>
                      {opp.title}
                    </Typography>
                    {opp.axis ? (
                      <Typography variant="body2" color="text.secondary">
                        {enumLabelOf(t, 'axis', opp.axis)}
                      </Typography>
                    ) : null}
                    {own.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        {t('report.steps.none')}
                      </Typography>
                    ) : (
                      own.map((s) => (
                        <StepCard
                          key={s.id}
                          ids={ids}
                          step={s}
                          disabled={locked}
                          due={dueIds.has(s.id)}
                          followUpReady={followUpReady}
                        />
                      ))
                    )}
                    <AddStepForm
                      ids={ids}
                      opportunityId={opp.id}
                      disabled={locked}
                      taken={own.flatMap((s) => (s.catalogueId ? [s.catalogueId] : []))}
                    />
                  </Box>
                );
              })}
            </Stack>
          )}
        </Card>

        <Card
          id="report-ranking"
          title={t('report.ranking.title')}
          subtitle={t('report.ranking.subtitle')}
        >
          {ranked.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('report.ranking.empty')}
            </Typography>
          ) : (
            <Box component="ol" sx={{ m: 0, pl: 6 }} data-testid="report-ranked">
              {ranked.map((x) => (
                <Box component="li" key={x.id} sx={{ py: 1 }}>
                  <Typography variant="body1" component="span">
                    {x.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" component="span">
                    {' · '}
                    {t(`report.ranking.quadrant.${x.quadrant}`)} ·{' '}
                    {t('report.ranking.impactEffort', {
                      impact: lvl(x.impact),
                      effort: lvl(x.effort),
                    })}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Card>

        <Card id="report-plan" title={t('report.plan.title')} subtitle={t('report.plan.subtitle')}>
          <PlanEditor
            ids={ids}
            disabled={locked}
            plan={r.plan}
            hasAccepted={steps.some((s) => s.status === 'accepted')}
          />
        </Card>
      </Stack>
    </section>
  );
}
