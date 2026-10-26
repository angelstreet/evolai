import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Public /learn pages (TASK-AE, ADR 0050): five pages reached with Next, Back works, page 3 lists
 * the live questionnaire word for word, empty video slots render nothing, FR and EN, axe clean.
 * No account: the pages are public, so no sign-in helper is used. Runs in all three viewports.
 */
const PATHS = ['/learn', '/learn/how', '/learn/questions', '/learn/results', '/learn/videos'];
const questionnaire = JSON.parse(
  readFileSync(
    path.join(__dirname, '../../../packages/contracts/src/questionnaires/pilot-v1.json'),
    'utf8',
  ),
) as { questions: Array<{ prompt: { fr: string; en: string } }> };

for (const locale of ['en', 'fr'] as const) {
  test.describe(`learn in ${locale}`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);
    });

    test('Next walks the five pages and Back returns', async ({ page }) => {
      await page.goto(PATHS[0] as string);
      for (let i = 0; i < PATHS.length; i++) {
        await expect(page).toHaveURL(new RegExp(`${PATHS[i]}$`));
        await expect(page.getByTestId('learn-progress')).toContainText(`${i + 1}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByTestId('learn-back')).toHaveCount(i === 0 ? 0 : 1);
        await expect(page.getByTestId('learn-next')).toHaveCount(i === PATHS.length - 1 ? 0 : 1);
        if (i < PATHS.length - 1) await page.getByTestId('learn-next').click();
      }
      await page.getByTestId('learn-back').click();
      await expect(page).toHaveURL(/\/learn\/results$/);
    });

    test('page 3 shows the survey questions word for word', async ({ page }) => {
      await page.goto('/learn/questions');
      const prompts = page.getByTestId('learn-question-prompt');
      await expect(prompts).toHaveCount(questionnaire.questions.length);
      expect(await prompts.allTextContents()).toEqual(
        questionnaire.questions.map((q) => q.prompt[locale]),
      );
      await expect(page.getByTestId('learn-question')).toHaveCount(10);
    });

    test('empty video slots render nothing', async ({ page }) => {
      for (const p of PATHS) {
        await page.goto(p);
        await expect(page.locator('iframe')).toHaveCount(0);
        await expect(page.getByTestId('learn-video')).toHaveCount(0);
      }
      await expect(page.getByTestId('learn-video-list')).toHaveCount(0);
      await expect(page.getByTestId('learn-sign-in')).toBeVisible();
    });

    test('no horizontal scroll and axe clean on every page', async ({ page }) => {
      for (const p of PATHS) {
        await page.goto(p);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, p).toBeLessThanOrEqual(0);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(
          results.violations.map((v) => v.id),
          p,
        ).toEqual([]);
      }
    });
  });
}

test('the front page links to /learn', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('front-learn').click();
  await expect(page).toHaveURL(/\/learn$/);
});
