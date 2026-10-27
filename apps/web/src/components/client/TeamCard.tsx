'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppIcon, SegmentedToggle, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { useLinkActions } from '@/components/LinkActions';
import { whatsappHref } from '@/lib/referentView';
import { setTeamSizeAction, type TeamSizeState } from '@/app/client/actions';

type Lang = 'fr' | 'en';

export interface TeamCardProps {
  readonly teamId: string;
  readonly teamName: string;
  /** The team address, in full. */
  readonly address: string;
  /** Server-rendered QR code (SVG markup of the address). */
  readonly qrSvg: string;
  /** Ready-made invitation and reminder texts, address included, in both languages. */
  readonly invite: Readonly<Record<Lang, string>>;
  readonly reminder: Readonly<Record<Lang, string>>;
  readonly defaultLang: Lang;
  readonly expectedSize: number | null;
  readonly primary: boolean;
  /** "9 of 12 answered" or the coarse band; never a figure the minimum group rule hides. */
  readonly answers: { readonly main: string; readonly hint?: string };
  /** 0..100 or null when there is nothing to draw. */
  readonly bar: number | null;
  /** "A reminder is due today." style hint, or null. */
  readonly reminderHint: string | null;
}

const INITIAL: TeamSizeState = { ok: false, code: 'idle' };

function SaveSize() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" disabled={pending} sx={{ minHeight: 44 }}>
      {t('client.space.sizeSave')}
    </Button>
  );
}

/** The team size field: one number, optional (TASK-AF screen 4). */
function TeamSize({ teamId, expectedSize }: Pick<TeamCardProps, 'teamId' | 'expectedSize'>) {
  const { t } = useI18n();
  const [state, action] = useFormState(setTeamSizeAction, INITIAL);
  const message =
    state.code === 'saved'
      ? { ok: true, text: t('client.space.sizeSaved') }
      : state.code === 'bad_size'
        ? { ok: false, text: t('client.space.sizeError') }
        : state.code === 'idle'
          ? null
          : state.code === 'read_only'
            ? { ok: false, text: t('client.space.readOnly') }
            : { ok: false, text: t('client.space.sizeFailed') };
  return (
    <Stack component="form" action={action} sx={{ gap: 2, mt: 4 }}>
      <input type="hidden" name="teamId" value={teamId} />
      <TextField
        name="size"
        label={t('client.space.sizeLabel')}
        helperText={t('client.space.sizeHelp')}
        defaultValue={expectedSize ?? ''}
        slotProps={{
          htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', 'data-testid': 'team-size' },
        }}
        sx={{ maxWidth: 360 }}
      />
      <Box aria-live="polite">
        {message ? (
          <StatusText status={message.ok ? 'success' : 'error'}>{message.text}</StatusText>
        ) : null}
      </Box>
      <Box>
        <SaveSize />
      </Box>
    </Stack>
  );
}

interface MessageDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly lead: string;
  readonly label: string;
  readonly copyLabel: string;
  readonly texts: Readonly<Record<Lang, string>>;
  readonly defaultLang: Lang;
  readonly testId: string;
  readonly children?: React.ReactNode;
}

/** A prefilled message to copy or open in WhatsApp. Nothing is sent by the platform. */
function MessageDialog(p: MessageDialogProps) {
  const { t } = useI18n();
  const actions = useLinkActions();
  const [lang, setLang] = useState<Lang>(p.defaultLang);
  const [text, setText] = useState<Record<Lang, string>>({ fr: p.texts.fr, en: p.texts.en });
  return (
    <Dialog
      open={p.open}
      onClose={p.onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={`${p.testId}-title`}
      data-testid={p.testId}
    >
      <DialogTitle id={`${p.testId}-title`}>{p.title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 3 }}>{p.lead}</DialogContentText>
        <Box sx={{ mb: 3 }}>
          <SegmentedToggle<Lang>
            value={lang}
            onChange={setLang}
            label={t('client.space.messageLanguage')}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Box>
        <TextField
          multiline
          fullWidth
          minRows={8}
          label={p.label}
          value={text[lang]}
          onChange={(e) => setText((prev) => ({ ...prev, [lang]: e.target.value }))}
          slotProps={{ htmlInput: { lang, 'data-testid': `${p.testId}-text` } }}
        />
        {p.children}
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Button onClick={p.onClose} sx={{ minHeight: 44 }}>
          {t('client.space.close')}
        </Button>
        <Button
          variant="outlined"
          href={whatsappHref(text[lang])}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<AppIcon name="whatsapp" size={16} />}
          data-testid={`${p.testId}-whatsapp`}
          sx={{ minHeight: 44 }}
        >
          {t('client.space.whatsapp')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void actions.copy(text[lang], t('client.space.copied'))}
          startIcon={<AppIcon name="copy" size={16} />}
          data-testid={`${p.testId}-copy`}
          sx={{ minHeight: 44 }}
        >
          {p.copyLabel}
        </Button>
      </DialogActions>
      {actions.dialog}
    </Dialog>
  );
}

/**
 * One team on the referent's space (TASK-AF): the team address in big type with its QR code, the
 * share and reminder dialogs, and the answers line. One address for everybody; no per-person link.
 */
export default function TeamCard(p: TeamCardProps) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<'share' | 'remind' | null>(null);
  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-team-card">
      <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 3 }}>
        {p.teamName}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 4, alignItems: { sm: 'center' } }}>
        <Box
          role="img"
          aria-label={t('client.home.qrAlt', { team: p.teamName })}
          data-testid="client-qr"
          sx={{
            width: 152,
            height: 152,
            flex: '0 0 auto',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            '& svg': { display: 'block', width: '100%', height: '100%' },
          }}
          dangerouslySetInnerHTML={{ __html: p.qrSvg }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" color="text.secondary" sx={{ m: 0 }}>
            {t('client.home.addressLabel')}
          </Typography>
          <Typography
            variant="pageTitle"
            component="p"
            data-testid="client-address"
            sx={{ m: 0, mt: 1, overflowWrap: 'anywhere' }}
          >
            {p.address}
          </Typography>
        </Box>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
        <Button
          variant={p.primary ? 'contained' : 'outlined'}
          onClick={() => setDialog('share')}
          startIcon={<AppIcon name="share" size={16} />}
          data-testid="client-share"
          sx={{ minHeight: 44 }}
        >
          {t('client.home.share')}
        </Button>
        <Button
          variant="outlined"
          href="/?learn=3"
          startIcon={<AppIcon name="info" size={16} />}
          data-testid="client-questions"
          sx={{ minHeight: 44 }}
        >
          {t('client.home.questions')}
        </Button>
      </Stack>

      <Box sx={{ mt: 6 }} data-testid="client-team-progress">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ justifyContent: 'space-between', gap: 1, mb: 2 }}
        >
          <Typography variant="cardTitle" component="h3" sx={{ m: 0 }}>
            {t('client.home.answersLabel')}
          </Typography>
          <Typography
            variant="body1"
            sx={{ m: 0, fontVariantNumeric: 'tabular-nums' }}
            data-testid="client-team-answered"
          >
            {p.answers.main}
          </Typography>
        </Stack>
        {p.bar !== null ? (
          <LinearProgress
            variant="determinate"
            value={p.bar}
            aria-label={t('client.home.progressAria', { team: p.teamName })}
            aria-valuetext={p.answers.main}
            sx={{ height: 8, borderRadius: 4 }}
          />
        ) : null}
        {p.answers.hint ? (
          <Typography variant="body1" color="text.secondary" sx={{ m: 0, mt: 2 }}>
            {p.answers.hint}
          </Typography>
        ) : null}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mt: 4, alignItems: { sm: 'center' } }}
        >
          <Button
            variant="outlined"
            onClick={() => setDialog('remind')}
            startIcon={<AppIcon name="time" size={16} />}
            data-testid="client-remind"
            sx={{ minHeight: 44 }}
          >
            {t('client.home.remind')}
          </Button>
          {p.reminderHint ? (
            <Typography variant="body1" sx={{ m: 0 }} data-testid="client-reminder-hint">
              <StatusText status="info">{p.reminderHint}</StatusText>
            </Typography>
          ) : null}
        </Stack>
      </Box>

      <MessageDialog
        open={dialog === 'share'}
        onClose={() => setDialog(null)}
        title={t('client.space.shareTitle')}
        lead={t('client.space.shareLead')}
        label={t('client.space.messageLabel')}
        copyLabel={t('client.space.copy')}
        texts={p.invite}
        defaultLang={p.defaultLang}
        testId="client-share-dialog"
      >
        <TeamSize teamId={p.teamId} expectedSize={p.expectedSize} />
      </MessageDialog>
      <MessageDialog
        open={dialog === 'remind'}
        onClose={() => setDialog(null)}
        title={t('client.space.remindTitle')}
        lead={t('client.space.remindLead')}
        label={t('client.space.remindLabel')}
        copyLabel={t('client.space.remindCopy')}
        texts={p.reminder}
        defaultLang={p.defaultLang}
        testId="client-remind-dialog"
      />
    </Paper>
  );
}
