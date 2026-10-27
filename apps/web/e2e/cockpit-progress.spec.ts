import { expect, test, type Page } from '@playwright/test';
import { dbQuery } from './helpers';

/**
 * ADR 0056: signed in, Your path follows the account. A lesson done in one browser shows as done in
 * a fresh one after sign-in; signed out, the route refuses and the page keeps its browser state.
 */

const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-admin', 'one viewport is enough for this flow');
});

const signIn = async (page: Page) => {
  await page.goto('/login');
  await page.fill('input[name=email]', REFERENT.email);
  await page.fill('input[name=password]', REFERENT.password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
};

test('signed out: progress is not read or written', async ({ request }) => {
  expect((await request.get('/api/progress')).status()).toBe(401);
  expect((await request.put('/api/progress', { data: { lessons: [0] } })).status()).toBe(401);
});

test('a lesson done on one device is done on the next', async ({ browser }) => {
  test.setTimeout(120_000);
  // Test database only: start this account from an empty path.
  await dbQuery(`DELETE FROM account_progress`);

  const first = await browser.newContext();
  const a = await first.newPage();
  await signIn(a);
  await a.goto('/');
  await a.locator('.ck-menu button[data-k=learn]').click();
  const saved = a.waitForResponse(
    (r) => r.url().endsWith('/api/progress') && r.request().method() === 'PUT',
  );
  await a.locator('.ck-foot-row .MuiButton-outlined').click();
  expect((await saved).status()).toBe(200);
  await first.close();

  const second = await browser.newContext();
  const b = await second.newPage();
  await signIn(b);
  await b.goto('/');
  await expect(b.getByTestId('ck-path-step').first()).toContainText(/Done|Fait/);

  // Merge never undoes: an empty save keeps lesson 1.
  const kept = await b.request.put('/api/progress', { data: { lessons: [] } });
  expect((await kept.json()).progress.lessons).toContain(0);
  await second.close();
});
