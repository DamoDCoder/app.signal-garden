import { expect, test } from '@playwright/test';

/**
 * The primary journey, which is an M1 exit criterion: start a run, watch the
 * garden move, change a control, and finish with a scorecard.
 *
 * It needs a daemon. `docker compose up` provides one; so does `task serve` in
 * the daemon checkout. Nothing here stubs the transport, because the thing
 * under test is that a browser and the daemon agree on the contract.
 */
test('start a run, steer it, and finish it', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Seed').fill('42');
  await page.getByRole('button', { name: 'Start run' }).click();

  // A frame per tick, so the stream going live is the first evidence.
  await expect(page.getByTestId('stream-status')).toHaveText('live');
  await expect(page.getByTestId('organisms').locator('li').first()).toBeVisible();

  // Simulation time has to move on its own.
  const firstTick = await page.getByTestId('garden-tick').textContent();
  await expect(page.getByTestId('garden-tick')).not.toHaveText(firstTick ?? '');

  // A control change is staged and reports the tick it lands on.
  await page.getByLabel('pest').fill('5');
  await page.getByRole('button', { name: 'Apply change' }).click();
  await expect(page.getByText(/takes effect at tick/)).toBeVisible();

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByTestId('run-summary')).toBeVisible();
});
