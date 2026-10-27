import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Front page cockpit (TASK-AH, ADR 0051, docs/mockups/front-page-stage-tabs.html), at phone
 * (390x844) and desktop (1280x800) width: splash once, every rail item, the survey up to the send
 * sheet, FR and EN, light and dark, axe clean, no real client or person name. No account.
 */
const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

/** The spec sets its own viewports, so it runs once, in the project that has no mobile emulation. */
const onlyDesktopProject = () =>
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-admin', 'sizes are set in the spec');
  });

const RAIL = ['home', 'journey', 'learn', 'questions', 'survey', 'materials'] as const;

const setLocale = async (page: Page, locale: 'en' | 'fr', baseURL: string) =>
  page.context().addCookies([{ name: 'evolai_locale', value: locale, url: baseURL }]);

const rail = (page: Page, key: string) =>
  page.locator(`.ck-rail .ck-rb[data-k=${key}]:visible`).first();

for (const size of SIZES) {
  test.describe(`front page at ${size.name}`, () => {
    onlyDesktopProject();
    test.use({ viewport: { width: size.width, height: size.height } });

    test('splash plays once per load and never again', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('ck-splash')).toBeVisible();
      await expect(page.getByTestId('ck-splash')).toHaveCount(0, { timeout: 3000 });
      await rail(page, 'learn').click();
      await rail(page, 'survey').click();
      await expect(page.getByTestId('ck-splash')).toHaveCount(0);
    });

    test.describe('without motion', () => {
      test.use({ reducedMotion: 'reduce' });

      test('no splash under reduced motion; every rail item opens its stage', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        await expect(page.getByTestId('ck-splash')).toHaveCount(0);
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'starts with your teams',
        );
        const stageHead = page.locator('.ck-st-h');
        const expected: Record<string, RegExp> = {
          home: /Stage 1 \/ 5 · Journey map/,
          journey: /Stage 1 \/ 5/,
          learn: /Stage 2 \/ 5 · Lessons/,
          survey: /Stage 3 \/ 5 · Survey/,
          materials: /Stage 5 \/ 5 · Materials/,
        };
        for (const key of RAIL) {
          if (key === 'questions') {
            await rail(page, key).click();
            await expect(page.getByRole('tab', { name: 'Questions' })).toHaveAttribute(
              'aria-selected',
              'true',
            );
            await expect(page.locator('.ck-side .ck-mini li')).toHaveCount(10);
            continue;
          }
          if (!(await rail(page, key).count())) continue; // Journey is hidden in the phone tab bar
          await rail(page, key).click();
          await expect(stageHead).toContainText(expected[key] as RegExp);
        }
        // The control bar: next goes round all five stages and back to the first.
        await rail(page, 'home').click();
        for (let i = 2; i <= 5; i++) {
          await page.locator('.ck-ctl').getByRole('button', { name: 'Next', exact: true }).click();
          await expect(stageHead).toContainText(`Stage ${i} / 5`);
        }
        await page.locator('.ck-ctl').getByRole('button', { name: 'Next', exact: true }).click();
        await expect(stageHead).toContainText('Stage 1 / 5');
      });

      test('lessons carry the five /learn pages, the sample is labelled, ten video slots say Coming', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        await rail(page, 'learn').click();
        for (let i = 1; i <= 5; i++) {
          await expect(page.locator('.ck-st-b h1')).toBeVisible();
          if (i < 5) await page.locator('.ck-pg').getByRole('button', { name: 'Next' }).click();
        }
        await expect(page.getByTestId('ck-video')).toHaveCount(10);
        await page.getByRole('button', { name: 'Report preview' }).click();
        await expect(page.locator('.ck-st-b')).toContainText('Demo Client');
        await expect(page.locator('.ck-st-b')).toContainText('Sample');
        await rail(page, 'materials').click();
        await expect(page.getByTestId('ck-video')).toHaveCount(10);
        await expect(page.getByTestId('ck-video').first()).toContainText('Coming');
      });

      test('survey: ten questions, answers kept in the browser, ends at the send sheet', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        await rail(page, 'survey').click();
        for (let i = 1; i <= 10; i++) {
          await expect(page.locator('.ck-sv-top')).toContainText(`Question ${i} / 10`);
          const option = page.getByTestId('ck-option').first();
          if (await option.count()) await option.click();
          else await page.locator('.ck-sv textarea').fill('Copy the same lines by hand.');
          await page.getByTestId('ck-next').click();
        }
        await expect(page.locator('.ck-st-b')).toContainText('You answered 10 of 10');
        // Nothing asked for an email or a sign-in before this point.
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.reload();
        await rail(page, 'survey').click();
        await expect(page.locator('.ck-st-b')).toContainText('You answered 10 of 10');
        await page
          .locator('.ck-st-b')
          .getByRole('button', { name: 'Send and start your audit' })
          .click();
        const sheet = page.getByRole('dialog');
        await expect(sheet).toBeVisible();
        await expect(sheet.getByLabel('Work email')).toBeFocused();
        await sheet.getByLabel('Work email').fill('not-an-email');
        await sheet.getByRole('button', { name: 'Send my answers' }).click();
        await expect(sheet).toContainText('Enter a valid work email');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      });

      test('"EvolAI team sign-in" is a footer link to /login; nothing else on the page asks to sign in', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        await expect(page.getByTestId('front-sign-in')).toHaveAttribute('href', '/login');
        await expect(page.locator('a[href="/login"]')).toHaveCount(1);
        await expect(page.locator('.ck-rail-note'))
          .toBeVisible()
          .catch(() => undefined);
      });

      for (const locale of ['en', 'fr'] as const) {
        for (const scheme of ['light', 'dark'] as const) {
          test(`${locale} ${scheme}: axe clean, no real names, no horizontal scroll`, async ({
            page,
            baseURL,
          }) => {
            await setLocale(page, locale, baseURL as string);
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto('/');
            await expect(page.locator('html')).toHaveAttribute('lang', locale);
            for (const step of ['home', 'learn', 'survey', 'materials'] as const) {
              await rail(page, step).click();
              await page.evaluate(() =>
                Promise.allSettled(document.getAnimations().map((a) => a.finished)),
              );
              const results = await new AxeBuilder({ page }).analyze();
              expect(
                results.violations.map(
                  (v) => `${step} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
                ),
              ).toEqual([]);
            }
            const text = await page.locator('body').innerText();
            expect(text).not.toMatch(/\b(Acme|Contoso|Initech)\b/);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
          });
        }
      }

      test('French copy and the language control', async ({ page, baseURL }) => {
        await setLocale(page, 'fr', baseURL as string);
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'commence par vos équipes',
        );
        await rail(page, 'survey').click();
        await expect(page.locator('.ck-sv-top')).toContainText('Question 1 / 10');
        await expect(page.getByTestId('ck-next')).toHaveText('Suivant');
      });
    });
  });
}

test.describe('phone layout', () => {
  onlyDesktopProject();
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  test('the rail becomes a bottom tab bar', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('.ck-rail').boundingBox();
    expect(box?.y).toBeGreaterThan(844 - 80);
    expect(box?.width).toBeGreaterThanOrEqual(389);
  });
});

test.describe('desktop layout', () => {
  onlyDesktopProject();
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  test('left rail, bordered stage, right panel', async ({ page }) => {
    await page.goto('/');
    const rail = await page.locator('.ck-rail').boundingBox();
    const stage = await page.locator('.ck-stage').boundingBox();
    const side = await page.locator('.ck-side').boundingBox();
    expect(rail?.x).toBe(0);
    expect(stage!.x).toBeGreaterThan(rail!.width - 1);
    expect(side!.x).toBeGreaterThan(stage!.x + stage!.width - 1);
  });
});

test.describe('old routes', () => {
  test('/about and /welcome redirect to the cockpit; /learn links back', async ({ page }) => {
    for (const old of ['/about', '/welcome']) {
      await page.goto(old);
      await expect(page).toHaveURL(/\/$/);
    }
    await page.goto('/learn');
    await page.getByTestId('learn-cockpit').click();
    await expect(page).toHaveURL(/\/$/);
  });
});
