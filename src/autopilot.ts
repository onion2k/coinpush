/**
 * The machine fed by the game itself: a coin a second, at a spot along the
 * funnel's reach chosen by a chance of its own, for measuring how the
 * machine pays out without a person at the controls.
 *
 * Everything that holds the game to a figure — the pace gate, the
 * determinism check, the leak watch — plays through this, so it is a
 * measuring instrument first: it must keep feeding and never stall. The
 * hand is topped up by the machine itself, and a drop the board refuses is
 * simply tried again next second.
 *
 * It is handed the game, and knows nothing of the page.
 */
import type { Controls, Game } from './game';
import { BOARD } from './machine';
import { seeded, type Random } from './random';

/** How often it drops a coin, in seconds. */
export const FEED_EVERY = 1;
const still: Controls = { funnel: null, drop: false };

export class Autopilot {
  /** How many coins it has fed the machine. */
  fed = 0;
  private nextFeed = 0;

  /** Its chance is its own, apart from the game's, so where it feeds does not shift what the machine does with chance. */
  constructor(
    readonly game: Game,
    private readonly random: Random = seeded(99),
  ) {}

  /** One frame: a coin if it is time for one, then the game. */
  step(dt: number) {
    const { game } = this;
    if (game.t >= this.nextFeed) {
      this.nextFeed = game.t + FEED_EVERY;
      game.slide((this.random() * 2 - 1) * BOARD.reach);
      if (game.drop()) this.fed++;
    }
    game.step(dt, still);
  }
}
