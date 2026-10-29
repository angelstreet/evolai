import { expect, test, type Page } from '@playwright/test';
import { dbQuery } from './helpers';

/**
 * ADR 0055: the front page's last step. Signed out, the answers stay in the browser and the one
 * action is Sign in; after sign-in the referent sends them, and they become one anonymous submitted
 * response of the referent's own team. A slug of another tenant's team is never used.
 */

const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-admin', 'one viewport is enough for this flow');
});

/** All fourteen questions answered in the browser, as the front page keeps them. */
const fillBrowser = async (page: Page) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('evolai-cockpit-v1')) return;
    localStorage.setItem(
      'evolai-cockpit-v1',
      JSON.stringify({
        answers: {
          v1_source_check: 2,
          v1_data_sharing: 1,
          v1_request_style: 1,
          v1_report_flow: 2,
          v1_repeat_data: 1,
          v1_repeat_time: 1,
          v1_repeat_task: 'Copying orders by hand',
          v2_task_frequency: 0,
          v2_task_duration: 2,
          v2_task_tool: 0,
          v2_task_data: 1,
          v1_missing_tool: 'A shared order list',
          v1_assistant_wish: 'Sorting emails',
          v1_job_family: 2,
        },
        seen: [],
        qi: 14,
        sent: false,
      }),
    );
  });
};

const clientC = async () => {
  const [row] = await dbQuery<{ id: string; team_id: string; status: string; tenant_id: string }>(
    `SELECT e.id, et.team_id, e.status, e.tenant_id FROM engagements e
       JOIN tenants t ON t.id = e.tenant_id
       JOIN engagement_teams et ON et.engagement_id = e.id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!row) throw new Error('synthetic client C is not seeded');
  return row;
};

const submittedFor = async (teamId: string, since: Date) =>
  Number(
    (
      await dbQuery<{ n: string }>(
        `SELECT count(*) AS n FROM invitations
          WHERE team_id = $1 AND status = 'submitted' AND created_at >= $2`,
        [teamId, since],
      )
    )[0]?.n ?? 0,
  );

test('signed out: the last step asks to sign in and keeps the answers', async ({ page }) => {
  await fillBrowser(page);
  await page.goto('/');
  await page.getByTestId('ck-send').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Sign in to send');
  await expect(dialog).toContainText('stay in this browser');
  await expect(page.getByTestId('ck-sign-in')).toHaveAttribute(
    'href',
    `/login?next=${encodeURIComponent('/?send=1')}`,
  );
  await page.request.post('/api/send', { data: { answers: {}, locale: 'en' } }).then((r) => {
    expect(r.status()).toBe(401);
  });
});

test('sign in, come back, send: one anonymous response in the referent team', async ({ page }) => {
  test.setTimeout(120_000);
  const c = await clientC();
  await dbQuery(`UPDATE engagements SET status = 'in_field' WHERE id = $1`, [c.id]);
  const since = new Date(Date.now() - 1000);
  try {
    await fillBrowser(page);
    await page.goto('/');
    await page.getByTestId('ck-send').click();
    await page.getByTestId('ck-sign-in').click();
    await page.fill('input[name=email]', REFERENT.email);
    await page.fill('input[name=password]', REFERENT.password);
    await page.click('button[type=submit]');
    await page.waitForURL((u) => u.pathname === '/');

    // A slug from another tenant is only a selector: refused, nothing written.
    const foreign = await page.request.post('/api/send', {
      data: { answers: { v1_source_check: 1 }, locale: 'en', slug: 'not-my-team' },
    });
    expect([403, 409]).toContain(foreign.status());
    expect(await submittedFor(c.team_id, since)).toBe(0);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Send to your team');
    await page.getByTestId('ck-send-now').click();
    await expect(dialog).toContainText('Answers sent');
    await expect(page).toHaveURL(/\/$/);
    expect(await submittedFor(c.team_id, since)).toBe(1);

    // Free text was stored anonymised, choices as values; nothing ties the row to the account.
    const [inv] = await dbQuery<{ respondent_pseudonym: string }>(
      `SELECT respondent_pseudonym FROM invitations
        WHERE team_id = $1 AND status = 'submitted' AND created_at >= $2`,
      [c.team_id, since],
    );
    expect(inv?.respondent_pseudonym).toMatch(/^p-[0-9a-f]{16}$/);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('ck-sent')).toContainText('Answers sent');
  } finally {
    await dbQuery(`UPDATE engagements SET status = $1 WHERE id = $2`, [c.status, c.id]);
  }
});
