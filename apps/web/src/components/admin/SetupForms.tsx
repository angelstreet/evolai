'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { MissionKind, MissionMode, MissionShape } from '@evolai/contracts';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import {
  createEngagementAction,
  createTeamAction,
  updateEngagementAction,
  updateTeamAction,
} from '@/app/admin/engagements/actions';
import { setupIdle } from '@/app/admin/engagements/state';
import { missionShapeKey } from '@/lib/missionStatus';
import { SetupResult, TenantField } from './SetupParts';

function Submit({ label, icon }: { label: string; icon?: 'add' }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      startIcon={icon ? <AppIcon name={icon} size={20} /> : undefined}
      sx={{ alignSelf: 'flex-start', minWidth: 160 }}
    >
      {label}
    </Button>
  );
}

export interface TeamChoice {
  readonly id: string;
  readonly name: string;
  readonly size: number;
}

export interface EngagementFormValues {
  readonly engagementId?: string;
  readonly name: string;
  readonly locale: 'fr' | 'en';
  readonly opensOn: string;
  readonly closesOn: string;
  readonly teamIds: readonly string[];
  readonly locked?: boolean;
  /** The stored kind and mode when editing (ADR 0065); shown, not editable. */
  readonly shape?: MissionShape;
}

/** One radio with a line of help under its label. */
function Choice({ value, label, help }: { value: string; label: string; help: string }) {
  return (
    <FormControlLabel
      value={value}
      control={<Radio />}
      label={
        <Stack component="span" sx={{ py: 1 }}>
          <span>{label}</span>
          <Typography component="span" variant="body2" color="text.secondary">
            {help}
          </Typography>
        </Stack>
      }
      sx={{ alignItems: 'flex-start', minHeight: 44, '& .MuiRadio-root': { mt: 0.5 } }}
    />
  );
}

/** What the audit looks at and how answers are collected, chosen once at creation (ADR 0065). */
function MissionShapeFields() {
  const { t } = useI18n();
  const [kind, setKind] = useState<MissionKind>('team');
  const [mode, setMode] = useState<MissionMode>('survey');
  return (
    <>
      <FormGroup>
        <FormLabel id="mission-kind-label" component="legend" sx={{ mb: 1 }}>
          {t('admin.setup.form.kind')}
        </FormLabel>
        <RadioGroup
          name="kind"
          aria-labelledby="mission-kind-label"
          value={kind}
          onChange={(e) => setKind(e.target.value === 'governance' ? 'governance' : 'team')}
        >
          <Choice
            value="team"
            label={t('admin.setup.form.kindTeam')}
            help={t('admin.setup.form.kindTeamHelp')}
          />
          <Choice
            value="governance"
            label={t('admin.setup.form.kindGovernance')}
            help={t('admin.setup.form.kindGovernanceHelp')}
          />
        </RadioGroup>
      </FormGroup>
      {kind === 'team' ? (
        <FormGroup>
          <FormLabel id="mission-mode-label" component="legend" sx={{ mb: 1 }}>
            {t('admin.setup.form.mode')}
          </FormLabel>
          <RadioGroup
            name="mode"
            aria-labelledby="mission-mode-label"
            value={mode}
            onChange={(e) => setMode(e.target.value === 'survey' ? 'survey' : 'interview')}
          >
            <Choice
              value="interview"
              label={t('admin.setup.form.modeInterview')}
              help={t('admin.setup.form.modeInterviewHelp')}
            />
            <Choice
              value="survey"
              label={t('admin.setup.form.modeSurvey')}
              help={t('admin.setup.form.modeSurveyHelp')}
            />
          </RadioGroup>
        </FormGroup>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('admin.setup.form.modeGovernance')}
        </Typography>
      )}
    </>
  );
}

/** Create or edit an engagement: name, language, dates, teams. Headcount follows the team sizes. */
export function EngagementForm({
  tenantId,
  teams,
  values,
  teamsHref,
  shapeChoice = false,
}: {
  tenantId: string;
  teams: readonly TeamChoice[];
  values: EngagementFormValues;
  teamsHref: string;
  /** Offer kind and mode (a new mission, once migration 0035 is applied). */
  shapeChoice?: boolean;
}) {
  const { t, locale } = useI18n();
  const editing = Boolean(values.engagementId);
  const [state, action] = useFormState(
    editing ? updateEngagementAction : createEngagementAction,
    setupIdle,
  );
  const [picked, setPicked] = useState<readonly string[]>(values.teamIds);
  const headcount = teams.filter((x) => picked.includes(x.id)).reduce((n, x) => n + x.size, 0);
  return (
    <Stack component="form" action={action} sx={{ gap: 4, maxWidth: 640 }}>
      <TenantField tenantId={tenantId} />
      {values.engagementId ? (
        <input type="hidden" name="engagementId" value={values.engagementId} />
      ) : null}
      {shapeChoice && !editing ? <MissionShapeFields /> : null}
      {editing && values.shape ? (
        <Typography variant="body2" color="text.secondary" data-testid="mission-shape-fixed">
          {t('admin.setup.form.shapeFixed', {
            shape: t(missionShapeKey(values.shape)),
          })}
        </Typography>
      ) : null}
      <TextField
        name="name"
        label={t('admin.setup.form.name')}
        helperText={t('admin.setup.form.nameHelp')}
        defaultValue={values.name}
        required
        slotProps={{ htmlInput: { maxLength: 120 } }}
      />
      <TextField
        select
        name="locale"
        label={t('admin.setup.form.locale')}
        defaultValue={values.locale}
        slotProps={{ inputLabel: { shrink: true } }}
        required
      >
        <MenuItem value="fr" lang="fr">
          {t('common.language.fr')}
        </MenuItem>
        <MenuItem value="en" lang="en">
          {t('common.language.en')}
        </MenuItem>
      </TextField>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 3 }}>
        <TextField
          type="date"
          name="opensOn"
          label={t('admin.setup.form.opensOn')}
          defaultValue={values.opensOn}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: 1 }}
        />
        <TextField
          type="date"
          name="closesOn"
          label={t('admin.setup.form.closesOn')}
          defaultValue={values.closesOn}
          helperText={t('admin.setup.form.datesHelp')}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: 1 }}
        />
      </Stack>
      <FormGroup>
        <FormLabel component="legend" sx={{ mb: 1 }}>
          {t('admin.setup.form.teams')}
        </FormLabel>
        {teams.length === 0 ? (
          <Typography color="text.secondary">
            {t('admin.setup.form.noTeams')} <a href={teamsHref}>{t('admin.setup.form.addTeams')}</a>
          </Typography>
        ) : (
          teams.map((team) => (
            <FormControlLabel
              key={team.id}
              control={
                <Checkbox
                  name="teamId"
                  value={team.id}
                  checked={picked.includes(team.id)}
                  onChange={(e) =>
                    setPicked((cur) =>
                      e.target.checked ? [...cur, team.id] : cur.filter((id) => id !== team.id),
                    )
                  }
                />
              }
              label={`${team.name} (${t('admin.setup.teams.sizeShort', { n: team.size })})`}
              sx={{ minHeight: 44 }}
            />
          ))
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} data-locale={locale}>
          {t('admin.setup.form.headcount', { n: headcount })}
        </Typography>
      </FormGroup>
      <SetupResult state={state} />
      {values.locked ? null : (
        <Submit label={editing ? t('admin.setup.form.save') : t('admin.setup.form.create')} />
      )}
    </Stack>
  );
}

/** Add a team: name and size. */
export function AddTeamForm({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [state, action] = useFormState(createTeamAction, setupIdle);
  const formRef = useRef<HTMLFormElement>(null);
  // Empty the fields once the server accepted the team.
  useEffect(() => {
    if (state.ok && state.code === 'team_created') formRef.current?.reset();
  }, [state]);
  return (
    <Stack component="form" ref={formRef} action={action} sx={{ gap: 3 }}>
      <TenantField tenantId={tenantId} />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 3, alignItems: { sm: 'flex-start' } }}
      >
        <TextField
          name="name"
          label={t('admin.setup.teams.name')}
          required
          slotProps={{ htmlInput: { maxLength: 120 } }}
          sx={{ flex: 2 }}
        />
        <TextField
          name="expectedHeadcount"
          type="number"
          label={t('admin.setup.teams.size')}
          required
          defaultValue={5}
          slotProps={{ htmlInput: { min: 0, max: 10000, inputMode: 'numeric' } }}
          sx={{ flex: 1, minWidth: 160 }}
        />
        <Submit label={t('admin.setup.teams.add')} icon="add" />
      </Stack>
      <SetupResult state={state} />
    </Stack>
  );
}

/** One team row: rename and resize in place. */
export function TeamRow({
  tenantId,
  team,
  usedLabel,
}: {
  tenantId: string;
  team: TeamChoice;
  usedLabel: string;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(updateTeamAction, setupIdle);
  return (
    <Box component="li" sx={{ py: 3, borderBottom: 1, borderColor: 'divider', listStyle: 'none' }}>
      <Stack component="form" action={action} sx={{ gap: 2 }}>
        <TenantField tenantId={tenantId} />
        <input type="hidden" name="teamId" value={team.id} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' } }}
        >
          <TextField
            name="name"
            defaultValue={team.name}
            size="small"
            required
            slotProps={{
              htmlInput: {
                maxLength: 120,
                'aria-label': t('admin.setup.teams.editAria', { team: team.name }),
              },
            }}
            sx={{ flex: 2 }}
          />
          <TextField
            name="expectedHeadcount"
            type="number"
            defaultValue={team.size}
            size="small"
            required
            slotProps={{
              htmlInput: { min: 0, max: 10000, 'aria-label': t('admin.setup.teams.size') },
            }}
            sx={{ flex: 1, minWidth: 120 }}
          />
          <Button type="submit" variant="outlined" sx={{ minWidth: 120 }}>
            {t('admin.setup.teams.rename')}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {usedLabel}
        </Typography>
        <SetupResult state={state} />
      </Stack>
    </Box>
  );
}
