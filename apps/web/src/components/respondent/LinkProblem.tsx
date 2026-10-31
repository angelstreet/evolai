import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EmptyState } from '@evolai/ui';
import { formatDate, type SupportedLocale, type Translator } from '@evolai/i18n';

type Gate = 'expired' | 'withdrawn' | 'not_yet';

/** Expired, withdrawn or not yet open: say so plainly and give the one next action (PRD §16). */
export default function LinkProblem({
  gate,
  t,
  opensOn,
  locale = 'fr',
}: {
  gate: Gate;
  t: Translator;
  opensOn?: string;
  locale?: SupportedLocale;
}) {
  const title =
    gate === 'expired'
      ? t('survey.expiredTitle')
      : gate === 'withdrawn'
        ? t('survey.withdrawnTitle')
        : t('survey.notYetTitle');
  const next =
    gate === 'not_yet' && opensOn
      ? t('survey.opensOn', {
          date: formatDate(locale, `${opensOn}T00:00:00Z`, { dateStyle: 'long', timeZone: 'UTC' }),
        })
      : t('survey.askNewLink');
  return (
    <Stack component="section" aria-labelledby="link-problem-title" sx={{ gap: 6 }}>
      <Typography id="link-problem-title" variant="pageTitle" component="h1" sx={{ m: 0 }}>
        {title}
      </Typography>
      <EmptyState icon={gate === 'not_yet' ? 'date' : 'linkBroken'} title={next} />
    </Stack>
  );
}
