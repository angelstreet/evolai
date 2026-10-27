'use client';

import { useRef, useState, type FormEvent } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useI18n } from '@/components/I18nProvider';
import PrimaryButton from './PrimaryButton';

type Phase = 'form' | 'sending' | 'sent';

/**
 * The last step (ADR 0051): one email field. Nothing else on the page asks for it. `onSend`
 * resolves to an error key or null.
 */
export default function SendSheet({
  open,
  answered,
  onClose,
  onSend,
}: {
  open: boolean;
  answered: number;
  onClose: () => void;
  onSend: (email: string) => Promise<'invalid' | 'busy' | 'unavailable' | null>;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPhase('sending');
    const err = await onSend(email.trim());
    if (err) {
      setError(
        err === 'invalid'
          ? t('cockpit.sheet.errEmail')
          : err === 'busy'
            ? t('cockpit.sheet.errBusy')
            : t('cockpit.sheet.errUnavailable'),
      );
      setPhase('form');
      // The disabled button lost focus: put it back on the field the message is about.
      setTimeout(() => field.current?.focus(), 0);
    } else {
      setError(null);
      setPhase('sent');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="ck-sheet-title">
      {phase === 'sent' ? (
        <>
          <DialogTitle id="ck-sheet-title" component="h2">
            {t('cockpit.sheet.inboxTitle')}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontWeight: 600 }}>{t('cockpit.sheet.sentTo', { email })}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {t('cockpit.sheet.sentBody')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <PrimaryButton onClick={onClose}>{t('cockpit.sheet.close')}</PrimaryButton>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <DialogTitle id="ck-sheet-title" component="h2">
            {t('cockpit.sheet.title')}
          </DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              {t('cockpit.sheet.body', { n: answered })}
            </Typography>
            <TextField
              autoFocus
              inputRef={field}
              fullWidth
              required
              type="email"
              autoComplete="email"
              label={t('cockpit.sheet.emailLabel')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error !== null}
              helperText={error ?? ' '}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button variant="text" onClick={onClose} sx={{ minHeight: 44 }}>
              {t('cockpit.sheet.notNow')}
            </Button>
            <PrimaryButton type="submit" disabled={phase === 'sending'}>
              {phase === 'sending' ? t('cockpit.sheet.sending') : t('cockpit.sheet.submit')}
            </PrimaryButton>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
