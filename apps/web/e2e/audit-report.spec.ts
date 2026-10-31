import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';

/**
 * TASK-V (ADR 0041): the auditor builds the audit report on synthetic data, previews it and
 * publishes it; the team referent sees nothing before, the published report after, and nothing
 * again once it is unpublished. Phone (360) and desktop (1280), French and English.
 *
 * Fixture: a second team of the synthetic client C ("Synthetic report team", so the TASK-S
 * counts of the referent’s own team do not move) with six completed surveys, two approved
 * findings resting on their answers, and one approved opportunity. All obviously fake.
 */

const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const PEOPLE = 6;
const OPP_TITLE = 'Automatiser le rapport hebdomadaire';
const OWN_STEP = 'Synthetic own step';
const THEMES = [
  { axis: 'practice', label: 'Rapport hebdomadaire saisi à la main' },
  { axis: 'literacy', label: 'Vérification des réponses de l’IA' },
];
const COPY = {
  fr: { inReview: 'En relecture', published: 'Publié', title: 'Rapport' },
  en: { inReview: 'In review', published: 'Published', title: 'Report' },
} as const;

const databaseUrl = (): string =>
  (
    JSON.parse(readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8')) as {
      databaseUrl: string;
    }
  ).databaseUrl;

const query = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
};

interface Fixture {
  tenant: string;
  engagement: string;
}

/**
 * Remove the report and every fixture row, so the specs that run after this one (TASK-S counts and
 * next steps on the referent home) see client C exactly as seeded.
 */
const cleanupFixture = async (): Promise<void> => {
  const [eng] = await query<{ id: string; tenant_id: string }>(
    `SELECT e.id, e.tenant_id FROM engagements e JOIN tenants t ON t.id = e.tenant_id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!eng) return;
  await query('DELETE FROM audit_report_versions WHERE engagement_id = $1', [eng.id]);
  await query('DELETE FROM audit_reports WHERE engagement_id = $1', [eng.id]);
  await query('DELETE FROM findings WHERE engagement_id = $1', [eng.id]);
  // Use cases (ADR 0064) are made again by each report.
  await query(
    'DELETE FROM opportunities WHERE engagement_id = $1 AND (title = ANY($2) OR use_case_id IS NOT NULL)',
    [eng.id, [OPP_TITLE, OWN_STEP]],
  );
  await query(
    `DELETE FROM invitations WHERE engagement_id = $1 AND respondent_pseudonym LIKE 'rpt-%'`,
    [eng.id],
  );
  await query(`DELETE FROM teams WHERE tenant_id = $1 AND name = 'Synthetic report team'`, [
    eng.tenant_id,
  ]);
};

test.afterAll(cleanupFixture);

/** Remove any report and fixture rows from an earlier run, then insert fresh ones. */
const resetFixture = async (withOpportunity = true): Promise<Fixture> => {
  const [eng] = await query<{ id: string; tenant_id: string; qv: string }>(
    `SELECT e.id, e.tenant_id, e.questionnaire_version_id AS qv
       FROM engagements e JOIN tenants t ON t.id = e.tenant_id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!eng) throw new Error('synthetic client C is not seeded');
  const [owner] = await query<{ id: string }>(
    `SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id
      WHERE m.tenant_id = $1 AND m.role = 'platform_owner' LIMIT 1`,
    [eng.tenant_id],
  );
  const ownerId = owner?.id as string;
  await query('DELETE FROM audit_report_versions WHERE engagement_id = $1', [eng.id]);
  await query('DELETE FROM audit_reports WHERE engagement_id = $1', [eng.id]);
  await query('DELETE FROM findings WHERE engagement_id = $1', [eng.id]);
  await query('DELETE FROM opportunities WHERE engagement_id = $1 AND title = ANY($2)', [
    eng.id,
    [OPP_TITLE, OWN_STEP],
  ]);
  await query(
    `DELETE FROM invitations WHERE engagement_id = $1 AND respondent_pseudonym LIKE 'rpt-%'`,
    [eng.id],
  );
  const [base] = await query<{ organisation_id: string; department_id: string }>(
    'SELECT organisation_id, department_id FROM teams WHERE tenant_id = $1 LIMIT 1',
    [eng.tenant_id],
  );
  let [team] = await query<{ id: string }>(
    `SELECT id FROM teams WHERE tenant_id = $1 AND name = 'Synthetic report team'`,
    [eng.tenant_id],
  );
  if (!team) {
    [team] = await query<{ id: string }>(
      `INSERT INTO teams (id, tenant_id, organisation_id, department_id, name, expected_headcount)
       VALUES (gen_random_uuid(), $1, $2, $3, 'Synthetic report team', 8) RETURNING id`,
      [eng.tenant_id, base?.organisation_id, base?.department_id],
    );
  }
  const teamId = team?.id as string;
  await query(
    `INSERT INTO engagement_teams (engagement_id, team_id, tenant_id) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [eng.id, teamId, eng.tenant_id],
  );
  const items = await query<{ id: string; options_json: { value: string }[] }>(
    `SELECT qi.id, qi.options_json FROM question_items qi
       JOIN questionnaire_versions qv ON qi.id = ANY(qv.item_ids) WHERE qv.id = $1`,
    [eng.qv],
  );
  const evidence: string[] = [];
  for (let i = 0; i < PEOPLE; i += 1) {
    const [inv] = await query<{ id: string }>(
      `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status,
                                token_reference, token_signature, opens_at, expires_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'submitted', $5, 'synthetic-signature',
               now() - interval '2 days', now() + interval '20 days') RETURNING id`,
      [eng.tenant_id, eng.id, teamId, `rpt-${i}`, `rpt-ref-${i}-${Date.now()}`],
    );
    const [sub] = await query<{ id: string }>(
      `INSERT INTO submissions (id, tenant_id, engagement_id, questionnaire_version_id, invitation_id,
                                status, locale, started_at, submitted_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'submitted', 'fr', now() - interval '1 day', now())
       RETURNING id`,
      [eng.tenant_id, eng.id, eng.qv, inv?.id],
    );
    for (const [seq, item] of items.entries()) {
      const opts = item.options_json;
      const choice = opts[(i + seq) % opts.length]?.value;
      const [answer] = await query<{ id: string }>(
        `INSERT INTO answers (id, tenant_id, submission_id, question_item_id, value_json, sequence)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
        [
          eng.tenant_id,
          sub?.id,
          item.id,
          JSON.stringify({ kind: 'scenario_choice', choice, rationale: null }),
          seq,
        ],
      );
      if (seq === 0) evidence.push(answer?.id as string);
    }
  }
  // Two approved findings, each resting on one answer of every person (ADR 0058).
  for (const t of THEMES) {
    const [f] = await query<{ id: string }>(
      `INSERT INTO findings (tenant_id, engagement_id, axis, label, status, source, created_by)
       VALUES ($1, $2, $3, $4, 'approved', 'auditor', $5) RETURNING id`,
      [eng.tenant_id, eng.id, t.axis, t.label, ownerId],
    );
    await query(
      `INSERT INTO finding_evidence (tenant_id, finding_id, answer_id)
       SELECT $1, $2, unnest($3::uuid[])`,
      [eng.tenant_id, f?.id, evidence],
    );
  }
  if (withOpportunity) {
    await query(
      `INSERT INTO opportunities (tenant_id, engagement_id, status, title, description,
                                  axis, created_by)
       VALUES ($1, $2, 'approved', $3, $4, 'practice', $5)`,
      [
        eng.tenant_id,
        eng.id,
        OPP_TITLE,
        'Les chiffres sont copiés et collés dans le rapport chaque semaine.',
        ownerId,
      ],
    );
  }
  return { tenant: eng.tenant_id, engagement: eng.id };
};

const setLocale = (context: BrowserContext, baseURL: string | undefined, locale: string) =>
  context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);

const signIn = async (page: Page, who: { email: string; password: string }, expectPath: RegExp) => {
  // A referent's sign-in lands on the front page (TASK-AI L5); these tests start in the space.
  await page.goto(expectPath.source.includes('client') ? '/login?next=%2Fclient' : '/login');
  await page.fill('input[name=email]', who.email);
  await page.fill('input[name=password]', who.password);
  await page.click('button[type=submit]');
  await page.waitForURL(expectPath);
};

const axe = async (page: Page, label: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(blocking, `${label}: axe serious/critical`).toEqual([]);
};

const noHorizontalScroll = async (page: Page, label: string) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'phone and desktop only');
});

for (const locale of ['fr', 'en'] as const) {
  test(`auditor builds and publishes; referent sees only the published report (${locale})`, async ({
    browser,
    context,
    page: own,
    baseURL,
  }, testInfo) => {
    test.setTimeout(240_000);
    const fx = await resetFixture();
    const copy = COPY[locale];
    const size = testInfo.project.name;

    // The referent sees nothing before publication.
    const use = testInfo.project.use;
    const refCtx = await browser.newContext({
      baseURL,
      viewport: use.viewport ?? null,
      isMobile: use.isMobile ?? false,
      hasTouch: use.hasTouch ?? false,
    });
    await setLocale(refCtx, baseURL, locale);
    const ref = await refCtx.newPage();
    await signIn(ref, REFERENT, /\/client/);
    await ref.goto('/client/report');
    await expect(ref.getByRole('heading', { level: 1 })).toHaveText(copy.title);
    await expect(ref.getByTestId('report-view')).toHaveCount(0);
    await expect(ref.getByTestId('client-tab-report')).toBeVisible();

    // The auditor builds the report.
    await setLocale(context, baseURL, locale);
    await signIn(own, OWNER, /\/(admin|board)/);
    // The report is the mission's Report tab (TASK-AD2).
    await own.goto(`/admin/engagements/${fx.engagement}/report?tenant=${fx.tenant}`);
    await axe(own, `${size} ${locale} report start`);
    await own.getByTestId('report-start').click();
    await own.waitForURL(new RegExp(`/admin/engagements/${fx.engagement}/report`));
    await expect(own.getByTestId('report-editor')).toBeVisible();

    // The findings name a weekly report typed by hand: the report proposes use cases with their
    // own steps (ADR 0064), and the auditor's opportunity still gets catalogue steps.
    await expect(
      own
        .getByTestId('report-opportunity')
        .filter({ hasText: /Recurring reports|Des rapports récurrents/ }),
    ).toBeVisible();
    const steps = own
      .getByTestId('report-opportunity')
      .filter({ hasText: OPP_TITLE })
      .getByTestId('report-step');
    await expect(steps.first()).toBeVisible();
    expect(await steps.count()).toBeGreaterThan(0);
    await steps
      .first()
      .getByRole('button', { name: locale === 'fr' ? 'Retenir' : 'Accept' })
      .click();
    await expect(own.locator('[data-testid=report-step][data-status=accepted]')).toHaveCount(1);

    await own.getByTestId('report-draft-summary').click();
    await expect(own.getByTestId('report-summary')).not.toHaveValue('');
    await expect(own.getByTestId('report-summary')).toHaveValue(/6/);

    await own.getByTestId('report-build-plan').click();
    await expect(own.getByTestId('report-plan-row')).toHaveCount(4);

    await own.getByTestId('report-to-review').click();
    await expect(own.getByTestId('report-state')).toHaveText(copy.inReview);
    await axe(own, `${size} ${locale} report editor`);
    await noHorizontalScroll(own, `${size} ${locale} report editor`);

    // Preview as the client: the same view, not yet visible to the referent.
    await own.getByTestId('report-preview-link').click();
    await expect(own.getByTestId('report-view')).toBeVisible();
    await expect(own.getByTestId('report-score')).toBeVisible();
    await ref.reload();
    await expect(ref.getByTestId('report-view')).toHaveCount(0);

    // Publish behind a confirmation.
    await own.goto(`/admin/engagements/${fx.engagement}/report?tenant=${fx.tenant}`);
    await own.getByTestId('report-publish').click();
    await own
      .getByRole('dialog')
      .getByRole('button', { name: locale === 'fr' ? 'Publier' : 'Publish' })
      .click();
    await expect(own.getByTestId('report-state')).toHaveText(copy.published);

    // The referent now reads it: aggregates only, no respondent code, readable on a phone.
    await ref.reload();
    const view = ref.getByTestId('report-view');
    await expect(view).toBeVisible();
    await expect(view).toContainText(OPP_TITLE);
    await expect(view).toContainText(THEMES[0]!.label);
    const text = await view.innerText();
    expect(text).not.toMatch(/rpt-|synthetic-signature|use_as_is|verify_source/);
    await axe(ref, `${size} ${locale} client report`);
    await noHorizontalScroll(ref, `${size} ${locale} client report`);

    // PDF: the referent and the auditor download the published version; each download is logged.
    await expect(ref.getByTestId('report-download')).toBeVisible();
    for (const [who, url] of [
      [ref, '/client/report/pdf'],
      [own, `/admin/reports/${fx.engagement}/pdf?tenant=${fx.tenant}`],
    ] as const) {
      const res = await who.request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type']).toBe('application/pdf');
      expect(res.headers()['content-disposition']).toMatch(
        /attachment; filename="[a-z0-9-]+-v1\.pdf"/,
      );
      expect((await res.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    }
    const exports = await query<{ n: string }>(
      `SELECT count(*) AS n FROM audit_log WHERE tenant_id = $1 AND action = 'report.export'
          AND created_at > now() - interval '5 minutes'`,
      [fx.tenant],
    );
    expect(Number(exports[0]?.n)).toBeGreaterThanOrEqual(2);

    // Unpublish: the referent no longer sees it.
    await own.getByTestId('report-unpublish').click();
    await own.getByRole('dialog').getByRole('button').last().click();
    await expect(own.getByTestId('report-state')).toHaveText(
      locale === 'fr' ? 'Brouillon' : 'Draft',
    );
    await ref.reload();
    await expect(ref.getByTestId('report-view')).toHaveCount(0);
    expect((await ref.request.get('/client/report/pdf')).status()).toBe(404);

    await refCtx.close();
  });
}

for (const locale of ['fr', 'en'] as const) {
  test(`publish with findings only, then write my own step; wide layout (${locale})`, async ({
    context,
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(240_000);
    const fx = await resetFixture(false);
    const copy = COPY[locale];
    const phone = testInfo.project.name === 'mobile-360';
    await setLocale(context, baseURL, locale);
    await signIn(page, OWNER, /\/(admin|board)/);

    // The Report tab uses the wide admin container, not the 480 px column.
    await page.goto(`/admin/engagements/${fx.engagement}/report?tenant=${fx.tenant}`);
    const listWidth = (await page.locator('section.wide').last().boundingBox())?.width ?? 0;
    if (!phone) expect(listWidth).toBeGreaterThan(900);
    await noHorizontalScroll(page, `${locale} report start`);
    await page.getByTestId('report-start').click();
    await page.waitForURL(new RegExp(`/admin/engagements/${fx.engagement}/report`));
    const editor = page.getByTestId('report-editor');
    await expect(editor).toBeVisible();
    if (!phone) expect((await editor.boundingBox())?.width ?? 0).toBeGreaterThan(900);

    // The PDF control is there before publishing, disabled and saying why; no few-people warning.
    await expect(page.getByTestId('report-admin-download-later')).toBeDisabled();
    await expect(page.getByTestId('report-few-people')).toHaveCount(0);

    // The method note rests on the real counts: themes approved, no opportunity claimed.
    await page.getByTestId('report-draft-summary').click();
    await expect(page.getByTestId('report-summary')).not.toHaveValue('');
    const method = await page.getByTestId('report-methodology').inputValue();
    expect(method).toMatch(/6/);
    // The note is written in the report language (the engagement's), whatever the screen language.
    expect(method).toMatch(/2 (findings|constats)/);
    expect(method).not.toMatch(/opportunit/i);

    // Nothing accepted, no opportunity: the report is still publishable with its findings alone.
    await expect(page.getByTestId('report-add-own')).toBeVisible();
    await page.getByTestId('report-to-review').click();
    await expect(page.getByTestId('report-state')).toHaveText(copy.inReview);
    await page.getByTestId('report-publish').click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: locale === 'fr' ? 'Publier' : 'Publish' })
      .click();
    await expect(page.getByTestId('report-state')).toHaveText(copy.published);
    await expect(page.getByTestId('report-admin-download')).toBeVisible();
    const pdf = await page.request.get(`/admin/reports/${fx.engagement}/pdf?tenant=${fx.tenant}`);
    expect(pdf.status()).toBe(200);
    await axe(page, `${locale} published findings-only editor`);

    // Back to draft, then write my own step: it gets an approved opportunity of its own.
    await page.getByTestId('report-unpublish').click();
    await page.getByRole('dialog').getByRole('button').last().click();
    await expect(page.getByTestId('report-state')).toHaveText(
      locale === 'fr' ? 'Brouillon' : 'Draft',
    );
    const own = page.getByTestId('report-add-own');
    await own.locator('input[name=title]').fill(OWN_STEP);
    await own.locator('input[name=owner]').fill('Team lead');
    await page.getByTestId('report-add-step').click();
    await expect(page.locator('[data-testid=report-step][data-status=accepted]')).toHaveCount(1);
    await expect(
      page.getByTestId('report-opportunity').filter({ hasText: OWN_STEP }),
    ).toBeVisible();
    await noHorizontalScroll(page, `${locale} editor with own step`);
  });
}

test('use cases: measured on the visit, ordered by the referent, shown with hours (ADR 0064)', async ({
  browser,
  context,
  page: own,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const fx = await resetFixture(false);
  await setLocale(context, baseURL, 'en');
  await signIn(own, OWNER, /\/(admin|board)/);
  await own.goto(`/admin/engagements/${fx.engagement}/report?tenant=${fx.tenant}`);
  await own.getByTestId('report-start').click();
  await expect(own.getByTestId('report-editor')).toBeVisible();

  // Two use cases from the findings, each with its playbook steps and the visit guide.
  const reports = own
    .getByTestId('report-opportunity')
    .filter({ hasText: /Recurring reports that build themselves|Des rapports récurrents/ });
  const reentry = own
    .getByTestId('report-opportunity')
    .filter({ hasText: /Stop typing the same data twice|saisir deux fois les mêmes/ });
  for (const uc of [reports, reentry]) {
    await uc.getByTestId('report-step').first().getByRole('button', { name: 'Accept' }).click();
  }
  await expect(own.locator('[data-testid=report-step][data-status=accepted]')).toHaveCount(2);
  const qualify = reports.getByTestId('use-case-qualify');
  await expect(qualify).toContainText('Ask during the visit');
  await qualify.locator('input[name=volumePerWeek]').fill('4');
  await qualify.locator('input[name=minutesPerUnit]').fill('90');
  await qualify.locator('input[name=teams]').fill('Synthetic report team');
  await qualify.getByTestId('use-case-save').click();
  // The estimate is in the report language (French here).
  await expect(reports.getByTestId('use-case-estimate')).toContainText(/6 (hours|heures)/);

  await own.getByTestId('report-draft-summary').click();
  await expect(own.getByTestId('report-summary')).toHaveValue(/2 (pieces of work|chantiers)/);
  await own.getByTestId('report-to-review').click();
  await expect(own.getByTestId('report-state')).toHaveText('In review');

  // The referent orders them while the report is in review.
  const refCtx = await browser.newContext({ baseURL });
  await setLocale(refCtx, baseURL, 'en');
  const ref = await refCtx.newPage();
  await signIn(ref, REFERENT, /\/client/);
  await ref.goto('/client/report');
  const ranking = ref.getByTestId('use-case-ranking');
  await expect(ranking).toBeVisible();
  await ranking.getByTestId('use-case-rank-save').click();
  await expect(ranking).toContainText('Order saved.');

  await own.reload();
  await own.getByTestId('report-publish').click();
  await own.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(own.getByTestId('report-state')).toHaveText('Published');

  await ref.reload();
  const view = ref.getByTestId('report-view');
  await expect(view).toContainText('Where to save time');
  await expect(view.getByTestId('use-case-today').first()).toContainText('about 6 hours a week');
  await expect(view.getByTestId('use-case-saving').first()).toContainText('Estimated saving');
  await expect(view.getByTestId('use-case-rank').first()).toContainText(
    'Priority given by your referent',
  );
  await axe(ref, 'en client report with use cases');
  await noHorizontalScroll(ref, 'en client report with use cases');
  await refCtx.close();
});

test('a referent cannot reach the auditor report screens', async ({ page }) => {
  const fx = await resetFixture();
  await signIn(page, REFERENT, /\/client/);
  await page.goto(`/admin/engagements/${fx.engagement}/report?tenant=${fx.tenant}`);
  await expect(page).toHaveURL(/\/client/);
  await expect(page.getByTestId('report-editor')).toHaveCount(0);
});
