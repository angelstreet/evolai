import { createHmac } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signInAsAuditorA } from './helpers';

/**
 * Accessibility gate (TASK-I): axe-core on every respondent page, login and the main admin
 * pages in fr and en at 360 and 1280; a keyboard-only run of the whole respondent path; and
 * structural checks (one h1, landmarks, labelled progress, lang, reduced motion, 200% zoom).
 * Zero serious or critical axe violations is the gate.
 */

const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const tokenFor = (reference: string): string =>
  `${reference}.${createHmac('sha256', SECRET).update(reference).digest('base64url')}`;

// Pending tenant-B invitations of migration 0003 that no other spec submits.
const INVITES = {
  fr: 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0004',
  en: 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0005',
} as const;

const LOCALES = ['fr', 'en'] as const;

const scan = async (page: Page, label: string): Promise<void> => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(blocking, `${label}: axe serious/critical`).toEqual([]);
  // One h1, one main landmark, a language, on every page.
  await expect(page.locator('h1:visible'), `${label}: one h1`).toHaveCount(1);
  await expect(page.locator('main'), `${label}: one main`).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang', /^(fr|en)$/);
};

const setLocale = async (
  context: import('@playwright/test').BrowserContext,
  baseURL: string | undefined,
  locale: string,
) => context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);

/** No horizontal scroll; names the offending elements when there is some. */
const expectNoHScroll = async (page: Page, label: string): Promise<void> => {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    wide: [...document.querySelectorAll('body *')]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 ||
          e.scrollWidth > e.clientWidth + 1,
      )
      .map((e) => `${e.tagName}.${e.className}:${e.scrollWidth}>${e.clientWidth}`)
      .slice(0, 8),
  }));
  expect(r.sw, `${label}: horizontal scroll (${r.wide.join(', ')})`).toBeLessThanOrEqual(r.cw + 1);
};

const focusedIs = (page: Page, selector: string) =>
  page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);

/** Tab until the focused element matches `selector` (bounded, so a trap fails the test). */
const tabTo = async (page: Page, selector: string, max = 15): Promise<void> => {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await focusedIs(page, selector)) return;
  }
  throw new Error(`could not reach ${selector} with Tab in ${max} presses (focus trap?)`);
};

/** The focused control, or its label, shows a visible outline from the focus token. */
const expectFocusRing = async (page: Page, label: string): Promise<void> => {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const target = el?.matches('input') ? (el.closest('label') ?? el) : el;
    if (!target) return null;
    const s = getComputedStyle(target);
    return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) };
  });
  expect(ring, `${label}: focus ring`).not.toBeNull();
  expect(ring?.style, `${label}: outline style`).not.toBe('none');
  expect(ring?.width ?? 0, `${label}: outline width`).toBeGreaterThanOrEqual(2);
};

test.describe('respondent path, keyboard only, with axe on every page', () => {
  test.skip(({ isMobile }) => !isMobile, 'runs once, in the mobile-360 project');

  for (const locale of LOCALES) {
    test(`full path in ${locale}`, async ({ page, context, baseURL }) => {
      // Ten questions, each scanned by axe and walked by keyboard (TASK-Z2 added four).
      test.setTimeout(120_000);
      await setLocale(context, baseURL, locale);
      const token = tokenFor(INVITES[locale]);

      await page.goto(`/s/${token}`);
      await scan(page, `${locale} welcome`);

      // Skip link is the first stop and works.
      await page.keyboard.press('Tab');
      expect(await focusedIs(page, 'a.skip-link')).toBe(true);
      await expectFocusRing(page, 'skip link');
      await page.keyboard.press('Enter');
      expect(await focusedIs(page, 'main')).toBe(true);

      // Privacy detail is one keypress away and the start button is reachable.
      await tabTo(page, 'main summary');
      await expectFocusRing(page, 'privacy summary');
      await page.keyboard.press('Enter');
      await expect(page.locator('main details')).toHaveAttribute('open', '');
      await scan(page, `${locale} welcome, privacy open`);
      await tabTo(page, 'main .MuiButton-contained');
      await expectFocusRing(page, 'start');
      await page.keyboard.press('Enter');

      for (let i = 0; ; i += 1) {
        await expect(page).toHaveURL(new RegExp(`/q/${i}$`));
        // Focus lands on the new heading.
        await expect.poll(() => focusedIs(page, 'main h1')).toBe(true);
        await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', /\d/);
        await scan(page, `${locale} question ${i + 1}`);
        const before = page.url();
        if ((await page.locator('textarea.text-answer-input').count()) > 0) {
          // Free text: reach the box, type, reach Next, press Enter.
          await tabTo(page, 'textarea.text-answer-input');
          await expectFocusRing(page, `question ${i + 1} text box`);
          await page.keyboard.type('Copier les mêmes lignes à la main.');
          await tabTo(page, 'button.text-next');
          await expectFocusRing(page, `question ${i + 1} next`);
          await page.keyboard.press('Enter');
        } else {
          await tabTo(page, 'button.ck-opt');
          await expectFocusRing(page, `question ${i + 1} option`);
          await page.keyboard.press(i % 2 === 0 ? 'Enter' : 'Space');
          await tabTo(page, 'button.text-next');
          await expectFocusRing(page, `question ${i + 1} next`);
          await page.keyboard.press('Enter');
        }
        await page.waitForURL((u) => u.toString() !== before);
        if (page.url().endsWith('/done')) break;
      }

      // Done: what happens next, contact line, axe.
      await expect.poll(() => focusedIs(page, 'main h1')).toBe(true);
      await expect(page.locator('#next-title + ol li')).toHaveCount(3);
      await scan(page, `${locale} done`);

      // Return view.
      await page.goto(`/s/${token}`);
      await scan(page, `${locale} return`);

      // 200% zoom at 360 css px is a 180 css px wide viewport: no sideways scroll on the status view.
      await page.setViewportSize({ width: 180, height: 800 });
      await page.reload();
      await expectNoHScroll(page, `${locale} return at 200%`);
      await page.goto(`/s/${token}/done`);
      await expectNoHScroll(page, `${locale} done at 200%`);
    });

    test(`broken link page in ${locale}`, async ({ page, context, baseURL }) => {
      await setLocale(context, baseURL, locale);
      await page.goto(`/s/${'x'.repeat(10)}.${'y'.repeat(40)}`);
      await scan(page, `${locale} not found`);
    });

    test(`200% zoom and reduced motion in ${locale}`, async ({ page, context, baseURL }) => {
      await setLocale(context, baseURL, locale);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // 200% zoom at 360 css px is a 180 css px wide viewport.
      await page.setViewportSize({ width: 180, height: 800 });
      await page.goto(`/s/${tokenFor(INVITES[locale])}`);
      for (const path of ['', '/q/0']) {
        if (path) await page.goto(`/s/${tokenFor(INVITES[locale])}${path}`);
        await expectNoHScroll(page, `${locale} ${path || 'welcome'} at 200%`);
      }
      const motion = await page.evaluate(() => {
        const bar = document.querySelector('.progress > span');
        return bar ? Number.parseFloat(getComputedStyle(bar).transitionDuration) : 0;
      });
      expect(motion).toBeLessThan(0.05);
    });
  }
});

test.describe('login and admin pages', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) === 768, 'checked at 360 and 1280 only');

  for (const locale of LOCALES) {
    test(`login in ${locale}`, async ({ page, context, baseURL }) => {
      await setLocale(context, baseURL, locale);
      await page.goto('/login');
      await scan(page, `${locale} login`);
    });

    test(`admin pages in ${locale}`, async ({ page, context, baseURL }) => {
      await setLocale(context, baseURL, locale);
      await signInAsAuditorA(page);
      for (const path of [
        '/admin/engagements',
        '/admin/engagements/new',
        '/admin/engagements/a5555555-4555-4555-8555-555555555555/settings',
        '/admin/engagements/a5555555-4555-4555-8555-555555555555/preview',
        '/admin/engagements/a5555555-4555-4555-8555-555555555555',
        '/admin/engagements/a5555555-4555-4555-8555-555555555555/invitations',
        '/admin/engagements/a5555555-4555-4555-8555-555555555555/answers',
        '/admin/engagements/a5555555-4555-4555-8555-555555555555/report',
        '/admin/settings',
        '/admin/settings/data',
        '/admin/settings/audit',
        '/welcome',
        '/about',
        '/privacy',
        '/quiz',
      ]) {
        await page.goto(path);
        await scan(page, `${locale} ${path}`);
      }
    });
  }
});
