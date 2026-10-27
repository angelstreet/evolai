import { expect, test } from '@playwright/test';

/**
 * One set of lessons (TASK-AI L2): the old /learn pages open the front page's Learn at the same
 * lesson, and the address loses its `?learn=` once open. No account needed.
 */
const PATHS = ['/learn', '/learn/how', '/learn/questions', '/learn/results', '/learn/videos'];

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'evolai_locale', value: 'en', url: baseURL as string }]);
});

for (const [i, path] of PATHS.entries()) {
  test(`${path} opens lesson ${i + 1} of 5 on the front page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByTestId('ck-crumb')).toContainText(`Lesson ${i + 1} of 5`);
    await expect(page.locator('.ck-menu button[data-k=learn]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page).toHaveURL(/\/$/);
  });
}
