import { expect, test, type Browser, type Page } from '@playwright/test';
import { dbQuery } from './helpers';

/**
 * The visit, the referent's review and the measure (TASK-AJ A6, A8, A9, ADR 0059): the auditor
 * writes a visit note (anonymised on save), writes a finding from it alone, accepts an action and
 * sets its measure, marks the report ready for review; the referent disputes the finding; the
 * report cannot be published until the auditor answers the dispute. Synthetic client C only.
 */
const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const LABEL = 'Orders typed twice by hand between two tools';

const signedIn = async (browser: Browser, baseURL: string, who: typeof OWNER): Promise<Page> => {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await ctx.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL }]);
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('input[name=email]', who.email);
  await page.fill('input[name=password]', who.password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-admin', 'one viewport for the whole chain');
});

test('a visit note becomes a finding; a dispute holds the report until answered', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const base = baseURL as string;
  const [eng] = await dbQuery<{ id: string; tenant_id: string }>(
    `SELECT e.id, e.tenant_id FROM engagements e JOIN tenants t ON t.id = e.tenant_id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!eng) throw new Error('synthetic client C is not seeded');
  const since = new Date(Date.now() - 1000);
  const clean = async () => {
    await dbQuery(`DELETE FROM audit_report_versions WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM audit_reports WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM findings WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM visit_notes WHERE engagement_id = $1`, [eng.id]);
    await dbQuery(`DELETE FROM opportunities WHERE engagement_id = $1 AND created_at >= $2`, [
      eng.id,
      since,
    ]);
  };
  await clean();
  try {
    const own = await signedIn(browser, base, OWNER);

    // A6: a note from the visit, anonymised when saved.
    await own.goto(`/admin/engagements/${eng.id}/visit?tenant=${eng.tenant_id}`);
    await expect(own.getByTestId('mission-tab-visit')).toHaveAttribute('aria-current', 'page');
    await own
      .getByTestId('visit-form')
      .locator('textarea[name=body]')
      .fill('Two people retype each order by hand. Ask synthetic.contact@synthetic.invalid.');
    await own.getByTestId('visit-add').click();
    await expect(own.getByTestId('visit-result')).toHaveText('Note saved.');
    const note = own.getByTestId('visit-note').first();
    await expect(note).toContainText('retype each order by hand');
    await expect(note).not.toContainText('synthetic.contact@synthetic.invalid');

    // A finding resting on that note alone.
    await own.getByTestId('visit-pick').first().click();
    await expect(own.getByTestId('visit-picked')).toContainText('1 note ticked');
    const form = own.getByTestId('note-finding');
    await form.locator('input[name=label]').fill(LABEL);
    await form
      .locator('textarea[name=statement]')
      .fill('Copying the same rows by hand between two tools, seen in the interviews.');
    await own.getByTestId('finding-save').click();
    await expect(own.getByTestId('finding-result')).toHaveText('Finding saved.');

    const report = `/admin/engagements/${eng.id}/report?tenant=${eng.tenant_id}`;
    await own.goto(report);
    const finding = own.getByTestId('finding').filter({ hasText: LABEL });
    await expect(finding).toHaveAttribute('data-status', 'approved');
    await expect(finding.getByTestId('finding-notes')).toHaveText('1 visit note');
    await expect(finding.getByTestId('finding-staff-only')).toHaveCount(0);

    // Seen on the visit, so it gets actions; A9: the accepted action gets its measure.
    await own.getByTestId('report-start').click();
    await expect(own.getByTestId('report-editor')).toBeVisible();
    await expect(own.getByTestId('report-opportunity').filter({ hasText: LABEL })).toBeVisible();
    const step = own.getByTestId('report-step').first();
    await step.getByRole('button', { name: 'Accept' }).click();
    const accepted = own.locator('[data-testid=report-step][data-status=accepted]').first();
    await expect(accepted).toBeVisible();
    await accepted.getByTestId('step-measure-open').click();
    const dialog = own.getByRole('dialog');
    await dialog.locator('input[name=baselineValue]').fill('40');
    await dialog.locator('input[name=baselineUnit]').fill('minutes per order');
    await dialog.locator('input[name=baselineSource]').fill('time sheet');
    await dialog.locator('input[name=followUpOn]').fill('2027-01-30');
    await own.getByTestId('measure-save').click();
    await expect(accepted.getByTestId('step-measure')).toHaveText(
      'Baseline: 40 minutes per order (time sheet) · Follow-up: 2027-01-30',
    );
    await own.getByTestId('report-to-review').click();
    await expect(own.getByTestId('report-state')).toHaveText('In review');

    // A8: the referent sees labels and counts only, and disputes it.
    const ref = await signedIn(browser, base, REFERENT);
    await ref.goto('/client/report');
    const item = ref.getByTestId('review-finding').filter({ hasText: LABEL });
    await expect(item).toContainText('seen on the visit');
    await expect(item).not.toContainText('seen in the interviews');
    await item.locator('input[name=comment]').fill('Only the night team does this.');
    await item.getByTestId('review-dispute').click();
    await expect(item.getByTestId('review-result')).toHaveText(
      'Thank you. The EvolAI team will look at it.',
    );
    await ref.context().close();

    // The dispute holds publishing until the auditor answers it.
    await own.reload();
    const disputed = own.getByTestId('finding').filter({ hasText: LABEL });
    await expect(disputed).toHaveAttribute('data-open-dispute', 'true');
    await expect(disputed.getByTestId('finding-review')).toContainText(
      'Only the night team does this.',
    );
    await own.getByTestId('report-publish').click();
    await own.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(own.getByTestId('report-workflow')).toContainText(
      'The client’s referent disputed a finding',
    );
    await expect(own.getByTestId('report-state')).toHaveText('In review');
    await disputed.getByTestId('finding-kept').click();
    await expect(disputed.getByTestId('finding-review')).toContainText('kept');
    await expect(disputed).not.toHaveAttribute('data-open-dispute', 'true');

    // ADR 0060: reword the finding; the action made from it says the same.
    await disputed.getByTestId('finding-edit').click();
    const edit = own.getByRole('dialog');
    await edit.locator('input[name=label]').fill(`${LABEL}, night team`);
    await own.getByTestId('finding-edit-save').click();
    const renamed = own.getByTestId('finding').filter({ hasText: `${LABEL}, night team` });
    await expect(renamed.getByTestId('finding-edit-result')).toHaveText(
      'Saved. The action made from it says the same now.',
    );
    await expect(
      own.getByTestId('report-opportunity').filter({ hasText: `${LABEL}, night team` }),
    ).toBeVisible();
    await own.context().close();
  } finally {
    await clean();
  }
});
