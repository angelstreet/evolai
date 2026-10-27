import { expect, test, type Page } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * Standard chrome (TASK-L, ADR 0034, docs/UI_RULES.md §0, §6, §11, §12):
 *  - header controls are icon buttons with names, and keep the same boxes in fr/en and light/dark,
 *  - after sign-in the header says who you are (name, email, role, organisation) and signs you out,
 *  - the theme toggle is a cookie the server renders, so a reload keeps it without a flash,
 *  - dark is a lifted slate, not black.
 */

const CONTROLS = ['language-toggle', 'theme-button', 'sign-in-button'] as const;

const boxesOf = async (page: Page) => {
  const out: Record<string, { x: number; y: number; width: number; height: number } | null> = {};
  for (const id of CONTROLS) out[id] = await page.getByTestId(id).boundingBox();
  return out;
};

const visit = async (page: Page, baseURL: string, locale: 'fr' | 'en', theme: 'light' | 'dark') => {
  await page.context().addCookies([
    { name: 'evolai_locale', value: locale, url: baseURL },
    { name: 'evolai_theme', value: theme, url: baseURL },
  ]);
  await page.goto('/privacy');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
};

test.describe('header chrome', () => {
  test('controls are named icon buttons of 44px or more', async ({ page }) => {
    await page.goto('/privacy');
    for (const id of CONTROLS) {
      const control = page.getByTestId(id);
      await expect(control).toHaveAttribute('aria-label', /.+/);
      const box = await control.boundingBox();
      expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44);
    }
  });

  test('no layout shift when the language or the theme changes', async ({ page, baseURL }) => {
    await visit(page, baseURL as string, 'fr', 'light');
    const reference = await boxesOf(page);
    for (const [locale, theme] of [
      ['en', 'light'],
      ['fr', 'dark'],
      ['en', 'dark'],
    ] as const) {
      await visit(page, baseURL as string, locale, theme);
      expect(await boxesOf(page), `${locale} ${theme}`).toEqual(reference);
    }
  });

  test('the theme toggle persists through a reload, from the server', async ({ page }) => {
    await page.goto('/privacy');
    const before = await page.locator('html').getAttribute('data-theme');
    await page.getByTestId('theme-button').click();
    const after = before === 'dark' ? 'light' : 'dark';
    await expect(page.locator('html')).toHaveAttribute('data-theme', after);
    // The server sends the attribute itself: check the raw HTML, before any script runs.
    const html = await (await page.request.get('/privacy')).text();
    expect(html).toMatch(new RegExp(`<html[^>]*data-theme="${after}"`));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  });

  test('dark is a lifted slate with a visible teal primary, not black (§12)', async ({
    page,
    baseURL,
  }) => {
    await visit(page, baseURL as string, 'en', 'dark');
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(26, 29, 35)');
    const primary = page.locator('main .MuiButton-contained').first();
    await expect(primary).toBeVisible();
    expect(await primary.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(46, 196, 178)',
    );
  });
});

test.describe('identity after sign-in (§11)', () => {
  test('the header shows who is signed in and signs out', async ({ page, baseURL }) => {
    await page
      .context()
      .addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL as string }]);
    await signInAsAuditorA(page);
    await expect(page.getByTestId('sign-in-button')).toHaveCount(0);
    const account = page.getByTestId('account-button');
    await expect(account).toBeVisible();
    await expect(account).toHaveAccessibleName('Synthetic auditor A');
    await account.click();
    const identity = page.getByTestId('account-identity');
    await expect(identity).toContainText('synthetic-auditor-a@synthetic.invalid');
    await expect(identity).toContainText(/EvolAI team/);
    await expect(identity).toContainText(/·\s*\S/);
    await page.getByTestId('sign-out').click();
    await page.waitForURL(/\/login/);
    await expect(page.getByTestId('sign-in-button')).toBeVisible();
  });
});

// One header row, whatever the language, theme or session (UI_RULES §5, §6, §11): every control
// shares the row's vertical centre and the bar never grows past one 64 px row plus its hairline.
const headerRow = async (page: Page) =>
  page.getByRole('banner').evaluate((header) => {
    const bar = header.getBoundingClientRect();
    const controls = [...header.querySelectorAll('a, button')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => Math.round(r.top + r.height / 2));
    return { height: Math.round(bar.height), centres: [...new Set(controls)] };
  });

test.describe('header bounding box across locales and themes', () => {
  for (const signedIn of [false, true]) {
    test(`one row, ${signedIn ? 'signed in' : 'signed out'}`, async ({ page, baseURL }) => {
      if (signedIn) await signInAsAuditorA(page);
      let reference: number | null = null;
      for (const locale of ['fr', 'en'] as const) {
        for (const theme of ['light', 'dark'] as const) {
          await page.context().addCookies([
            { name: 'evolai_locale', value: locale, url: baseURL as string },
            { name: 'evolai_theme', value: theme, url: baseURL as string },
          ]);
          await page.goto(signedIn ? '/admin/engagements' : '/');
          const row = await headerRow(page);
          const label = `${locale} ${theme}`;
          expect(row.height, label).toBeLessThanOrEqual(65);
          const spread = Math.max(...row.centres) - Math.min(...row.centres);
          expect(spread, `${label}: controls on one line`).toBeLessThanOrEqual(2);
          reference ??= row.height;
          expect(row.height, `${label}: same height as fr light`).toBe(reference);
        }
      }
    });
  }
});

const linesOf = (el: Element): number => {
  const h = el.getBoundingClientRect().height;
  return Math.round(h / parseFloat(getComputedStyle(el).lineHeight));
};

test.describe('hierarchy and copy length (§13)', () => {
  for (const locale of ['fr', 'en'] as const) {
    test(`front page headline, ${locale}`, async ({ page, baseURL }) => {
      await page
        .context()
        .addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);
      await page.goto('/');
      const width = page.viewportSize()?.width ?? 0;
      if (width >= 1024) {
        expect(await page.locator('h1').evaluate(linesOf), 'headline lines').toBeLessThanOrEqual(2);
      }
      // No shouting eyebrow pill in capitals above the headline.
      const caps = await page
        .locator('main *')
        .evaluateAll(
          (els) => els.filter((e) => getComputedStyle(e).textTransform === 'uppercase').length,
        );
      expect(caps).toBe(0);
    });
  }
});
