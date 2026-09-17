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
        const { coins: _c, flight: _f, ...kept } = before;
        expect(after).toMatchObject(kept);
        // a save without its coins is a machine primed afresh; one with them comes back as it was
        expect(after.coins.length / 3).toBe(before.coins.length ? before.coins.length / 3 : game.world.live);
        expect(after.flight).toEqual(before.flight);
      });
    });
  }

  it('takes defaults for what an old save lacks, and shrugs at what it cannot read', () => {
    const fresh = { hand: 100, banked: 0, given: 100, coins: [], flight: [] };
    expect(new Progress(memoryStore('{"banked": 3}')).save).toEqual({ ...fresh, banked: 3 });
    expect(new Progress(memoryStore('not json')).save).toEqual(fresh);
    expect(new Progress(memoryStore('{"hand": "lots"}')).save).toEqual(fresh);
    // coins that are not numbers, or not in threes, are left out rather than put somewhere
    expect(new Progress(memoryStore('{"coins": [1, 2, 3, "x", 5, 6, 7]}')).save.coins).toEqual([1, 2, 3]);
    expect(new Progress(memoryStore('{"flight": [1, 2, 3]}')).save.flight).toEqual([]);
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
