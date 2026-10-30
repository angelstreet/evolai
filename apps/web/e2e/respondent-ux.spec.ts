import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { answerCurrent } from './helpers';

/**
 * Respondent UX gate (TASK-E, docs/UX_AUDIT.md). Walks the whole employee path in fr and en:
 * invitation → questions → done/team status → optional quiz → return visit, and checks the rules
 * a busy, non-technical person needs:
 *  - no jargon on respondent screens (the banned list below is the single source),
 *  - exactly one primary button where there is a main action,
 *  - a visible progress element on every question,
 *  - 44px tap targets inside the page,
 *  - the screen language matches the chosen language (no mixed-language screens).
 * Admin and consultant screens are out of scope for the jargon rule (PRD §16, brief).
 */

const BANNED = [
  'pseudonym',
  'pseudonyme',
  'tenant',
  'locataire',
  'engagement',
  'synergy',
  'synergie',
  'opportunity',
  'opportunité',
  'analysis',
  'analyse',
  'audit',
  'schema',
  'RLS',
  'token',
  'referent',
  'référent',
  'rubric',
  'tier',
  'synthetic',
  'synthétique',
  'calibration',
];
// Letter-aware edges: `\b` treats an accented letter as a boundary, so "métier" would match "tier".
const BANNED_RE = new RegExp(`(?<!\\p{L})(${BANNED.join('|')})s?(?!\\p{L})`, 'iu');

const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const tokenFor = (reference: string): string =>
  `${reference}.${createHmac('sha256', SECRET).update(reference).digest('base64url')}`;

// Seeded pending tenant-B invitations (migration 0003): submitting them leaves the tenant-A
// completion figures that admin-engagements.spec.ts asserts untouched.
const INVITES = {
  fr: 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0002',
  en: 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0003',
} as const;

// The organisation named in "who is asking" is data (the seed calls it Synthetic Co), not copy.
const mainText = (page: Page) =>
  page.locator('main').evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[data-testid=who-is-asking]').forEach((n) => n.remove());
    return copy.textContent ?? '';
  });

const expectPlainScreen = async (page: Page, label: string) => {
  const text = await mainText(page);
  expect(text, `${label}: banned jargon`).not.toMatch(BANNED_RE);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main a, main button, main summary, main label')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return el.checkVisibility() && r.width > 0 && r.height > 0 && r.height < 44;
      })
      .map((el) => (el as HTMLElement).innerText.trim().slice(0, 30)),
  );
  expect(small, `${label}: tap targets under 44px`).toEqual([]);
};

test.describe('respondent path is short, plain and in one language', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone-first flow; runs in the mobile-360 project');

  for (const locale of ['fr', 'en'] as const) {
    test(`full path in ${locale}`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);
      const token = tokenFor(INVITES[locale]);
      const otherLang = locale === 'fr' ? /\b(the|your|answer)\b/i : /\b(vous|votre|réponse)\b/i;

      // Invitation: one primary action, visible without scrolling, privacy in one line.
      await page.goto(`/s/${token}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('main .MuiButton-contained')).toHaveCount(1);
      await expect(page.locator('main .MuiButton-contained')).toBeInViewport();
      await expect(page.locator('main details')).toHaveCount(1);
      await expectPlainScreen(page, `${locale} welcome`);
      expect(await mainText(page)).not.toMatch(otherLang);

      await page.locator('main .MuiButton-contained').click();
      let taps = 1;
      for (let i = 0; ; i += 1) {
        await expect(page).toHaveURL(new RegExp(`/q/${i}$`));
        await expect(page.getByRole('progressbar')).toBeVisible();
        await expectPlainScreen(page, `${locale} question ${i + 1}`);
        expect(await mainText(page), `question ${i + 1} language`).not.toMatch(otherLang);
        const before = page.url();
        await answerCurrent(page);
        taps += 1;
        await page.waitForURL((u) => u.toString() !== before);
        if (page.url().endsWith('/done')) break;
      }
      // One tap to start plus one per question (a text answer is typed, then one tap on Next).
      expect(taps).toBeLessThanOrEqual(15);

      // Done: team progress at a glance and what happens next; it ends calm, no quiz (TASK-AD2).
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('progressbar')).toBeVisible();
      await expect(page.locator('main a[href$="/quiz"]')).toHaveCount(0);
      await expectPlainScreen(page, `${locale} done`);

      // Return visit: the status view, no dead end, still plain.
      await page.goto(`/s/${token}`);
      await expect(page.getByRole('progressbar')).toBeVisible();
      await expectPlainScreen(page, `${locale} return`);
    });
  }

  test('a broken link explains itself in plain words', async ({ page }) => {
    const response = await page.goto(`/s/${'x'.repeat(10)}.${'y'.repeat(40)}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectPlainScreen(page, 'not found');
  });
});
