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
    game.world.z[slot] = TIER[1].z + 0.1;
    expect(checkInvariants(game).join('\n')).toMatch(/below its floor/);
    game.world.y[slot] = y;
    game.world.z[slot] = z;
    game.world.x[slot] = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/not a number/);
    game.world.x[slot] = x;
    game.progress.save.hand = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/the hand is -1/);
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
