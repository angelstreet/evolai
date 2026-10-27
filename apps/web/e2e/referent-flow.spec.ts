import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { answerCurrent, dbQuery } from './helpers';

/**
 * TASK-AF (ADR 0052): the referent flow on the synthetic client C, screens 3 to 6. One address per
 * team with a QR code, Share with the team (prefilled message, Copy, WhatsApp, team size), two
 * fresh browsers answering the same address and counted as two, and the answers line. fr and en,
 * 360 and 1280, axe. The tablet project is skipped (phone and desktop only).
 */

const REFERENT = {
  email: 'synthetic-referent@synthetic.invalid',
  password: 'synthetic-password-referent',
};
const LOCALES = ['fr', 'en'] as const;
const COPY = {
  fr: {
    shareTitle: 'Partager avec l’équipe',
    saved: 'Enregistré',
    answers: /Aucune réponse|personnes? attendues?|ont répondu|Quelques|La plupart/,
  },
  en: {
    shareTitle: 'Share with the team',
    saved: 'Saved',
    answers: /No answers|expected|answered|Some people|Most people/,
  },
} as const;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', 'phone and desktop only (TASK-AF)');
});

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

const setLocale = (context: BrowserContext, baseURL: string | undefined, locale: string) =>
  context.addCookies([{ name: 'evolai_locale', value: locale, url: baseURL as string }]);

const signIn = async (page: Page) => {
  await page.goto('/login?next=%2Fclient');
  await page.fill('input[name=email]', REFERENT.email);
  await page.fill('input[name=password]', REFERENT.password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/client$/);
};

/** Open the survey of client C so its address accepts visitors. */
const openSurvey = async (): Promise<{ id: string; teamId: string; status: string }> => {
  const [row] = await dbQuery<{ id: string; team_id: string; status: string }>(
    `SELECT e.id, et.team_id, e.status FROM engagements e
       JOIN tenants t ON t.id = e.tenant_id
       JOIN engagement_teams et ON et.engagement_id = e.id
      WHERE t.slug = 'synthetic-client-c' ORDER BY e.created_at LIMIT 1`,
  );
  if (!row) throw new Error('synthetic client C is not seeded');
  await dbQuery(`UPDATE engagements SET status = 'in_field' WHERE id = $1`, [row.id]);
  return { id: row.id, teamId: row.team_id, status: row.status };
};

const finishSurvey = async (page: Page) => {
  await page.locator('main .MuiButton-contained').click();
  for (let i = 0; i < 40 && !page.url().endsWith('/done'); i += 1) {
    // Answer only a question that is on screen and open, never the one being left.
    const open = page
      .locator('textarea.text-answer-input:not([disabled]), button.ck-opt:not([disabled])')
      .first();
    try {
      await open.waitFor({ timeout: 3000 });
    } catch {
      continue;
    }
    const before = page.url();
    await answerCurrent(page);
    await page.waitForURL((u) => u.toString() !== before);
  }
  expect(page.url()).toMatch(/\/done$/);
};

for (const locale of LOCALES) {
  test(`team address, share, two fresh browsers count two, progress (${locale})`, async ({
    browser,
    context,
    page,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const copy = COPY[locale];
    const survey = await openSurvey();
    const startedAt = new Date();
    try {
      await setLocale(context, baseURL, locale);
      await signIn(page);

      // Screen 3: the card with the address in big type and the QR code.
      const card = page.getByTestId('client-team-card').first();
      await expect(card).toBeVisible();
      const address = (await page.getByTestId('client-address').first().innerText()).trim();
      expect(address).toMatch(/\/s\/[a-z0-9]+(-[a-z0-9]+)*$/);
      const slug = address.split('/s/')[1] as string;
      await expect(page.getByTestId('client-qr').first().locator('svg')).toBeVisible();
      await expect(page.getByTestId('client-questions').first()).toHaveAttribute(
        'href',
        '/?learn=3',
      );
      const submittedBefore = Number(
        (
          await dbQuery<{ n: string }>(
            `SELECT count(*)::text AS n FROM invitations WHERE engagement_id = $1 AND status = 'submitted'`,
            [survey.id],
          )
        )[0]?.n,
      );
      // The learn card shows while the team has no answer at all (the second language run has some).
      if (submittedBefore === 0) {
        await expect(page.getByTestId('client-learn-cta')).toHaveAttribute('href', '/?learn=1');
      }
      await expect(page.getByTestId('client-team-answered').first()).toContainText(copy.answers);
      await axe(page, `${locale} my space`);
      await noHorizontalScroll(page, `${locale} my space`);
      // No per-person link anywhere on the page.
      expect(await page.locator('main').innerText()).not.toMatch(/\/s\/[^\s]+\.[A-Za-z0-9_-]{20,}/);

      // Screen 4: Share with the team. Prefilled message with the address, Copy, WhatsApp, size.
      await page.getByTestId('client-share').first().click();
      const dialog = page.getByTestId('client-share-dialog');
      await expect(dialog).toContainText(copy.shareTitle);
      await expect(page.getByTestId('client-share-dialog-text')).toHaveValue(new RegExp(slug));
      const wa = await page.getByTestId('client-share-dialog-whatsapp').getAttribute('href');
      expect(wa).toMatch(/^https:\/\/wa\.me\/\?text=/);
      expect(decodeURIComponent(wa as string)).toContain(address);
      await expect(page.getByTestId('client-share-dialog-copy')).toBeVisible();
      await page.getByTestId('team-size').fill('12');
      await dialog.locator('button[type=submit]').click();
      await expect(dialog).toContainText(copy.saved);
      const [size] = await dbQuery<{ expected_size: number }>(
        `SELECT expected_size FROM team_addresses WHERE slug = $1`,
        [slug],
      );
      expect(size?.expected_size).toBe(12);
      // Let the dialog finish its fade-in: axe reads half-transparent text as low contrast.
      await expect(page.locator('.MuiDialog-container').last()).toHaveCSS('opacity', '1');
      await axe(page, `${locale} share dialog`);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      // Screen 5: two fresh browsers open the same address, each gets its own invitation and cookie.
      const before = Number(
        (
          await dbQuery<{ n: string }>(
            `SELECT count(*)::text AS n FROM invitations WHERE engagement_id = $1 AND team_id = $2 AND status = 'submitted'`,
            [survey.id, survey.teamId],
          )
        )[0]?.n,
      );
      const tokens: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const fresh = await browser.newContext({ baseURL, hasTouch: false });
        await setLocale(fresh, baseURL, locale);
        const p = await fresh.newPage();
        await p.goto(`/s/${slug}`);
        await p.waitForURL(/\/s\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
        tokens.push(p.url());
        // Back on the address: the same browser keeps its own invitation.
        await p.goto(`/s/${slug}`);
        await p.waitForURL(/\/s\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
        expect(p.url()).toBe(tokens[i]);
        await finishSurvey(p);
        await fresh.close();
      }
      expect(tokens[0]).not.toBe(tokens[1]);
      const after = Number(
        (
          await dbQuery<{ n: string }>(
            `SELECT count(*)::text AS n FROM invitations WHERE engagement_id = $1 AND team_id = $2 AND status = 'submitted'`,
            [survey.id, survey.teamId],
          )
        )[0]?.n,
      );
      expect(after - before).toBe(2);

      // Screen 6: progress for the referent, and the reminder dialog. The minimum group rule holds.
      await page.reload();
      await expect(page.getByTestId('client-team-answered').first()).toContainText(copy.answers);
      expect(await page.getByTestId('client-team-answered').first().innerText()).not.toMatch(
        /\b2 (of|sur) /,
      );
      await expect(page.getByTestId('client-learn')).toHaveCount(0);
      await page.getByTestId('client-remind').first().click();
      const remind = page.getByTestId('client-remind-dialog');
      await expect(page.getByTestId('client-remind-dialog-text')).toHaveValue(new RegExp(slug));
      await expect(page.getByTestId('client-remind-dialog-whatsapp')).toHaveAttribute(
        'href',
        /^https:\/\/wa\.me\/\?text=/,
      );
      // Let the dialog finish its fade-in: axe reads half-transparent text as low contrast.
      await expect(page.locator('.MuiDialog-container').last()).toHaveCSS('opacity', '1');
      await axe(page, `${locale} reminder dialog`);
      await page.keyboard.press('Escape');
      await expect(remind).toBeHidden();

      // A closed mission refuses new visitors in plain words; an unknown address is a 404.
      await dbQuery(`UPDATE engagements SET status = 'closed' WHERE id = $1`, [survey.id]);
      const closed = await browser.newContext({ baseURL });
      await setLocale(closed, baseURL, locale);
      const cp = await closed.newPage();
      await cp.goto(`/s/${slug}`);
      await expect(cp.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(cp).toHaveURL(/closed=1$/);
      const unknown = await cp.goto('/s/no-such-team');
      expect(unknown?.status()).toBe(404);
      await closed.close();
      await dbQuery(`UPDATE engagements SET status = 'in_field' WHERE id = $1`, [survey.id]);
    } finally {
      // Leave the shared test database as found: no visitor of this run, the survey state back.
      await dbQuery(`DELETE FROM invitations WHERE engagement_id = $1 AND created_at >= $2`, [
        survey.id,
        startedAt,
      ]);
      await dbQuery(`UPDATE engagements SET status = $2 WHERE id = $1`, [survey.id, survey.status]);
    }
  });
}
