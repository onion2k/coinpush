/**
 * The game played through in a real browser: a coin dropped from the
 * funnel, down the board, onto the top tier, and the machine fed until
 * coins come out of the chute into the hand. Played through the test API
 * with the game paused and stepped a frame at a time, so it is the same
 * every run and waits on no clock — but everything that follows, the board,
 * the physics, the scene, the words on the screen, is the game's own.
 *
 * A feature that a player can reach gets a stage here, and after every
 * stage the game's invariants are checked.
 */
import { expect, test, type Page } from '@playwright/test';
import { start, watch } from './game';

/** Play `frames` frames, and check nothing that must hold has broken. */
async function play(page: Page, frames: number, stage: string) {
  const broken = await page.evaluate((n) => {
    window.game!.step(n);
    return window.game!.invariants();
  }, frames);
  expect(broken, `invariants after ${stage}`).toEqual([]);
}

test('a coin dropped falls down the board onto the top tier, and the machine fed pays out into the hand', async ({
  page,
}, info) => {
  const problems = watch(page);
  await start(page, { seed: 1, paused: true });
  await play(page, 60, 'settling');
  const before = await page.evaluate(() => {
    const g = window.game!;
    g.events();
    return g.state();
  });
  expect(await page.evaluate(() => window.game!.drop(3)), 'a coin dropped').toBe(true);
  expect((await page.evaluate(() => window.game!.state())).flying).toBe(1);
  let landed = false;
  for (let f = 0; f < 60 * 8 && !landed; f += 10) {
    await play(page, 10, 'a coin falling down the board');
    landed = await page.evaluate(() => window.game!.events().some((e) => e.startsWith('landed')));
  }
  expect(landed, 'the coin landed').toBe(true);
  const after = await page.evaluate(() => window.game!.state());
  expect(after.flying).toBe(0);
  expect(after.live, 'the coin is in the machine').toBe(before.live + 1 - (after.banked - before.banked));
  // the drop held down, until the chute has paid
  await page.evaluate(() => window.game!.feed(true));
  let banked = after.banked;
  for (let s = 0; s < 120 && banked === after.banked; s++) {
    await play(page, 60, 'feeding the machine');
    banked = await page.evaluate(() => window.game!.state().banked);
  }
  await page.evaluate(() => window.game!.feed(false));
  expect(banked, 'coins out of the chute').toBeGreaterThan(after.banked);
  const state = await page.evaluate(() => window.game!.state());
  await expect(page.locator('#hand b')).toHaveText(String(state.hand));
  await expect(page.locator('#won')).toHaveText(String(state.banked));
  await info.attach('paid', { body: await page.screenshot(), contentType: 'image/png' });
  expect(problems).toEqual([]);
});
