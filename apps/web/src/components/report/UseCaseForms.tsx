'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { UseCaseQualification } from '@evolai/contracts';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { qualifyUseCaseAction } from '@/app/admin/reports/actions';
import { rankUseCasesAction, type ReviewState } from '@/app/client/actions';
import { reportIdle } from '@/app/admin/reports/state';
import { ActionResult, Hidden, type Ids } from './ReportForms';

/**
 * Use-case forms (ADR 0064). The auditor's visit guide: the questions to ask and the two figures
 * that turn into time today and the estimated saving. The referent's ranking: in which order to
 * start the use cases, while the report is in review.
 */

function Save({ disabled, label, testId }: { disabled: boolean; label: string; testId: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outlined"
      disabled={disabled || pending}
      startIcon={<AppIcon name="success" size={20} />}
      data-testid={testId}
    >
      {label}
    </Button>
  );
}

export function QualifyForm({
  ids,
  opportunityId,
  unit,
  questions,
  value,
  estimate,
  disabled,
}: {
  ids: Ids;
  opportunityId: string;
  /** What is counted, e.g. "CV". */
  unit: string;
  /** Visit questions from the playbook, in the report language. */
  questions: readonly string[];
  value: UseCaseQualification;
  /** Today's time and the saving, already worded, or null until measured. */
  estimate: string | null;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(qualifyUseCaseAction, reportIdle);
  const num = (v: number | null) => (v === null ? '' : String(v));
  return (
    <Box
      component="form"
      action={action}
      sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}
      data-testid="use-case-qualify"
    >
      <Hidden ids={ids} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Typography variant="body2" sx={{ m: 0, fontWeight: 600 }}>
        {t('report.useCases.form.guide')}
      </Typography>
      <Box component="ul" sx={{ m: 0, mt: 1, mb: 3, pl: 5 }}>
        {questions.map((q) => (
          <Box component="li" key={q} sx={{ typography: 'body2' }}>
            {q}
          </Box>
        ))}
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 3 }}>
        <TextField
          name="volumePerWeek"
          label={t('report.useCases.form.volume', { unit })}
          defaultValue={num(value.volumePerWeek)}
          inputProps={{ inputMode: 'decimal' }}
          disabled={disabled}
        />
        <TextField
          name="minutesPerUnit"
          label={t('report.useCases.form.minutes', { unit })}
          defaultValue={num(value.minutesPerUnit)}
          inputProps={{ inputMode: 'decimal' }}
          disabled={disabled}
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 3 }}>
        <TextField
          name="teams"
          label={t('report.useCases.form.teams')}
          defaultValue={value.teams}
          inputProps={{ maxLength: 200 }}
          disabled={disabled}
          sx={{ flex: 1 }}
        />
        <TextField
          name="source"
          label={t('report.useCases.form.source')}
          helperText={t('report.useCases.form.sourceHelp')}
          defaultValue={value.source}
          inputProps={{ maxLength: 200 }}
          disabled={disabled}
          sx={{ flex: 1 }}
        />
      </Stack>
      {estimate ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2 }}
          data-testid="use-case-estimate"
        >
          {estimate}
        </Typography>
      ) : null}
      <Save disabled={disabled} label={t('report.useCases.form.save')} testId="use-case-save" />
      <ActionResult state={state} />
    </Box>
  );
}

export interface RankItem {
  readonly id: string;
  readonly title: string;
  readonly approach: string;
  readonly rank: number | null;
}

const rankIdle: ReviewState = { ok: false, code: 'idle' };

/** The referent orders the use cases: 1 = start here. */
export function UseCaseRanking({
  items,
  readOnly,
}: {
  items: readonly RankItem[];
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(rankUseCasesAction, rankIdle);
  if (items.length < 2) return null;
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="use-case-rank-title"
      sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3 }}
      data-testid="use-case-ranking"
    >
      <Typography id="use-case-rank-title" variant="sectionTitle" component="h2" sx={{ m: 0 }}>
        {t('report.useCases.rank.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {t('report.useCases.rank.subtitle')}
      </Typography>
      <Box component="form" action={action}>
        <Stack spacing={3}>
          {items.map((it, i) => (
            <Stack
              key={it.id}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <TextField
                select
                name={`rank_${it.id}`}
                label={t('report.useCases.rank.label')}
                defaultValue={String(it.rank ?? i + 1)}
                disabled={readOnly}
                sx={{ minWidth: 140 }}
                inputProps={{ 'data-testid': 'use-case-rank-select' }}
              >
                {items.map((_, n) => (
                  <MenuItem key={n} value={String(n + 1)}>
                    {n + 1}
                  </MenuItem>
                ))}
              </TextField>
              <Box>
                <Typography variant="cardTitle" component="h3" sx={{ m: 0 }}>
                  {it.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {it.approach}
                </Typography>
              </Box>
            </Stack>
          ))}
          <Box>
            <Save
              disabled={readOnly}
              label={t('report.useCases.rank.save')}
              testId="use-case-rank-save"
            />
          </Box>
          <Box aria-live="polite" sx={{ minHeight: 24 }}>
            {state.code !== 'idle' ? (
              <StatusText status={state.ok ? 'success' : 'error'}>
                {t(`report.useCases.rank.result.${state.code}` as MessageKey)}
              </StatusText>
            ) : null}
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}
