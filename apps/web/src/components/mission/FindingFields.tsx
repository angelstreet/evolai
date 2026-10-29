'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import type { FindingActionState } from '@/app/admin/findings/state';
import { enumLabelOf } from '@/lib/enumLabel';

const AXES = ['literacy', 'practice', 'readiness', 'opportunity', 'context'] as const;

function Save() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      startIcon={<AppIcon name="add" size={20} />}
      data-testid="finding-save"
      sx={{ minHeight: 44, alignSelf: 'flex-start' }}
    >
      {t('admin.answers.make.submit')}
    </Button>
  );
}

/**
 * The words of a finding the auditor writes (TASK-AJ A1, A6): title, one sentence, axis, save and
 * the result with a link to the Report tab. Used inside the Answers and the Visit tab forms.
 */
export default function FindingFields({
  state,
  tenantId,
  engagementId,
  minGroup,
}: {
  state: FindingActionState;
  tenantId: string;
  engagementId: string;
  minGroup: number;
}) {
  const { t } = useI18n();
  return (
    <>
      <TextField
        name="label"
        label={t('admin.answers.make.label')}
        helperText={t('admin.answers.make.labelHelp')}
        required
        inputProps={{ minLength: 3, maxLength: 200 }}
      />
      <TextField
        name="statement"
        label={t('admin.answers.make.statement')}
        multiline
        minRows={2}
        inputProps={{ maxLength: 600 }}
      />
      <TextField
        select
        name="axis"
        label={t('admin.answers.make.axis')}
        defaultValue="opportunity"
        sx={{ maxWidth: 280 }}
      >
        {AXES.map((a) => (
          <MenuItem key={a} value={a}>
            {enumLabelOf(t, 'axis', a)}
          </MenuItem>
        ))}
      </TextField>
      <Save />
      <Box aria-live="polite" sx={{ minHeight: 24 }}>
        {state.code !== 'idle' ? (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusText status={state.ok ? 'success' : 'error'}>
              <span data-testid="finding-result">
                {t(`report.findings.result.${state.code}` as MessageKey, { n: minGroup })}
              </span>
            </StatusText>
            {state.ok ? (
              <Button
                component={Link}
                href={`/admin/engagements/${engagementId}/report?tenant=${tenantId}#report-findings`}
                variant="text"
                sx={{ minHeight: 44 }}
              >
                {t('report.findings.work.title')}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Box>
    </>
  );
}
