import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { AuditQuality, QualityGate } from '@evolai/domain';
import type { Translator } from '@evolai/i18n';
import { StatusText, type Status } from '@evolai/ui';

const GATE_STATUS: Record<QualityGate, Status> = {
  ready: 'success',
  gaps: 'warning',
  discover: 'error',
  unscored: 'pending',
};

/**
 * Audit-quality card (PRD §29, ADR 0061): staff only, on the report screen; never in the snapshot
 * the client reads. One row per dimension with what raises it.
 */
export function AuditQualityCard({
  t,
  quality,
  minGroup,
}: {
  t: Translator;
  quality: AuditQuality;
  minGroup: number;
}) {
  return (
    <Paper
      component="section"
      aria-labelledby="report-quality"
      variant="outlined"
      sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3 }}
      data-testid="audit-quality"
      data-gate={quality.gate}
    >
      <Typography id="report-quality" variant="sectionTitle" component="h2" sx={{ m: 0 }}>
        {t('report.quality.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4, maxWidth: '72ch' }}>
        {t('report.quality.subtitle')}
      </Typography>
      <Stack spacing={2} sx={{ mb: 4 }}>
        {quality.score !== null ? (
          <Typography variant="cardTitle" component="p" sx={{ m: 0 }} data-testid="quality-score">
            {t('report.quality.score', { score: quality.score })}
          </Typography>
        ) : null}
        <StatusText status={GATE_STATUS[quality.gate]}>
          <span data-testid="quality-gate">
            {t(`report.quality.gate.${quality.gate}`, { n: minGroup })}
          </span>
        </StatusText>
        {quality.noGo.map((n) => (
          <StatusText key={n} status="error">
            <span data-testid="quality-nogo">{t(`report.quality.noGo.${n}`)}</span>
          </StatusText>
        ))}
      </Stack>
      <Box
        component="ul"
        sx={{ listStyle: 'none', m: 0, p: 0, borderTop: 1, borderColor: 'divider' }}
      >
        {quality.dimensions.map((d) => (
          <Box
            component="li"
            key={d.dimension}
            data-testid="quality-dimension"
            data-dimension={d.dimension}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr auto', sm: '14rem 1fr auto' },
              columnGap: 4,
              rowGap: 1,
              py: 3,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {t(`report.quality.dimension.${d.dimension}`)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, gridRow: { xs: 2, sm: 'auto' } }}
            >
              {t(`report.quality.hint.${d.dimension}`, { n: minGroup })}{' '}
              {t('report.quality.weight', { pct: Math.round(d.weight * 100) })}
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
              data-testid="quality-rated"
            >
              {t('report.quality.rated', { score: d.score })}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        {t('report.quality.note')}
      </Typography>
    </Paper>
  );
}
