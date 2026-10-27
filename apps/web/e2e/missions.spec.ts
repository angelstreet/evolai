import { expect, test, type Page } from '@playwright/test';
import { dbQuery, signInAsAuditorA } from './helpers';

/**
 * TASK-AD2 (ADR 0049): staff land on Missions with one primary action; a mission has five tabs;
 * the removed screens redirect; the top navigation fits at 360, 768 and 1280; the Answers tab and
 * its CSV are for staff only, never for a referent. Synthetic data only.
 */
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const ENG_A = 'a5555555-4555-4555-8555-555555555555';
const MISSION = `/admin/engagements/${ENG_A}`;
const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};

const noHorizontalScroll = async (page: Page, label: string) => {
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(scroll, `${label}: page scrolls sideways`).toBeLessThanOrEqual(width);
};

test('sign-in lands on Missions with one primary action and the mission list', async ({ page }) => {
  await signInAsAuditorA(page);
  await expect(page).toHaveURL(/\/admin\/engagements$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Missions$/);
  await expect(page.locator('#main .MuiButton-contained:visible')).toHaveCount(1);
  await expect(page.locator('[data-testid=mission-link]:visible').first()).toBeVisible();
  // One next step per mission, never a second filled button.
  const rows = page.locator(
    '[data-testid=mission-row]:visible, [data-testid=mission-card]:visible',
  );
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(page.getByText(/Portfolio|Portefeuille|Synerg/)).toHaveCount(0);
  await noHorizontalScroll(page, 'missions');
});

test('the side menu is Missions, Settings and the front page, and it fits', async ({ page }) => {
  await signInAsAuditorA(page);
  const nav = page.locator('.ck-menu').first();
  await expect(nav.getByRole('link')).toHaveCount(3);
  await expect(nav.getByRole('link', { name: 'Missions' })).toHaveAttribute('aria-current', 'page');
  const [scroll, client] = await nav.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
  await noHorizontalScroll(page, 'nav');
});

test('a mission has five tabs with one header, and each tab opens', async ({ page }) => {
  await signInAsAuditorA(page);
  await page.goto(`${MISSION}?tenant=${TENANT_A}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByTestId('mission-overview')).toBeVisible();
  for (const [tab, path] of [
    ['invitations', '/invitations'],
    ['answers', '/answers'],
    ['report', '/report'],
    ['settings', '/settings'],
    ['overview', ''],
  ] as const) {
    await page.getByTestId(`mission-tab-${tab}`).click();
    await page.waitForURL(new RegExp(`${MISSION}${path}\\?`));
    await expect(page.getByTestId(`mission-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await noHorizontalScroll(page, tab);
  }
  // Never two filled buttons on one tab.
  await expect(page.locator('#main .MuiButton-contained:visible')).toHaveCount(
    (await page.getByTestId('mission-next-step').count()) > 0 ? 1 : 0,
  );
});

test('the removed screens redirect to where the same thing lives now', async ({ page }) => {
  await signInAsAuditorA(page);
  for (const [from, to] of [
    ['/board', /\/admin\/engagements(\?|$)/],
    ['/intake', /\/admin\/engagements(\?|$)/],
    ['/admin/synergies', /\/admin\/engagements(\?|$)/],
    ['/admin/redaction', /\/admin\/engagements(\?|$)/],
    ['/admin/reports', /\/admin\/engagements(\?|$)/],
    ['/admin/teams', /\/admin\/settings(\?|$)/],
    ['/admin/data', /\/admin\/settings\/data(\?|$)/],
    ['/admin/audit', /\/admin\/settings\/audit(\?|$)/],
    [
      `/admin/invitations?tenant=${TENANT_A}&engagement=${ENG_A}`,
      new RegExp(`${MISSION}/invitations`),
    ],
    [`/admin/reports/${ENG_A}?tenant=${TENANT_A}`, new RegExp(`${MISSION}/report`)],
    [`${MISSION}/analyses?tenant=${TENANT_A}`, new RegExp(`${MISSION}/report`)],
    [`${MISSION}/opportunities?tenant=${TENANT_A}`, new RegExp(`${MISSION}/report`)],
  ] as const) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
  }
});

test('the answers CSV follows the five-answer rule and carries no name column', async ({
  page,
}) => {
  await signInAsAuditorA(page);
  const [row] = await dbQuery<{ n: number }>(
    `SELECT count(*)::int AS n FROM submissions WHERE engagement_id = $1 AND status = 'submitted'`,
    [ENG_A],
  );
  const res = await page.request.get(`${MISSION}/answers/export?tenant=${TENANT_A}`);
  if ((row?.n ?? 0) >= 5) {
    expect(res.status()).toBe(200);
    const header = (await res.text()).replace(/^﻿/, '').split(/\r?\n/)[0];
    expect(header).toBe('respondent_pseudonym,question_code,question,answer,comment,answered_at');
  } else {
    expect(res.status()).toBe(409);
    expect(await res.text()).toMatch(/5/);
  }
});

test('a referent never reaches Answers, its CSV or the mission pages', async ({ page }) => {
  await page.goto('/login?next=%2Fclient');
  await page.fill('input[name=email]', REFERENT.email);
  await page.fill('input[name=password]', REFERENT.password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/client/);
  for (const path of [`${MISSION}/answers?tenant=${TENANT_A}`, `${MISSION}?tenant=${TENANT_A}`]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/client/);
    await expect(page.getByTestId('answers-tab')).toHaveCount(0);
  }
  const csv = await page.request.get(`${MISSION}/answers/export?tenant=${TENANT_A}`, {
    maxRedirects: 0,
  });
  expect(csv.status()).toBe(403);
});
