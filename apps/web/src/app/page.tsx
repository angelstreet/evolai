import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon, type IconName } from '@evolai/ui';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('meta.pages.welcome') };
}

/** Understand / Adapt / Evolve, echoing the symbol: apricot, blue, teal (brand kit). */
const STEPS: ReadonlyArray<{ icon: IconName; n: 1 | 2 | 3; accent: string }> = [
  { icon: 'listen', n: 1, accent: 'var(--color-amber)' },
  { icon: 'scene', n: 2, accent: 'var(--color-blue)' },
  { icon: 'act', n: 3, accent: 'var(--color-teal)' },
];

/**
 * Front page (docs/FABLE_REVIEW_2026-10-22.md §2): one card, no mascots. Headline, one sentence,
 * three steps, Contact us (mailto when CONTACT_EMAIL is set, else the Privacy page contact),
 * a quiet Sign in link and the one line for people who arrived without opening their survey link.
 */
export default function FrontPage() {
  const { t } = getT();
  const email = process.env['CONTACT_EMAIL']?.trim();
  const contactHref = email ? `mailto:${email}` : '/privacy';
  return (
    <Box
      component="section"
      aria-labelledby="welcome-title"
      className="wide"
      sx={{ pt: { xs: 4, md: 10 } }}
    >
      <Typography
        id="welcome-title"
        variant="pageTitle"
        component="h1"
        sx={{ m: 0, maxWidth: '30ch', fontSize: { md: 'var(--text-2xl)' } }}
      >
        {t('welcome.heading')}
      </Typography>
      <Typography
        variant="lede"
        component="p"
        color="text.secondary"
        sx={{ mt: 4, mb: 0, maxWidth: '56ch' }}
      >
        {t('welcome.lede')}
      </Typography>
      <Box
        component="ol"
        aria-label={t('welcome.stepsAria')}
        sx={{
          listStyle: 'none',
          p: 0,
          mt: 8,
          mb: 0,
          display: 'grid',
          gap: 4,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {STEPS.map(({ icon, n, accent }) => (
          <Paper
            component="li"
            key={n}
            variant="outlined"
            sx={{ p: 5, borderRadius: 3, borderTop: `3px solid ${accent}` }}
          >
            <AppIcon name={icon} />
            <Typography variant="cardTitle" component="h2" sx={{ mt: 3, mb: 1 }}>
              {t(`welcome.step${n}Title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
              {t(`welcome.step${n}Body`)}
            </Typography>
          </Paper>
        ))}
      </Box>
      <Button
        variant="text"
        href="/learn"
        endIcon={<AppIcon name="forward" size={16} />}
        data-testid="front-learn"
        sx={{ mt: 4, minHeight: 44 }}
      >
        {t('learn.entry.front')}
      </Button>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ mt: 4, gap: 3, alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <Button variant="contained" size="large" href={contactHref} data-testid="contact-us">
          {t('welcome.contact')}
        </Button>
        <Button variant="text" size="large" href="/login" data-testid="front-sign-in">
          {t('welcome.signIn')}
        </Button>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        data-testid="survey-line"
        sx={{ mt: 6, mb: 0, maxWidth: '60ch' }}
      >
        {t('welcome.surveyLine')}
      </Typography>
    </Box>
  );
}
