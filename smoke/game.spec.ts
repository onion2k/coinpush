/**
 * The game as a player gets it: served by Vite, run in Chromium on the real
 * GPU, with a fresh save each test. What the unit tests cannot reach — the
 * renderer, the keyboard, the pointer, the frame loop, the page — checked
 * for the things that would make it plainly broken: an error, a black
 * screen, a coin that does not drop, a save that does not come back.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { start, watch } from './game';

/** How many frames the page draws in a second. */
function framesInASecond(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const began = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - began < 1000) requestAnimationFrame(tick);
          else resolve(n);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/** How much a screenshot has in it: the spread of its brightness, and the share of it that is not near black. */
function content(png: Buffer) {
  const img = PNG.sync.read(png);
  let sum = 0,
    sq = 0,
    lit = 0;
  const n = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    const y = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    sum += y;
    sq += y * y;
    if (y > 40) lit++;
  }
  const mean = sum / n;
  return { spread: Math.sqrt(sq / n - mean * mean), lit: lit / n };
}

/** Whether the game has told of a coin dropped since last asked. */
const dropped = (page: Page) => page.evaluate(() => window.game!.events().some((e) => e.startsWith('dropped')));

test('boots with no errors and draws the machine', async ({ page }, info) => {
  const problems = watch(page);
  await start(page);
  expect(await framesInASecond(page)).toBeGreaterThan(20);
  const state = await page.evaluate(() => window.game!.state());
  expect(state.live, 'coins in the machine').toBeGreaterThan(1000);
  const shot = await page.screenshot();
  await info.attach('machine', { body: shot, contentType: 'image/png' });
  const c = content(shot);
  expect(c.lit, 'share of the screen lit').toBeGreaterThan(0.2);
  expect(c.spread, 'variety in the picture').toBeGreaterThan(20);
  expect(await page.evaluate(() => window.game!.invariants())).toEqual([]);
  expect(problems).toEqual([]);
});

test('drops a coin by the keyboard, and slides the funnel by it', async ({ page }) => {
  const problems = watch(page);
  await start(page);
  const before = await page.evaluate(() => window.game!.state());
  await page.keyboard.press(' ');
  await expect.poll(() => dropped(page), { timeout: 5000 }).toBe(true);
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(() => page.evaluate(() => window.game!.state().funnel), { timeout: 5000 })
    .toBeGreaterThan(before.funnel + 2);
  await page.keyboard.up('ArrowRight');
  expect(problems).toEqual([]);
});

test('drops a coin by a click, from where the pointer is', async ({ page }) => {
  const problems = watch(page);
  await start(page);
  const size = page.viewportSize()!;
  await page.mouse.click(size.width * 0.8, size.height * 0.5);
  await expect.poll(() => dropped(page), { timeout: 5000 }).toBe(true);
  // the pointer four fifths of the way across put the funnel well to the right
  expect(await page.evaluate(() => window.game!.state().funnel)).toBeGreaterThan(4);
  expect(problems).toEqual([]);
});

test('keeps the hand and the machine across a reload', async ({ page }) => {
  const problems = watch(page);
  await start(page);
  const before = await page.evaluate(() => {
    const g = window.game!;
    g.pause();
    g.give(123);
    g.step(1);
    g.save();
    return g.state();
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.game?.ready ?? false), { timeout: 60_000 }).toBe(true);
  const after = await page.evaluate(() => window.game!.state());
  expect(after.hand).toBe(before.hand);
  expect(after.banked).toBe(before.banked);
  expect(after.live, 'every coin put back').toBe(before.live);
  expect(problems).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true });

  test('boots, nothing is wider than the screen, and a finger drops a coin', async ({ page }, info) => {
    const problems = watch(page);
    await start(page);
    await expect(page.locator('#hand')).toBeVisible();
    await info.attach('phone', { body: await page.screenshot(), contentType: 'image/png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
    await page.touchscreen.tap(200, 430);
    await expect.poll(() => dropped(page), { timeout: 5000 }).toBe(true);
    expect(problems).toEqual([]);
  });
});
