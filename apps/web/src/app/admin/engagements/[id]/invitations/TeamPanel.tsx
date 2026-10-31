'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AppIcon, StatusText, useNotify } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { copyText } from '@/lib/clipboard';
import ReferentInviteForm from '@/app/admin/teams/ReferentInviteForm';
import { saveTeamAddressAction, saveTeamMessagesAction } from './actions';
import { teamIdle, type TeamActionState } from './state';

export interface TeamRow {
  readonly teamId: string;
  readonly teamName: string;
  readonly slug: string;
  readonly address: string;
  readonly expectedSize: number | null;
  /** Words for the answers column, already through the minimum group rule. */
  readonly answers: string;
}

export interface ReferentView {
  readonly userId: string;
  readonly name: string;
  readonly teamName: string;
  readonly status: string;
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" disabled={pending} sx={{ minHeight: 44 }}>
      {label}
    </Button>
  );
}

function Result({ state, ns }: { state: TeamActionState; ns: 'addresses' | 'messages' }) {
  const { t } = useI18n();
  if (state.code === 'idle') return null;
  const text = state.ok
    ? t(`admin.invitations.${ns}.saved`)
    : t(
        `admin.invitations.${ns}.errors.${state.code}` as 'admin.invitations.addresses.errors.error',
        {},
      );
  return <StatusText status={state.ok ? 'success' : 'error'}>{text}</StatusText>;
}

function TeamAddressForm({
  row,
  tenantId,
  engagementId,
}: {
  row: TeamRow;
  tenantId: string;
  engagementId: string;
}) {
  const { t } = useI18n();
  const notify = useNotify();
  const [state, action] = useFormState(saveTeamAddressAction, teamIdle);
  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="team-address-row">
      <Typography variant="cardTitle" component="h3" sx={{ m: 0, mb: 2 }}>
        {row.teamName}
      </Typography>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: 3 }}>
        <Typography
          variant="body1"
          data-testid="team-address"
          sx={{ m: 0, overflowWrap: 'anywhere' }}
        >
          {row.address}
        </Typography>
        <Tooltip title={t('admin.invitations.addresses.copy')}>
          <IconButton
            aria-label={t('admin.invitations.addresses.copy')}
            onClick={async () => {
              if (await copyText(row.address)) notify(t('admin.invitations.addresses.copied'));
            }}
            sx={{ width: 44, height: 44 }}
          >
            <AppIcon name="copy" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography variant="body1" color="text.secondary" sx={{ m: 0, mb: 3 }}>
        {t('admin.invitations.addresses.answers')}: {row.answers}
      </Typography>
      <Stack component="form" action={action} sx={{ gap: 3 }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="engagementId" value={engagementId} />
        <input type="hidden" name="teamId" value={row.teamId} />
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 3 }}>
          <TextField
            name="slug"
            label={t('admin.invitations.addresses.slug')}
            helperText={t('admin.invitations.addresses.slugHelp')}
            defaultValue={row.slug}
            slotProps={{
              htmlInput: { spellCheck: false, autoCapitalize: 'none', 'data-testid': 'team-slug' },
            }}
            sx={{ flex: 2, minWidth: 0 }}
          />
          <TextField
            name="size"
            label={t('admin.invitations.addresses.size')}
            helperText={t('admin.invitations.addresses.sizeHelp')}
            defaultValue={row.expectedSize ?? ''}
            slotProps={{ htmlInput: { inputMode: 'numeric', 'data-testid': 'team-size' } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
        </Stack>
        <Box aria-live="polite">
          <Result state={state} ns="addresses" />
        </Box>
        <Box>
          <Save label={t('admin.invitations.addresses.save')} />
        </Box>
      </Stack>
    </Paper>
  );
}

function MessagesForm({
  tenantId,
  engagementId,
  contact,
  reminderDays,
}: {
  tenantId: string;
  engagementId: string;
  contact: string;
  reminderDays: string;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(saveTeamMessagesAction, teamIdle);
  return (
    <Stack component="form" action={action} sx={{ gap: 3 }}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <TextField
        name="contact"
        label={t('admin.invitations.messages.contact')}
        helperText={t('admin.invitations.messages.contactHint')}
        defaultValue={contact}
        slotProps={{ htmlInput: { maxLength: 120 } }}
        sx={{ maxWidth: 560 }}
      />
      <TextField
        name="reminderDays"
        label={t('admin.invitations.messages.reminderDays')}
        helperText={t('admin.invitations.messages.reminderHint')}
        defaultValue={reminderDays}
        sx={{ maxWidth: 360 }}
      />
      <Box aria-live="polite">
        <Result state={state} ns="messages" />
      </Box>
      <Box>
        <Save label={t('admin.invitations.messages.save')} />
      </Box>
    </Stack>
  );
}

/** The Team tab body (TASK-AF): referent welcome email, one address per team, messages. */
export default function TeamPanel({
  tenantId,
  engagementId,
  referents,
  teams,
  contact,
  reminderDays,
}: {
  tenantId: string;
  engagementId: string;
  referents: readonly ReferentView[];
  teams: readonly TeamRow[];
  contact: string;
  reminderDays: string;
}) {
  const { t } = useI18n();
  return (
    <Stack spacing={6}>
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="team-referents">
        <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
          {t('admin.invitations.referent.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
          {t('admin.invitations.referent.hint')}
        </Typography>
        {referents.length === 0 ? (
          <Typography variant="body1" sx={{ m: 0 }}>
            {t('admin.invitations.referent.none')}
          </Typography>
        ) : (
          <Stack spacing={5}>
            {referents.map((r) => (
              <Box key={r.userId} data-testid="team-referent">
                <Typography variant="cardTitle" component="h3" sx={{ m: 0, mb: 1 }}>
                  {r.name} · {r.teamName}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ m: 0, mb: 3 }}>
                  {r.status}
                </Typography>
                <ReferentInviteForm tenantId={tenantId} userId={r.userId} />
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Box component="section" aria-labelledby="team-addresses-title">
        <Typography id="team-addresses-title" variant="sectionTitle" component="h2" sx={{ m: 0 }}>
          {t('admin.invitations.addresses.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
          {t('admin.invitations.addresses.hint')}
        </Typography>
        {teams.length === 0 ? (
          <Typography variant="body1" sx={{ m: 0 }}>
            {t('admin.invitations.addresses.empty')}
          </Typography>
        ) : (
          <Stack spacing={4}>
            {teams.map((row) => (
              <TeamAddressForm
                key={row.teamId}
                row={row}
                tenantId={tenantId}
                engagementId={engagementId}
              />
            ))}
          </Stack>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 4 }}>
          {t('admin.invitations.messages.title')}
        </Typography>
        <MessagesForm
          tenantId={tenantId}
          engagementId={engagementId}
          contact={contact}
          reminderDays={reminderDays}
        />
      </Paper>
    </Stack>
  );
}
