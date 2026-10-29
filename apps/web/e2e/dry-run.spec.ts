import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { dbQuery } from './helpers';

/**
 * Dry run of one whole audit (owner request 2026-10-29): eight people answer with varied answers,
 * the auditor proposes and approves findings, writes a visit note and a finding from it, builds and
 * reviews the report, the referent confirms, the auditor publishes, and the client's report and PDF
 * are saved for a human read. Not part of the regular run: `DRY_RUN_OUT=<dir>` turns it on.
 * Synthetic client C only; cleaned up afterwards.
 */
const OUT = process.env['DRY_RUN_OUT'] ?? '';
const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const PEOPLE = 8;
const TEXTS = [
  'Copying orders from email into the spreadsheet by hand, every morning.',
  'Typing the same customer details twice, in the CRM and in the invoice tool.',
  'Writing the weekly report by hand from three exports.',
  'Searching old emails for the latest price list.',
  'Checking delivery notes one by one against the orders.',
];

const page = async (browser: Browser, baseURL: string, width = 1280): Promise<Page> => {
  const ctx = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
  await ctx.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL }]);
  return ctx.newPage();
};

const signIn = async (p: Page, who: typeof OWNER) => {
  await p.goto('/login');
  await p.fill('input[name=email]', who.email);
  await p.fill('input[name=password]', who.password);
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
};

test.beforeEach(({}, testInfo) => {
  test.skip(!OUT || testInfo.project.name !== 'desktop-admin', 'set DRY_RUN_OUT to run');
});

test('dry run: one whole audit, read as the client', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const shot = (p: Page, name: string) =>
    p.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  const base = baseURL as string;
  const [eng] = await dbQuery<{ id: string; tenant_id: string; status: string }>(
    `SELECT e.id, e.tenant_id, e.status FROM engagements e JOIN tenants t ON t.id = e.tenant_id
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
  await dbQuery(`UPDATE engagements SET status = 'in_field' WHERE id = $1`, [eng.id]);
  await clean();
  try {
    const ref = await page(browser, base);
    await signIn(ref, REFERENT);
    await ref.goto('/client');
    const address = (await ref.getByTestId('client-address').first().innerText()).trim();
    const slug = address.split('/s/')[1] as string;

    // Eight people, varied answers: person p picks option (p + q) mod n, writes one of five texts.
    for (let m = 0; m < PEOPLE; m += 1) {
      const member = await page(browser, base, 390);
      await member.goto(`/s/${slug}`);
      await member.locator('main .MuiButton-contained').click();
      for (let q = 0; q < 20 && !member.url().endsWith('/done'); q += 1) {
        await member.waitForURL(/\/q\/\d+$/);
        const before = member.url();
        const box = member.locator('textarea.text-answer-input');
        if ((await box.count()) > 0) await box.fill(TEXTS[(m + q) % TEXTS.length] as string);
        else {
          const opts = member.locator('button.ck-opt');
          const n = await opts.count();
          // Mostly the first options, sometimes "unsure" at the end: a believable spread.
          await opts.nth((m * 3 + q) % Math.max(1, n - (m % 3 === 0 ? 0 : 1))).click();
        }
        if (m === 0 && q === 7) await shot(member, '01-survey-question-phone');
        await member.locator('button.text-next').click();
        await member.waitForURL((u) => u.toString() !== before);
      }
      await expect(member).toHaveURL(/\/done$/);
      await member.context().close();
    }

    const own = await page(browser, base);
    await signIn(own, OWNER);
    const q = `?tenant=${eng.tenant_id}`;
    const mission = `/admin/engagements/${eng.id}`;

    // Findings: propose, approve every proposal.
    await own.goto(`${mission}/report${q}`);
    await own.getByTestId('findings-propose').click();
    await expect(own.getByTestId('finding').first()).toBeVisible();
    const drafts = own.locator('[data-testid=finding][data-status=draft]');
    for (let left = await drafts.count(); left > 0; left -= 1) {
      await drafts.first().getByTestId('finding-approve').click();
      await expect(drafts).toHaveCount(left - 1);
    }
    await shot(own, '02-findings');

    // The brief with "Ask on site".
    await own.goto(`${mission}${q}`);
    await shot(own, '03-brief');

    // The visit: two notes, one finding from them.
    await own.goto(`${mission}/visit${q}`);
    const notes = [
      'Interview with two planners: orders arrive by email and are retyped into the spreadsheet, about 20 minutes each morning.',
      'Observed the invoicing desk: customer details are typed into the CRM and again into the invoice tool.',
    ];
    for (const body of notes) {
      await own.getByTestId('visit-form').locator('textarea[name=body]').fill(body);
      await own.getByTestId('visit-add').click();
      await expect(own.getByTestId('visit-result')).toHaveText('Note saved.');
    }
    await expect(own.getByTestId('visit-note')).toHaveCount(2);
    await own.getByTestId('visit-pick').nth(0).click();
    await own.getByTestId('visit-pick').nth(1).click();
    await expect(own.getByTestId('visit-picked')).toContainText('2 notes ticked');
    const form = own.getByTestId('note-finding');
    await form.locator('input[name=label]').fill('Customer and order data is typed twice');
    await form
      .locator('textarea[name=statement]')
      .fill(
        'Planners and the invoicing desk retype the same data between email, CRM and invoicing.',
      );
    await own.getByTestId('finding-save').click();
    await expect(own.getByTestId('finding-result')).toHaveText('Finding saved.');
    await shot(own, '04-visit');

    // The report: start, accept up to four actions, a measure, summary, plan, review.
    await own.goto(`${mission}/report${q}`);
    await own.getByTestId('report-start').click();
    await expect(own.getByTestId('report-editor')).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      const step = own.locator('[data-testid=report-step][data-status=suggested]').first();
      if ((await step.count()) === 0) break;
      await step.getByRole('button', { name: 'Accept' }).click();
      await expect(own.locator('[data-testid=report-step][data-status=accepted]')).toHaveCount(
        i + 1,
      );
    }
    const accepted = own.locator('[data-testid=report-step][data-status=accepted]').first();
    await accepted.getByTestId('step-measure-open').click();
    const dialog = own.getByRole('dialog');
    await dialog.locator('input[name=baselineValue]').fill('20');
    await dialog.locator('input[name=baselineUnit]').fill('minutes per morning');
    await dialog.locator('input[name=baselineSource]').fill('planners, visit');
    await dialog.locator('input[name=followUpOn]').fill('2027-02-01');
    await own.getByTestId('measure-save').click();
    await expect(accepted.getByTestId('step-measure')).toBeVisible();
    await own.getByTestId('report-draft-summary').click();
    await expect(own.getByTestId('report-summary')).not.toHaveValue('');
    await own.getByTestId('report-build-plan').click();
    await expect(own.getByTestId('report-plan-row').first()).toBeVisible();
    await own.getByTestId('report-to-review').click();
    await expect(own.getByTestId('report-state')).toHaveText('In review');
    await shot(own, '05-editor');

    // The referent confirms every finding.
    await ref.goto('/client/report');
    await shot(ref, '06-referent-review');
    const items = ref.getByTestId('review-finding');
    for (let i = 0; i < (await items.count()); i += 1) {
      await items.nth(i).getByTestId('review-confirm').click();
      await expect(items.nth(i).getByTestId('review-result')).toBeVisible();
    }

    // Publish, then read it as the client.
    await own.goto(`${mission}/report${q}`);
    await own.getByTestId('report-publish').click();
    await own.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(own.getByTestId('report-state')).toHaveText('Published');
    await ref.goto('/client/report');
    await expect(ref.getByTestId('report-view')).toBeVisible();
    await shot(ref, '07-client-report');
    writeFileSync(
      join(OUT, '07-client-report.txt'),
      await ref.getByTestId('report-view').innerText(),
    );
    const pdf = await ref.request.get('/client/report/pdf');
    expect(pdf.status()).toBe(200);
    writeFileSync(join(OUT, '08-client-report.pdf'), await pdf.body());
    await own.context().close();
    await ref.context().close();
  } finally {
    await clean();
    await dbQuery(`DELETE FROM invitations WHERE engagement_id = $1 AND created_at >= $2`, [
      eng.id,
      since,
    ]);
    await dbQuery(`UPDATE engagements SET status = $1 WHERE id = $2`, [eng.status, eng.id]);
  }
});
