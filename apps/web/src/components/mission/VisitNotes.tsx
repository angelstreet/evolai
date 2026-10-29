'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import FindingFields from '@/components/mission/FindingFields';
import { makeFindingAction } from '@/app/admin/findings/actions';
import { findingIdle } from '@/app/admin/findings/state';
import { addNoteAction, deleteNoteAction, type VisitActionState } from '@/app/admin/visit/actions';
import type { VisitNote } from '@/lib/visitData';

const FORM_ID = 'note-finding-form';
const CARD_SX = { p: { xs: 4, sm: 6 }, borderRadius: 3, mb: 5 } as const;
const KINDS = ['interview', 'observation', 'workshop'] as const;
const idle: VisitActionState = { ok: false, code: 'idle' };

function Result({ state }: { state: VisitActionState }) {
  const { t } = useI18n();
  return (
    <Box aria-live="polite" sx={{ minHeight: 24 }}>
      {state.code !== 'idle' ? (
        <StatusText status={state.ok ? 'success' : 'error'}>
          <span data-testid="visit-result">
            {t(`admin.visit.result.${state.code}` as MessageKey)}
          </span>
        </StatusText>
      ) : null}
    </Box>
  );
}

function AddButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outlined"
      disabled={pending}
      startIcon={<AppIcon name="add" size={20} />}
      data-testid="visit-add"
      sx={{ minHeight: 44, alignSelf: 'flex-start' }}
    >
      {t('admin.visit.add')}
    </Button>
  );
}

function AddNote({
  tenantId,
  engagementId,
  teams,
  today,
}: {
  tenantId: string;
  engagementId: string;
  teams: { id: string; name: string }[];
  today: string;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(addNoteAction, idle);
  return (
    <Paper variant="outlined" component="section" aria-labelledby="visit-add-title" sx={CARD_SX}>
      <Typography id="visit-add-title" variant="sectionTitle" component="h3" sx={{ m: 0 }}>
        {t('admin.visit.addTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
        {t('admin.visit.addHint')}
      </Typography>
      <Stack component="form" action={action} spacing={4} data-testid="visit-form">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="engagementId" value={engagementId} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <TextField
            select
            name="kind"
            label={t('admin.visit.kind')}
            defaultValue="interview"
            sx={{ minWidth: 200 }}
          >
            {KINDS.map((k) => (
              <MenuItem key={k} value={k}>
                {t(`admin.visit.kinds.${k}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            name="notedOn"
            label={t('admin.visit.date')}
            defaultValue={today}
            required
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            select
            name="teamId"
            label={t('admin.visit.team')}
            defaultValue=""
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">{t('admin.visit.wholeMission')}</MenuItem>
            {teams.map((tm) => (
              <MenuItem key={tm.id} value={tm.id}>
                {tm.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TextField
          name="body"
          label={t('admin.visit.body')}
          multiline
          minRows={3}
          required
          inputProps={{ minLength: 3, maxLength: 2000 }}
        />
        <AddButton />
        <Result state={state} />
      </Stack>
    </Paper>
  );
}

function DeleteNote({ tenantId, noteId }: { tenantId: string; noteId: string }) {
  const { t } = useI18n();
  const [state, action] = useFormState(deleteNoteAction, idle);
  return (
    <Box component="form" action={action}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="noteId" value={noteId} />
      <Tooltip title={t('admin.visit.delete')}>
        <IconButton
          type="submit"
          aria-label={t('admin.visit.deleteAria')}
          data-testid="visit-delete"
          sx={{ width: 44, height: 44 }}
        >
          <AppIcon name="delete" size={20} />
        </IconButton>
      </Tooltip>
      {state.code !== 'idle' && !state.ok ? <Result state={state} /> : null}
    </Box>
  );
}

/**
 * The Visit tab body (TASK-AJ A6, ADR 0059): add a note, the notes newest first with a tick box
 * each, and "Write a finding from the notes" that saves an approved finding resting on the ticked
 * notes. Staff only.
 */
export default function VisitNotes({
  tenantId,
  engagementId,
  notes,
  teams,
  minGroup,
  today,
}: {
  tenantId: string;
  engagementId: string;
  notes: readonly VisitNote[];
  teams: { id: string; name: string }[];
  minGroup: number;
  today: string;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(makeFindingAction, findingIdle);
  const [picked, setPicked] = useState(0);
  return (
    <>
      <AddNote tenantId={tenantId} engagementId={engagementId} teams={teams} today={today} />
      <Paper variant="outlined" component="section" aria-labelledby="visit-list-title" sx={CARD_SX}>
        <Typography
          id="visit-list-title"
          variant="sectionTitle"
          component="h3"
          sx={{ mt: 0, mb: 4 }}
        >
          {t('admin.visit.listTitle')}
        </Typography>
        {notes.length === 0 ? (
          <Typography color="text.secondary">{t('admin.visit.empty')}</Typography>
        ) : (
          <Stack component="ul" spacing={3} sx={{ m: 0, p: 0 }}>
            {notes.map((n) => (
              <Box
                component="li"
                key={n.id}
                data-testid="visit-note"
                sx={{
                  listStyle: 'none',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: { xs: 3, sm: 4 },
                  display: 'flex',
                  gap: 2,
                  alignItems: 'flex-start',
                }}
              >
                <Checkbox
                  name="note"
                  value={n.id}
                  onChange={(e) => setPicked((v) => v + (e.target.checked ? 1 : -1))}
                  inputProps={
                    { form: FORM_ID, 'aria-label': t('admin.answers.make.pick') } as never
                  }
                  data-testid="visit-pick"
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t(`admin.visit.kinds.${n.kind}`)} · {n.notedOn} ·{' '}
                    {n.teamName ?? t('admin.visit.wholeMission')}
                    {n.findings > 0 ? ` · ${t('admin.visit.cited', { n: n.findings })}` : ''}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ mt: 1, whiteSpace: 'pre-wrap', maxWidth: '72ch' }}
                  >
                    {n.body}
                  </Typography>
                </Box>
                <DeleteNote tenantId={tenantId} noteId={n.id} />
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
      {notes.length > 0 ? (
        <Paper
          variant="outlined"
          component="section"
          id="note-finding"
          aria-labelledby="note-finding-title"
          sx={CARD_SX}
        >
          <Typography id="note-finding-title" variant="sectionTitle" component="h3" sx={{ m: 0 }}>
            {t('admin.visit.makeTitle')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, mb: 4, maxWidth: '72ch' }}
          >
            {t('admin.visit.makeSubtitle')}
          </Typography>
          <Stack
            component="form"
            id={FORM_ID}
            action={action}
            spacing={4}
            data-testid="note-finding"
          >
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="engagementId" value={engagementId} />
            <Typography
              variant="body2"
              color="text.secondary"
              aria-live="polite"
              data-testid="visit-picked"
            >
              {t('admin.visit.picked', { n: picked })}
            </Typography>
            <FindingFields
              state={state}
              tenantId={tenantId}
              engagementId={engagementId}
              minGroup={minGroup}
            />
          </Stack>
        </Paper>
      ) : null}
    </>
  );
}
