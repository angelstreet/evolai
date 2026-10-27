import { expect, test } from '@playwright/test';
import { dbQuery, freshInvitation } from './helpers';

/**
 * Questionnaire v1 end to end (TASK-Z2, ADR 0046): the neutral choice questions with an honest
 * "I don't know / It depends", the three optional free-text questions (counter, hint, 400
 * characters, skip) and the coarse role question, answered and read back on a phone.
 *
 * Each test mints its own synthetic invitation (tenant B), so nothing is shared with other specs.
 */
const FIRST_TEXT = 6;
const TEXT = 'Chaque lundi je recopie les commandes du mail vers le tableur, à la main.';

test.describe('questionnaire v1 on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone-first flow; runs in the mobile-360 project');

  let token = '';
  let reference = '';
  test.beforeEach(async () => {
    ({ token, reference } = await freshInvitation('z2'));
  });

  test('English copy matches', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL as string }]);
    // Ten questions, about seven minutes, stated honestly before the first tap.
    await page.goto(`/s/${token}`);
    await expect(page.locator('main')).toContainText('10 questions · about 7 min');
    await page.goto(`/s/${token}/q/${FIRST_TEXT}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'repeated task took the most time',
    );
    await expect(page.locator('#text-counter')).toHaveText(/\d+ of 400 characters/);
    await expect(page.locator('main')).toContainText('We mask them.');
    await expect(page.locator('main')).toContainText('Optional');
    await page.goto(`/s/${token}/q/0`);
    await expect(page.locator('button.option-button').last()).toHaveText(
      'I don’t know / It depends',
    );
  });

  test('the API refuses text that is too long, empty, or an unknown option', async ({
    request,
  }) => {
    const post = (body: Record<string, unknown>) =>
      request.post('/api/answer', { data: { token, ...body } });
    expect((await post({ index: FIRST_TEXT, text: 'x'.repeat(401) })).status()).toBe(400);
    expect((await post({ index: FIRST_TEXT, text: '   ' })).status()).toBe(400);
    expect((await post({ index: 0, choice: 'verify_source' })).status()).toBe(400);
    expect((await post({ index: 0, choice: 'unsure' })).status()).toBe(200);
  });

  test('answers all ten questions in French, with free text and a skip, and reads them back', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'evolai_locale', value: 'fr', url: baseURL as string }]);
    // Choice questions: neutral wording, an honest last option, no hint at a right answer.
    await page.goto(`/s/${token}/q/0`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'En général, que faites-vous',
    );
    const options = page.locator('button.option-button');
    await expect(options.last()).toHaveText('Je ne sais pas / Ça dépend');
    await expect(page.locator('main')).not.toContainText(
      /bonne demande|pas toujours la bonne|bonne réponse/i,
    );
    await options.nth(1).click();
    await page.locator('button.text-next').click();
    await expect(page).toHaveURL(/\/q\/1$/);

    for (let i = 1; i < FIRST_TEXT; i += 1) {
      await expect(page).toHaveURL(new RegExp(`/q/${i}$`));
      await page.locator('button.option-button').last().click();
      await page.locator('button.text-next').click();
    }

    // Free text 1: box, hint, counter, hard cap at 400.
    await expect(page).toHaveURL(new RegExp(`/q/${FIRST_TEXT}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'tâche répétitive a pris le plus de temps',
    );
    const box = page.locator('textarea.text-answer-input');
    await expect(box).toBeVisible();
    await expect(page.locator('main')).toContainText(
      'Pas de noms, ni e-mails, ni numéros. Nous les masquons.',
    );
    await expect(page.locator('main')).toContainText('Facultatif');
    await expect(page.locator('#text-counter')).toHaveText('0 sur 400 caractères');
    await box.fill('x'.repeat(450));
    await expect(page.locator('#text-counter')).toHaveText('400 sur 400 caractères');
    await box.fill(TEXT);
    await expect(page.locator('#text-counter')).toHaveText(`${TEXT.length} sur 400 caractères`);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    await page.locator('button.text-next').click();

    // Free text 2: skipped with the Skip link, nothing is saved.
    await expect(page).toHaveURL(new RegExp(`/q/${FIRST_TEXT + 1}$`));
    await page.getByTestId('survey-skip').click();

    // Free text 3: empty box + Next is also a skip.
    await expect(page).toHaveURL(new RegExp(`/q/${FIRST_TEXT + 2}$`));
    await page.locator('button.text-next').click();

    // Read back before finishing: the typed answer is there, the skipped one is empty.
    await page.goto(`/s/${token}/q/${FIRST_TEXT}`);
    await expect(page.locator('textarea.text-answer-input')).toHaveValue(TEXT);
    await page.goto(`/s/${token}/q/${FIRST_TEXT + 1}`);
    await expect(page.locator('textarea.text-answer-input')).toHaveValue('');
    await page.goto(`/s/${token}/q/${FIRST_TEXT + 3}`);

    // Role question: coarse categories only, no text box.
    await expect(page).toHaveURL(new RegExp(`/q/${FIRST_TEXT + 3}$`));
    await expect(page.locator('textarea')).toHaveCount(0);
    expect(await page.locator('button.option-button').count()).toBeLessThanOrEqual(8);
    await page.locator('button.option-button').last().click();
    await page.locator('button.text-next').click();
    await page.waitForURL(/\/done$/);

    // What was stored: the typed words, two saved skips, a coarse role; no text for skips.
    const rows = await dbQuery<{
      sequence: number;
      code: string;
      kind: string;
      text: string | null;
    }>(
      `SELECT a.sequence, qi.code, a.value_json->>'kind' AS kind, a.value_json->>'text' AS text
         FROM answers a
         JOIN question_items qi ON qi.id = a.question_item_id
         JOIN submissions s ON s.id = a.submission_id
         JOIN invitations i ON i.id = s.invitation_id
        WHERE i.token_reference = $1 ORDER BY a.sequence`,
      [reference],
    );
    expect(rows).toHaveLength(10);
    expect(rows.slice(0, 6).every((r) => r.kind === 'scenario_choice')).toBe(true);
    expect(rows[FIRST_TEXT]).toMatchObject({ code: 'v1_repeat_task', kind: 'short_text' });
    expect(rows[FIRST_TEXT]?.text).toContain('recopie les commandes');
    expect(rows[FIRST_TEXT + 1]).toMatchObject({ code: 'v1_missing_tool', kind: 'skipped' });
    expect(rows[FIRST_TEXT + 2]).toMatchObject({ code: 'v1_assistant_wish', kind: 'skipped' });
    expect(rows[FIRST_TEXT + 3]).toMatchObject({ code: 'v1_job_family', kind: 'single_choice' });
  });
});
