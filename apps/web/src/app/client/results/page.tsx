import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EmptyState, PageTitle, StatusText } from '@evolai/ui';
import { requireClientContext } from '@/lib/clientContext';
import Button from '@mui/material/Button';
import type { TenantId } from '@evolai/contracts';
import { loadClientSurvey, loadPublishedResults } from '@/lib/clientData';
import { loadPublishedReport } from '@/lib/reportData';
import { enumLabelOf } from '@/lib/enumLabel';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';

export const dynamic = 'force-dynamic';

const STATUS_KEYS = new Set(['approved', 'in_progress', 'delivered']);

/**
 * Team space results (TASK-P): only what the auditor approved. Themes are counted across
 * approved analyses and shown only when at least five people raised them; no summary, no quote
 * and no individual answer or score ever reaches this page.
 */
export default async function ClientResults() {
  const { ctx } = await requireClientContext();
  const { t } = getT();
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  const results = survey
    ? await loadPublishedResults(ctx.tenantId, survey.engagementId)
    : { themes: [], opportunities: [] };
  const empty = results.themes.length === 0 && results.opportunities.length === 0;
  // With no approved findings yet the report may still be published: point to it (TASK-AI walkthrough).
  const report =
    empty && survey
      ? await loadPublishedReport(ctx.tenantId as TenantId, survey.engagementId)
      : null;
  return (
    <section aria-labelledby="client-results-title">
      <PageTitle
        id="client-results-title"
        title={t('client.results.title')}
        subtitle={t('client.results.subtitle')}
      />
      {empty ? (
        report ? (
          <EmptyState
            icon="report"
            title={t('client.results.inReport')}
            action={
              <Button variant="outlined" href="/client/report" data-testid="client-results-report">
                {t('client.home.reportOpen')}
              </Button>
            }
          />
        ) : (
          <EmptyState icon="pending" title={t('client.results.empty')} />
        )
      ) : (
        <Stack spacing={4}>
          {results.themes.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-themes">
              <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
                {t('client.results.themesTitle')}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {t('client.results.themesHint', { n: MIN_GROUP_SIZE })}
              </Typography>
              <List dense>
                {results.themes.map((th) => (
                  <ListItem key={`${th.axis}|${th.label}`} divider>
                    <ListItemText
                      primary={th.label}
                      secondary={`${enumLabelOf(t, 'axis', th.axis)} · ${t('client.results.themePeople', { count: th.people })}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          ) : null}
          {results.opportunities.length > 0 ? (
            <Paper
              variant="outlined"
              sx={{ p: 4, borderRadius: 3 }}
              data-testid="client-opportunities"
            >
              <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
                {t('client.results.opportunitiesTitle')}
              </Typography>
              <List dense>
                {results.opportunities.map((o) => (
                  <ListItem key={o.id} divider>
                    <ListItemText
                      primary={o.title}
                      secondary={
                        <StatusText status={o.status === 'delivered' ? 'success' : 'running'}>
                          {STATUS_KEYS.has(o.status)
                            ? t(`status.${o.status}` as 'status.approved')
                            : o.status}
                        </StatusText>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          ) : null}
        </Stack>
      )}
    </section>
  );
}
