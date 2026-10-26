import { getT } from '@/lib/i18n';
import LearnBody from '@/components/learn/LearnBody';
import LearnPage from '@/components/learn/LearnPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('learn.results.title') };
}

export default function LearnResults() {
  const { t } = getT();
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
    </LearnPage>
  );
}
