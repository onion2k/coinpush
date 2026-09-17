import { describe, expect, it } from 'vitest';
import {
  BOARD,
  BODY_CAPACITY,
  BOTTOM,
  DROP_EVERY,
  FILL,
  HAND0,
  KIND_THICKNESS,
  RAIN,
  SAVE_EVERY,
  TIER,
  TIERS,
  TOP_UP,
  pusherTop,
  tierAt,
} from '../src/machine';
import { Autopilot } from '../src/autopilot';
import { checkInvariants } from '../src/invariants';
import { seeded } from '../src/random';
import { DT, newGame, playUntil, settle, still } from './helpers';

const H = KIND_THICKNESS[0];

/** Coins are neither made nor lost: what is in hand, in the machine and on the board is what it was filled with and given. */
function conserved(game: ReturnType<typeof newGame>['game']) {
  const { hand, given } = game.progress.save;
  return hand + game.world.live + game.board.count === FILL + given;
}

describe('the game', () => {
  it('starts primed and at rest: beds lying flat, more rained on them and piled, some leaning, nothing cutting anything', () => {
    const { game } = newGame();
    const { world } = game;
    expect(world.live + game.progress.save.banked).toBe(FILL);
    expect(game.progress.save.hand).toBe(HAND0 + game.progress.save.banked);
    expect(game.t, 'and no time has passed: the pushers have not stirred').toBe(0);
    const above = new Array<number>(TIERS).fill(0);
    let asleep = 0,
      leaning = 0;
    for (let i = 0; i < world.count; i++) {
      if (!world.alive[i]) continue;
      const k = tierAt(world.y[i]);
      expect(k, `coin ${i} at y ${world.y[i]}`).toBeGreaterThanOrEqual(0);
      if (world.asleep[i]) asleep++;
      if (world.z[i] > TIER[k].z + H) above[k]++;
      if (Math.abs(world.axis(i)[2]) < 0.99) leaning++;
    }
    expect(asleep / world.live, 'at rest before the first frame').toBeGreaterThan(0.95);
    for (let k = 0; k < TIERS; k++) expect(above[k], `piled on tier ${k}`).toBeGreaterThan(RAIN.each / 3);
    expect(leaning, 'some lean').toBeGreaterThan(10);
    expect(checkInvariants(game)).toEqual([]);
    expect(conserved(game)).toBe(true);
  });

  it(
    'piles as it is played: after half a minute fed, a tenth of every shelf lies above the first layer, and nothing at rest cuts anything',
    { timeout: 30_000 },
    () => {
      const { game } = newGame(11);
      const pilot = new Autopilot(game);
      for (let f = 0; f < 60 * 30; f++) pilot.step(DT);
      const { world } = game;
      const shelf = new Array<number>(TIERS).fill(0),
        above = new Array<number>(TIERS).fill(0);
      let leaning = 0;
      for (let i = 0; i < world.count; i++) {
        if (!world.alive[i]) continue;
        const k = tierAt(world.y[i]);
        if (k < 0 || world.z[i] > pusherTop(k) - 0.1) continue;
        shelf[k]++;
        if (world.z[i] > TIER[k].z + H) above[k]++;
        if (world.asleep[i] && Math.abs(world.axis(i)[2]) < 0.99) leaning++;
      }
      for (let k = 0; k < TIERS; k++) expect(above[k] / shelf[k], `tier ${k}`).toBeGreaterThan(0.1);
      expect(leaning, 'some at rest leaning').toBeGreaterThan(10);
      expect(world.deepest(true).depth, 'a twentieth of a unit').toBeLessThanOrEqual(0.0501);
      expect(checkInvariants(game)).toEqual([]);
    },
  );

  it('drops a coin from the hand onto the board, which lands on the top tier, and tells of both', () => {
    const { game, told } = newGame(2);
    settle(game, 60);
    const live = game.world.live;
    game.slide(3);
    expect(game.funnel).toBe(3);
    expect(game.drop()).toBe(true);
    expect(game.progress.save.hand).toBe(HAND0 - 1);
    expect(game.board.count).toBe(1);
    expect(told.some((t) => t.startsWith('dropped'))).toBe(true);
    const frames = playUntil(game, 60 * 8, () => game.board.count === 0);
    expect(frames).toBeLessThan(60 * 8);
    expect(game.world.live).toBe(live + 1 - game.progress.save.banked);
    const landed = told.find((t) => t.startsWith('landed'));
    expect(landed).toBeDefined();
    // the coin that landed is on the top tier, over the pusher or the shelf behind it, and not in a wall
    const slot = +landed!.split(' ').pop()!;
    settle(game, 120);
    expect(game.world.alive[slot]).toBe(1);
    expect(tierAt(game.world.y[slot])).toBe(0);
    expect(game.world.z[slot]).toBeGreaterThan(TIER[0].z);
    expect(checkInvariants(game)).toEqual([]);
    expect(conserved(game)).toBe(true);
  });

  it('takes a coin no faster than the machine does, held or tapped', () => {
    const { game } = newGame(3);
    expect(game.drop()).toBe(true);
    expect(game.drop()).toBe(false);
    settle(game, Math.ceil(DROP_EVERY * 60) + 1);
    expect(game.drop()).toBe(true);
    // held down, a coin every so often and no more
    const before = game.progress.save.hand;
    for (let f = 0; f < 120; f++) game.step(DT, { funnel: null, drop: true });
    const dropped = before - game.progress.save.hand;
    expect(dropped).toBeGreaterThanOrEqual(Math.floor(2 / DROP_EVERY) - 1);
    expect(dropped).toBeLessThanOrEqual(Math.ceil(2 / DROP_EVERY) + 1);
  });

  it('slides the funnel with the controls, and never past its reach', () => {
    const { game } = newGame(4);
    game.step(DT, { funnel: 1, drop: false });
    expect(game.funnel).toBeCloseTo(BOARD.reach, 6);
    game.step(DT, { funnel: 0, drop: false });
    expect(game.funnel).toBeCloseTo(-BOARD.reach, 6);
    game.slide(1000);
    expect(game.funnel).toBe(BOARD.reach);
    game.step(DT, still);
    expect(game.funnel).toBe(BOARD.reach);
  });

  it('is fed by the pushers alone: from the primed start, coins reach the chute inside a minute, each counted once into the hand', () => {
    const { game, told } = newGame(5);
    const frames = playUntil(game, 60 * 60, () => game.progress.save.banked >= 3);
    expect(frames).toBeLessThan(60 * 60);
    const { banked, hand } = game.progress.save;
    expect(banked).toBeGreaterThanOrEqual(3);
    expect(hand).toBe(HAND0 + banked);
    expect(told.filter((t) => t.startsWith('banked'))).toHaveLength(banked);
    expect(game.world.live).toBe(FILL - banked);
    for (let i = 0; i < game.world.count; i++) if (game.world.alive[i]) expect(game.world.z[i]).toBeGreaterThan(BOTTOM);
    expect(checkInvariants(game)).toEqual([]);
    expect(conserved(game)).toBe(true);
  });

  it('gives a top-up when the hand is empty, counts it, and lets the drop go on', () => {
    const { game, told } = newGame(6);
    // the hand emptied by hand, with the count kept honest: as if the machine had given nothing to begin with
    game.progress.save.hand = 0;
    game.progress.save.given -= HAND0;
    const given = game.progress.save.given;
    expect(game.drop()).toBe(true);
    expect(game.progress.save.hand).toBe(TOP_UP - 1);
    expect(game.progress.save.given).toBe(given + TOP_UP);
    expect(told.some((t) => t.startsWith(`topUp ${TOP_UP}`))).toBe(true);
    expect(conserved(game)).toBe(true);
  });

  it(
    'refuses a coin when the board is full, and gives one back when the machine is, losing none',
    { timeout: 30_000 },
    () => {
      const { game, told } = newGame(7);
      // the board packed by hand, drop after drop with no time passing
      while (game.board.drop(0));
      expect(game.drop()).toBe(false);
      expect(told.some((t) => t.startsWith('refused'))).toBe(true);
      // the machine filled to the brim: a coin that lands with no room comes back to the hand
      const { game: full, told: said } = newGame(8);
      settle(full, 60);
      const random = seeded(8);
      const hand = full.progress.save.hand,
        won = full.progress.save.banked;
      expect(full.drop()).toBe(true);
      expect(full.progress.save.hand).toBe(hand - 1);
      // The coin put at the foot of the board, and the machine filled to the brim at that moment with coins in
      // the air over the back of every tier: a machine that full pours coins into the chute every frame, so only
      // in the same frame does the coin find no room. What a brimful machine costs a frame is the perf gate's.
      full.board.h[0] = BOARD.height - 0.01;
      let put = 0;
      for (let k = 0; full.world.live < BODY_CAPACITY; k++) {
        const t = TIER[k % TIERS];
        const y = t.back - 1 - random() * (t.back - t.front - 4);
        if (full.world.spawn(0, (random() * 2 - 1) * 16, y, t.z + 6 + random() * 8) >= 0) put++;
      }
      full.progress.save.given += put; // the test's own coins, so the count still adds up
      expect(full.world.live).toBe(BODY_CAPACITY);
      full.step(DT, still);
      expect(full.board.count).toBe(0);
      expect(said.some((t) => t.startsWith('returned'))).toBe(true);
      expect(full.progress.save.hand).toBe(hand + (full.progress.save.banked - won));
      expect(conserved(full)).toBe(true);
    },
  );

  it('writes the save when something has changed and time has passed, and every coin comes back where it was', () => {
    const { game, store } = newGame(9);
    settle(game, 60);
    expect(store.json).toBe(null);
    game.drop();
    settle(game, Math.ceil(SAVE_EVERY * 60) + 2);
    expect(store.json).not.toBe(null);
    const saved = JSON.parse(store.json!) as { coins: number[]; flight: number[]; hand: number; banked: number };
    expect(saved.hand).toBe(HAND0 - 1 + saved.banked);
    expect(saved.coins.length / 3 + saved.flight.length / 4).toBe(FILL + 1 - saved.banked);
    // loaded again from a save written now: the same coins in the same places, and the same hand
    game.persist();
    const { game: again } = newGame(9, store.json);
    expect(again.world.live).toBe(game.world.live);
    expect(again.board.count).toBe(game.board.count);
    expect(again.progress.save.hand).toBe(game.progress.save.hand);
    const at = (g: typeof game) =>
      [...Array(g.world.count).keys()]
        .filter((i) => g.world.alive[i])
        .map((i) => [g.world.x[i], g.world.y[i], g.world.z[i]].map((v) => Math.round(v * 100) / 100).join(','))
        .sort();
    expect(at(again)).toEqual(at(game));
    // and lying as it lay: a coin that leant comes back leaning the same way
    const lie = (g: typeof game) =>
      [...Array(g.world.count).keys()].filter((i) => g.world.alive[i]).map((i) => g.world.axis(i));
    const lay = lie(game),
      lies = lie(again);
    expect(lay.filter((n) => Math.abs(n[2]) < 0.99).length, 'some were leaning').toBeGreaterThan(5);
    // to within what a save keeps of it, a hundredth each way: a degree or so
    const turned = lay.filter((n, i) => n[0] * lies[i][0] + n[1] * lies[i][1] + n[2] * lies[i][2] < 0.9995);
    expect(turned, 'coins not lying as they lay').toEqual([]);
    // and the pushers where they were in their stroke, so no coin comes back inside one
    expect(again.t).toBe(game.t);
    for (let k = 0; k < TIERS; k++) expect(again.pushers.extension(k)).toBeCloseTo(game.pushers.extension(k), 6);
    expect(conserved(again)).toBe(true);
    expect(checkInvariants(again)).toEqual([]);
  });

  it('comes back from a save with every pusher where it was, and plays on with no coin flung or buried by one', () => {
    // saved with the second tier's pusher right back, which at the start of a game is nearly right out: put back
    // to the start, it would come down on four rows of coins
    const { game, store } = newGame(4);
    playUntil(game, 60 * 10, () => game.pushers.extension(1) < 0.02 && game.t > 1);
    expect(game.pushers.extension(1)).toBeLessThan(0.02);
    game.persist();
    const { game: again } = newGame(4, store.json);
    const inside = (g: typeof game) => {
      let n = 0;
      for (let i = 0; i < g.world.count; i++) {
        if (!g.world.alive[i]) continue;
        for (const box of g.pushers.boxes)
          if (
            Math.abs(g.world.y[i] - box.y) < box.hy - 0.1 &&
            Math.abs(g.world.z[i] - box.z) < box.hz - 0.1 &&
            Math.abs(g.world.x[i] - box.x) < box.hx
          )
            n++;
      }
      return n;
    };
    expect(inside(again), 'coins inside a pusher as it loads').toBe(0);
    settle(again, 120);
    expect(inside(again), 'coins inside a pusher two seconds on').toBe(0);
    expect(checkInvariants(again)).toEqual([]);
  });
});
