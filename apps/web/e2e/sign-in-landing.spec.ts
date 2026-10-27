import { expect, test } from '@playwright/test';

/**
 * TASK-AI L5: a referent's sign-in lands on the front page, which names their team and links to
 * their space; the space says whether their own answers were sent.
 */
const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-admin', 'one viewport is enough for this flow');
});

test('referent sign-in lands on the front page, with their team and a way to their space', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL as string }]);
  await page.goto('/login');
  await page.fill('input[name=email]', REFERENT.email);
  await page.fill('input[name=password]', REFERENT.password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.getByTestId('ck-team-line')).toContainText('Your team:');
  await page.getByTestId('ck-space-link').click();
  await page.waitForURL(/\/client$/);
  await expect(page.getByTestId('client-own-state')).toContainText(/answers/);
  await expect(page.getByTestId('client-tab-home')).toHaveAttribute('aria-current', 'page');
});

test('signed out, the front page names no team', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('ck-team-line')).toHaveCount(0);
  await expect(page.getByTestId('ck-space-link')).toHaveCount(0);
});
