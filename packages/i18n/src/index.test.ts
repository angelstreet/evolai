import { describe, expect, it } from 'vitest';
import {
  createTranslator,
  deName,
  defaultLocale,
  formatCurrency,
  formatDate,
  formatMessage,
  isSupportedLocale,
  messages,
  negotiateLocale,
  quizItems,
  supportedLocales,
} from './index.js';

const flatten = (node: unknown, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
};

const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1] as string).sort();

describe('@evolai/i18n locale list', () => {
  it('supports fr and en', () => {
    expect([...supportedLocales].sort()).toEqual(['en', 'fr']);
  });
  it('recognises supported locales', () => {
    expect(isSupportedLocale('fr')).toBe(true);
    expect(isSupportedLocale('en')).toBe(true);
  });
  it('rejects unknown locales', () => {
    expect(isSupportedLocale('de')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });
});

describe('negotiateLocale', () => {
  it('falls back to the default', () => {
    expect(negotiateLocale(null)).toBe(defaultLocale);
    expect(negotiateLocale('de-DE,es;q=0.8')).toBe(defaultLocale);
    expect(negotiateLocale('*')).toBe(defaultLocale);
  });
  it('honours q-values and regional subtags', () => {
    expect(negotiateLocale('fr-CA,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(negotiateLocale('en-GB,fr;q=0.5')).toBe('en');
    expect(negotiateLocale('de,fr;q=0.2,en;q=0.7')).toBe('en');
    expect(negotiateLocale('fr;q=0,en;q=0.1')).toBe('en');
  });
});

describe('catalog parity', () => {
  const en = flatten(messages.en);
  const fr = flatten(messages.fr);

  it('has the same keys in both locales', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
  it('has no empty strings', () => {
    for (const [k, v] of [...Object.entries(en), ...Object.entries(fr)]) {
      expect(v.trim().length, k).toBeGreaterThan(0);
    }
  });
  it('uses the same placeholders in both locales', () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(fr[key] as string), key).toEqual(placeholders(en[key] as string));
    }
  });
  it('keeps plural blocks balanced and including `other`', () => {
    for (const [k, v] of Object.entries({ ...en })) {
      if (!v.includes('plural')) continue;
      expect((fr[k] as string).includes('plural'), k).toBe(true);
      expect(v).toMatch(/other\s*\{/);
      expect(fr[k]).toMatch(/other\s*\{/);
    }
  });
  it('has quiz items for the same codes and options', () => {
    const shape = (l: 'en' | 'fr') =>
      Object.fromEntries(
        Object.entries(quizItems[l]).map(([c, i]) => [c, Object.keys(i.options).sort()]),
      );
    expect(shape('fr')).toEqual(shape('en'));
  });
  it('uses the same placeholders in quiz items', () => {
    for (const [code, item] of Object.entries(quizItems.en)) {
      const fr = quizItems.fr[code];
      expect(placeholders(fr?.prompt ?? ''), code).toEqual(placeholders(item.prompt));
    }
  });
});

describe('French typography and length', () => {
  const fr = flatten(messages.fr);
  const frQuiz = Object.entries(quizItems.fr).flatMap(([code, item]) => [
    [`quizItems.${code}.prompt`, item.prompt] as const,
    ...Object.entries(item.options).map(([o, v]) => [`quizItems.${code}.${o}`, v] as const),
  ]);
  const all = [...Object.entries(fr), ...frQuiz];

  it('puts a no-break space before : ; ? ! and uses typographic apostrophes', () => {
    for (const [k, v] of all) {
      // Plain text only: skip placeholders and technical tokens such as {command}.
      const text = v.replace(/\{[^}]*\}/g, '');
      expect(text, `${k}: regular space before high punctuation`).not.toMatch(/ [:;?!]/);
      expect(text, `${k}: missing no-break space before ? ! ;`).not.toMatch(/\S[?!;]/);
      expect(text, `${k}: straight apostrophe`).not.toMatch(/'/);
      expect(text, `${k}: three dots instead of an ellipsis`).not.toMatch(/\.\.\./);
      expect(text, `${k}: straight double quote`).not.toMatch(/"/);
    }
  });
  it('keeps respondent sentences short (survey, quiz, done, return, errors)', () => {
    const respondent = all.filter(([k]) => /^(survey|quiz|quizItems)\./.test(k));
    for (const [k, v] of respondent) {
      for (const sentence of v.split(/(?<=[.?!])\s+/)) {
        const words = sentence
          .replace(/\{[^}]*\}/g, 'x')
          .split(/\s+/)
          .filter(Boolean).length;
        expect(words, `${k}: "${sentence}"`).toBeLessThanOrEqual(18);
      }
    }
  });
});

describe('formatMessage / createTranslator', () => {
  it('substitutes placeholders', () => {
    expect(formatMessage('Hi {name}', 'en', { name: 'A' })).toBe('Hi A');
  });
  it('selects plural branches per locale', () => {
    const tpl = '{n, plural, one {# question} other {# questions}}';
    expect(formatMessage(tpl, 'en', { n: 1 })).toBe('1 question');
    expect(formatMessage(tpl, 'en', { n: 6 })).toBe('6 questions');
    expect(formatMessage(tpl, 'fr', { n: 0 })).toBe('0 question');
    expect(formatMessage(tpl, 'fr', { n: 2 })).toBe('2 questions');
  });
  it('translates and falls back to the key', () => {
    expect(createTranslator('fr')('survey.start')).toBe('Commencer');
    expect(createTranslator('en')('survey.duration', { n: 6, m: 2 })).toBe(
      '6 questions · about 2 min',
    );
    expect(createTranslator('en')('nope.missing' as never)).toBe('nope.missing');
  });
});

describe('Intl helpers', () => {
  it('localises numbers, currency and dates', () => {
    expect(formatCurrency('en', 12000)).toContain('12,000');
    expect(formatCurrency('fr', 12000).replace(/\s/g, ' ')).toContain('12 000');
    expect(formatDate('fr', '2026-03-05', { dateStyle: 'long' })).toBe('5 mars 2026');
    expect(formatDate('en', '2026-03-05', { dateStyle: 'long' })).toBe('March 5, 2026');
  });
});

describe('deName', () => {
  it('elides "de" before a vowel in French and leaves names as written', () => {
    expect(deName('fr', 'Équipe pilote')).toBe('d’Équipe pilote');
    expect(deName('fr', 'Equipe pilote')).toBe('d’Equipe pilote');
    expect(deName('fr', 'Santé')).toBe('de Santé');
    expect(deName('en', 'Équipe pilote')).toBe('Équipe pilote');
  });
});

describe('plural numbers', () => {
  it('use the locale decimal sign', () => {
    const msg = '{n, plural, one {# heure} other {# heures}}';
    expect(formatMessage(msg, 'fr', { n: 1.5 })).toBe('1,5 heure');
    expect(formatMessage(msg, 'en', { n: 1.5 })).toBe('1.5 heures');
    expect(formatMessage(msg, 'fr', { n: 12000 })).toBe('12000 heures');
  });
});
