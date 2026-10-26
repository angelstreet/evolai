import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';

/**
 * TASK-U (ADR 0040): real referent login by link, forgot password, the complete privacy notice,
 * the audit trail screen, data-page safety and the small-group guard. Synthetic client C and
 * tenant A come from the seeds; every person here is a "Demo" one. fr and en, 360 and 1280, axe.
 * The tablet project is skipped (phone and desktop only).
 */

const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const AUDITOR_A = {
  email: 'synthetic-auditor-a@synthetic.invalid',
  password: 'synthetic-password-a',
};
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const INVITE = 'inv-synthetic-aaaa-aaaa-aaaa-aaaaaaaa0002';
const inviteUrl = `/s/${INVITE}.${createHmac('sha256', SECRET).update(INVITE).digest('base64url')}`;
const LOCALES = ['fr', 'en'] as const;

const COPY = {
  fr: {
    invalid: 'Ce lien ne fonctionne plus',
    short: 'Utilisez au moins 12 caractères.',
    mismatch: 'Les deux mots de passe ne sont pas identiques.',
    forgotDone: /Si cette adresse est connue/,
    created: 'Création…',
    warn: 'Pas encore configuré',
    noSuch: /Personne n’a ce code de réponse/,
    previewTitle: 'Ceci sera effacé',
    sent: /Demande envoyée/,
    hidden: /Masqué sous 5 personnes/,
    erased: 'A effacé',
    inviteAudit: 'A créé un lien de connexion pour un référent',
  },
  en: {
    invalid: 'This link no longer works',
    short: 'Use at least 12 characters.',
    mismatch: 'The two passwords are not the same.',
    forgotDone: /If this address is known/,
    created: 'Creating…',
    warn: 'Not configured yet',
    noSuch: /Nobody has this answer code/,
    previewTitle: 'This will be erased',
    sent: /Request sent/,
    hidden: /Hidden under 5 people/,
    erased: 'Erased',
    inviteAudit: 'Created a sign-in link for a referent',
  },
} as const;

const databaseUrl = (): string =>
  (
    JSON.parse(readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8')) as {
      databaseUrl: string;
    }
  ).databaseUrl;

/** One statement list as the service account (RLS honours the flag), in one transaction. */
const run = async <T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    const res = await client.query<T>(sql, params);
    await client.query('COMMIT');
    return res.rows;
  } finally {
    await client.end();
  }
};

const emailHash = (e: string) => createHash('sha256').update(e.trim().toLowerCase()).digest('hex');

const setLocale = (context: BrowserContext, baseURL: string | undefined, locale: string) =>
  context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);

const signIn = async (page: Page, who: { email: string; password: string }, expect_: RegExp) => {
  await page.goto('/login');
  await page.fill('input[name=email]', who.email);
  await page.fill('input[name=password]', who.password);
  await page.click('button[type=submit]');
  await page.waitForURL(expect_);
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

const noOverflow = async (page: Page, label: string) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  const vw = page.viewportSize()?.width ?? 360;
  expect(w, `${label}: horizontal overflow`).toBeLessThanOrEqual(vw);
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'phone and desktop only (TASK-U)');
});

interface Ctx {
  tenantC: string;
  teamC: string;
  engagementC: string;
}
const clientC = async (): Promise<Ctx> => {
  const [row] = await run<{ tenant_id: string; team_id: string }>(
    `SELECT m.tenant_id, m.team_id FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.role = 'team_referent' AND u.display_name = 'Sam Synthetic' LIMIT 1`,
  );
  const [eng] = await run<{ id: string }>(
    `SELECT id FROM engagements WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
    [row?.tenant_id],
  );
  return {
    tenantC: row?.tenant_id as string,
    teamC: row?.team_id as string,
    engagementC: eng?.id as string,
  };
};

/** A referent of client C who has no password yet, made fresh for this test. */
const newReferent = async (ctx: Ctx, label: string) => {
  const id = randomUUID();
  const name = `Demo Referent ${label}`;
  await run(`INSERT INTO users (id, email_hash, display_name) VALUES ($1, $2, $3)`, [
    id,
    emailHash(`placeholder-${id}@demo.invalid`),
    name,
  ]);
  await run(
    `INSERT INTO memberships (id, tenant_id, user_id, team_id, role)
     VALUES ($1, $2, $3, $4, 'team_referent')`,
    [randomUUID(), ctx.tenantC, id, ctx.teamC],
  );
  return { id, name };
};

for (const locale of LOCALES) {
  test(`owner sends the welcome email, the referent opens the space once, no password (${locale})`, async ({
    browser,
    context,
    page,
    baseURL,
  }, testInfo) => {
    const copy = COPY[locale];
    const ctx = await clientC();
    const label = `${locale}-${testInfo.project.name}-${Date.now()}`;
    const referent = await newReferent(ctx, label);
    const address = `demo-${randomUUID().slice(0, 8)}@example.test`;

    await setLocale(context, baseURL, locale);
    await signIn(page, OWNER, /\/(admin\/|board)/);
    await page.goto(`/admin/settings?tenant=${ctx.tenantC}`);
    const card = page.getByTestId('referent-card').filter({ hasText: referent.name });
    await expect(card).toBeVisible();
    await axe(page, `${locale} teams with referents`);
    await noOverflow(page, `${locale} teams`);
    await card.getByLabel(/./, { exact: false }).first().fill(address);
    await card.locator('button[type=submit]').click();
    const link = card.getByTestId('invite-link');
    await expect(link).toBeVisible();
    const url = await link.inputValue();
    expect(url).toMatch(/\/client\?open=[A-Za-z0-9_-]{43}$/);
    const token = url.split('open=')[1] as string;

    // Hashed at rest: the table never holds the token itself.
    const stored = await run<{ token_hash: string; purpose: string }>(
      `SELECT token_hash, purpose FROM auth_tokens WHERE user_id = $1`,
      [referent.id],
    );
    expect(stored.map((r) => r.token_hash)).not.toContain(token);
    expect(stored[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored[0]?.purpose).toBe('space');

    // An expired address is refused: back to sign-in, nothing opened.
    await run(
      `UPDATE auth_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1`,
      [referent.id],
    );
    const stranger = await browser.newContext({ baseURL });
    await setLocale(stranger, baseURL, locale);
    const sp = await stranger.newPage();
    await sp.goto(`/client?open=${token}`);
    await expect(sp).toHaveURL(/\/login/);

    // A fresh address replaces it and opens the space without any password.
    await card.locator('button[type=submit]').click();
    await expect(card.getByTestId('invite-link')).not.toHaveValue(url);
    const fresh = (await card.getByTestId('invite-link').inputValue()).split('open=')[1] as string;
    await sp.goto(`/client?open=${fresh}`);
    await sp.waitForURL(/\/client$/);
    await expect(sp.locator('h1:visible')).toHaveCount(1);
    await axe(sp, `${locale} opened space`);
    await noOverflow(sp, `${locale} opened space`);

    // Single use: the same address is dead now, in a clean browser.
    const again = await browser.newContext({ baseURL });
    await setLocale(again, baseURL, locale);
    const ap = await again.newPage();
    await ap.goto(`/client?open=${fresh}`);
    await expect(ap).toHaveURL(/\/login/);
    await again.close();

    // A set-password token cannot open a session.
    const setPasswordToken = randomBytes(32).toString('base64url');
    await run(
      `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at) VALUES ($1, 'invite', $2, now() + interval '1 day')`,
      [referent.id, createHash('sha256').update(setPasswordToken).digest('hex')],
    );
    const third = await browser.newContext({ baseURL });
    const tp = await third.newPage();
    await tp.goto(`/client?open=${setPasswordToken}`);
    await expect(tp).toHaveURL(/\/login/);
    await third.close();

    // Role landing: the opened space never reaches the admin.
    await sp.goto('/admin/engagements');
    await expect(sp).toHaveURL(/\/client$/);
    await sp.goto('/board');
    await expect(sp).toHaveURL(/\/client$/);
    await stranger.close();

    // The trail has the invitation, in plain words, with no address.
    await page.goto(`/admin/settings/audit?tenant=${ctx.tenantC}`);
    await expect(page.getByTestId('audit-table')).toContainText(copy.inviteAudit);
    expect(await page.getByTestId('audit-table').innerText()).not.toContain(address);
    await axe(page, `${locale} audit trail`);
    await noOverflow(page, `${locale} audit`);

    await run(`DELETE FROM memberships WHERE user_id = $1`, [referent.id]);
    await run(`DELETE FROM audit_log WHERE target_id = $1 OR actor_user_id = $1`, [
      referent.id,
    ]).catch(() => undefined);
  });

  test(`forgot password never says whether the address exists (${locale})`, async ({
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const copy = COPY[locale];
    await setLocale(context, baseURL, locale);
    await page.goto('/login');
    await page.getByRole('link', { name: /oubli|Forgot/ }).click();
    await page.waitForURL(/\/forgot-password$/);
    await axe(page, `${locale} forgot form`);
    await noOverflow(page, `${locale} forgot`);
    const submit = async (email: string) => {
      await page.goto('/forgot-password');
      await page.fill('input[name=email]', email);
      await page.locator('button[type=submit]').click();
      const box = page.getByRole('status');
      await expect(box).toContainText(copy.forgotDone);
      return box.innerText();
    };
    const known = await submit(AUDITOR_A.email);
    const unknown = await submit(`nobody-${randomUUID().slice(0, 8)}@example.test`);
    expect(unknown).toBe(known);
    // Past the limit the answer is still the same words.
    for (let i = 0; i < 2; i += 1) await submit(AUDITOR_A.email);
    expect(await submit(AUDITOR_A.email)).toBe(known);
    await axe(page, `${locale} forgot done`);
  });

  test(`privacy notice: fields, warnings, request to the auditor (${locale})`, async ({
    context,
    page,
    baseURL,
  }) => {
    const copy = COPY[locale];
    const ctx = await clientC();
    await run(`UPDATE tenants SET retention_days = 365 WHERE id = $1`, [ctx.tenantC]);
    await run(
      `UPDATE engagements SET privacy_json = privacy_json - 'notice' - 'respondentContact' WHERE id = $1`,
      [ctx.engagementC],
    );
    await setLocale(context, baseURL, locale);

    // Public page before anything is configured: no empty placeholder, a line saying who to ask.
    await page.goto(`/privacy?e=${ctx.engagementC}`);
    await expect(page.getByTestId('notice-gap')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\{|undefined|null/);
    expect(
      (await page.getByRole('heading', { level: 2 }).allTextContents()).join(' | '),
    ).not.toMatch(/IA|AI use|Usage de l/);
    await axe(page, `${locale} privacy (unconfigured)`);

    // Admin: warning first, then fill the fields.
    await signIn(page, OWNER, /\/(admin\/|board)/);
    await page.goto(`/admin/engagements/${ctx.engagementC}/settings?tenant=${ctx.tenantC}`);
    await expect(page.getByTestId('notice-warning')).toContainText(copy.warn);
    await axe(page, `${locale} notice form (warning)`);
    await page.fill('input[name=contactName]', 'Demo Privacy Contact');
    await page.fill('input[name=contactEmail]', 'privacy@example.test');
    await page.fill('textarea[name=providers]', 'Demo Hosting\nDemo Mail');
    await page.fill('input[name=region]', 'EU demo region');
    await page.locator('input[name=aiOn]').check();
    await page.fill('input[name=aiRoute]', 'Demo approved AI service');
    await page.locator('form[aria-labelledby=notice-title] button[type=submit]').click();
    await expect(page.getByTestId('notice-warning')).toHaveCount(0);
    await noOverflow(page, `${locale} notice form`);

    // Public page now shows the configured parts.
    await page.goto(`/privacy?e=${ctx.engagementC}`);
    const main = page.locator('main');
    await expect(main).toContainText('Demo Privacy Contact');
    await expect(main).toContainText('Demo Hosting');
    await expect(main).toContainText('365');
    await expect(main).toContainText('Demo approved AI service');
    await expect(page.getByTestId('notice-gap')).toHaveCount(0);
    await axe(page, `${locale} privacy (configured)`);
    await noOverflow(page, `${locale} privacy`);

    // The request form reaches the auditor's data page, not a manager.
    const code = `demo-code-${randomUUID().slice(0, 8)}`;
    await page.fill('input[name=code]', code);
    await page.locator('main form button[type=submit]').click();
    await expect(page.getByRole('status')).toContainText(copy.sent);
    const rows = await run<{ kind: string }>(
      `SELECT kind FROM privacy_requests WHERE tenant_id = $1 AND respondent_code = $2`,
      [ctx.tenantC, code],
    );
    expect(rows).toEqual([{ kind: 'erase' }]);
    await page.goto(`/admin/settings/data?tenant=${ctx.tenantC}`);
    const table = page.getByTestId('privacy-requests');
    await expect(table).toContainText(code);
    await table.locator('tr', { hasText: code }).locator('button[type=submit]').click();
    await expect
      .poll(
        async () =>
          (
            await run(`SELECT status FROM privacy_requests WHERE respondent_code = $1`, [code])
          )[0]?.['status'],
      )
      .toBe('handled');

    // Cleanup so other specs see the plain state.
    await run(`UPDATE engagements SET privacy_json = privacy_json - 'notice' WHERE id = $1`, [
      ctx.engagementC,
    ]);
  });

  test(`the first survey page says who is asking, why, and for how long (${locale})`, async ({
    context,
    page,
    baseURL,
  }) => {
    await setLocale(context, baseURL, locale);
    const [eng] = await run<{ id: string }>(
      `SELECT id FROM engagements WHERE tenant_id = $1 LIMIT 1`,
      [TENANT_A],
    );
    await run(
      `UPDATE engagements SET privacy_json = privacy_json || jsonb_build_object('notice', jsonb_build_object('contactName', 'Demo Referent', 'purpose', 'Demo purpose sentence.')) WHERE id = $1`,
      [eng?.id],
    );
    try {
      await page.goto(inviteUrl);
      const who = page.getByTestId('who-is-asking');
      await expect(who).toContainText('Demo Referent');
      await expect(who).toContainText('Demo purpose sentence.');
      await axe(page, `${locale} survey entry`);
      await noOverflow(page, `${locale} survey entry`);
    } finally {
      await run(`UPDATE engagements SET privacy_json = privacy_json - 'notice' WHERE id = $1`, [
        eng?.id,
      ]);
    }
  });

  test(`data page: unknown code, preview before erase, find a code by date (${locale})`, async ({
    context,
    page,
    baseURL,
  }) => {
    const copy = COPY[locale];
    await setLocale(context, baseURL, locale);
    await signIn(page, AUDITOR_A, /\/(admin\/|board)/);
    await page.goto(`/admin/settings/data?tenant=${TENANT_A}`);
    await axe(page, `${locale} data page`);

    // An unknown code is said plainly, before any confirmation, and nothing is recorded.
    const before = await run(`SELECT 1 FROM deletion_events WHERE tenant_id = $1`, [TENANT_A]);
    await page.fill('input[name=respondentPseudonym]', 'no-such-code-0001');
    await page
      .getByRole('button', { name: /Effacer|Erase/ })
      .first()
      .click();
    await expect(page.getByText(copy.noSuch)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
      await run(`SELECT 1 FROM deletion_events WHERE tenant_id = $1`, [TENANT_A]),
    ).toHaveLength(before.length);

    // Find a code by date: codes only, no identity, then use one.
    await page.goto(`/admin/settings/data?tenant=${TENANT_A}&from=2000-01-01&to=2099-12-31`);
    const results = page.getByTestId('code-results');
    await expect(results).toBeVisible();
    const text = await results.innerText();
    expect(text).not.toMatch(/@/);
    await results.getByRole('link').first().click();
    await page.waitForURL(/code=/);
    const code = await page.inputValue('input[name=respondentPseudonym]');
    expect(code).toMatch(/^[a-z0-9-]{8,64}$/);

    // The confirmation lists what will go, and needs the code typed.
    await page
      .getByRole('button', { name: /Effacer|Erase/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('erase-preview')).toContainText(copy.previewTitle);
    const confirm = dialog.locator('button.MuiButton-colorError, button[class*=colorError]').last();
    await expect(confirm).toBeDisabled();
    await axe(page, `${locale} erase dialog`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await noOverflow(page, `${locale} data`);
  });
}

test('the audit CSV has plain words and no payload, and needs a session', async ({
  page,
  request,
}) => {
  const anonymous = await request.get(`/admin/audit/export?tenant=${TENANT_A}`, {
    maxRedirects: 0,
  });
  expect([302, 307, 403]).toContain(anonymous.status());
  await signIn(page, AUDITOR_A, /\/(admin\/|board)/);
  const res = await page.request.get(`/admin/audit/export?tenant=${TENANT_A}&group=all`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const body = await res.text();
  expect(body).not.toMatch(/payload|token|password_hash/i);
  const other = await page.request.get(
    `/admin/audit/export?tenant=22222222-2222-4222-8222-222222222222`,
  );
  expect(other.status()).toBe(403);
});
