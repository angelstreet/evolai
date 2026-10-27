import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';

/**
 * TASK-P (ADR 0035): the platform owner switches to a client referent's view and back.
 * Synthetic client C, its owner and its referent come from infra/db/scripts/seed-synthetic-client.mjs.
 * Checked in fr and en at 360 and 1280: banner, avatar, read only, navigation, isolation, trail,
 * axe. The tablet project is skipped (the brief asks for phone and desktop).
 */

const OWNER = { email: 'synthetic-owner@synthetic.invalid', password: 'synthetic-password-owner' };
const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const AUDITOR_A = {
  email: 'synthetic-auditor-a@synthetic.invalid',
  password: 'synthetic-password-a',
};
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const ENGAGEMENT_A = 'a5555555-4555-4555-8555-555555555555';
const LOCALES = ['fr', 'en'] as const;
const COPY = {
  fr: {
    banner: /Vous voyez Synthetic client C en tant que Sam Synthetic \(référent\)/,
    back: 'Revenir à ma vue',
    readOnly: /Lecture seule/,
  },
  en: {
    banner: /You are viewing Synthetic client C as Sam Synthetic \(referent\)/,
    back: 'Back to my view',
    readOnly: /Read only/,
  },
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

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'phone and desktop only (TASK-P)');
});

for (const locale of LOCALES) {
  test(`owner views the app as the referent and back (${locale})`, async ({
    page,
    context,
    baseURL,
  }) => {
    const copy = COPY[locale];
    await setLocale(context, baseURL, locale);
    await signIn(page, OWNER, /\/(admin\/|board)/);
    const [owner] = await query<{ id: string }>(
      `SELECT u.id FROM users u JOIN memberships m ON m.user_id = u.id
        WHERE m.role = 'platform_owner' AND u.display_name = 'Synthetic Owner' LIMIT 1`,
    );
    const since = new Date(Date.now() - 1000).toISOString();

    // The account menu offers "View as": me, and the referent persona.
    await page.getByTestId('account-button').click();
    await expect(page.getByTestId('view-as-self')).toBeVisible();
    const persona = page.getByTestId('view-as-persona');
    await expect(persona).toHaveCount(1);
    await expect(persona).toContainText(/Synthetic client C · (Référent|Referent)/);
    // Let the menu finish its fade-in: axe reads half-transparent text as low contrast.
    await expect(page.locator('.MuiPopover-paper').first()).toHaveCSS('opacity', '1');
    await axe(page, `${locale} account menu`);
    await persona.click();
    await page.waitForURL(/\/client$/);

    // Banner, persona avatar, organisation stated, client navigation only.
    const banner = page.getByTestId('view-as-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(copy.banner);
    await expect(banner).toHaveCSS('position', 'sticky');
    await expect(page.getByTestId('account-button')).toContainText('SS');
    await expect(page.getByTestId('client-organisation')).toContainText('Synthetic client C');
    await expect(page.locator('[data-testid^="client-tab-"]')).toHaveCount(5);
    await expect(page.locator('main a[href^="/admin"], header a[href^="/admin"]')).toHaveCount(0);
    await expect(page.locator('h1:visible')).toHaveCount(1);
    await axe(page, `${locale} client home (view as)`);

    // The banner stays on screen when the page scrolls.
    await page.mouse.wheel(0, 2000);
    await expect(banner).toBeInViewport();

    // Read only: the team size cannot be changed, and no per-person link exists (TASK-AF).
    await page.getByTestId('client-share').click();
    await page.getByTestId('team-size').fill('5');
    await page.getByTestId('client-share-dialog').locator('button[type=submit]').click();
    await expect(page.getByTestId('client-share-dialog')).toContainText(/Read only|Lecture seule/);
    await expect(page.locator('.MuiDialog-container').last()).toHaveCSS('opacity', '1');
    await axe(page, `${locale} client share (view as)`);
    await page.keyboard.press('Escape');
    await page.getByTestId('client-tab-results').click();
    await page.waitForURL(/\/client\/results$/);
    await axe(page, `${locale} client results (view as)`);
    // The report tab (TASK-V) is read only by nature: no form, nothing unpublished.
    await page.getByTestId('client-tab-report').click();
    await page.waitForURL(/\/client\/report$/);
    await expect(page.locator('main form')).toHaveCount(0);
    await axe(page, `${locale} client report (view as)`);

    // Isolation: the staff surface is closed, other tenants and APIs refuse.
    await page.goto('/admin/engagements');
    await expect(page).toHaveURL(/\/client$/);
    await page.goto('/board');
    await expect(page).toHaveURL(/\/client$/);
    // Answers are never shown in view-as (TASK-AD2): page and CSV refuse.
    await page.goto(`/admin/engagements/${ENGAGEMENT_A}/answers?tenant=${TENANT_A}`);
    await expect(page).toHaveURL(/\/client$/);
    const answersCsv = await page.request.get(
      `/admin/engagements/${ENGAGEMENT_A}/answers/export?tenant=${TENANT_A}`,
      { maxRedirects: 0 },
    );
    expect(answersCsv.status()).toBe(403);
    const api = await page.request.get(
      `/api/admin/invitations?tenant=${TENANT_A}&engagement=${ENGAGEMENT_A}`,
    );
    expect(api.status()).toBe(403);
    // No nested switch while viewing as.
    const nested = await page.request.post('/api/view-as', {
      form: { persona: '88888888-8888-4888-8888-888888888888' },
      maxRedirects: 0,
    });
    expect(nested.status()).toBe(403);

    // Every request is trailed with the real actor and the "as" tenant.
    const trail = await query<{
      action: string;
      actor_user_id: string;
      payload_json: { as_role: string };
    }>(
      `SELECT action, actor_user_id, payload_json FROM audit_log
        WHERE action LIKE 'view_as.%' AND created_at >= $1 ORDER BY created_at`,
      [since],
    );
    const actions = trail.map((r) => r.action);
    expect(actions).toContain('view_as.start');
    expect(actions).toContain('view_as.request');
    expect(actions).toContain('view_as.refused');
    for (const r of trail) {
      expect(r.actor_user_id).toBe(owner?.id);
      expect(r.payload_json.as_role).toBe('team_referent');
    }

    // Back to my view: banner gone, admin open again.
    await page.getByRole('button', { name: copy.back }).click();
    await page.waitForURL(/\/admin\/engagements/);
    await expect(page.getByTestId('view-as-banner')).toHaveCount(0);
    const stops = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log WHERE action = 'view_as.stop' AND created_at >= $1`,
      [since],
    );
    expect(stops[0]?.n).toBeGreaterThan(0);
  });
}

test('a tampered view-as cookie is not accepted', async ({ page, context, baseURL }) => {
  await signIn(page, OWNER, /\/(admin\/|board)/);
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'evolai_session');
  expect(session).toBeDefined();
  const [body, sig] = (session?.value ?? '').split('.') as [string, string];
  const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  const [tenantC] = await query<{ id: string }>(
    `SELECT id FROM tenants WHERE slug = 'synthetic-client-c'`,
  );
  json.viewAs = {
    role: 'team_referent',
    tenantId: tenantC?.id,
    teamId: tenantC?.id,
    personaId: tenantC?.id,
    label: 'X',
    tenantLabel: 'X',
    teamLabel: 'X',
  };
  await context.addCookies([
    {
      name: 'evolai_session',
      value: `${Buffer.from(JSON.stringify(json)).toString('base64url')}.${sig}`,
      url: baseURL as string,
    },
  ]);
  await page.goto('/client');
  await expect(page).toHaveURL(/\/login/);
});

test('a non-owner cannot start a view-as, even with a real persona id', async ({ page }) => {
  const [m] = await query<{ id: string }>(
    `SELECT m.id FROM memberships m JOIN tenants t ON t.id = m.tenant_id
      WHERE m.role = 'team_referent' AND t.slug = 'synthetic-client-c' LIMIT 1`,
  );
  expect(m?.id).toBeTruthy();
  // Signed out: no cookie, sent to sign-in.
  const anon = await page.request.post('/api/view-as', {
    form: { persona: m?.id as string },
    maxRedirects: 0,
  });
  expect(anon.status()).toBe(303);
  expect(anon.headers()['set-cookie'] ?? '').not.toContain('evolai_session=');
  // An auditor of another tenant (direct POST with a forged form field).
  await signIn(page, AUDITOR_A, /\/(admin\/|board)/);
  await page.getByTestId('account-button').click();
  await expect(page.getByTestId('view-as-self')).toHaveCount(0);
  await page.keyboard.press('Escape');
  const res = await page.request.post('/api/view-as', {
    form: { persona: m?.id as string },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(403);
  await page.goto('/client');
  await expect(page).toHaveURL(/\/admin\/engagements/);
  await expect(page.getByTestId('view-as-banner')).toHaveCount(0);
});

test('a real referent lands on the team space, sees one team address, cannot leave it', async ({
  page,
}) => {
  await signIn(page, REFERENT, /\/client$/);
  await expect(page.getByTestId('view-as-banner')).toHaveCount(0);
  await expect(page.getByTestId('account-button')).toContainText('SS');
  await expect(page.getByTestId('client-address')).toHaveText(/\/s\/[a-z0-9-]+$/);
  await expect(page.getByTestId('client-qr')).toBeVisible();
  // The old per-person pages are gone: the old address redirects home, the export does not exist.
  await page.goto('/client/invitations');
  await expect(page).toHaveURL(/\/client$/);
  expect((await page.request.get('/client/invitations/export')).status()).toBe(404);
  // Admin, board, other tenants: closed.
  for (const path of [
    '/admin/engagements',
    '/admin/settings/data',
    `/admin/engagements/${ENGAGEMENT_A}/answers?tenant=${TENANT_A}`,
    '/board',
  ]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/client$/);
  }
  const api = await page.request.get(
    `/api/admin/invitations?tenant=${TENANT_A}&engagement=${ENGAGEMENT_A}`,
  );
  expect(api.status()).toBe(403);
  const start = await page.request.post('/api/view-as', {
    form: { persona: '88888888-8888-4888-8888-888888888888' },
    maxRedirects: 0,
  });
  expect(start.status()).toBe(403);
  await page.goto('/client/results');
  await expect(page.locator('main')).not.toContainText(/p-[0-9a-f]{16}/);
});
