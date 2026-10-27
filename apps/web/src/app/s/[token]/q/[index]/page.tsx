import { notFound, redirect } from 'next/navigation';
import LinkProblem from '@/components/respondent/LinkProblem';
import QuestionClient from '@/components/respondent/QuestionClient';
import { loadRespondent } from '@/lib/respondent';
import {
  FREE_TEXT_MAX_LENGTH,
  freeTextHint,
  questionByIndex,
  totalQuestionCount,
} from '@/lib/syntheticTemplate';
import { isSubmitted } from '@/lib/surveyState';

// Always render at request time so the DB connection is fresh.
export const dynamic = 'force-dynamic';

interface Params {
  token: string;
  index: string;
}

export default async function QuestionPage({ params }: { params: Params }) {
  const total = totalQuestionCount();
  const index = Number.parseInt(params.index, 10);
  if (!Number.isInteger(index) || index < 0 || index >= total) notFound();

  const ctx = await loadRespondent(params.token);
  if (ctx.kind === 'blocked') return <LinkProblem gate={ctx.gate} t={ctx.t} />;
  const { invite, state, locale, t } = ctx;
  if (!state.submissionId) notFound();
  // Answers are final once submitted; send the person to their status view instead.
  if (await isSubmitted(invite.tenantId, state.submissionId)) redirect(`/s/${params.token}`);

  const question = questionByIndex(index);
  const isLast = index === total - 1;
  const nextHref = isLast ? `/s/${params.token}/done` : `/s/${params.token}/q/${index + 1}`;
  const backHref = index === 0 ? null : `/s/${params.token}/q/${index - 1}`;
  // A segment links back to a question reached, answered, or right after an answered one.
  const answered = (i: number) => state.answers[i] !== undefined;
  const segments = Array.from({ length: total }, (_, i) => ({
    href: i <= index || answered(i) || answered(i - 1) ? `/s/${params.token}/q/${i}` : null,
    on: i <= index,
  }));
  const saved = state.answers[index]?.value;
  const initialChoice =
    saved?.kind === 'scenario_choice' || saved?.kind === 'single_choice' ? saved.choice : null;
  const isText = question.kind === 'short_text';

  return (
    <>
      <QuestionClient
        token={params.token}
        index={index}
        prompt={question.prompt[locale]}
        helper={question.helper[locale]}
        options={question.options.map((o) => ({ value: o.value, label: o.label[locale] }))}
        initialChoice={initialChoice}
        nextHref={nextHref}
        backHref={backHref}
        segments={segments}
        labels={{
          title: t('survey.title'),
          count: t('survey.questionOf', { i: index + 1, n: total }),
          progress: t('survey.progress'),
          previous: t('survey.previous'),
          next: t('survey.next'),
          finish: t('survey.finish'),
          pick: t('survey.pick'),
          saved: t('survey.savedHint'),
          goTo: t('survey.goTo', { n: '{n}' }),
        }}
        isLast={isLast}
        skipLabel={t('survey.skip')}
        messages={{
          saving: t('survey.saving'),
          saveFailed: t('survey.saveFailed'),
          alreadyFinished: t('survey.alreadyFinished'),
          incomplete: t('survey.incomplete'),
          finishFailed: t('survey.finishFailed'),
        }}
        text={
          isText
            ? {
                initial: saved?.kind === 'short_text' ? saved.text : '',
                maxLength: FREE_TEXT_MAX_LENGTH,
                hint: freeTextHint(locale),
                optionalLabel: t('survey.optional'),
                counterTemplate: t('survey.textCounter', { n: '{n}', max: FREE_TEXT_MAX_LENGTH }),
              }
            : undefined
        }
      />
    </>
  );
}
