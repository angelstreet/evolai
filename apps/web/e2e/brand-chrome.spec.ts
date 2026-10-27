import { createHmac } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * TASK-AC2: the brand kit and the one standard chrome. The kit lockup is in the header once per
 * page, the footer is one slim row with each link once, FR | EN is one toggle that persists,
 * public pages carry no mascot, and no page says "auditor" / "consultant" to a reader.
 * Runs at 360, 768 and 1280 through the Playwright projects, light and dark.
 */

const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const reference = 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0004';
const surveyToken = `${reference}.${createHmac('sha256', SECRET).update(reference).digest('base64url')}`;

const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};

const BANNED = /\b(auditors?|auditeurs?|auditrices?|consultants?)\b/i;

const PAGES = [
  { name: 'front page', path: '/' },
  { name: 'sign-in', path: '/login' },
  { name: 'forgot password', path: '/forgot-password' },
  { name: 'privacy', path: '/privacy' },
  { name: 'survey landing', path: `/s/${surveyToken}` },
] as const;

const expectOneLogo = async (page: Page, label: string) => {
  await expect(page.getByTestId('brand-logo'), `${label}: one lockup`).toHaveCount(1);
  await expect(page.getByTestId('brand-logo'), `${label}: in the header`).toBeVisible();
  await expect(
    page.locator('header [data-testid=brand-logo]'),
    `${label}: lockup in header`,
  ).toHaveCount(1);
  // The footer carries the symbol only, never a second lockup.
  await expect(page.locator('footer [data-testid=brand-logo]')).toHaveCount(0);
};

for (const theme of ['light', 'dark'] as const) {
  test.describe(`kit chrome, ${theme}`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([
        { name: 'evolai_theme', value: theme, url: baseURL as string },
        { name: 'evolai_locale', value: 'en', url: baseURL as string },
      ]);
    });

    for (const { name, path } of PAGES) {
      test(`${name}: one logo, one footer, no mascot, no banned word, axe`, async ({ page }) => {
        await page.goto(path);
        await expectOneLogo(page, name);
        await expect(page.locator('footer')).toHaveCount(1);
        await expect(page.locator('footer a[href="/privacy"]')).toHaveCount(1);
        await expect(page.locator('footer a[href*="github.com"]')).toHaveCount(1);
        await expect(page.locator('header a[href="/about"], a[href="/about"]')).toHaveCount(0);
        if (path !== `/s/${surveyToken}`) {
          await expect(page.locator('main svg[aria-label*="mascot" i], main #mascot')).toHaveCount(
            0,
          );
        }
        expect(await page.locator('body').innerText()).not.toMatch(BANNED);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(
          results.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => v.id),
        ).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(overflow).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
      });
    }

    test('client home shows the kit logo once', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name=email]', REFERENT.email);
      await page.fill('input[name=password]', REFERENT.password);
      await page.click('button[type=submit]');
      await page.waitForURL(/\/client/);
      await expectOneLogo(page, 'client home');
      expect(await page.locator('body').innerText()).not.toMatch(BANNED);
    });
  });
}

test.describe('front page and sign-in content', () => {
  test('front page: the cockpit, one primary action, auditor sign-in only in the footer, no intake button', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('cockpit')).toBeVisible();
    await expect(
      page.locator('[data-testid=ck-main] .MuiButton-contained, .ck-try .MuiButton-contained'),
    ).toHaveCount(1);
    await expect(page.getByTestId('front-sign-in')).toHaveAttribute('href', '/login');
    await expect(page.locator('footer a[href="/login"]')).toHaveCount(1);
    await expect(page.locator('a[href="/intake"]')).toHaveCount(0);
  });

  test('sign-in: left-aligned card, no logo inside, no help sentence, survey line under it', async ({
    page,
  }) => {
    await page.goto('/login');
    const card = page.locator('main .MuiPaper-root').first();
    await expect(card.locator('[data-testid^=brand-]')).toHaveCount(0);
    await expect(card.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(card.locator('a[href="/privacy"]')).toHaveCount(0);
    const cardBox = await card.boundingBox();
    const headerLogo = await page.getByTestId('brand-logo').boundingBox();
    expect(Math.abs((cardBox?.x ?? 0) - (headerLogo?.x ?? 99))).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('survey-line')).toBeVisible();
    const lineBox = await page.getByTestId('survey-line').boundingBox();
    expect(lineBox?.y ?? 0).toBeGreaterThan((cardBox?.y ?? 0) + (cardBox?.height ?? 0));
  });

  test('/about redirects to the front page', async ({ page }) => {
    await page.goto('/about');
    await page.waitForURL(/\/$/);
  });
});

test.describe('FR | EN toggle', () => {
  test('switches the page language and persists across pages', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'evolai_locale', value: 'fr', url: baseURL as string }]);
    await page.goto('/');
    const toggle = page.getByTestId('language-toggle');
    await expect(toggle).toHaveAttribute('aria-label', /.+/);
    await expect(page.getByTestId('switch-fr')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('commence par vos équipes');
    await page.getByTestId('switch-en').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('starts with your teams');
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('switch-en')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('account menu', () => {
  test('rows share one left edge and none wraps', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL as string }]);
    await signInAsAuditorA(page);
    await page.getByTestId('account-button').click();
    const menu = page.locator('#account-menu [role=menu]');
    await expect(menu).toBeVisible();
    await expect(page.getByTestId('account-identity')).toContainText('EvolAI team');
    await expect(page.getByTestId('account-identity').locator('p').last()).not.toContainText(
      /auditor/i,
    );
    const rows = await page
      .locator('#account-menu [role=menuitem] .MuiListItemText-root')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
          return { x: Math.round(r.left), lines: Math.round(r.height / lh) };
        }),
      );
    expect(rows.length).toBeGreaterThan(0);
    const edge = rows[0]?.x ?? 0;
    for (const row of rows) {
      expect(Math.abs(row.x - edge)).toBeLessThanOrEqual(1);
      expect(row.lines).toBe(1);
    }
    const box = await page.locator('#account-menu .MuiPaper-root').boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  });
});
