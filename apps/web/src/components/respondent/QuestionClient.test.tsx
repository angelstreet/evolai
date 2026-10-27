import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '@evolai/i18n';
import { FREE_TEXT_MAX_LENGTH, freeTextHint, questionByIndex } from '@/lib/syntheticTemplate';
import QuestionClient from './QuestionClient';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const render = (locale: 'fr' | 'en', index: number, saved = '') => {
  const t = createTranslator(locale);
  const q = questionByIndex(index);
  return renderToStaticMarkup(
    <QuestionClient
      token="t"
      index={index}
      prompt={q.prompt[locale]}
      helper={q.helper[locale]}
      options={q.options.map((o) => ({ value: o.value, label: o.label[locale] }))}
      initialChoice={null}
      nextHref="/next"
      ariaQuestionLabel={t('survey.answerOptions')}
      isLast={false}
      skipLabel={t('survey.skip')}
      messages={{
        saving: t('survey.saving'),
        saveFailed: t('survey.saveFailed'),
        alreadyFinished: t('survey.alreadyFinished'),
        incomplete: t('survey.incomplete'),
        finishFailed: t('survey.finishFailed'),
      }}
      text={
        q.kind === 'short_text'
          ? {
              initial: saved,
              maxLength: FREE_TEXT_MAX_LENGTH,
              hint: freeTextHint(locale),
              optionalLabel: t('survey.optional'),
              nextLabel: t('survey.next'),
              counterTemplate: t('survey.textCounter', { n: '{n}', max: FREE_TEXT_MAX_LENGTH }),
            }
          : undefined
      }
    />,
  );
};

const FIRST_TEXT = 6;

describe('QuestionClient, free-text question', () => {
  it('French: text box capped at 400, counter, hint and a Suivant button', () => {
    const html = render('fr', FIRST_TEXT);
    expect(html).toContain('<textarea');
    expect(html).toContain('maxLength="400"');
    expect(html).toContain('0 sur 400 caractères');
    expect(html).toContain('Pas de noms, ni e-mails, ni numéros');
    expect(html).toContain('Nous les masquons.');
    expect(html).toContain('Facultatif');
    expect(html).toContain('Suivant');
    expect(html).toContain('Passer');
    expect(html).not.toContain('option-button');
  });

  it('English: matching copy', () => {
    const html = render('en', FIRST_TEXT);
    expect(html).toContain('0 of 400 characters');
    expect(html).toContain('We mask them.');
    expect(html).toContain('Optional');
    expect(html).toContain('Next');
    expect(html).toContain('Skip');
  });

  it('shows a saved answer and its length when the person comes back', () => {
    const html = render('fr', FIRST_TEXT, 'Les commandes à la main');
    expect(html).toContain('Les commandes à la main');
    expect(html).toContain('23 sur 400 caractères');
  });

  it('a choice question still renders option buttons, with "Je ne sais pas / Ça dépend" last', () => {
    const html = render('fr', 0);
    expect(html).not.toContain('<textarea');
    expect(html.match(/option-button/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html.lastIndexOf('Je ne sais pas / Ça dépend')).toBeGreaterThan(
      html.lastIndexOf('Je vérifie ailleurs'),
    );
  });
});
