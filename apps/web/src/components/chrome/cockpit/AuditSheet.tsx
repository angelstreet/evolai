'use client';

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useI18n } from '@/components/I18nProvider';
import PrimaryButton from './PrimaryButton';

type Phase = 'ready' | 'sending' | 'sent';
const ERRORS = ['invalid', 'no_mail', 'busy', 'unavailable'] as const;
type ErrorKind = (typeof ERRORS)[number];

/**
 * Ask for an audit (TASK-AI L6): one email field. The address must be valid (shape, and a domain
 * that takes mail); asking again is fine. The request reaches the owner by email; no account.
 */
export default function AuditSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    if (open) setPhase('ready');
  }, [open]);

  const submit = async () => {
    setError(null);
    setPhase('sending');
    try {
      const res = await fetch('/api/audit-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });
      const out = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (out?.ok) return setPhase('sent');
      setError(ERRORS.find((e) => e === out?.error) ?? 'unavailable');
    } catch {
      setError('unavailable');
    }
    setPhase('ready');
  };

  const field = error === 'invalid' || error === 'no_mail';
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="ck-audit-title">
      <DialogTitle id="ck-audit-title" component="h2">
        {phase === 'sent' ? t('cockpit.audit.sentTitle') : t('cockpit.audit.title')}
      </DialogTitle>
      <DialogContent>
        {phase === 'sent' ? (
          <Typography color="text.secondary">{t('cockpit.audit.sentBody')}</Typography>
        ) : (
          <form
            id="ck-audit-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Typography color="text.secondary">{t('cockpit.audit.body')}</Typography>
            <TextField
              type="email"
              autoComplete="email"
              fullWidth
              required
              label={t('cockpit.audit.label')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              error={field}
              helperText={field ? t(`cockpit.audit.err.${error}`) : ' '}
              slotProps={{ htmlInput: { 'data-testid': 'ck-audit-email', maxLength: 254 } }}
              sx={{ mt: 3 }}
            />
            {error && !field && (
              <Typography color="error" role="alert" data-testid="ck-audit-error">
                {t(`cockpit.audit.err.${error}`)}
              </Typography>
            )}
          </form>
        )}
      </DialogContent>
      <DialogActions>
        {phase === 'sent' ? (
          <PrimaryButton onClick={onClose}>{t('cockpit.sheet.close')}</PrimaryButton>
        ) : (
          <>
            <Button variant="text" onClick={onClose} sx={{ minHeight: 44 }}>
              {t('cockpit.sheet.notNow')}
            </Button>
            <PrimaryButton
              type="submit"
              form="ck-audit-form"
              disabled={phase === 'sending' || email.trim() === ''}
              data-testid="ck-audit-send"
            >
              {phase === 'sending' ? t('cockpit.sheet.sending') : t('cockpit.audit.submit')}
            </PrimaryButton>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
