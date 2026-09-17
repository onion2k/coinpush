/** The autopilot as a measuring instrument: it feeds the machine steadily, on more than one seed, and coins come out. */
import { describe, expect, it } from 'vitest';
import { Autopilot } from '../src/autopilot';
import { checkInvariants } from '../src/invariants';
import { DT, newGame } from './helpers';

describe('the autopilot', () => {
  for (const seed of [1, 2, 3]) {
    it(`feeds a coin a second and wins ten inside two minutes from seed ${seed}, breaking no rule`, () => {
      const { game } = newGame(seed);
      const pilot = new Autopilot(game);
      let f = 0;
      for (; f < 120 * 60 && game.progress.save.banked < 10; f++) pilot.step(DT);
      expect(game.progress.save.banked).toBeGreaterThanOrEqual(10);
      // fed at about its rate: the hand is down by about a coin a second, less what came back
      const fed = game.progress.save.given - game.progress.save.hand + game.progress.save.banked;
      expect(fed).toBeGreaterThan((f / 60) * 0.8);
      expect(checkInvariants(game)).toEqual([]);
    });
  }
});
