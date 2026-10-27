import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import pg from 'pg';

/** Sign in as the seeded synthetic auditor of tenant A (migration 0015; fake credentials). */
export const signInAsAuditorA = async (
  page: Page,
  expectPath = /\/(admin\/|board)/,
): Promise<void> => {
  await page.goto('/login');
  await page.fill('input[name=email]', 'synthetic-auditor-a@synthetic.invalid');
  await page.fill('input[name=password]', 'synthetic-password-a');
  await page.click('button[type=submit]');
  await page.waitForURL(expectPath);
};

/**
 * Answer the question on screen the way a person would: type a short sentence when it is a text
 * box, otherwise pick the last option, then press Next (TASK-Z2, TASK-AI L3).
 */
export const answerCurrent = async (
  page: Page,
  sentence = 'Copier les mêmes lignes à la main.',
): Promise<void> => {
  const box = page.locator('textarea.text-answer-input');
  if ((await box.count()) > 0) {
    await box.fill(sentence);
    await page.locator('button.text-next').click();
    return;
  }
  await page.locator('button.ck-opt').last().click();
  await page.locator('button.text-next').click();
};

/** Run a query on the database the Playwright server uses (written by e2e/serve.mjs). */
export const dbQuery = async <T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
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

/** A fresh synthetic invitation (copy of a seeded tenant-B one) with its signed token. */
export const freshInvitation = async (
  prefix: string,
): Promise<{ token: string; reference: string }> => {
  const secret = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
  const reference = `inv-synthetic-${prefix}-${randomUUID()}`;
  await dbQuery(
    `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym, status,
                              token_reference, token_signature, opens_at, expires_at)
     SELECT gen_random_uuid(), tenant_id, engagement_id, team_id, $2, 'pending',
            $1, 'synthetic-signature', now(), now() + interval '7 days'
       FROM invitations WHERE token_reference = 'inv-synthetic-bbbb-bbbb-bbbb-bbbbbbbb0006'`,
    [reference, `${prefix}-${reference.slice(-12)}`],
  );
  const signature = createHmac('sha256', secret).update(reference).digest('base64url');
  return { token: `${reference}.${signature}`, reference };
};
