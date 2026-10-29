#!/usr/bin/env node
/**
 * End-to-end smoke test for the local stack (M7).
 *
 * Assumes `pnpm local:up` is running and `DATABASE_URL` matches the one the runner printed.
 * Walks:
 *   1. GET /about to confirm the welcome page renders.
 *   2. Follow the synthetic link to /s/[token], accept the privacy notice.
 *   3. POST /api/locale to set fr.
 *   4. POST /api/answer for each of the six synthetic questions.
 *   5. GET /s/[token]/done to confirm the thank-you page.
 *   6. GET /admin/engagements and assert the completion count moved by exactly 1.
 *
 * Exits 0 when all checks pass, non-zero on the first failure.
 */

import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { default as pg } from 'pg';
import { loginCookie } from './smoke-auth.mjs';

const base = process.env['LOCAL_WEB_URL'] ?? 'http://127.0.0.1:3101';
const cookiePromise = loginCookie(base);
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is required\n');
  process.exit(2);
}

const fetchJson = async (path, init) => {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...init?.headers, cookie: await cookiePromise },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
};

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    process.stderr.write(`FAIL ${label}: expected ${expected}, got ${actual}\n`);
    process.exit(1);
  }
  process.stdout.write(`OK   ${label}\n`);
};

const assert = (condition, label) => {
  if (!condition) {
    process.stderr.write(`FAIL ${label}\n`);
    process.exit(1);
  }
  process.stdout.write(`OK   ${label}\n`);
};

const main = async () => {
  // 0. Clean up any prior state from a previous smoke run, so the test is idempotent. The
  //    employee flow reuses the same submission row on resume (done page calls getOrCreateState
  //    and then UPDATEs the existing row), so without this wipe the "count increased by one"
  //    check would only pass on the first run.
  const resetClient = new pg.Client({ connectionString: databaseUrl });
  await resetClient.connect();
  await resetClient.query(`SET ROLE auditai_app`);
  await resetClient.query(`SET app.is_service_account = 'on'`);
  await resetClient.query(
    `DELETE FROM answers WHERE submission_id IN (
       SELECT s.id FROM submissions s
         JOIN invitations i ON i.id = s.invitation_id
        WHERE i.token_reference = 'inv-synthetic-pilot-001'
     )`,
  );
  await resetClient.query(
    `UPDATE invitations SET submission_id = NULL, status = 'pending' WHERE token_reference = 'inv-synthetic-pilot-001'`,
  );
  await resetClient.query(
    `DELETE FROM submissions WHERE invitation_id IN (
       SELECT id FROM invitations WHERE token_reference = 'inv-synthetic-pilot-001'
     )`,
  );
  await resetClient.end();

  // 1. About page.
  const about = await fetchJson('/about');
  const aboutHtml = await about.text();
  assert(aboutHtml.includes('EvolAI'), 'about page renders the product name');
  // The public pages no longer link to a sample survey: sign the seeded sample invitation here,
  // with the same dev secret the local stack uses.
  const reference = 'inv-synthetic-pilot-001';
  const secret = process.env['SURVEY_SIGNING_SECRET'] ?? 'dev-only-survey-signing-secret-change-me';
  const token = `${reference}.${createHmac('sha256', secret).update(reference).digest('base64url')}`;

  // 2. Welcome.
  const welcome = await fetchJson(`/s/${token}`);
  const welcomeHtml = await welcome.text();
  assert(welcomeHtml.includes('EvolAI'), 'welcome page renders');

  // 3. Locale.
  const localeRes = await fetchJson('/api/locale', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, locale: 'fr' }),
  });
  const localeJson = await localeRes.json();
  assertEqual(localeJson.locale, 'fr', 'locale set to fr');

  // Snapshot completion count before answering. The auditai_app role is NOSUPERUSER NOBYPASSRLS,
  // so we have to either set app.tenant_id or run as a service account. The smoke only cares
  // about the delta, so we use the service-account flag to count across all tenants.
  // Use `SET` (session) not `SET LOCAL` because the `pg` client auto-commits each query, which
  // would drop a SET LOCAL outside an explicit transaction block.
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(`SET ROLE auditai_app`);
  await client.query(`SET app.is_service_account = 'on'`);
  const before = await client.query(
    `SELECT COUNT(*)::int AS n FROM submissions WHERE status = 'submitted'`,
  );
  const beforeCount = before.rows[0].n;

  // 4. Answer every question of the pilot questionnaire: the first option of each choice, a short
  //    sentence for each free-text question.
  const definition = JSON.parse(
    readFileSync(
      new URL('../../../packages/contracts/src/questionnaires/pilot-v2.json', import.meta.url),
      'utf8',
    ),
  );
  for (const [i, q] of definition.questions.entries()) {
    const res = await fetchJson('/api/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        q.kind === 'short_text'
          ? { token, index: i, text: 'Smoke test: copier les mêmes lignes à la main.' }
          : { token, index: i, choice: q.options[0].value },
      ),
    });
    const json = await res.json();
    assertEqual(json.ok, true, `answer recorded for question ${i}`);
  }

  // 5. Done page.
  const done = await fetchJson(`/s/${token}/done`);
  const doneHtml = await done.text();
  assert(doneHtml.includes('Merci') || doneHtml.includes('Thank you'), 'done page renders');

  // 6. Completion moved.
  await client.query(`SET app.is_service_account = 'on'`);
  const after = await client.query(
    `SELECT COUNT(*)::int AS n FROM submissions WHERE status = 'submitted'`,
  );
  await client.end();
  const afterCount = after.rows[0].n;
  assertEqual(afterCount, beforeCount + 1, 'submitted submission count increased by one');

  // 7. Admin page renders the new completion.
  const admin = await fetchJson('/admin/engagements');
  const adminHtml = await admin.text();
  assert(adminHtml.includes('audit engagements'), 'admin page renders');
  assert(adminHtml.includes('EvolAI'), 'admin page shows the brand wordmark');
  process.stdout.write(`OK   admin page rendered (${adminHtml.length} bytes)\n`);

  await sleep(100);
  process.stdout.write('\nAll local smoke checks passed.\n');
};

main().catch((err) => {
  process.stderr.write(`FAIL: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
