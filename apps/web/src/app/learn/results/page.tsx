import Button from '@mui/material/Button';
import { AppIcon } from '@evolai/ui';
import { getSession } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { effectiveContext } from '@/lib/tenantAccess';
import LearnBody from '@/components/learn/LearnBody';
import LearnPage from '@/components/learn/LearnPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('learn.results.title') };
}

export default async function LearnResults() {
  const { t } = getT();
  // A referent with a space gets the way back to it; everybody else sees the page as before.
  const session = await getSession();
  const hasSpace = session ? effectiveContext(session).kind === 'client' : false;
  return (
    <LearnPage page="results" title={t('learn.results.title')}>
      <LearnBody
        lead={t('learn.results.lead')}
        items={[
          t('learn.results.item1'),
          t('learn.results.item2'),
          t('learn.results.item3'),
          t('learn.results.item4'),
        ]}
      />
      {hasSpace ? (
        <Button
          variant="outlined"
          href="/client"
          startIcon={<AppIcon name="home" size={16} />}
          data-testid="learn-back-to-space"
          sx={{ mt: 4, minHeight: 44 }}
        >
          {t('client.space.back')}
        </Button>
      ) : null}
    </LearnPage>
  );
}
