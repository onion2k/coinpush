/**
 * The game played by a monkey: the real game, without the picture, driven
 * at random and made to do at random everything a player can make happen —
 * dropping a coin, sliding the funnel, holding the drop down, dropping at
 * the very ends of the funnel's reach, waiting, saving and loading — and
 * checked after every few frames for anything that must always hold and
 * does not (`invariants.ts`), and for anything thrown.
 *
 * Only what a player could do. A monkey that did what no player can would
 * find bugs no player will. A new thing a player can do gets an action here.
 *
 * From a seed, so a failure can be played again exactly: `npm run fuzz --
 * --seed N` does, and prints what was done before it went wrong.
 */
import { Game, type GameEvents } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { BOARD } from '../src/machine';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';

const DT = 1 / 60;
/** How many frames between checks, when nothing has just been done. */
const CHECK_EVERY = 10;
/** How many of the last things done a failure reports. */
const LOG_TAIL = 25;

export interface FuzzFailure {
  seed: number;
  frame: number;
  problems: string[];
  /** The last things done before it, oldest first. */
  log: string[];
}

export interface FuzzResult {
  seed: number;
  frames: number;
  failure: FuzzFailure | null;
  /** How often each thing was done, and each event happened: to see that the monkey got about. */
  done: Record<string, number>;
  happened: Record<string, number>;
}

/** Play `frames` frames of the game at random from `seed`. */
export function fuzz(seed: number, frames: number): FuzzResult {
  // the monkey's own chance, apart from the game's, so what it decides does not shift what the game does
  const random = seeded(seed * 7 + 1);
  const happened: Record<string, number> = {};
  const done: Record<string, number> = {};
  const count = (into: Record<string, number>, key: string) => (into[key] = (into[key] ?? 0) + 1);
  const events: GameEvents = new Proxy(
    {},
    {
      get: (_, name: string) => () => count(happened, name),
    },
  );
  const log: string[] = [];
  let frame = 0;
  const fail = (problems: string[]): FuzzResult => ({
    seed,
    frames: frame,
    failure: { seed, frame, problems, log: log.slice(-LOG_TAIL) },
    done,
    happened,
  });

  try {
    let store = memoryStore();
    let game = new Game(new Progress(store), events, { random: seeded(seed) });
    /** Whether the drop is being held down, and for how many more frames the monkey is busy with what it chose. */
    let held = false;
    let busy = 0;
    const between = (a: number, b: number) => a + random() * (b - a);
    const did = (what: string) => {
      count(done, what);
      log.push(`frame ${frame}: ${what}`);
    };
    /** Everything a player can make happen, each as often as it is weighted. */
    const actions: [number, () => void][] = [
      [
        6,
        () => {
          game.drop();
          did('drop');
        },
      ],
      [
        4,
        () => {
          game.slide(between(-BOARD.reach, BOARD.reach));
          did('slide');
        },
      ],
      [
        3,
        () => {
          // the drop held down: a coin as often as the machine takes one, for a while
          held = true;
          busy = Math.floor(between(30, 240));
          did('feed');
        },
      ],
      [
        1,
        () => {
          // a coin from the very end of the funnel's reach, either end
          game.slide(random() < 0.5 ? -BOARD.reach : BOARD.reach);
          game.drop();
          did('edge');
        },
      ],
      [
        2,
        () => {
          held = false;
          busy = Math.floor(between(30, 180));
          did('wait');
        },
      ],
      [
        1,
        () => {
          // saved, and loaded again into a new game as a reload would: the hand, the winnings and every coin must be kept
          const { hand, banked } = game.progress.save;
          const coins = game.world.live + game.board.count;
          game.persist();
          store = memoryStore(store.json);
          game = new Game(new Progress(store), events, { random: seeded(seed + frame) });
          if (game.progress.save.hand !== hand)
            throw new Error(`the hand was ${hand} and loaded as ${game.progress.save.hand}`);
          if (game.progress.save.banked !== banked)
            throw new Error(`the winnings were ${banked} and loaded as ${game.progress.save.banked}`);
          if (game.world.live + game.board.count !== coins)
            throw new Error(`${coins} coins were saved and ${game.world.live + game.board.count} loaded`);
          did('reload');
        },
      ],
    ];
    const total = actions.reduce((n, [w]) => n + w, 0);
    const act = () => {
      let pick = random() * total;
      for (const [w, go] of actions) {
        if ((pick -= w) < 0) return go();
      }
    };

    for (frame = 1; frame <= frames; frame++) {
      if (busy > 0) busy--;
      else {
        held = false;
        act();
      }
      game.step(DT, { funnel: null, drop: held });
      if (frame % CHECK_EVERY === 0) {
        const problems = checkInvariants(game);
        if (problems.length) return fail(problems);
      }
    }
    return { seed, frames, failure: null, done, happened };
  } catch (err) {
    return fail([`threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`]);
  }
}
