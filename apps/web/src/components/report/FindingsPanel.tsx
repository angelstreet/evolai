'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, StatusText, type Status } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import {
  decideFindingAction,
  proposeFindingsAction,
  resolveDisputeAction,
} from '@/app/admin/findings/actions';
import { findingIdle, type FindingActionState } from '@/app/admin/findings/state';
import { enumLabelOf } from '@/lib/enumLabel';
import { isOpenDispute, isReportable } from '@/lib/findingRules';
import type { FindingRow } from '@/lib/findingsData';

interface Ids {
  readonly tenantId: string;
  readonly engagementId: string;
}

const STATUS: Record<FindingRow['status'], Status> = {
  approved: 'success',
  draft: 'pending',
  rejected: 'info',
};

function Result({ state, minGroup }: { state: FindingActionState; minGroup: number }) {
  const { t } = useI18n();
  return (
    <Box aria-live="polite" sx={{ minHeight: 24 }}>
      {state.code !== 'idle' ? (
        <StatusText status={state.ok ? 'success' : 'error'}>
          {t(`report.findings.result.${state.code}` as MessageKey, {
            count: state.count ?? 0,
            n: minGroup,
          })}
        </StatusText>
      ) : null}
    </Box>
  );
}

function Submit({
  children,
  variant,
  icon,
  testId,
  disabled,
}: {
  children: React.ReactNode;
  variant: 'outlined' | 'text';
  icon?: Parameters<typeof AppIcon>[0]['name'];
  testId: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || pending}
      startIcon={icon ? <AppIcon name={icon} size={20} /> : undefined}
      data-testid={testId}
      sx={{ minHeight: 44 }}
    >
      {children}
    </Button>
  );
}

function DecideForm({
  ids,
  f,
  to,
  minGroup,
}: {
  ids: Ids;
  f: FindingRow;
  to: 'approved' | 'rejected';
  minGroup: number;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(decideFindingAction, findingIdle);
  const label =
    to === 'approved'
      ? t('report.findings.work.approve')
      : f.status === 'approved'
        ? t('report.findings.work.withdraw')
        : t('report.findings.work.reject');
  const testId =
    to === 'approved'
      ? 'finding-approve'
      : f.status === 'approved'
        ? 'finding-withdraw'
        : 'finding-reject';
  return (
    <Box component="form" action={action}>
      <input type="hidden" name="tenantId" value={ids.tenantId} />
      <input type="hidden" name="findingId" value={f.id} />
      <input type="hidden" name="to" value={to} />
      <Submit
        variant={to === 'approved' && f.status === 'draft' ? 'outlined' : 'text'}
        icon={to === 'approved' ? 'success' : 'close'}
        testId={testId}
      >
        {label}
      </Submit>
      <Result state={state} minGroup={minGroup} />
    </Box>
  );
}

function ResolveForm({
  ids,
  f,
  to,
  minGroup,
}: {
  ids: Ids;
  f: FindingRow;
  to: 'corrected' | 'kept';
  minGroup: number;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(resolveDisputeAction, findingIdle);
  return (
    <Box component="form" action={action}>
      <input type="hidden" name="tenantId" value={ids.tenantId} />
      <input type="hidden" name="findingId" value={f.id} />
      <input type="hidden" name="to" value={to} />
      <Submit
        variant={to === 'corrected' ? 'outlined' : 'text'}
        icon={to === 'corrected' ? 'edit' : 'success'}
        testId={`finding-${to}`}
      >
        {t(
          to === 'corrected'
            ? 'report.findings.work.review.markCorrected'
            : 'report.findings.work.review.keep',
        )}
      </Submit>
      <Result state={state} minGroup={minGroup} />
    </Box>
  );
}

/** The referent's verdict (A8), and the auditor's answer to an open dispute. */
function Review({ ids, f, minGroup }: { ids: Ids; f: FindingRow; minGroup: number }) {
  const { t } = useI18n();
  const r = f.review;
  if (!r || f.status !== 'approved') return null;
  if (r.verdict === 'confirmed') {
    return (
      <Box sx={{ mb: 2 }} data-testid="finding-review">
        <StatusText status="success">{t('report.findings.work.review.confirmed')}</StatusText>
      </Box>
    );
  }
  return (
    <Box sx={{ mb: 2 }} data-testid="finding-review">
      <StatusText status={r.resolution ? 'info' : 'warning'}>
        {t('report.findings.work.review.disputed', { comment: r.comment })}
      </StatusText>
      {r.resolution ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t(`report.findings.work.review.${r.resolution}`)}
        </Typography>
      ) : (
        <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: 'wrap' }}>
          <ResolveForm ids={ids} f={f} to="corrected" minGroup={minGroup} />
          <ResolveForm ids={ids} f={f} to="kept" minGroup={minGroup} />
        </Stack>
      )}
    </Box>
  );
}

/** Draft: approve or reject. Approved: withdraw. Rejected: approve again. */
function Decide({ ids, f, minGroup }: { ids: Ids; f: FindingRow; minGroup: number }) {
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {f.status !== 'approved' ? (
        <DecideForm ids={ids} f={f} to="approved" minGroup={minGroup} />
      ) : null}
      {f.status !== 'rejected' ? (
        <DecideForm ids={ids} f={f} to="rejected" minGroup={minGroup} />
      ) : null}
    </Stack>
  );
}

function FindingItem({ ids, f, minGroup }: { ids: Ids; f: FindingRow; minGroup: number }) {
  const { t } = useI18n();
  return (
    <Box
      component="li"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: { xs: 3, sm: 4 },
        listStyle: 'none',
      }}
      data-testid="finding"
      data-status={f.status}
      data-open-dispute={isOpenDispute(f) ? 'true' : undefined}
    >
      <Typography variant="cardTitle" component="h3" sx={{ m: 0 }}>
        {f.label}
      </Typography>
      {f.statement ? (
        <Typography variant="body2" sx={{ mt: 1, maxWidth: '72ch' }}>
          {f.statement}
        </Typography>
      ) : null}
      <Stack
        direction="row"
        spacing={3}
        sx={{ mt: 2, mb: 2, flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}
      >
        <StatusText status={STATUS[f.status]}>
          {t(`report.findings.work.status.${f.status}`)}
        </StatusText>
        <Typography variant="body2" color="text.secondary" data-testid="finding-people">
          {t('report.findings.people', { count: f.people })}
        </Typography>
        {f.notes > 0 ? (
          <Typography variant="body2" color="text.secondary" data-testid="finding-notes">
            {t('report.findings.work.visit', { n: f.notes })}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {enumLabelOf(t, 'axis', f.axis)} · {t(`report.findings.work.source.${f.source}`)}
        </Typography>
      </Stack>
      {!isReportable(f, minGroup) && f.status !== 'rejected' ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2 }}
          data-testid="finding-staff-only"
        >
          {t('report.findings.work.staffOnly', { n: minGroup })}
        </Typography>
      ) : null}
      <Review ids={ids} f={f} minGroup={minGroup} />
      <Decide ids={ids} f={f} minGroup={minGroup} />
    </Box>
  );
}

/**
 * Findings on the Report tab (TASK-AJ, ADR 0058): propose findings from the answers, approve or
 * reject each proposal, withdraw an approved one. Approved findings from enough people become the
 * report's key findings and get catalogue actions under Actions.
 */
export function FindingsPanel({
  ids,
  findings,
  minGroup,
  disabled,
}: {
  ids: Ids;
  findings: readonly FindingRow[] | null;
  minGroup: number;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(proposeFindingsAction, findingIdle);
  if (findings === null) {
    return <Typography color="text.secondary">{t('report.findings.work.unavailable')}</Typography>;
  }
  const open = findings.filter((f) => f.status !== 'rejected');
  const rejected = findings.filter((f) => f.status === 'rejected');
  return (
    <Stack spacing={4} data-testid="findings-panel">
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 2, alignItems: 'center' }}>
        <Box component="form" action={action}>
          <input type="hidden" name="tenantId" value={ids.tenantId} />
          <input type="hidden" name="engagementId" value={ids.engagementId} />
          <Submit variant="outlined" icon="ai" testId="findings-propose" disabled={disabled}>
            {t('report.findings.work.propose')}
          </Submit>
        </Box>
        <Button
          component={Link}
          href={`/admin/engagements/${ids.engagementId}/answers?tenant=${ids.tenantId}#write-finding`}
          variant="text"
          startIcon={<AppIcon name="edit" size={20} />}
          sx={{ minHeight: 44 }}
        >
          {t('report.findings.work.fromAnswers')}
        </Button>
      </Stack>
      <Result state={state} minGroup={minGroup} />
      {open.length === 0 ? (
        <Typography color="text.secondary">{t('report.findings.work.empty')}</Typography>
      ) : (
        <Stack component="ul" spacing={3} sx={{ m: 0, p: 0 }}>
          {open.map((f) => (
            <FindingItem key={f.id} ids={ids} f={f} minGroup={minGroup} />
          ))}
        </Stack>
      )}
      {rejected.length > 0 ? (
        <Box>
          <Typography variant="sectionTitle" component="h3" sx={{ mb: 2 }}>
            {t('report.findings.work.rejectedTitle')}
          </Typography>
          <Stack component="ul" spacing={3} sx={{ m: 0, p: 0 }}>
            {rejected.map((f) => (
              <FindingItem key={f.id} ids={ids} f={f} minGroup={minGroup} />
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
