import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PILOT_QUESTIONNAIRE } from '@evolai/contracts';
import { getT } from '@/lib/i18n';
import LearnPage from '@/components/learn/LearnPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('learn.questions.title') };
}

/** Page 3: the live questionnaire, read only, from the same JSON file the survey uses. */
export default function LearnQuestions() {
  const { t, locale } = getT();
  const q = PILOT_QUESTIONNAIRE;
  return (
    <LearnPage page="questions" title={t('learn.questions.title')}>
      <Typography variant="lede" component="p" sx={{ m: 0 }}>
        {t('learn.questions.lead')}
      </Typography>
      <Stack component="ol" spacing={3} sx={{ listStyle: 'none', p: 0, mt: 4, mb: 0 }}>
        {q.questions.map((question, i) => (
          <Card
            component="li"
            key={question.code}
            variant="outlined"
            sx={{ borderRadius: 3 }}
            data-testid="learn-question"
            data-code={question.code}
          >
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
                {t('learn.questions.cardLabel', { n: i + 1 })}
              </Typography>
              <Typography
                variant="cardTitle"
                component="h2"
                sx={{ m: 0, mt: 1 }}
                data-testid="learn-question-prompt"
              >
                {question.prompt[locale]}
              </Typography>
              {question.kind === 'short_text' ? (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 0 }}>
                  {t('learn.freeText', { max: q.freeTextMaxLength })}
                </Typography>
              ) : (
                <Typography component="ul" variant="body1" sx={{ mt: 2, mb: 0, pl: 5 }}>
                  {question.options.map((o) => (
                    <li key={o.value}>{o.label[locale]}</li>
                  ))}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 0 }}>
                {t('learn.tells', {
                  why: t(
                    `learn.questions.${question.code}.why` as 'learn.questions.v1_source_check.why',
                  ),
                })}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </LearnPage>
  );
}
