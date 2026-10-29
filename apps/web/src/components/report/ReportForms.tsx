'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IMPROVEMENT_CATALOGUE,
  improvementCategorySchema,
  type Horizon,
  type Level,
  type PlanItem,
} from '@evolai/contracts';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import {
  addStepAction,
  buildPlanAction,
  decideStepAction,
  draftSummaryAction,
  saveSectionsAction,
  savePlanAction,
  startReportAction,
  suggestAction,
  updateStepAction,
  applyAiDraftAction,
  measureStepAction,
} from '@/app/admin/reports/actions';
import { reportIdle, type ReportActionState } from '@/app/admin/reports/state';
import { measureLine, type StepRow } from '@/lib/reportModel';
import MeasureDialog from './MeasureDialog';

/**
 * Auditor report editor controls (TASK-V, ADR 0041). Each form posts to a server action that
 * re-checks the session; the hidden tenant id is only a selector. One line of feedback per form,
 * icon plus words (UI_RULES §4). `disabled` locks every control of a published version or a
 * view-as session.
 */

const LEVELS: readonly Level[] = ['low', 'medium', 'high'];
const HORIZONS: readonly Horizon[] = ['d30', 'd60', 'd90'];

export interface Ids {
  readonly tenantId: string;
  readonly reportId: string;
  readonly engagementId: string;
}

export function Hidden({ ids }: { ids: Ids }) {
  return (
    <>
      <input type="hidden" name="tenantId" value={ids.tenantId} />
      <input type="hidden" name="reportId" value={ids.reportId} />
      <input type="hidden" name="engagementId" value={ids.engagementId} />
    </>
  );
}

export function ActionResult({ state }: { state: ReportActionState }) {
  const { t } = useI18n();
  return (
    <Box aria-live="polite" sx={{ minHeight: 24 }}>
      {state.code !== 'idle' ? (
        <StatusText status={state.ok ? 'success' : 'error'}>
          {t(`report.result.${state.code}` as MessageKey, { count: state.count ?? 0 })}
        </StatusText>
      ) : null}
    </Box>
  );
}

function Submit({
  children,
  variant = 'outlined',
  disabled,
  icon,
  testId,
}: {
  children: React.ReactNode;
  variant?: 'contained' | 'outlined' | 'text';
  disabled?: boolean;
  icon?: Parameters<typeof AppIcon>[0]['name'];
  testId?: string;
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

export function StartReportForm({
  tenantId,
  engagementId,
  primary,
}: {
  tenantId: string;
  engagementId: string;
  primary: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(startReportAction, reportIdle);
  return (
    <Box component="form" action={action}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <Submit variant={primary ? 'contained' : 'outlined'} icon="add" testId="report-start">
        {t('report.list.start')}
      </Submit>
      {state.code !== 'idle' ? <ActionResult state={state} /> : null}
    </Box>
  );
}

export function SectionsForm({
  ids,
  disabled,
  title,
  summary,
  citations,
  risksNote,
  methodology,
  findings,
  minGroupSize,
}: {
  ids: Ids;
  disabled: boolean;
  title: string;
  summary: string;
  citations: readonly string[];
  risksNote: string;
  methodology: string;
  findings: readonly { key: string; label: string; people: number }[];
  minGroupSize: number;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(saveSectionsAction, reportIdle);
  const [draftState, draftAction] = useFormState(draftSummaryAction, reportIdle);
  // The server re-renders with new values after a draft; the key resets the uncontrolled fields.
  const formKey = `${summary}|${citations.join(',')}|${methodology}`;
  return (
    <Stack spacing={3}>
      <Box component="form" action={draftAction}>
        <Hidden ids={ids} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Submit disabled={disabled} icon="edit" testId="report-draft-summary">
            {t('report.sections.draft')}
          </Submit>
          <Typography variant="body2" color="text.secondary">
            {t('report.sections.draftHelp')}
          </Typography>
        </Stack>
        <ActionResult state={draftState} />
      </Box>
      <Stack component="form" action={action} spacing={4} key={formKey}>
        <Hidden ids={ids} />
        <TextField
          name="title"
          label={t('report.sections.title')}
          defaultValue={title}
          required
          disabled={disabled}
          inputProps={{ maxLength: 200 }}
        />
        <TextField
          name="summary"
          label={t('report.sections.summary')}
          helperText={t('report.sections.summaryHelp')}
          defaultValue={summary}
          multiline
          minRows={5}
          disabled={disabled}
          inputProps={{ maxLength: 6000, 'data-testid': 'report-summary' }}
        />
        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }} disabled={disabled}>
          <Typography component="legend" variant="cardTitle">
            {t('report.sections.citations')}
          </Typography>
          <FormHelperText sx={{ mt: 0 }}>{t('report.sections.citationsHelp')}</FormHelperText>
          {findings.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('report.sections.noFindings', { n: minGroupSize })}
            </Typography>
          ) : (
            <FormGroup>
              {findings.map((f, i) => (
                <FormControlLabel
                  key={f.key}
                  control={
                    <Checkbox
                      name="citation"
                      value={f.key}
                      defaultChecked={citations.includes(f.key)}
                      disabled={disabled}
                    />
                  }
                  label={`${t('report.view.finding', { n: i + 1 })} · ${f.label}`}
                />
              ))}
            </FormGroup>
          )}
        </Box>
        <TextField
          name="risksNote"
          label={t('report.sections.risks')}
          helperText={t('report.sections.risksHelp')}
          defaultValue={risksNote}
          multiline
          minRows={3}
          disabled={disabled}
          inputProps={{ maxLength: 6000 }}
        />
        <TextField
          name="methodology"
          label={t('report.sections.methodology')}
          defaultValue={methodology}
          multiline
          minRows={3}
          disabled={disabled}
          inputProps={{ maxLength: 4000, 'data-testid': 'report-methodology' }}
        />
        <Box>
          <Submit disabled={disabled} testId="report-save-sections">
            {t('report.sections.save')}
          </Submit>
        </Box>
        <ActionResult state={state} />
      </Stack>
    </Stack>
  );
}

export function AiDraftCard({
  ids,
  disabled,
  text,
  meta,
}: {
  ids: Ids;
  disabled: boolean;
  text: string;
  meta: string;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(applyAiDraftAction, reportIdle);
  return (
    <Box
      component="form"
      action={action}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 4 }}
      data-testid="report-ai-draft"
    >
      <Hidden ids={ids} />
      <StatusText status="info">{t('report.ai.badge')}</StatusText>
      <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mt: 2 }}>
        {text}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        {meta}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('report.ai.help')}
      </Typography>
      <Submit disabled={disabled}>{t('report.ai.use')}</Submit>
      <ActionResult state={state} />
    </Box>
  );
}

export function SuggestForm({ ids, disabled }: { ids: Ids; disabled: boolean }) {
  const { t } = useI18n();
  const [state, action] = useFormState(suggestAction, reportIdle);
  return (
    <Box component="form" action={action}>
      <Hidden ids={ids} />
      <Submit variant="text" disabled={disabled} icon="refresh">
        {t('report.steps.suggestAgain')}
      </Submit>
      <ActionResult state={state} />
    </Box>
  );
}

function LevelSelect({
  name,
  label,
  value,
}: {
  name: 'effort' | 'impact' | 'risk';
  label: string;
  value: Level;
}) {
  const { t } = useI18n();
  return (
    <TextField select name={name} label={label} defaultValue={value} sx={{ minWidth: 140 }}>
      {LEVELS.map((l) => (
        <MenuItem key={l} value={l}>
          {t(`report.steps.level.${l}`)}
        </MenuItem>
      ))}
    </TextField>
  );
}

function HorizonSelect({
  name = 'horizon',
  value,
  disabled,
}: {
  name?: string;
  value: Horizon;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <TextField
      select
      name={name}
      label={t('report.steps.horizon')}
      defaultValue={value}
      slotProps={{ inputLabel: { shrink: true } }}
      disabled={disabled}
      sx={{ minWidth: 180 }}
    >
      {HORIZONS.map((h) => (
        <MenuItem key={h} value={h}>
          {t(`report.steps.horizonName.${h}`)}
        </MenuItem>
      ))}
    </TextField>
  );
}

function StepFields({ step }: { step?: StepRow }) {
  const { t } = useI18n();
  return (
    <Stack spacing={3} sx={{ pt: 2 }}>
      <TextField
        name="title"
        label={t('report.steps.stepTitle')}
        defaultValue={step?.title ?? ''}
        required
        inputProps={{ maxLength: 200 }}
      />
      <TextField
        name="description"
        label={t('report.steps.description')}
        defaultValue={step?.description ?? ''}
        multiline
        minRows={2}
        inputProps={{ maxLength: 2000 }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <LevelSelect
          name="effort"
          label={t('report.steps.effort')}
          value={step?.effort ?? 'medium'}
        />
        <LevelSelect
          name="impact"
          label={t('report.steps.impact')}
          value={step?.impact ?? 'medium'}
        />
        <LevelSelect name="risk" label={t('report.steps.risk')} value={step?.risk ?? 'low'} />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          name="owner"
          label={t('report.steps.owner')}
          helperText={t('report.steps.ownerHelp')}
          defaultValue={step?.owner ?? ''}
          inputProps={{ maxLength: 120 }}
          sx={{ flex: 1 }}
        />
        <HorizonSelect value={step?.horizon ?? 'd60'} />
      </Stack>
    </Stack>
  );
}

const STATUS_ICON = { suggested: 'pending', accepted: 'success', rejected: 'cancelled' } as const;
const STATUS_COLOUR = {
  suggested: 'text.secondary',
  accepted: 'success.main',
  rejected: 'text.secondary',
} as const;

export function StepCard({
  ids,
  step,
  disabled,
  due = false,
  followUpReady = false,
}: {
  ids: Ids;
  step: StepRow;
  disabled: boolean;
  /** Its follow-up date has come and no day-90 result is set (ADR 0061). */
  due?: boolean;
  followUpReady?: boolean;
}) {
  const { t, locale } = useI18n();
  const [measureState, saveMeasure] = useFormState(measureStepAction, reportIdle);
  const [measuring, setMeasuring] = useState(false);
  const measure = measureLine(t, step.measure, locale === 'fr' ? '\u00a0: ' : ': ');
  const [state, decide] = useFormState(decideStepAction, reportIdle);
  const [editState, edit] = useFormState(updateStepAction, reportIdle);
  const [open, setOpen] = useState(false);
  const why =
    step.source === 'auditor'
      ? t('report.steps.whyAuditor')
      : step.tags.length > 0
        ? t('report.steps.why', {
            tags: step.tags.map((tag) => t(`report.steps.tag.${tag}` as MessageKey)).join(', '),
          })
        : t('report.steps.whyPicked');
  const statusWord = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        color: STATUS_COLOUR[step.status],
      }}
    >
      <AppIcon name={STATUS_ICON[step.status]} size={16} />
      <Box component="span" sx={{ color: 'text.primary' }}>
        {t(`report.steps.status.${step.status}`)}
      </Box>
    </Box>
  );
  return (
    <Box
      sx={{ py: 3, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
      data-testid="report-step"
      data-status={step.status}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="cardTitle" component="p" sx={{ m: 0 }}>
            {step.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`report.steps.categoryName.${step.category}`)} ·{' '}
            {t(`report.steps.horizonName.${step.horizon}`)} · {t('report.steps.effort')}{' '}
            {t(`report.steps.level.${step.effort}`).toLowerCase()} · {t('report.steps.impact')}{' '}
            {t(`report.steps.level.${step.impact}`).toLowerCase()} · {t('report.steps.risk')}{' '}
            {t(`report.steps.level.${step.risk}`).toLowerCase()}
            {step.owner ? ` · ${step.owner}` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            {why}
          </Typography>
          {due ? (
            <StatusText status="warning">
              <span data-testid="step-follow-up-due">{t('report.steps.measure.due')}</span>
            </StatusText>
          ) : null}
          {measure ? (
            <Typography variant="body2" color="text.secondary" data-testid="step-measure">
              {measure}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 'none' }}>
          {statusWord}
        </Stack>
      </Stack>
      <Stack
        component="form"
        action={decide}
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ mt: 2, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <Hidden ids={ids} />
        <input type="hidden" name="stepId" value={step.id} />
        {step.status !== 'accepted' ? (
          <Button
            type="submit"
            name="decision"
            value="accepted"
            variant="outlined"
            disabled={disabled}
            startIcon={<AppIcon name="success" size={20} />}
            sx={{ minHeight: 44 }}
          >
            {t('report.steps.accept')}
          </Button>
        ) : null}
        {step.status !== 'rejected' ? (
          <Button
            type="submit"
            name="decision"
            value="rejected"
            variant="text"
            disabled={disabled}
            startIcon={<AppIcon name="close" size={20} />}
            sx={{ minHeight: 44 }}
          >
            {t('report.steps.reject')}
          </Button>
        ) : null}
        {step.status !== 'suggested' ? (
          <Button
            type="submit"
            name="decision"
            value="suggested"
            variant="text"
            disabled={disabled}
            sx={{ minHeight: 44 }}
          >
            {t('report.steps.undo')}
          </Button>
        ) : null}
        <Tooltip title={t('report.steps.edit')}>
          <span>
            <IconButton
              aria-label={t('report.steps.edit')}
              onClick={() => setOpen(true)}
              disabled={disabled}
              sx={{ width: 44, height: 44 }}
            >
              <AppIcon name="edit" size={20} />
            </IconButton>
          </span>
        </Tooltip>
        {step.status === 'accepted' ? (
          <Button
            variant="text"
            onClick={() => setMeasuring(true)}
            startIcon={<AppIcon name="time" size={20} />}
            data-testid="step-measure-open"
            sx={{ minHeight: 44 }}
          >
            {t('report.steps.measure.title')}
          </Button>
        ) : null}
        <ActionResult
          state={
            state.code !== 'idle' ? state : measureState.code !== 'idle' ? measureState : editState
          }
        />
      </Stack>
      {step.status === 'accepted' ? (
        <MeasureDialog
          ids={ids}
          step={step}
          open={measuring}
          onClose={() => setMeasuring(false)}
          onSave={saveMeasure}
          followUpReady={followUpReady}
        />
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby={`edit-${step.id}`}
      >
        <Box
          component="form"
          action={(fd: FormData) => {
            setOpen(false);
            edit(fd);
          }}
        >
          <DialogTitle id={`edit-${step.id}`}>{t('report.steps.editTitle')}</DialogTitle>
          <DialogContent>
            <Hidden ids={ids} />
            <input type="hidden" name="stepId" value={step.id} />
            <StepFields step={step} />
          </DialogContent>
          <DialogActions sx={{ px: 6, pb: 5 }}>
            <Button variant="text" onClick={() => setOpen(false)}>
              {t('report.steps.cancel')}
            </Button>
            <Button type="submit" variant="contained">
              {t('report.steps.save')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

export function AddStepForm({
  ids,
  opportunityId,
  disabled,
  taken,
  customOnly = false,
}: {
  ids: Ids;
  /** Empty when the audit has no approved opportunity: the step then gets one of its own. */
  opportunityId: string;
  disabled: boolean;
  /** Catalogue ids already attached to this opportunity. */
  taken: readonly string[];
  /** Only "Write my own" (nothing to pick from without an opportunity). */
  customOnly?: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, action] = useFormState(addStepAction, reportIdle);
  const [mode, setMode] = useState<'catalogue' | 'custom' | null>(customOnly ? 'custom' : null);
  const options = IMPROVEMENT_CATALOGUE.filter((e) => !taken.includes(e.id));
  return (
    <Box sx={{ mt: 2 }} data-testid={customOnly ? 'report-add-own' : undefined}>
      {customOnly ? null : (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="text"
            disabled={disabled}
            onClick={() => setMode(mode === 'catalogue' ? null : 'catalogue')}
            startIcon={<AppIcon name="add" size={20} />}
            aria-expanded={mode === 'catalogue'}
            sx={{ minHeight: 44 }}
          >
            {t('report.steps.addFromCatalogue')}
          </Button>
          <Button
            variant="text"
            disabled={disabled}
            onClick={() => setMode(mode === 'custom' ? null : 'custom')}
            startIcon={<AppIcon name="edit" size={20} />}
            aria-expanded={mode === 'custom'}
            sx={{ minHeight: 44 }}
          >
            {t('report.steps.addCustom')}
          </Button>
        </Stack>
      )}
      {mode ? (
        <Stack component="form" action={action} spacing={3} sx={{ mt: 2, maxWidth: 640 }}>
          <Hidden ids={ids} />
          <input type="hidden" name="opportunityId" value={opportunityId} />
          {mode === 'catalogue' ? (
            <TextField
              select
              name="catalogueId"
              label={t('report.steps.pick')}
              defaultValue=""
              required
            >
              {options.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {t(`report.steps.categoryName.${e.category}`)} · {e.title[locale]}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <>
              <TextField
                select
                name="category"
                label={t('report.steps.category')}
                defaultValue="simplify"
                slotProps={{ inputLabel: { shrink: true } }}
              >
                {improvementCategorySchema.options.map((c) => (
                  <MenuItem key={c} value={c}>
                    {t(`report.steps.categoryName.${c}`)}
                  </MenuItem>
                ))}
              </TextField>
              <StepFields />
            </>
          )}
          <Box>
            <Submit disabled={disabled} testId="report-add-step">
              {t('report.steps.add')}
            </Submit>
          </Box>
        </Stack>
      ) : null}
      <ActionResult state={state} />
    </Box>
  );
}

export function PlanEditor({
  ids,
  disabled,
  plan,
  hasAccepted,
}: {
  ids: Ids;
  disabled: boolean;
  plan: readonly PlanItem[];
  hasAccepted: boolean;
}) {
  const { t } = useI18n();
  const [buildState, build] = useFormState(buildPlanAction, reportIdle);
  const [state, save] = useFormState(savePlanAction, reportIdle);
  const [rows, setRows] = useState<PlanItem[]>(() => [...plan]);
  const [synced, setSynced] = useState(plan);
  // A rebuilt plan comes back from the server: take it over.
  if (synced !== plan) {
    setSynced(plan);
    setRows([...plan]);
  }
  const counter = useRef(0);
  return (
    <Stack spacing={3}>
      <Box component="form" action={build}>
        <Hidden ids={ids} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Submit disabled={disabled || !hasAccepted} icon="refresh" testId="report-build-plan">
            {t('report.plan.build')}
          </Submit>
          <Typography variant="body2" color="text.secondary">
            {t('report.plan.buildHelp')}
          </Typography>
        </Stack>
        <ActionResult state={buildState} />
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('report.plan.empty')}
        </Typography>
      ) : null}
      <Stack component="form" action={save} spacing={2}>
        <Hidden ids={ids} />
        {rows.map((r, i) => (
          <Stack
            key={r.id}
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              alignItems: { md: 'flex-start' },
              pb: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
            data-testid="report-plan-row"
          >
            <input type="hidden" name="planId" value={r.id} />
            <HorizonSelect name="planHorizon" value={r.horizon} disabled={disabled} />
            <TextField
              name="planText"
              label={t('report.plan.text')}
              defaultValue={r.text}
              multiline
              disabled={disabled}
              inputProps={{ maxLength: 400 }}
              sx={{ flex: 2 }}
            />
            <TextField
              name="planOwner"
              label={t('report.plan.owner')}
              defaultValue={r.owner}
              disabled={disabled}
              inputProps={{ maxLength: 120 }}
              sx={{ flex: 1 }}
            />
            <Tooltip title={t('report.plan.remove')}>
              <span>
                <IconButton
                  aria-label={t('report.plan.remove')}
                  disabled={disabled}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  sx={{ width: 44, height: 44 }}
                >
                  <AppIcon name="delete" size={20} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ))}
        <Stack direction="row" spacing={2}>
          <Button
            variant="text"
            disabled={disabled || rows.length >= 60}
            onClick={() => {
              counter.current += 1;
              setRows([
                ...rows,
                { id: `new-${Date.now()}-${counter.current}`, horizon: 'd30', text: '', owner: '' },
              ]);
            }}
            startIcon={<AppIcon name="add" size={20} />}
            sx={{ minHeight: 44 }}
          >
            {t('report.plan.addLine')}
          </Button>
          <Submit disabled={disabled} testId="report-save-plan">
            {t('report.plan.save')}
          </Submit>
        </Stack>
        <ActionResult state={state} />
      </Stack>
    </Stack>
  );
}
