import { describe, expect, it } from 'vitest';
import { BACK, FILL, TIER } from '../src/machine';
import { checkInvariants } from '../src/invariants';
import { newGame, settle } from './helpers';

describe('what must always hold', () => {
  it('holds of a new game', () => {
    const { game } = newGame();
    settle(game);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reports a coin in a wall, one below its floor, one that is not a number, and a hand that is not whole', () => {
    const { game } = newGame();
    settle(game);
    const slot = [...Array(game.world.count).keys()].find((i) => game.world.alive[i])!;
    const [x, y, z] = [game.world.x[slot], game.world.y[slot], game.world.z[slot]];
    game.world.x[slot] = 0;
    game.world.y[slot] = BACK + 0.5;
    expect(checkInvariants(game).join('\n')).toMatch(/in a wall/);
    game.world.x[slot] = x;
    game.world.y[slot] = (TIER[1].back + TIER[1].front) / 2;
    game.world.z[slot] = TIER[1].z + 0.03;
    expect(checkInvariants(game).join('\n')).toMatch(/below its floor/);
    game.world.y[slot] = y;
    game.world.z[slot] = z;
    game.world.x[slot] = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/not a number/);
    game.world.x[slot] = x;
    game.progress.save.hand = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/the hand is -1/);
  });

  it('reports two coins at rest cutting into each other, and lets two being shoved be', () => {
    const { game } = newGame();
    const { world } = game;
    const asleep = [...Array(world.count).keys()].filter(
      (i) => world.alive[i] && world.asleep[i] && Math.abs(world.axis(i)[2]) > 0.999,
    );
    const [a, b] = asleep;
    const was = [world.x[b], world.y[b], world.z[b]];
    // the second put half across the first, in the same plane: a third of a unit into it
    world.x[b] = world.x[a] + 0.5;
    world.y[b] = world.y[a];
    world.z[b] = world.z[a];
    expect(checkInvariants(game).join('\n')).toMatch(/at rest.* into/);
    // awake, it is being put right, and that is not a rule broken
    world.wake(b);
    expect(checkInvariants(game).join('\n')).not.toMatch(/at rest.* into/);
    [world.x[b], world.y[b], world.z[b]] = was;
  });

  it('reports coins made or lost, and a funnel out of reach', () => {
    const { game } = newGame();
    settle(game);
    const slot = [...Array(game.world.count).keys()].find((i) => game.world.alive[i])!;
    game.world.remove(slot);
    expect(checkInvariants(game).join('\n')).toMatch(new RegExp(`${FILL}`));
    game.progress.save.hand += 1;
    expect(checkInvariants(game)).toEqual([]);
    game.funnel = 1e4;
    expect(checkInvariants(game).join('\n')).toMatch(/funnel/);
  });
});
