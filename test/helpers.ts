/** What the tests share: a new game in memory, from a seed, with a note of every event it tells. */
import { Game, type Controls, type GameEvents } from '../src/game';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

export const DT = 1 / 60;
/** The controls left alone: the funnel where it is, nothing dropped. */
export const still: Controls = { funnel: null, drop: false };

export function newGame(seed = 1, json: string | null = null) {
  const store = memoryStore(json);
  const told: string[] = [];
  const events: GameEvents = new Proxy(
    {},
    {
      get:
        (_, name: string) =>
        (...args: unknown[]) =>
          told.push(`${name} ${args.filter((a) => typeof a === 'number').join(' ')}`.trim()),
    },
  );
  const game = new Game(new Progress(store), events, { random: seeded(seed) });
  return { game, store, told };
}

/** Play `frames` frames with the controls left alone. */
export function settle(game: Game, frames = 120) {
  for (let f = 0; f < frames; f++) game.step(DT, still);
}

/** Play until `done`, or `frames` are up; how many were played. */
export function playUntil(game: Game, frames: number, done: () => boolean, controls: Controls = still): number {
  let f = 0;
  for (; f < frames && !done(); f++) game.step(DT, controls);
  return f;
}
