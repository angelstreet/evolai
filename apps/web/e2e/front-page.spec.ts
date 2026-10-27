import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Front page cockpit, Workbench look (TASK-AH W1-W8, ADR 0051, docs/mockups/glowup-c-workbench.html),
 * at phone (390x844) and desktop (1280x800) width: splash once, every menu item, Try it up to the
 * send sheet, the path checklist, FR and EN, light and dark, axe clean, no label cut, no real
 * client or person name. No account.
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

const MENU = ['home', 'learn', 'videos', 'survey', 'report'] as const;

const setLocale = async (page: Page, locale: 'en' | 'fr', baseURL: string) =>
  page.context().addCookies([{ name: 'evolai_locale', value: locale, url: baseURL }]);

const menu = (page: Page, key: string) => page.locator(`.ck-menu button[data-k=${key}]`);

/** W6: no menu, tab or step label is cut, and the page does not scroll sideways. */
const expectWordsFit = async (page: Page) => {
  const cut = await page.evaluate(() => {
    const sel = '.ck-menu .ck-label, .ck-menu .ck-nav-count, .ck-step-name, .ck-path .ck-word';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth)
      .map((el) => `${el.textContent} ${el.scrollWidth}>${el.clientWidth}`);
  });
  expect(cut).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
};

for (const size of SIZES) {
  test.describe(`front page at ${size.name}`, () => {
    onlyDesktopProject();
    test.use({ viewport: { width: size.width, height: size.height } });

    test('splash plays once per load and never again', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('ck-splash')).toBeVisible();
      await expect(page.getByTestId('ck-splash')).toHaveCount(0, { timeout: 3000 });
      await menu(page, 'learn').click();
      await menu(page, 'survey').click();
      await expect(page.getByTestId('ck-splash')).toHaveCount(0);
    });

    test.describe('without motion', () => {
      test.use({ reducedMotion: 'reduce' });

      test('every menu item opens its card; the header names where you are', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        await expect(page.getByTestId('ck-splash')).toHaveCount(0);
        const main = page.getByTestId('ck-main');
        await expect(main.getByRole('heading', { level: 1 })).toContainText(
          'starts with your teams',
        );
        await expect(main.locator('.ck-point')).toHaveCount(3);
        await menu(page, 'learn').click();
        await expect(menu(page, 'learn')).toHaveAttribute('aria-current', 'page');
        await expect(page.getByTestId('ck-crumb')).toContainText('Lesson 1 of 5');
        await expect(main.getByRole('heading', { level: 1 })).toContainText('Why an AI audit');
        for (let i = 2; i <= 5; i++) {
          await main.getByRole('button', { name: 'Next lesson' }).click();
          await expect(page.getByTestId('ck-crumb')).toContainText(`Lesson ${i} of 5`);
        }
        await expect(main.getByRole('button', { name: 'Answer the survey' })).toBeVisible();
        await menu(page, 'videos').click();
        await expect(page.getByTestId('ck-video')).toHaveCount(10);
        await expect(page.getByTestId('ck-video').first()).toContainText('Coming soon');
        await menu(page, 'survey').click();
        await expect(page.getByTestId('ck-question-row')).toHaveCount(10);
        await menu(page, 'report').click();
        await expect(main).toContainText('Demo Client');
        await expect(main).toContainText('Sample');
        await expect(main).toContainText('Sales team');
        // Round 1 pieces are gone.
        await expect(
          page.locator('.ck-ctl, .ck-tabs, .ck-strip, .ck-tstrip, .ck-mono'),
        ).toHaveCount(0);
      });

      test('Try it: Next question waits for an answer and shares answers with the Survey view', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        const next = page.getByTestId('ck-next');
        await expect(page.getByTestId('ck-try-count')).toHaveText('1 of 10');
        await expect(next).toBeDisabled();
        await expect(page.getByTestId('ck-hint')).toContainText('Pick one answer');
        await page.getByTestId('ck-option').first().click();
        await expect(next).toBeEnabled();
        await expect(page.getByTestId('ck-hint')).toContainText('kept on this device');
        await next.click();
        await expect(page.getByTestId('ck-try-count')).toHaveText('2 of 10');
        await menu(page, 'survey').click();
        await expect(page.getByTestId('ck-question-row').first()).toContainText('Answered');
        await expect(page.getByTestId('ck-question-row').nth(1)).toContainText('To do');
        await expect(page.getByTestId('ck-path-count')).toHaveText('0 / 7');
      });

      test('Your path: seven steps, status as icon plus word, a lesson opened ticks its step', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        const steps = page.getByTestId('ck-path-step');
        await expect(steps).toHaveCount(7);
        await expect(steps.first()).toContainText('Now');
        await expect(steps.nth(1)).toContainText('To do');
        await expect(steps.last()).toContainText('Sign in');
        await menu(page, 'learn').click();
        await expect(page.getByTestId('ck-path-count')).toHaveText('1 / 7');
        await expect(steps.first()).toContainText('Done');
        await expect(steps.nth(1)).toContainText('Now');
        await steps.nth(3).click();
        await expect(page.getByTestId('ck-crumb')).toContainText('Lesson 4 of 5');
      });

      test('survey: ten questions, answers kept in the browser, ends at the send sheet', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        await page.goto('/');
        for (let i = 1; i <= 10; i++) {
          await expect(page.getByTestId('ck-try-count')).toHaveText(`${i} of 10`);
          const option = page.getByTestId('ck-option').first();
          if (await option.count()) await option.click();
          else await page.locator('.ck-try textarea').first().fill('Copy the same lines by hand.');
          await page.getByTestId('ck-next').click();
        }
        await expect(page.getByTestId('ck-try-done')).toContainText('You answered 10 of 10');
        // Nothing asked for an email or a sign-in before this point.
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.reload();
        await expect(page.getByTestId('ck-try-done')).toContainText('You answered 10 of 10');
        await expect(page.getByTestId('ck-path-count')).toHaveText('1 / 7');
        await page.getByTestId('ck-send').click();
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
      });

      for (const locale of ['en', 'fr'] as const) {
        for (const scheme of ['light', 'dark'] as const) {
          test(`${locale} ${scheme}: axe clean, no label cut, no real names, no horizontal scroll`, async ({
            page,
            baseURL,
          }) => {
            await setLocale(page, locale, baseURL as string);
            await page.emulateMedia({ colorScheme: scheme });
            await page.goto('/');
            await expect(page.locator('html')).toHaveAttribute('lang', locale);
            for (const step of MENU) {
              await menu(page, step).click();
              await page.evaluate(() =>
                Promise.allSettled(document.getAnimations().map((a) => a.finished)),
              );
              const results = await new AxeBuilder({ page }).analyze();
              expect(
                results.violations.map(
                  (v) => `${step} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
                ),
              ).toEqual([]);
              await expectWordsFit(page);
            }
            const text = await page.locator('body').innerText();
            expect(text).not.toMatch(/\b(Acme|Contoso|Initech)\b/);
            expect(text).not.toContain('·');
          });
        }
      }

      test('every card description is two lines or fewer', async ({ page, baseURL }) => {
        for (const locale of ['en', 'fr'] as const) {
          await setLocale(page, locale, baseURL as string);
          await page.goto('/');
          const tooLong: string[] = [];
          const measure = async (label: string) => {
            const bad = await page.evaluate(() =>
              [...document.querySelectorAll<HTMLElement>('.ck-lesson .ck-lede')]
                .filter(
                  (el) =>
                    el.getBoundingClientRect().height >
                    2 * parseFloat(getComputedStyle(el).lineHeight) + 1,
                )
                .map((el) => el.textContent),
            );
            tooLong.push(...bad.map((b) => `${locale} ${label}: ${b}`));
          };
          for (const key of MENU) {
            await menu(page, key).click();
            if (key === 'learn') {
              for (let i = 0; i < 5; i++) {
                await measure(`lesson ${i + 1}`);
                const nextLesson = page.locator('.ck-foot-row .MuiButton-outlined');
                if (i < 4) await nextLesson.click();
              }
            } else await measure(key);
          }
          expect(tooLong).toEqual([]);
        }
      });

      test('the disabled Next question keeps a readable label in both themes', async ({
        page,
        baseURL,
      }) => {
        await setLocale(page, 'en', baseURL as string);
        for (const scheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          await page.goto('/');
          const ratio = await page.getByTestId('ck-next').evaluate((el) => {
            const lum = (css: string) => {
              const [r, g, b] = (css.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
                const c = Number(v) / 255;
                return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              }) as [number, number, number];
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const cs = getComputedStyle(el);
            const [a, b] = [lum(cs.color), lum(cs.backgroundColor)].sort((x, y) => y - x);
            return ((a as number) + 0.05) / ((b as number) + 0.05);
          });
          expect(ratio, scheme).toBeGreaterThanOrEqual(3);
        }
      });

      test('with no saved choice the page follows the system theme', async ({ page }) => {
        const bg = async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        const dark = await bg();
        await page.emulateMedia({ colorScheme: 'light' });
        await page.context().clearCookies();
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
        expect(await bg()).not.toBe(dark);
      });

      test('French copy and the language control', async ({ page, baseURL }) => {
        await setLocale(page, 'fr', baseURL as string);
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          'commence par vos équipes',
        );
        await expect(page.getByTestId('ck-next')).toHaveText('Question suivante');
        await expect(page.getByTestId('ck-try-count')).toHaveText('1 sur 10');
        await expect(menu(page, 'survey')).toContainText('Questionnaire');
        await page.getByTestId('switch-en').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.getByTestId('ck-next')).toHaveText('Next question');
      });
    });
  });
}

test.describe('phone layout', () => {
  onlyDesktopProject();
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  test('the side menu becomes a bottom tab bar of five items', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('.ck-side').boundingBox();
    expect(box?.y).toBeGreaterThan(844 - 90);
    expect(box?.width).toBeGreaterThanOrEqual(389);
    await expect(page.locator('.ck-menu button')).toHaveCount(5);
  });
});

test.describe('desktop layout', () => {
  onlyDesktopProject();
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  test('232 px side menu, content card left, Try it and Your path on the right', async ({
    page,
  }) => {
    await page.goto('/');
    const side = await page.locator('.ck-side').boundingBox();
    const card = await page.getByTestId('ck-main').boundingBox();
    const tryIt = await page.locator('.ck-try').boundingBox();
    const path = await page.locator('.ck-path').boundingBox();
    expect(side?.x).toBe(0);
    expect(Math.round(side!.width)).toBe(232);
    expect(card!.x).toBeGreaterThan(side!.width - 1);
    expect(card!.width).toBeGreaterThan(520);
    expect(Math.round(tryIt!.width)).toBe(380);
    // The logo keeps its own size (32 px mark), not the 20 px line-icon size.
    const mark = await page.locator('.ck-brand svg').boundingBox();
    expect(Math.round(mark!.height)).toBe(32);
    expect(tryIt!.x).toBeGreaterThan(card!.x + card!.width - 1);
    expect(path!.y).toBeGreaterThan(tryIt!.y + tryIt!.height - 1);
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
