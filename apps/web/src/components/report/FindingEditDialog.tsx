'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { editFindingAction } from '@/app/admin/findings/actions';
import { findingIdle } from '@/app/admin/findings/state';
import { enumLabelOf } from '@/lib/enumLabel';
import type { FindingRow } from '@/lib/findingsData';

const AXES = ['literacy', 'practice', 'readiness', 'opportunity', 'context'] as const;

/**
 * Reword a finding (ADR 0060): title, one sentence, axis. The evidence stays as it is; the action
 * made from it follows. Editing a disputed finding answers the dispute as "corrected".
 */
export default function FindingEditDialog({
  tenantId,
  finding,
}: {
  tenantId: string;
  finding: FindingRow;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(editFindingAction, findingIdle);
  return (
    <>
      <Tooltip title={t('report.findings.work.edit')}>
        <IconButton
          aria-label={t('report.findings.work.edit')}
          onClick={() => setOpen(true)}
          data-testid="finding-edit"
          sx={{ width: 44, height: 44 }}
        >
          <AppIcon name="edit" size={20} />
        </IconButton>
      </Tooltip>
      {state.code !== 'idle' ? (
        <StatusText status={state.ok ? 'success' : 'error'}>
          <span data-testid="finding-edit-result">
            {t(`report.findings.result.${state.code}` as MessageKey)}
          </span>
        </StatusText>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby={`finding-edit-${finding.id}`}
      >
        <Box
          component="form"
          action={(fd: FormData) => {
            setOpen(false);
            action(fd);
          }}
        >
          <DialogTitle id={`finding-edit-${finding.id}`}>
            {t('report.findings.work.editTitle')}
          </DialogTitle>
          <DialogContent>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="findingId" value={finding.id} />
            <Stack spacing={3} sx={{ pt: 1 }}>
              <TextField
                name="label"
                label={t('admin.answers.make.label')}
                helperText={t('admin.answers.make.labelHelp')}
                defaultValue={finding.label}
                required
                inputProps={{ minLength: 3, maxLength: 200 }}
              />
              <TextField
                name="statement"
                label={t('admin.answers.make.statement')}
                defaultValue={finding.statement}
                multiline
                minRows={2}
                inputProps={{ maxLength: 600 }}
              />
              <TextField
                select
                name="axis"
                label={t('admin.answers.make.axis')}
                defaultValue={finding.axis}
                sx={{ maxWidth: 280 }}
              >
                {AXES.map((a) => (
                  <MenuItem key={a} value={a}>
                    {enumLabelOf(t, 'axis', a)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 6, pb: 5 }}>
            <Button variant="text" onClick={() => setOpen(false)}>
              {t('report.steps.cancel')}
            </Button>
            <Button type="submit" variant="contained" data-testid="finding-edit-save">
              {t('report.steps.save')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
