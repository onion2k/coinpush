/**
 * What the game looks like, held to pictures taken before. Every other check
 * is on what the game does; nothing until now noticed a palette gone muddy,
 * a light lost, or the rock drawn over the floor.
 *
 * Each scene is set through the test API with chance seeded from before the
 * game is built, the game paused, the camera parked by hand, and a fixed
 * number of frames stepped, so the same machine draws the same pixels every
 * run. The pictures are in `smoke/screens/`. They are this machine's GPU:
 * another one will draw them a little differently, so the tolerance is
 * loose and the pictures are not worth arguing with from elsewhere.
 *
 *   npm run look               the scenes against the pictures
 *   npm run look:update        the pictures written again, after a change meant to alter them
 *
 * A failure leaves the picture, what was drawn and the difference in
 * `test-results/`. Look at all three before deciding which is right.
 */
import { expect, test, type Page } from '@playwright/test';
import { standardView, start, watch } from './game';

/** How far the pictures may differ before it is a change and not the GPU: a fiftieth of the pixels, each well off. */
const TOLERANCE = { maxDiffPixelRatio: 0.002, threshold: 0.02 };

/** The corner that counts the milliseconds a frame takes is different every run, and says nothing about the look. */
async function hideStats(page: Page) {
  await page.locator('#stats').evaluate((el: HTMLElement) => (el.hidden = true));
}

test.describe('what it looks like', () => {
  test('the machine, from the start', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => window.game!.step(180));
    await standardView(page);
    await page.evaluate(() => window.game!.step(1));
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('machine.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('coins falling down the board', async ({ page }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.feed(true);
      g.step(100);
      g.feed(false);
      g.look(0, 0, 24, { azimuth: -Math.PI / 2, polar: 1.25, radius: 60 });
      g.step(1);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('board.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test('a bed up close, played for a while: coins lying on coins, leaning and lapped, none cutting another', async ({
    page,
  }) => {
    const problems = watch(page);
    await start(page, { seed: 11, paused: true });
    await page.evaluate(() => {
      const g = window.game!;
      g.feed(true);
      g.step(60 * 20);
      g.feed(false);
      g.step(120);
      // the top tier's bed, from just above its edge, looking back along it toward the pusher
      g.look(-6, -8, 8.6, { azimuth: -Math.PI / 2 + 0.5, polar: 1.15, radius: 9 });
      g.step(1);
    });
    await hideStats(page);
    await expect(page.locator('#view')).toHaveScreenshot('bed.png', TOLERANCE);
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });

    test('the machine, upright, as the page fits it', async ({ page }) => {
      const problems = watch(page);
      await start(page, { seed: 11, paused: true });
      await page.evaluate(() => window.game!.step(181));
      await hideStats(page);
      await expect(page).toHaveScreenshot('phone.png', TOLERANCE);
      expect(problems).toEqual([]);
    });
  });
});
