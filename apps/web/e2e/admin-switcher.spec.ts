import { expect, test } from '@playwright/test';
import { dbQuery } from './helpers';

/**
 * TASK-AI: staff with several organisations switch in the Workbench admin header. The account
 * menu lists them; picking one keeps the admin section and the header names the new organisation.
 */
const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };

// The synthetic owner belongs to client C only; for this test they also join tenant A.
const joinSecond = async () => {
  const [row] = await dbQuery<{ user_id: string; tenant_id: string }>(
    `SELECT m.user_id, a.id AS tenant_id
       FROM memberships m JOIN tenants c ON c.id = m.tenant_id, tenants a
      WHERE m.role = 'platform_owner' AND c.slug = 'synthetic-client-c'
        AND a.slug = 'synthetic-tenant-a' LIMIT 1`,
  );
  if (!row) throw new Error('synthetic owner or tenant A missing');
  await dbQuery(
    `INSERT INTO memberships (id, tenant_id, user_id, role)
     SELECT gen_random_uuid(), $1, $2, 'platform_owner'
      WHERE NOT EXISTS (SELECT 1 FROM memberships WHERE tenant_id = $1 AND user_id = $2)`,
    [row.tenant_id, row.user_id],
  );
  return row;
};

test('the organisation switcher works in the admin header', async ({ page, context, baseURL }) => {
  const extra = await joinSecond();
  test.info().attach('membership', { body: JSON.stringify(extra) });
  // The synthetic organisations are test data: listed once "Show test data" is on.
  await context.addCookies([
    { name: 'evolai_locale', value: 'en', url: baseURL as string },
    { name: 'evolai_show_test', value: '1', url: baseURL as string },
  ]);
  await page.goto('/login');
  await page.fill('input[name=email]', OWNER.email);
  await page.fill('input[name=password]', OWNER.password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/admin\//);
  const before = (await page.getByTestId('header-organisation').innerText()).trim();
  await page.getByTestId('account-button').click();
  const items = page.getByTestId('switch-organisation');
  expect(await items.count()).toBeGreaterThan(1);
  const other = page.locator('[data-testid=switch-organisation]:not([aria-current=true])').first();
  const label = (await other.innerText()).trim();
  expect(label).not.toBe(before);
  await other.click();
  await page.waitForURL(/[?&]tenant=/);
  await expect(page).toHaveURL(/\/admin\//);
  await expect(page.getByTestId('header-organisation')).toHaveText(label);
  await expect(page.locator('.ck-menu a[aria-current=page]')).toHaveCount(1);
  // The side menu carries the organisation to the other section.
  await page.locator('.ck-menu a', { hasText: /Settings/ }).click();
  await expect(page).toHaveURL(/\/admin\/settings\?tenant=/);
  await expect(page.getByTestId('header-organisation')).toHaveText(label);
  await dbQuery(`DELETE FROM memberships WHERE tenant_id = $1 AND user_id = $2`, [
    extra.tenant_id,
    extra.user_id,
  ]);
});
