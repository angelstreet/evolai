import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { filledVideos, type LearnPageKey, type LearnVideo } from '@evolai/contracts';
import { AppIcon } from '@evolai/ui';
import { getT } from '@/lib/i18n';
import { LEARN_PAGES } from '@/lib/learn';

/** One video card: a 16:9 box with the privacy-friendly YouTube embed; the title is a caption below. */
function VideoCard({ video, title }: { video: LearnVideo; title: string }) {
  const { t, locale } = getT();
  const name = video.title[locale];
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }} data-testid="learn-video">
      <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'app.raised' }}>
        <Box
          component="iframe"
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
          title={name || title}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </Box>
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
          {t('learn.videoCaption', { title: name, n: video.minutes })}
        </Typography>
      </CardContent>
    </Card>
  );
}

/**
 * Shell of one /learn page: progress line, title, body, the filled video slots of this page beside
 * the text on desktop, and Back / Next. Next is the one primary action; on the last page it is
 * replaced by nothing (the page ends with the sign-in line).
 */
export default function LearnPage({
  page,
  title,
  children,
}: {
  page: LearnPageKey;
  title: string;
  children: ReactNode;
}) {
  const { t } = getT();
  const index = LEARN_PAGES.findIndex((p) => p.key === page);
  const prev = LEARN_PAGES[index - 1];
  const next = LEARN_PAGES[index + 1];
  const videos = page === 'more' ? [] : filledVideos(page);
  return (
    <Box
      component="section"
      aria-labelledby="learn-title"
      className="wide"
      sx={{ pt: { xs: 4, md: 8 } }}
    >
      <Button
        variant="text"
        href="/"
        startIcon={<AppIcon name="back" size={16} />}
        data-testid="learn-cockpit"
        sx={{ minHeight: 44, mb: 2, ml: -2 }}
      >
        {t('learn.cockpit')}
      </Button>
      <Typography
        variant="body2"
        color="text.secondary"
        data-testid="learn-progress"
        sx={{ m: 0, mb: 2, fontVariantNumeric: 'tabular-nums' }}
      >
        {t('learn.progress', { n: index + 1, total: LEARN_PAGES.length })}
      </Typography>
      <Typography id="learn-title" variant="pageTitle" component="h1" sx={{ m: 0, mb: 4 }}>
        {title}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 6,
          gridTemplateColumns: { xs: '1fr', md: videos.length ? '3fr 2fr' : '1fr' },
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0, maxWidth: videos.length ? 'none' : '80ch' }}>{children}</Box>
        {videos.length ? (
          <Stack spacing={4}>
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} title={title} />
            ))}
          </Stack>
        ) : null}
      </Box>
      <Stack
        component="nav"
        aria-label={t('learn.nav')}
        direction="row"
        sx={{ mt: 8, gap: 3, justifyContent: 'space-between', alignItems: 'center' }}
      >
        {prev ? (
          <Button
            variant="outlined"
            href={prev.href}
            startIcon={<AppIcon name="back" size={16} />}
            data-testid="learn-back"
            sx={{ minHeight: 44 }}
          >
            {t('learn.back')}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button
            variant="contained"
            href={next.href}
            endIcon={<AppIcon name="forward" size={16} />}
            data-testid="learn-next"
            sx={{ minHeight: 44 }}
          >
            {t('learn.next')}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
