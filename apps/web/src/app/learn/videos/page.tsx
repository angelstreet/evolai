import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { filledVideos } from '@evolai/contracts';
import { AppIcon } from '@evolai/ui';
import { getT } from '@/lib/i18n';
import LearnPage from '@/components/learn/LearnPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('learn.more.title') };
}

/** Page 5: every filled video as a list that opens YouTube in a new tab (no embed here). */
export default function LearnMore() {
  const { t, locale } = getT();
  const videos = filledVideos();
  return (
    <LearnPage page="more" title={t('learn.more.title')}>
      <Typography variant="lede" component="p" sx={{ m: 0 }}>
        {t('learn.more.lead')}
      </Typography>
      {videos.length ? (
        <Paper variant="outlined" sx={{ mt: 4, borderRadius: 3 }}>
          <List disablePadding data-testid="learn-video-list">
            {videos.map((v) => (
              <ListItem
                key={v.id}
                divider
                secondaryAction={
                  <Button
                    variant="outlined"
                    href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<AppIcon name="forward" size={16} />}
                    sx={{ minHeight: 44 }}
                  >
                    {t('learn.watch')}
                  </Button>
                }
                sx={{ py: 2, pr: { xs: 2, sm: 20 }, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
              >
                <ListItemText
                  primary={v.title[locale]}
                  secondary={t('learn.minutes', { n: v.minutes })}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      ) : (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 4, mb: 0 }}>
          {t('learn.more.empty')}
        </Typography>
      )}
      <Typography variant="body1" sx={{ mt: 6, mb: 0 }} data-testid="learn-survey-line">
        {t('learn.more.surveyLine')}{' '}
        <Link href="/login" underline="always" data-testid="learn-sign-in">
          {t('learn.more.signIn')}
        </Link>
      </Typography>
    </LearnPage>
  );
}
