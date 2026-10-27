import { expect, test } from '@playwright/test';

/**
 * TASK-AI L6: a visitor asks for an audit with one email field; the address must be valid
 * (shape and a domain that takes mail). Nothing is sent for an invalid one.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-admin', 'one viewport is enough for this flow');
});

test('the front page asks for a valid email before sending a request', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL as string }]);
  await page.goto('/');
  await page.getByTestId('ck-audit').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Ask for an audit');
  const field = page.getByTestId('ck-audit-email');
  await field.fill('not-an-email');
  await page.getByTestId('ck-audit-send').click();
  await expect(dialog).toContainText('Enter a full email address');
  await field.fill('someone@synthetic.invalid');
  await page.getByTestId('ck-audit-send').click();
  await expect(dialog).toContainText('This domain does not take email');
});

test('the request route refuses what is not a valid email', async ({ request }) => {
  for (const email of ['', 'ana', 'ana@x', 'ana@synthetic.invalid']) {
    const res = await request.post('/api/audit-request', { data: { email, locale: 'en' } });
    expect(res.status(), email).toBe(400);
  }
});
