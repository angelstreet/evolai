import { expect, test, type Browser } from '@playwright/test';
import { dbQuery } from './helpers';

/**
 * Findings from the answers (TASK-AJ A1 to A3, ADR 0058): five people answer; the staff side
 * proposes findings from the answers, approves one that rests on five people, starts the report
 * and sees catalogue actions proposed for it; then writes a finding of its own from the Answers
 * tab. Synthetic client C only.
 */
const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const MEMBERS = 5;
const TEXT = 'Copying the same rows by hand between two tools.';
const OWN = 'Synthetic finding written from the answers';

const newPage = async (browser: Browser, baseURL: string) => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await ctx.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL }]);
  return ctx.newPage();
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-admin', 'one viewport for the whole chain');
});

test('answers become findings, findings become actions', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const base = baseURL as string;
  const [eng] = await dbQuery<{ id: string; tenant_id: string; status: string }>(
    `SELECT e.id, e.tenant_id, e.status FROM engagements e JOIN tenants t ON t.id = e.tenant_id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!eng) throw new Error('synthetic client C is not seeded');
  // The referent's space creates the team address on first visit.
  const ref = await newPage(browser, base);
  await ref.goto('/login');
  await ref.fill('input[name=email]', REFERENT.email);
  await ref.fill('input[name=password]', REFERENT.password);
  await ref.click('button[type=submit]');
  await ref.waitForURL((u) => !u.pathname.startsWith('/login'));
  await ref.goto('/client');
  const address = (await ref.getByTestId('client-address').first().innerText()).trim();
  const addr = { slug: address.split('/s/')[1] as string };
  await ref.context().close();
  const since = new Date(Date.now() - 1000);
  const clean = async () => {
    await dbQuery(`DELETE FROM audit_report_versions WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM audit_reports WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM findings WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM opportunities WHERE engagement_id = $1 AND created_at >= $2`, [
      eng.id,
      since,
    ]);
  };
  await dbQuery(`UPDATE engagements SET status = 'in_field' WHERE id = $1`, [eng.id]);
  await clean();
  try {
    for (let m = 0; m < MEMBERS; m += 1) {
      const member = await newPage(browser, base);
      await member.goto(`/s/${addr.slug}`);
      await member.locator('main .MuiButton-contained').click();
      for (let i = 0; i < 20 && !member.url().endsWith('/done'); i += 1) {
        await member.waitForURL(/\/q\/\d+$/);
        const before = member.url();
        const box = member.locator('textarea.text-answer-input');
        if ((await box.count()) > 0) await box.fill(TEXT);
        // The first option of every scenario: the weaker practice ("paste as is", "use as is").
        else await member.locator('button.ck-opt').first().click();
        await member.locator('button.text-next').click();
        await member.waitForURL((u) => u.toString() !== before);
      }
      await expect(member).toHaveURL(/\/done$/);
      await member.context().close();
    }

    const own = await newPage(browser, base);
    await own.goto('/login');
    await own.fill('input[name=email]', OWNER.email);
    await own.fill('input[name=password]', OWNER.password);
    await own.click('button[type=submit]');
    await own.waitForURL((u) => !u.pathname.startsWith('/login'));

    // Propose: the free texts name copying by hand; five people chose the weaker practices.
    const report = `/admin/engagements/${eng.id}/report?tenant=${eng.tenant_id}`;
    await own.goto(report);
    await own.getByTestId('findings-propose').click();
    const typed = own.getByTestId('finding').filter({ hasText: /typed twice|saisie deux fois/ });
    await expect(typed).toBeVisible();
    await expect(typed).toHaveAttribute('data-status', 'draft');
    await expect(typed.getByTestId('finding-people')).toContainText(`${MEMBERS} people`);
    await expect(
      own
        .getByTestId('finding')
        .filter({ hasText: /client|clients/ })
        .first(),
    ).toBeVisible();

    // Approve it: it becomes an approved opportunity, and the report proposes catalogue actions.
    await typed.getByTestId('finding-approve').click();
    await expect(typed).toHaveAttribute('data-status', 'approved');
    await own.getByTestId('report-start').click();
    await expect(own.getByTestId('report-editor')).toBeVisible();
    // It is evidence for the use case it names (ADR 0064), with the playbook's steps.
    const opportunity = own
      .getByTestId('report-opportunity')
      .filter({ hasText: /Stop typing the same data twice|saisir deux fois/ });
    await expect(opportunity).toBeVisible();
    await expect(opportunity).toContainText('Why:');
    // A theme from the free texts backs the use case; the summary cites findings that say
    // something on their own (ADR 0064).
    await expect(own.locator('section[aria-labelledby=report-summary]')).not.toContainText(
      /typed twice|saisie deux fois/,
    );

    // Rejecting a draft keeps it out of the report.
    const draft = own.getByTestId('finding').and(own.locator('[data-status=draft]')).first();
    await draft.getByTestId('finding-reject').click();
    await expect(own.locator('[data-testid=finding][data-status=rejected]').first()).toBeVisible();

    // Write one from the Answers tab: two free texts and one choice as evidence.
    await own.goto(`/admin/engagements/${eng.id}/answers?tenant=${eng.tenant_id}`);
    await own.getByTestId('answers-text-pick').nth(0).click();
    await own.getByTestId('answers-text-pick').nth(1).click();
    await own.getByTestId('answers-choice-pick').first().click();
    await expect(own.getByTestId('finding-picked')).toContainText('3');
    const form = own.getByTestId('write-finding');
    await form.locator('input[name=label]').fill(OWN);
    await form
      .locator('textarea[name=statement]')
      .fill('Five people describe the same copying work.');
    await own.getByTestId('finding-save').click();
    await expect(own.getByTestId('finding-result')).toHaveText('Finding saved.');
    await own.goto(report);
    const mine = own.getByTestId('finding').filter({ hasText: OWN });
    await expect(mine).toHaveAttribute('data-status', 'approved');
    await expect(mine).toContainText('Written by you');
    await own.context().close();
  } finally {
    await clean();
    await dbQuery(`DELETE FROM invitations WHERE engagement_id = $1 AND created_at >= $2`, [
      eng.id,
      since,
    ]);
    await dbQuery(`UPDATE engagements SET status = $1 WHERE id = $2`, [eng.status, eng.id]);
  }
});
