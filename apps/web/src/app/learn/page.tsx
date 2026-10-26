import { getT } from '@/lib/i18n';
import LearnBody from '@/components/learn/LearnBody';
import LearnPage from '@/components/learn/LearnPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('learn.why.title') };
}

export default function LearnWhy() {
  const { t } = getT();
  return (
    <LearnPage page="why" title={t('learn.why.title')}>
      <LearnBody
        lead={t('learn.why.lead')}
        items={[t('learn.why.item1'), t('learn.why.item2'), t('learn.why.item3')]}
        closing={t('learn.why.closing')}
      />
    </LearnPage>
  );
}
