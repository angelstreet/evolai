import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { dbQuery } from './helpers';

/**
 * The whole audit as a client lives it, in one run (owner request 2026-10-27): a visitor reads the
 * front page; the team referent signs in, opens their space and shares the team address; five team
 * members answer; the referent sends their own answers; the auditor writes and publishes the report;
 * the referent reads it in their space and on the front page. Synthetic client C only. A screenshot is
 * taken at every step (`WALK_SHOTS=<dir>`), so the journey can be looked at as a whole.
 */
const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const MEMBERS = 5;
const OWN_STEP = 'Synthetic walkthrough step';

const SHOTS = process.env['WALK_SHOTS'];
let shot = 0;
const snap = async (page: Page, name: string) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  shot += 1;
  await page.screenshot({
    path: join(SHOTS, `${String(shot).padStart(2, '0')}-${name}.png`),
    fullPage: true,
  });
};

const signIn = async (page: Page, who: { email: string; password: string }) => {
  await page.goto('/login');
  await page.fill('input[name=email]', who.email);
  await page.fill('input[name=password]', who.password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
};

const newPage = async (browser: Browser, baseURL: string) => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await ctx.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL }]);
  return ctx.newPage();
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-admin', 'one viewport for the whole journey');
});

test('the whole audit, as the client lives it', async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  const base = baseURL as string;
  const [eng] = await dbQuery<{ id: string; tenant_id: string; status: string }>(
    `SELECT e.id, e.tenant_id, e.status FROM engagements e JOIN tenants t ON t.id = e.tenant_id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!eng) throw new Error('synthetic client C is not seeded');
  const since = new Date(Date.now() - 1000);
  await dbQuery(`UPDATE engagements SET status = 'in_field' WHERE id = $1`, [eng.id]);
  await dbQuery(`DELETE FROM audit_report_versions WHERE engagement_id = $1`, [eng.id]);
  await dbQuery(`DELETE FROM audit_reports WHERE engagement_id = $1`, [eng.id]);
  try {
    // 1. A visitor reads the front page.
    const visitor = await newPage(browser, base);
    await visitor.goto('/');
    await expect(visitor.getByTestId('cockpit')).toBeVisible();
    await expect(visitor.getByTestId('ck-audit')).toBeVisible();
    await visitor.waitForTimeout(1200);
    await snap(visitor, 'visitor-front-page');
    await visitor.context().close();

    // 2. The referent signs in: the front page names their team and leads to their space.
    const ref = await newPage(browser, base);
    await signIn(ref, REFERENT);
    await expect(ref).toHaveURL(/\/$/);
    await expect(ref.getByTestId('ck-team-line')).toBeVisible();
    await snap(ref, 'referent-front-page');
    await ref.getByTestId('ck-space-link').click();
    await ref.waitForURL(/\/client$/);
    await expect(ref.getByTestId('client-own-state')).toBeVisible();
    await snap(ref, 'referent-space');
    const address = (await ref.getByTestId('client-address').first().innerText()).trim();
    const slug = address.split('/s/')[1] as string;
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);

    // 3. Five team members open the team address in their own browsers and answer.
    for (let m = 0; m < MEMBERS; m += 1) {
      const member = await newPage(browser, base);
      await member.goto(`/s/${slug}`);
      await member.waitForURL(/\/s\/[^/]+$/);
      if (m === 0) await snap(member, 'member-welcome');
      await member.locator('main .MuiButton-contained').click();
      for (let i = 0; i < 20 && !member.url().endsWith('/done'); i += 1) {
        await member.waitForURL(/\/q\/\d+$/);
        if (m === 0 && i === 1) await snap(member, 'member-question');
        const before = member.url();
        // Real answers, not "I don't know", so the report has a readiness score.
        const box = member.locator('textarea.text-answer-input');
        if ((await box.count()) > 0) await box.fill('Copying the same rows by hand.');
        else
          await member
            .locator('button.ck-opt')
            .nth((m + i) % 2 === 0 ? 1 : 2)
            .click();
        await member.locator('button.text-next').click();
        await member.waitForURL((u) => u.toString() !== before);
      }
      await expect(member).toHaveURL(/\/done$/);
      if (m === 0) await snap(member, 'member-thanks');
      await member.context().close();
    }
    const [{ n } = { n: '0' }] = await dbQuery<{ n: string }>(
      `SELECT count(*) AS n FROM invitations WHERE engagement_id = $1 AND status = 'submitted'
          AND created_at >= $2`,
      [eng.id, since],
    );
    expect(Number(n)).toBe(MEMBERS);

    // 4. The referent sees the count in their space and the results page.
    await ref.goto('/client');
    await expect(ref.getByTestId('client-team-answered').first()).toBeVisible();
    await snap(ref, 'referent-space-answered');
    await ref.goto('/client/results');
    await snap(ref, 'referent-results');

    // 5. The referent answers on the front page and sends their own answers.
    await ref.goto('/?survey=1');
    await expect(ref.getByTestId('ck-try-question')).toBeVisible();
    for (let i = 0; i < 20; i += 1) {
      if ((await ref.getByTestId('ck-try-done').count()) > 0) break;
      const opts = ref.getByTestId('ck-option');
      if ((await opts.count()) > 0) await opts.nth(1).click();
      else await ref.locator('.ck-try textarea').first().fill('Copying the same rows by hand.');
      await ref.getByTestId('ck-next').click();
    }
    await ref.getByTestId('ck-send').click();
    await ref.getByTestId('ck-send-now').click();
    await expect(ref.getByRole('dialog')).toContainText('Answers sent');
    await snap(ref, 'referent-sent');
    await ref.getByRole('button', { name: 'Close' }).click();
    await ref.goto('/client');
    await expect(ref.getByTestId('client-own-state')).toContainText('were sent');

    // 6. The auditor reads the answers, writes a step and publishes the report.
    const own = await newPage(browser, base);
    await signIn(own, OWNER);
    await own.goto(`/admin/engagements/${eng.id}?tenant=${eng.tenant_id}`);
    await snap(own, 'auditor-mission');
    await own.goto(`/admin/engagements/${eng.id}/answers?tenant=${eng.tenant_id}`);
    await snap(own, 'auditor-answers');
    await own.goto(`/admin/engagements/${eng.id}/report?tenant=${eng.tenant_id}`);
    await own.getByTestId('report-start').click();
    await expect(own.getByTestId('report-editor')).toBeVisible();
    await own.getByTestId('report-draft-summary').click();
    const step = own.getByTestId('report-add-own');
    await step.locator('input[name=title]').fill(OWN_STEP);
    await step.locator('input[name=owner]').fill('Team lead');
    await own.getByTestId('report-add-step').click();
    await expect(own.getByTestId('report-opportunity')).toContainText(OWN_STEP);
    await own.getByTestId('report-to-review').click();
    await own.getByTestId('report-publish').click();
    await own.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(own.getByTestId('report-state')).toHaveText('Published');
    await snap(own, 'auditor-published');
    await own.context().close();

    // 7. The referent reads the report in their space and on the front page.
    await ref.goto('/client/report');
    await expect(ref.getByTestId('report-view')).toContainText(OWN_STEP);
    await snap(ref, 'referent-report');
    // Results lists what was approved (here the auditor's own step), or points to the report.
    await ref.goto('/client/results');
    await expect(
      ref.getByTestId('client-results-report').or(ref.getByText(OWN_STEP).first()),
    ).toBeVisible();
    await snap(ref, 'referent-results-after');
    await ref.goto('/');
    await ref.locator('.ck-menu button[data-k=report]').click();
    await expect(ref.getByTestId('ck-own-report')).toBeVisible();
    await snap(ref, 'referent-front-report');
    await ref.context().close();
  } finally {
    await dbQuery(`DELETE FROM audit_report_versions WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM audit_reports WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM opportunities WHERE engagement_id = $1 AND title = $2`, [
      eng.id,
      OWN_STEP,
    ]);
    await dbQuery(`DELETE FROM invitations WHERE engagement_id = $1 AND created_at >= $2`, [
      eng.id,
      since,
    ]);
    await dbQuery(`DELETE FROM account_progress`);
    await dbQuery(`UPDATE engagements SET status = $1 WHERE id = $2`, [eng.status, eng.id]);
  }
});
