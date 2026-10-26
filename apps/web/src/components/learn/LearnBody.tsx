import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';

/** Lead sentence, a short list and an optional closing line: the body of the simple /learn pages. */
export default function LearnBody({
  lead,
  items,
  closing,
}: {
  lead: string;
  items: ReactNode[];
  closing?: string;
}) {
  return (
    <>
      <Typography variant="lede" component="p" sx={{ m: 0 }}>
        {lead}
      </Typography>
      <Typography
        component="ul"
        variant="body1"
        sx={{ mt: 3, mb: 0, pl: 5, '& li': { py: 0.5 } }}
        data-testid="learn-items"
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Typography>
      {closing ? (
        <Typography variant="body1" sx={{ mt: 4, mb: 0 }}>
          {closing}
        </Typography>
      ) : null}
    </>
  );
}
