'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useI18n } from '@/components/I18nProvider';
import type { StepRow } from '@/lib/reportModel';

interface Ids {
  readonly tenantId: string;
  readonly reportId: string;
  readonly engagementId: string;
}

const DAY90 = ['validated', 'mixed', 'no_benefit', 'not_implemented'] as const;

/** Baseline and day-90 follow-up of an accepted action (TASK-AJ A9, PRD §30.1). */
export default function MeasureDialog({
  ids,
  step,
  open,
  onClose,
  onSave,
}: {
  ids: Ids;
  step: StepRow;
  open: boolean;
  onClose: () => void;
  onSave: (fd: FormData) => void;
}) {
  const { t } = useI18n();
  const m = step.measure ?? null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={`measure-${step.id}`}
    >
      <Box
        component="form"
        action={(fd: FormData) => {
          onClose();
          onSave(fd);
        }}
      >
        <DialogTitle id={`measure-${step.id}`}>{t('report.steps.measure.title')}</DialogTitle>
        <DialogContent>
          <input type="hidden" name="tenantId" value={ids.tenantId} />
          <input type="hidden" name="reportId" value={ids.reportId} />
          <input type="hidden" name="engagementId" value={ids.engagementId} />
          <input type="hidden" name="stepId" value={step.id} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('report.steps.measure.help')}
          </Typography>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <TextField
                name="baselineValue"
                label={t('report.steps.measure.value')}
                defaultValue={m?.baselineValue ?? ''}
                inputProps={{ inputMode: 'decimal', maxLength: 20 }}
                sx={{ maxWidth: { sm: 180 } }}
              />
              <TextField
                name="baselineUnit"
                label={t('report.steps.measure.unit')}
                helperText={t('report.steps.measure.unitHelp')}
                defaultValue={m?.baselineUnit ?? ''}
                inputProps={{ maxLength: 40 }}
                fullWidth
              />
            </Stack>
            <TextField
              name="baselineSource"
              label={t('report.steps.measure.source')}
              helperText={t('report.steps.measure.sourceHelp')}
              defaultValue={m?.baselineSource ?? ''}
              inputProps={{ maxLength: 200 }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <TextField
                type="date"
                name="followUpOn"
                label={t('report.steps.measure.followUpOn')}
                defaultValue={m?.followUpOn ?? ''}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 180 }}
              />
              <TextField
                select
                name="day90Status"
                label={t('report.steps.measure.day90')}
                defaultValue={m?.day90Status ?? ''}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">{t('report.steps.measure.none')}</MenuItem>
                {DAY90.map((s) => (
                  <MenuItem key={s} value={s}>
                    {t(`report.steps.measure.status.${s}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button variant="text" onClick={onClose}>
            {t('report.steps.cancel')}
          </Button>
          <Button type="submit" variant="contained" data-testid="measure-save">
            {t('report.steps.measure.save')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
