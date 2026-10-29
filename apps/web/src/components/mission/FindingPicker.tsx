'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useI18n } from '@/components/I18nProvider';
import FindingFields from '@/components/mission/FindingFields';
import { makeFindingAction } from '@/app/admin/findings/actions';
import { CHOICE_SEP, findingIdle } from '@/app/admin/findings/state';
import type { AnswersView } from '@/lib/answersData';

const FORM_ID = 'write-finding-form';
const CARD_SX = { p: { xs: 4, sm: 6 }, borderRadius: 3, mb: 5 } as const;

/**
 * Free texts with a tick box each, and "Write a finding" (TASK-AJ A1, ADR 0058): the auditor ticks
 * the free texts and the choices that show something, names it in one sentence, and saves it as an
 * approved finding with those answers as its evidence. Staff only, like the rest of the tab.
 */
export default function FindingPicker({
  tenantId,
  engagementId,
  choices,
  texts,
  minGroup,
}: {
  tenantId: string;
  engagementId: string;
  choices: AnswersView['choices'];
  texts: AnswersView['texts'];
  minGroup: number;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(makeFindingAction, findingIdle);
  const [picked, setPicked] = useState(0);
  const onTick = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPicked((n) => n + (e.target.checked ? 1 : -1));
  const people = (n: number) => t('admin.answers.people', { n });
  return (
    <>
      <Paper
        variant="outlined"
        component="section"
        id="free-texts"
        aria-labelledby="texts-title"
        sx={CARD_SX}
      >
        <Typography id="texts-title" variant="sectionTitle" component="h3" sx={{ mt: 0, mb: 4 }}>
          {t('admin.answers.textsTitle')}
        </Typography>
        {texts.length === 0 ? (
          <Typography color="text.secondary">{t('admin.answers.noTexts')}</Typography>
        ) : (
          texts.map((q) => (
            <section key={q.code} data-testid="answers-text-group">
              <Typography variant="cardTitle" component="h4" sx={{ mb: 2 }}>
                {q.question || t('admin.answers.endComment')}
              </Typography>
              <Box component="ul" sx={{ pl: 0, listStyle: 'none' }}>
                {q.entries.map((item, i) => (
                  <li key={i}>
                    {item.id ? (
                      <FormControlLabel
                        control={
                          <Checkbox
                            name="answer"
                            value={item.id}
                            onChange={onTick}
                            inputProps={
                              { form: FORM_ID, 'aria-label': t('admin.answers.make.pick') } as never
                            }
                          />
                        }
                        label={<Typography variant="body2">{item.text}</Typography>}
                        data-testid="answers-text-pick"
                      />
                    ) : (
                      <Typography variant="body2" component="span" sx={{ pl: 6 }}>
                        {item.text}
                      </Typography>
                    )}
                  </li>
                ))}
              </Box>
            </section>
          ))
        )}
      </Paper>
      <Paper
        variant="outlined"
        component="section"
        id="write-finding"
        aria-labelledby="write-finding-title"
        sx={CARD_SX}
      >
        <Typography id="write-finding-title" variant="sectionTitle" component="h3" sx={{ m: 0 }}>
          {t('admin.answers.make.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4, maxWidth: '72ch' }}>
          {t('admin.answers.make.subtitle')}
        </Typography>
        <Stack
          component="form"
          id={FORM_ID}
          action={action}
          spacing={4}
          data-testid="write-finding"
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="engagementId" value={engagementId} />
          <Box>
            <Typography variant="cardTitle" component="h4" sx={{ mb: 1 }}>
              {t('admin.answers.make.choices')}
            </Typography>
            {choices.map((c) => (
              <Box key={c.code} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {c.question}
                </Typography>
                {c.counts.map((o) => (
                  <FormControlLabel
                    key={o.label}
                    sx={{ display: 'flex' }}
                    control={
                      <Checkbox
                        name="choice"
                        value={`${c.code}${CHOICE_SEP}${o.label}`}
                        onChange={onTick}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {o.label} · {people(o.n)}
                      </Typography>
                    }
                    data-testid="answers-choice-pick"
                  />
                ))}
              </Box>
            ))}
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            aria-live="polite"
            data-testid="finding-picked"
          >
            {t('admin.answers.make.picked', { n: picked })}
          </Typography>
          <FindingFields
            state={state}
            tenantId={tenantId}
            engagementId={engagementId}
            minGroup={minGroup}
          />
        </Stack>
      </Paper>
    </>
  );
}
