'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { MessageKey } from '@evolai/i18n';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { reviewFindingAction, type ReviewState } from '@/app/client/actions';
import type { ReviewItem } from '@/lib/findingsData';

const idle: ReviewState = { ok: false, code: 'idle' };

function Submit({ verdict, disabled }: { verdict: 'confirmed' | 'disputed'; disabled: boolean }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="verdict"
      value={verdict}
      variant={verdict === 'confirmed' ? 'outlined' : 'text'}
      disabled={disabled || pending}
      startIcon={<AppIcon name={verdict === 'confirmed' ? 'success' : 'warning'} size={20} />}
      data-testid={`review-${verdict === 'confirmed' ? 'confirm' : 'dispute'}`}
      sx={{ minHeight: 44 }}
    >
      {t(verdict === 'confirmed' ? 'report.clientReview.confirm' : 'report.clientReview.dispute')}
    </Button>
  );
}

function Item({ item, readOnly }: { item: ReviewItem; readOnly: boolean }) {
  const { t } = useI18n();
  const [state, action] = useFormState(reviewFindingAction, idle);
  const r = item.review;
  return (
    <Box
      component="li"
      data-testid="review-finding"
      sx={{
        listStyle: 'none',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: { xs: 3, sm: 4 },
      }}
    >
      <Typography variant="cardTitle" component="h3" sx={{ m: 0 }}>
        {item.label}
      </Typography>
      {item.statement ? (
        <Typography variant="body1" sx={{ mt: 1, mb: 0 }} data-testid="review-statement">
          {item.statement}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {item.people > 0
          ? t('report.clientReview.people', { count: item.people })
          : t('report.clientReview.visit')}
      </Typography>
      {r ? (
        <Box sx={{ mt: 2 }} data-testid="review-state">
          <StatusText status={r.verdict === 'confirmed' ? 'success' : 'warning'}>
            {r.verdict === 'confirmed'
              ? t('report.clientReview.confirmed')
              : t('report.clientReview.disputed', { comment: r.comment })}
          </StatusText>
          {r.resolution ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('report.clientReview.resolved')}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      {readOnly ? null : (
        <Stack component="form" action={action} spacing={2} sx={{ mt: 3 }}>
          <input type="hidden" name="findingId" value={item.id} />
          <TextField
            name="comment"
            label={t('report.clientReview.comment')}
            helperText={t('report.clientReview.commentHelp')}
            inputProps={{ maxLength: 300 }}
            size="small"
          />
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <Submit verdict="confirmed" disabled={false} />
            <Submit verdict="disputed" disabled={false} />
          </Stack>
          <Box aria-live="polite" sx={{ minHeight: 24 }}>
            {state.code !== 'idle' ? (
              <StatusText status={state.ok ? 'success' : 'error'}>
                <span data-testid="review-result">
                  {t(`report.clientReview.result.${state.code}` as MessageKey)}
                </span>
              </StatusText>
            ) : null}
          </Box>
        </Stack>
      )}
    </Box>
  );
}

/**
 * The referent checks the findings before publishing (TASK-AJ A8, ADR 0059, ADR 0063): the label,
 * the sentence the report will carry and the count; never an answer, evidence or a note. Shown while the working report is in review.
 */
export default function FindingReview({
  items,
  readOnly,
}: {
  items: readonly ReviewItem[];
  readOnly: boolean;
}) {
  const { t } = useI18n();
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby="client-review-title"
      sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, mb: 4 }}
      data-testid="client-review"
    >
      <Typography id="client-review-title" variant="sectionTitle" component="h2" sx={{ m: 0 }}>
        {t('report.clientReview.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4, maxWidth: '72ch' }}>
        {readOnly ? t('report.clientReview.readOnly') : t('report.clientReview.intro')}
      </Typography>
      <Stack component="ul" spacing={3} sx={{ m: 0, p: 0 }}>
        {items.map((item) => (
          <Item key={item.id} item={item} readOnly={readOnly} />
        ))}
      </Stack>
    </Paper>
  );
}
