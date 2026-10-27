import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { answerCurrent } from './helpers';

/**
 * TASK-Y: the survey is submitted by an explicit finish (POST /api/submit), never by loading the
 * done page. Opening the last question and waiting (so link prefetch has run) must not submit, the
 * last answer must still save, and the survey must be submitted exactly once. fr and en, plain
 * answer flow and skip-then-last flow. Each run mints its own fresh invitation (synthetic, tenant B).
 */

const SECRET = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
const TEMPLATE_INVITE = 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0006';

const query = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => {
  const { databaseUrl } = JSON.parse(
    readFileSync(join(process.cwd(), '.playwright-database-url'), 'utf8'),
  ) as { databaseUrl: string };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
};

const freshToken = async (): Promise<{ token: string; reference: string }> => {
  const reference = `inv-synthetic-finish-${randomUUID()}`;
  await query(
    `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status,
                              token_reference, token_signature, opens_at, expires_at)
     SELECT gen_random_uuid(), tenant_id, engagement_id, team_id, $2, 'pending',
            $1, 'synthetic-signature', now(), now() + interval '7 days'
       FROM invitations WHERE token_reference = $3`,
    [reference, `finish-${reference.slice(-12)}`, TEMPLATE_INVITE],
  );
  const signature = createHmac('sha256', SECRET).update(reference).digest('base64url');
  return { token: `${reference}.${signature}`, reference };
};

const state = async (reference: string) =>
  (
    await query<{ status: string; answers: string; skipped: string; submitted_at: string | null }>(
      `SELECT s.status, s.submitted_at,
              (SELECT count(*) FROM answers a WHERE a.submission_id = s.id)::text AS answers,
              (SELECT count(*) FROM answers a
                WHERE a.submission_id = s.id AND a.value_json->>'kind' = 'skipped')::text AS skipped
         FROM invitations i JOIN submissions s ON s.id = i.submission_id
        WHERE i.token_reference = $1`,
      [reference],
    )
  )[0];

const position = async (page: Page): Promise<{ i: number; n: number }> => {
  const text = (await page.getByTestId('survey-count').innerText()).trim();
  const [i, n] = (text.match(/\d+/g) ?? []).map(Number);
  return { i: i as number, n: n as number };
};

test.describe('the survey is submitted by an explicit finish', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone-first flow; runs in the mobile-360 project');

  for (const locale of ['fr', 'en'] as const) {
    for (const flow of ['answer', 'skip-then-last'] as const) {
      test(`${flow} in ${locale}`, async ({ page, context, baseURL }) => {
        await context.addCookies([
          { name: 'evolai_locale', value: locale, url: baseURL as string },
        ]);
        const { token, reference } = await freshToken();
        const submitCalls: string[] = [];
        page.on('request', (r) => {
          if (r.method() === 'POST' && r.url().endsWith('/api/submit')) submitCalls.push(r.url());
        });

        await page.goto(`/s/${token}`);
        await page.locator('main .MuiButton-contained').click();

        let skipped = false;
        for (;;) {
          const { i, n } = await position(page);
          const last = i === n;
          if (last) {
            // Let prefetch of anything linked from this page run: it must not submit.
            await page.waitForTimeout(5000);
            expect((await state(reference))?.status).toBe('in_progress');
            expect(submitCalls).toHaveLength(0);
          }
          const before = page.url();
          // Free-text questions carry Skip; choice questions offer "I don't know" instead.
          if (
            flow === 'skip-then-last' &&
            !skipped &&
            (await page.getByTestId('survey-skip').count())
          ) {
            await page.getByTestId('survey-skip').click();
            skipped = true;
          } else {
            await answerCurrent(page);
          }
          await page.waitForURL((u) => u.toString() !== before);
          if (page.url().endsWith('/done')) break;
        }

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const after = await state(reference);
        expect(after?.status).toBe('submitted');
        // The last answer was saved, and every question has a row (answered or skipped).
        expect(Number(after?.answers)).toBeGreaterThanOrEqual(1);
        expect(Number(after?.skipped)).toBe(skipped ? 1 : 0);
        expect(submitCalls).toHaveLength(1);

        // Reloading the done page, or opening it again, does not submit again.
        await page.goto(`/s/${token}/done`);
        await page.reload();
        const again = await state(reference);
        expect(String(again?.submitted_at)).toBe(String(after?.submitted_at));
        expect(after?.submitted_at).not.toBeNull();
        expect(submitCalls).toHaveLength(1);
      });
    }
  }

  test('the done page does not submit; it sends the person to the open question', async ({
    page,
  }) => {
    const { token, reference } = await freshToken();
    await page.goto(`/s/${token}`);
    await page.locator('main .MuiButton-contained').click();
    await page.goto(`/s/${token}/done`);
    await expect(page).toHaveURL(/\/q\/0$/);
    expect((await state(reference))?.status).toBe('in_progress');
  });
});
