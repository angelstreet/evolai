import { PILOT_QUESTIONNAIRE } from '@evolai/contracts';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import LearnBody from '@/components/learn/LearnBody';
import LearnPage from '@/components/learn/LearnPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { title: getT().t('learn.how.title') };
}

export default function LearnHow() {
  const { t } = getT();
  return (
    <LearnPage page="how" title={t('learn.how.title')}>
      <LearnBody
        lead={t('learn.how.lead')}
        items={[
          t('learn.how.item1', {
            minutes: PILOT_QUESTIONNAIRE.estimatedMinutes,
            count: PILOT_QUESTIONNAIRE.questions.length,
          }),
          t('learn.how.item2'),
          t('learn.how.item3', { min: MIN_GROUP_SIZE }),
          t('learn.how.item4'),
        ]}
      />
    </LearnPage>
  );
}
