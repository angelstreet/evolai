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
      backHref={index === 0 ? null : '/prev'}
      segments={Array.from({ length: 10 }, (_, i) => ({
        href: i <= index ? `/q/${i}` : null,
        on: i <= index,
      }))}
      labels={{
        title: t('survey.title'),
        count: t('survey.questionOf', { i: index + 1, n: 10 }),
        progress: t('survey.progress'),
        previous: t('survey.previous'),
        next: t('survey.next'),
        finish: t('survey.finish'),
        pick: t('survey.pick'),
        saved: t('survey.savedHint'),
        goTo: t('survey.goTo', { n: '{n}' }),
      }}
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
              counterTemplate: t('survey.textCounter', { n: '{n}', max: FREE_TEXT_MAX_LENGTH }),
            }
          : undefined
      }
    />,
  );
};

const FIRST_TEXT = 6;

describe('QuestionClient, Workbench card (TASK-AI L3)', () => {
  it('Previous and the reached segments link back; later ones are not links', () => {
    const html = render('en', 2);
    expect(html).toContain('href="/prev"');
    expect(html).toContain('Previous');
    expect(html).toContain('Question 3 of 10');
    expect(html.match(/aria-label="Go to question \d+"/g)).toHaveLength(2);
  });
});

describe('QuestionClient, free-text question', () => {
  it('French: text box capped at 400, counter, hint and a Suivant button', () => {
    const html = render('fr', FIRST_TEXT);
    expect(html).toContain('<textarea');
    expect(html).toMatch(/maxLength="400"|maxlength="400"/);
    expect(html).toContain('0 sur 400 caractères');
    expect(html).toContain('Pas de noms, ni e-mails, ni numéros');
    expect(html).toContain('Nous les masquons.');
    expect(html).toContain('Facultatif');
    expect(html).toContain('Suivant');
    expect(html).toContain('Passer');
    expect(html).not.toContain('ck-opt');
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

  it('a choice question renders radio options, Next waits for a pick, Skip is there, no Previous on question 1', () => {
    const html = render('fr', 0);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('Choisissez une réponse, ou passez. Anonyme.');
    expect(html).not.toContain('survey-prev');
    // Every question can be skipped (ADR 0062).
    expect(html).toContain('data-testid="survey-skip"');
    expect(html).not.toContain('<textarea');
    expect(html.match(/ck-opt/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html.lastIndexOf('Je ne sais pas / Ça dépend')).toBeGreaterThan(
      html.lastIndexOf('Je vérifie ailleurs'),
    );
  });
});
