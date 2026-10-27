'use client';

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import { useI18n } from '@/components/I18nProvider';
import PrimaryButton from './PrimaryButton';

/** What the send step answered (`/api/send`, ADR 0055). */
export type SendOutcome =
  | { readonly kind: 'ok' }
  | { readonly kind: 'signin' | 'no_team' | 'read_only' | 'closed' | 'unavailable' }
  | { readonly kind: 'choose'; readonly teams: readonly { slug: string; name: string }[] };

type Phase = 'ready' | 'sending' | 'sent' | 'error';

/**
 * The last step (ADR 0051, 0055). Signed out: the answers stay in this browser and the one action
 * is Sign in, which comes back here. Signed in: Send files them for the referent's team, without
 * the person's name.
 */
export default function SendSheet({
  open,
  signedIn,
  answered,
  onClose,
  onSend,
}: {
  open: boolean;
  signedIn: boolean;
  answered: number;
  onClose: () => void;
  onSend: (slug: string | null) => Promise<SendOutcome>;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<readonly { slug: string; name: string }[]>([]);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (open && phase !== 'sent') setPhase('ready');
  }, [open, phase]);

  const send = async () => {
    setPhase('sending');
    const out = await onSend(slug);
    if (out.kind === 'ok') return setPhase('sent');
    if (out.kind === 'choose') {
      setTeams(out.teams);
      setSlug(out.teams[0]?.slug ?? null);
      return setPhase('ready');
    }
    setError(
      out.kind === 'no_team'
        ? t('cockpit.sheet.errNoTeam')
        : out.kind === 'closed'
          ? t('cockpit.sheet.errClosed')
          : out.kind === 'read_only'
            ? t('cockpit.sheet.errReadOnly')
            : t('cockpit.sheet.errUnavailable'),
    );
    setPhase('error');
  };

  const signIn = `/login?next=${encodeURIComponent('/?send=1')}`;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="ck-sheet-title">
      <DialogTitle id="ck-sheet-title" component="h2">
        {phase === 'sent'
          ? t('cockpit.sheet.sentTitle')
          : signedIn
            ? t('cockpit.sheet.sendTitle')
            : t('cockpit.sheet.signInTitle')}
      </DialogTitle>
      <DialogContent>
        {phase === 'sent' ? (
          <Typography color="text.secondary">{t('cockpit.sheet.sentBody')}</Typography>
        ) : (
          <>
            <Typography color="text.secondary">
              {signedIn
                ? t('cockpit.sheet.sendBody', { n: answered })
                : t('cockpit.sheet.signInBody', { n: answered })}
            </Typography>
            {signedIn && teams.length > 1 && (
              <RadioGroup
                aria-label={t('cockpit.sheet.teamLabel')}
                value={slug ?? ''}
                onChange={(e) => setSlug(e.target.value)}
                sx={{ mt: 2 }}
              >
                {teams.map((tm) => (
                  <FormControlLabel
                    key={tm.slug}
                    value={tm.slug}
                    control={<Radio />}
                    label={tm.name}
                  />
                ))}
              </RadioGroup>
            )}
            {phase === 'error' && error && (
              <Typography color="error" sx={{ mt: 2 }} role="alert">
                {error}
              </Typography>
            )}
          </>
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
            {signedIn ? (
              <PrimaryButton
                onClick={send}
                disabled={phase === 'sending'}
                data-testid="ck-send-now"
              >
                {phase === 'sending' ? t('cockpit.sheet.sending') : t('cockpit.sheet.submit')}
              </PrimaryButton>
            ) : (
              <PrimaryButton href={signIn} data-testid="ck-sign-in">
                {t('cockpit.sheet.signIn')}
              </PrimaryButton>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
