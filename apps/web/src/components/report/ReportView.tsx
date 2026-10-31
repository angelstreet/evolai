import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import type {
  Horizon,
  Quadrant,
  ReadinessGroup,
  ReportSnapshot,
  ReportUseCase,
} from '@evolai/contracts';
import { formatDate } from '@evolai/i18n';
import { getT } from '@/lib/i18n';
import {
  findingLine,
  measureLine,
  prerequisiteLines,
  repeatedTimeLines,
  useCaseLines,
  weightsSentence,
} from '@/lib/reportModel';

/**
 * The audit report as the client reads it (TASK-V, ADR 0041). Renders a frozen snapshot only, so
 * the auditor preview, the client page and the PDF show the same thing. Aggregates only: no
 * answer, quote or per-person value exists in a snapshot. Print-friendly: cards do not break
 * across pages and the screen-only controls are hidden on paper.
 */

const QUADRANTS: readonly Quadrant[] = ['quick_win', 'big_bet', 'fill_in', 'reconsider'];
const HORIZONS: readonly Horizon[] = ['d30', 'd60', 'd90'];

function Section({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return (
    <Paper
      component="section"
      aria-labelledby={id}
      variant="outlined"
      sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3, breakInside: 'avoid' }}
    >
      <Typography id={id} variant="sectionTitle" component="h2" sx={{ m: 0, mb: 3 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

/** What makes an opportunity a use case (ADR 0064), one line each. */
function UseCaseFacts({ u }: { u: ReportUseCase }) {
  const { t, locale } = getT();
  const [approach, ...rest] = useCaseLines(t, locale, u);
  return (
    <Box sx={{ mt: 1, mb: 2 }} data-testid="report-use-case">
      <Typography variant="body1" sx={{ m: 0, maxWidth: '72ch' }}>
        {approach?.text}
      </Typography>
      {rest.map((l) => (
        <Typography
          key={l.key}
          variant="body2"
          sx={{ m: 0, mt: 1, maxWidth: '72ch' }}
          data-testid={`use-case-${l.key}`}
        >
          {l.text}
        </Typography>
      ))}
    </Box>
  );
}

export default function ReportView({
  snapshot,
  actions,
}: {
  snapshot: ReportSnapshot;
  /** Screen-only controls (download, print), hidden on paper. */
  actions?: ReactNode;
}) {
  const { t, locale } = getT();
  const s = snapshot;
  const findingNo = new Map(s.findings.map((f, i) => [f.key, i + 1]));
  const hasUseCases = s.opportunities.some((o) => o.useCase);
  const level = (l: string | null) =>
    l ? t(`report.readiness.level.${l as 'L0'}`) : t('report.readiness.noAxis');
  const score = (n: number | null) =>
    n === null ? t('report.readiness.noAxis') : t('report.readiness.scoreOf', { score: n });
  const lvl = (l: 'low' | 'medium' | 'high') => t(`report.steps.level.${l}`);
  const colon = locale === 'fr' ? '\u00a0: ' : ': ';
  const day = (iso: string) =>
    formatDate(locale, `${iso}T00:00:00Z`, { dateStyle: 'long', timeZone: 'UTC' });
  const before = prerequisiteLines(s.steps, colon);

  const axisRows = (g: ReadinessGroup) => (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {g.axes.map((a) => (
        <Box
          component="li"
          key={a.axis}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 2,
            py: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 16rem' }}>
            <Typography variant="body1" component="p" sx={{ m: 0 }}>
              {t(`report.readiness.axis.${a.axis}`)}
            </Typography>
            <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
              {t(`report.readiness.axisHelp.${a.axis}`)}
            </Typography>
          </Box>
          <Typography
            variant="body1"
            component="p"
            sx={{ m: 0, fontVariantNumeric: 'tabular-nums' }}
          >
            {a.score === null
              ? t('report.readiness.noAxis')
              : `${score(a.score)} · ${level(a.level)}`}
          </Typography>
        </Box>
      ))}
    </Box>
  );

  return (
    <Stack spacing={4} data-testid="report-view" lang={s.locale}>
      <Box>
        <Typography variant="body2" color="text.secondary">
          {s.organisation}
        </Typography>
        <Typography variant="pageTitle" component="p" sx={{ m: 0, mt: 1, textWrap: 'balance' }}>
          {s.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('report.view.version', {
            version: s.version,
            date: formatDate(locale, s.publishedAt, { dateStyle: 'long' }),
          })}
          {' · '}
          {t('report.view.aggregateNote')}
          {s.locale !== locale ? ` ${t('report.view.reportLanguage', { language: s.locale })}` : ''}
        </Typography>
        {actions ? (
          <Stack direction="row" spacing={2} sx={{ mt: 4, displayPrint: 'none' }}>
            {actions}
          </Stack>
        ) : null}
      </Box>

      <Section id="rv-summary" title={t('report.view.summary')}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-line', maxWidth: '72ch' }}>
          {s.summary}
        </Typography>
        {s.summaryCitations.length > 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            {t('report.view.sources', {
              list: s.summaryCitations
                .map((c) => t('report.view.finding', { n: findingNo.get(c) ?? 0 }))
                .join(', '),
            })}
          </Typography>
        ) : null}
      </Section>

      <Section
        id="rv-ranking"
        title={hasUseCases ? t('report.useCases.title') : t('report.ranking.title')}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {hasUseCases ? t('report.useCases.subtitle') : t('report.ranking.subtitle')}
        </Typography>
        <Box
          role="img"
          aria-label={t('report.ranking.matrixAria', {
            list: s.opportunities
              .map((o) => `${o.rank}. ${o.title}: ${t(`report.ranking.quadrant.${o.quadrant}`)}`)
              .join('; '),
          })}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mb: 4,
          }}
        >
          {QUADRANTS.map((q) => (
            <Box
              key={q}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 3, minHeight: 88 }}
            >
              <Typography variant="cardTitle" component="p" sx={{ m: 0 }}>
                {t(`report.ranking.quadrant.${q}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                {t(`report.ranking.quadrantHelp.${q}`)}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
                {s.opportunities
                  .filter((o) => o.quadrant === q)
                  .map((o) => (
                    <Box
                      key={o.id}
                      component="span"
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        px: 2,
                        typography: 'body2',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {o.rank}
                    </Box>
                  ))}
              </Stack>
            </Box>
          ))}
        </Box>
        <Box component="ol" sx={{ m: 0, pl: 6 }}>
          {s.opportunities.map((o) => (
            <Box component="li" key={o.id} sx={{ py: 2, breakInside: 'avoid' }}>
              <Typography variant="cardTitle" component="p" sx={{ m: 0 }}>
                {o.title}
              </Typography>
              {o.useCase ? <UseCaseFacts u={o.useCase} /> : null}
              <Typography variant="body2" color="text.secondary">
                {t(`report.ranking.quadrant.${o.quadrant}`)} ·{' '}
                {t('report.ranking.impactEffort', {
                  impact: lvl(o.impact).toLowerCase(),
                  effort: lvl(o.effort).toLowerCase(),
                })}
              </Typography>
              <Box component="ul" sx={{ m: 0, mt: 1, pl: 5 }}>
                {s.steps
                  .filter((st) => st.opportunityId === o.id)
                  .map((st) => (
                    <Box component="li" key={st.id} sx={{ py: 1 }}>
                      <Typography variant="body1" component="span" sx={{ fontWeight: 600 }}>
                        {st.title}
                      </Typography>
                      <Typography variant="body2" component="span" color="text.secondary">
                        {' · '}
                        {t(`report.steps.categoryName.${st.category}`)}
                      </Typography>
                      {st.description ? (
                        <Typography variant="body2" sx={{ maxWidth: '72ch' }}>
                          {st.description}
                        </Typography>
                      ) : null}
                      <Typography variant="body2" color="text.secondary">
                        {[
                          `${t('report.steps.owner')}${colon}${st.owner || '—'}`,
                          t(`report.steps.horizonName.${st.horizon}`),
                          `${t('report.steps.effort')} ${lvl(st.effort).toLowerCase()}`,
                          `${t('report.steps.impact')} ${lvl(st.impact).toLowerCase()}`,
                          `${t('report.steps.risk')} ${lvl(st.risk).toLowerCase()}`,
                        ]
                          .join(' · ')
                          .replace(' : ', locale === 'fr' ? ' : ' : ': ')}
                      </Typography>
                      {measureLine(t, st.measure, colon, day) ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          data-testid="report-step-measure"
                        >
                          {measureLine(t, st.measure, colon, day)}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Section>

      <Section id="rv-readiness" title={t('report.readiness.title')}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('report.readiness.subtitle', { n: s.minGroupSize })}
        </Typography>
        {s.readiness.overall ? (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ mb: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('report.readiness.overall')} ·{' '}
                  {t('report.readiness.people', { count: s.readiness.overall.people })}
                </Typography>
                <Typography
                  variant="pageTitle"
                  component="p"
                  sx={{ m: 0, fontVariantNumeric: 'tabular-nums' }}
                  data-testid="report-score"
                >
                  {score(s.readiness.overall.overall)}
                </Typography>
              </Box>
              <Box sx={{ maxWidth: '48ch' }}>
                <Typography variant="cardTitle" component="p" sx={{ m: 0 }}>
                  {level(s.readiness.overall.level)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.readiness.overall.level
                    ? t(`report.readiness.levelMeaning.${s.readiness.overall.level}`)
                    : ''}
                </Typography>
              </Box>
            </Stack>
            {axisRows(s.readiness.overall)}
          </>
        ) : (
          <Typography variant="body1">
            {t('report.readiness.noScore', { n: s.minGroupSize })}
          </Typography>
        )}
        {s.readiness.teams.length > 1 ? (
          // Phones: one card per team; the table needs more width than a phone has.
          <Stack
            spacing={2}
            sx={{ mt: 4, display: { xs: 'flex', sm: 'none' } }}
            data-testid="rv-team-cards"
          >
            {s.readiness.teams.map((tm) => (
              <Box key={tm.team} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 3 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {tm.team} · {t('report.readiness.people', { count: tm.people })}
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {[
                    `${t('report.readiness.overall')}${colon}${tm.overall ?? '—'}`,
                    ...tm.axes.map(
                      (a) => `${t(`report.readiness.axis.${a.axis}`)}${colon}${a.score ?? '—'}`,
                    ),
                  ].join(' · ')}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : null}
        {s.readiness.teams.length > 1 ? (
          <Box sx={{ overflowX: 'auto', mt: 4, display: { xs: 'none', sm: 'block' } }}>
            <Table size="small" aria-label={t('report.readiness.team')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('report.readiness.team')}</TableCell>
                  <TableCell>{t('report.readiness.overall')}</TableCell>
                  {(['literacy', 'practice', 'readiness'] as const).map((a) => (
                    <TableCell key={a}>{t(`report.readiness.axis.${a}`)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {s.readiness.teams.map((tm) => (
                  <TableRow key={tm.team}>
                    <TableCell component="th" scope="row">
                      {tm.team} · {t('report.readiness.people', { count: tm.people })}
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {tm.overall ?? '—'}
                    </TableCell>
                    {tm.axes.map((a) => (
                      <TableCell key={a.axis} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {a.score ?? '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : null}
        <Stack spacing={1} sx={{ mt: 3 }}>
          {s.readiness.hiddenTeams > 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('report.readiness.hiddenTeams', { count: s.readiness.hiddenTeams })}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {weightsSentence(t, s.readiness)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('report.readiness.scale')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('report.readiness.notHr')}
          </Typography>
        </Stack>
      </Section>

      <Section id="rv-findings" title={t('report.findings.title')}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('report.findings.subtitle', { n: s.minGroupSize })}
        </Typography>
        {s.findings.length === 0 ? (
          <Typography variant="body1">{t('report.findings.empty')}</Typography>
        ) : (
          <Box component="ol" sx={{ m: 0, pl: 6, listStyleType: 'decimal' }}>
            {s.findings.map((f, i) => (
              <Box
                component="li"
                key={f.key}
                id={`rv-finding-${i + 1}`}
                sx={{ py: 1, display: 'list-item', scrollMarginTop: 96 }}
              >
                <Typography variant="body1" component="span">
                  {f.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" component="span">
                  {' · '}
                  {findingLine(t, f)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Section>

      {repeatedTimeLines(t, s.repeatedTime, s.minGroupSize).length > 0 ? (
        <Section id="rv-time" title={t('report.time.title')}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: '72ch' }}>
            {t('report.time.subtitle')}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 6 }} data-testid="report-time">
            {repeatedTimeLines(t, s.repeatedTime, s.minGroupSize).map((line) => (
              <Box component="li" key={line} sx={{ py: 0.5 }}>
                <Typography variant="body1" component="span">
                  {line}
                </Typography>
              </Box>
            ))}
          </Box>
        </Section>
      ) : null}

      {s.plan.length > 0 ? (
        <Section id="rv-plan" title={t('report.plan.title')}>
          <Stack spacing={3}>
            {HORIZONS.map((h) => {
              const items = s.plan.filter((p) => p.horizon === h);
              if (items.length === 0) return null;
              return (
                <Box key={h} sx={{ breakInside: 'avoid' }}>
                  <Typography variant="cardTitle" component="h3" sx={{ m: 0 }}>
                    {t(`report.steps.horizonName.${h}`)}
                  </Typography>
                  <Box component="ul" sx={{ m: 0, mt: 1, pl: 5 }}>
                    {items.map((p) => (
                      <Box component="li" key={p.id} sx={{ py: 1 }}>
                        <Typography variant="body1" component="span">
                          {p.text}
                        </Typography>
                        {p.owner ? (
                          <Typography variant="body2" color="text.secondary" component="span">
                            {' · '}
                            {p.owner}
                          </Typography>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Section>
      ) : null}

      <Section id="rv-risks" title={t('report.view.risksTitle')}>
        {s.risks.length === 0 ? (
          <Typography variant="body1">{t('report.view.noRisks')}</Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 5 }}>
            {s.risks.map((r) => (
              <Box component="li" key={r} sx={{ py: 0.5 }}>
                {r}
              </Box>
            ))}
          </Box>
        )}
        {before.length > 0 ? (
          <>
            <Typography variant="cardTitle" component="h3" sx={{ m: 0, mt: 4 }}>
              {t('report.view.prerequisitesTitle')}
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 5 }}>
              {before.map((p) => (
                <Box component="li" key={p} sx={{ py: 0.5 }}>
                  {p}
                </Box>
              ))}
            </Box>
          </>
        ) : null}
      </Section>

      <Section id="rv-method" title={t('report.view.methodTitle')}>
        {s.methodology ? (
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line', maxWidth: '72ch', mb: 2 }}>
            {s.methodology}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {t('report.view.privacyNote', { n: s.minGroupSize })}
        </Typography>
      </Section>
    </Stack>
  );
}
