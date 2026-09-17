/**
 * Saves from every shape the game has ever written, kept in `test/saves`, all
 * still loading and playing. A player's save outlives the code that wrote it.
 *
 * A save whose shape is new needs a file here. The last test sees to that: it
 * fails when the game writes a field no file in the corpus has.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import { FILL } from '../src/machine';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

const DIR = new URL('saves/', import.meta.url);
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
const read = (file: string) => readFileSync(new URL(file, DIR), 'utf8');

/** What each save was worth when it was written, and what loading it must keep. */
const KEPT: Record<string, Record<string, unknown>> = {
  // the stub's save: what it banked is what has been won, and the rest starts afresh
  '01-first.json': { banked: 7, hand: 100 },
  '02-coins.json': { banked: 21, hand: 113, given: 100 },
  // coins that lie as they lay, the time, which is where the pushers were, and what the machine was filled with
  '03-tilts.json': { banked: 38, hand: 130, given: 100, filled: 1500, time: 12.016666666666843 },
};

describe('saves from every shape the game has written', () => {
  it('has a file for every shape, oldest first', () => {
    expect(files).toEqual(Object.keys(KEPT).sort());
  });

  for (const file of files) {
    describe(file, () => {
      it('loads with what it banked kept', () => {
        const save = new Progress(memoryStore(read(file))).save;
        for (const [key, was] of Object.entries(KEPT[file])) expect(save[key as keyof typeof save]).toEqual(was);
        expect(Number.isFinite(save.hand) && save.hand >= 0).toBe(true);
      });

      it('plays on from where it left off, and breaks no rule', () => {
        const game = new Game(new Progress(memoryStore(read(file))), {}, { random: seeded(7) });
        for (let f = 0; f < 300; f++) game.step(1 / 60, { funnel: 0.5, drop: f % 30 === 0 });
        expect(checkInvariants(game)).toEqual([]);
      });

      it('comes back as it went, written again in the shape of today', () => {
        const store = memoryStore(read(file));
        const before = new Progress(store).save;
        expect(store.json, 'loading alone must not write').toBe(read(file));
        const game = new Game(new Progress(store), {}, { random: seeded(1) });
        game.persist();
        const after = new Progress(memoryStore(store.json)).save;
        // a machine primed afresh says what with; the rest is as it was, the time with it
        const { coins, tilts, flight, filled, ...kept } = before;
        expect(after).toMatchObject(kept);
        expect(after.filled).toBe(filled || FILL);
        // a save without its coins is a machine primed afresh; one with them comes back as it was
        if (coins.length) expect(after.coins).toEqual(coins);
        else expect(after.coins.length / 3).toBe(game.world.live);
        expect(after.flight).toEqual(flight);
        // every coin lying as the save says, to the hundredth a save keeps, or flat if it does not say
        expect(after.tilts.length).toBe(after.coins.length);
        if (coins.length)
          after.tilts.forEach((n, i) =>
            expect(Math.abs(n - (tilts.length ? tilts[i] : i % 3 === 2 ? 1 : 0))).toBeLessThan(0.011),
          );
      });
    });
  }

  it('balances the books of a save against what its machine was filled with, not what a machine is filled with now', () => {
    // a save from a machine filled with three more than today's: the hand, the machine and the board make 1603
    const old = new Progress(memoryStore(read('02-coins.json'))).save;
    expect(old.filled).toBe(old.hand + old.coins.length / 3 + old.flight.length / 4 - old.given);
    expect(old.filled).not.toBe(FILL);
    // a save that says what it was filled with is believed, and one with no coins has no machine to have filled
    expect(new Progress(memoryStore('{"coins": [1, 2, 3], "filled": 40}')).save.filled).toBe(40);
    expect(new Progress(memoryStore('{"banked": 3}')).save.filled).toBe(0);
    // a new machine says what it was primed with, and it comes back
    const store = memoryStore();
    const game = new Game(new Progress(store), {}, { random: seeded(2) });
    expect(game.progress.save.filled).toBe(FILL);
    game.persist();
    expect(new Progress(memoryStore(store.json)).save.filled).toBe(FILL);
  });

  it('takes defaults for what an old save lacks, and shrugs at what it cannot read', () => {
    const fresh = { hand: 100, banked: 0, given: 100, coins: [], tilts: [], flight: [], time: 0, filled: 0 };
    expect(new Progress(memoryStore('{"banked": 3}')).save).toEqual({ ...fresh, banked: 3 });
    expect(new Progress(memoryStore('not json')).save).toEqual(fresh);
    expect(new Progress(memoryStore('{"hand": "lots"}')).save).toEqual(fresh);
    // coins that are not numbers, or not in threes, are left out rather than put somewhere
    expect(new Progress(memoryStore('{"coins": [1, 2, 3, "x", 5, 6, 7]}')).save.coins).toEqual([1, 2, 3]);
    expect(new Progress(memoryStore('{"flight": [1, 2, 3]}')).save.flight).toEqual([]);
    // tilts that do not match the coins are left out whole: a coin with someone else's tilt is worse than one lying flat
    expect(new Progress(memoryStore('{"coins": [1, 2, 3], "tilts": [0, 0, 1, 0, 0, 1]}')).save.tilts).toEqual([]);
    expect(new Progress(memoryStore('{"coins": [1, 2, 3], "tilts": [0, 0.6, 0.8]}')).save.tilts).toEqual([0, 0.6, 0.8]);
  });

  it('puts a save with thousands of coins back where they were, at the size the leak watch allows', () => {
    const game = new Game(new Progress(memoryStore()), {}, { random: seeded(3) });
    for (let f = 0; f < 120; f++) game.step(1 / 60, { funnel: null, drop: false });
    game.persist();
    const json = game.progress.save;
    expect(json.coins.length / 3).toBe(game.world.live);
    expect(JSON.stringify(json).length).toBeLessThan(200_000);
    const again = new Game(new Progress(memoryStore(JSON.stringify(json))), {}, { random: seeded(4) });
    expect(again.world.live).toBe(game.world.live);
    let moved = 0;
    for (let i = 0; i < game.world.count; i++) {
      if (!game.world.alive[i]) continue;
      if (
        Math.hypot(
          again.world.x[i] - game.world.x[i],
          again.world.y[i] - game.world.y[i],
          again.world.z[i] - game.world.z[i],
        ) > 0.01
      )
        moved++;
    }
    expect(moved).toBe(0);
  });

  it('has the shape the game writes now: a new field means a new file here', () => {
    const game = new Game(new Progress(memoryStore()));
    game.persist();
    const now = Object.keys(JSON.parse(JSON.stringify(game.progress.save)) as object).sort();
    const newest = Object.keys(JSON.parse(read(files[files.length - 1])) as object).sort();
    expect(newest, 'add a save in the new shape to test/saves').toEqual(now);
  });
});
