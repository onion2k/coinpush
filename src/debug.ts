/**
 * `window.game`: the game, for tests and for poking at from the console.
 * Everything a test needs to set a scene, play it exactly and read back
 * what happened, so no test waits on a clock or reaches into the game's
 * insides.
 *
 * Time is the test's to keep: `pause` stops the game where it is, and
 * `step` plays it on a frame at a time, exactly, drawing the last. `seed`
 * makes chance repeat. Anything that changes the game goes through here,
 * and `state`, `bodies`, `board`, `events` and `invariants` read it back.
 *
 * The types are shared with the smoke tests, so a test that calls something
 * that is not here does not compile.
 */
import type { Controls, Game } from './game';
import { checkInvariants } from './invariants';
import {
  BOARD,
  BODY_CAPACITY,
  COIN,
  FILL,
  FRONT,
  KIND_NAME,
  PINS,
  TIER,
  TIERS,
  WIDTH,
  pusherTop,
  tierAt,
} from './machine';
import { seeded } from './random';

declare global {
  interface Window {
    game?: GameApi;
  }
}

export interface GameState {
  /** Game time, in seconds. */
  t: number;
  frame: number;
  paused: boolean;
  hand: number;
  banked: number;
  given: number;
  /** How many coins are in the machine, and how many on the board. */
  live: number;
  flying: number;
  funnel: number;
  /** How far out each tier's pusher is, 0 to 1. */
  pushers: number[];
}

/** A coin in the machine. */
export interface Body {
  slot: number;
  kind: string;
  x: number;
  y: number;
  z: number;
  asleep: boolean;
  /** Which tier it is on, or -1 in the chute or behind the wall. */
  tier: number;
}

/** A coin on the board: across, and down from the top. */
export interface Flying {
  x: number;
  h: number;
}

/** Where things are, for setting a scene without importing the game's source. */
export interface Content {
  width: number;
  tiers: { z: number; back: number; front: number; top: number }[];
  board: { height: number; foot: number; reach: number; pins: { x: number; h: number }[] };
  /** The lip of the chute. */
  chute: number;
  fill: number;
  capacity: number;
}

export interface GameApi {
  readonly version: 2;
  /** Booted, and the frame loop running. */
  readonly ready: boolean;
  /** How long the boot took, from the page's start to ready, in milliseconds; 0 until it has. */
  readonly bootMs: number;

  pause(): void;
  resume(): void;
  /** Play `frames` frames of 1/60 s exactly, and draw the last. */
  step(frames?: number): void;
  /** Chance from a seed from now on. */
  seed(n: number): void;

  state(): GameState;
  bodies(kind?: string): Body[];
  board(): Flying[];
  content(): Content;
  /** What has happened since this was last asked, a line each: "banked 12.0,-36.4". */
  events(): string[];
  /** The rules that must always hold, broken; empty when all is well. */
  invariants(): string[];

  /** A coin dropped now, from the funnel put at `x` first if given; whether one went. */
  drop(x?: number): boolean;
  /** The funnel to `x` along the board. */
  slide(x: number): void;
  /** The drop held down, or let go, as if by a finger, until told otherwise. */
  feed(on: boolean): void;
  /** A coin moved to a point, still, and woken. */
  place(slot: number, x: number, y: number, z?: number): void;
  /** Coins into the hand, given by the machine and counted as such. */
  give(n: number): void;
  /** `n` more coins put straight into the machine, dropped over its tiers, given and counted; how many fitted. */
  fill(n: number): number;
  /** The save written now, and what it is. */
  save(): string;

  /** The camera looking at a point, from `azimuth` round and `polar` down, `radius` away, at once. */
  look(x: number, y: number, z: number, view?: { azimuth?: number; polar?: number; radius?: number }): void;
  /** What drawing a frame of the scene as it stands costs, in milliseconds. */
  measureFrame(): Promise<number>;
}

/** What the page gives the API that is not the game's: time, the controls, the camera and the renderer. */
export interface DebugHost {
  game: Game;
  ready(): boolean;
  bootMs(): number;
  paused(): boolean;
  setPaused(paused: boolean): void;
  /** Play one frame of `dt`, without drawing. */
  simulate(dt: number): void;
  draw(dt: number): void;
  frame(): number;
  setControls(controls: Controls | null): void;
  look(x: number, y: number, z: number, view: { azimuth?: number; polar?: number; radius?: number }): void;
  measureFrame(): Promise<number>;
  events: string[];
}

export function createApi(host: DebugHost): GameApi {
  const { game } = host;
  const { world, board, progress, pushers } = game;
  return {
    version: 2,
    get ready() {
      return host.ready();
    },
    get bootMs() {
      return host.bootMs();
    },
    pause: () => host.setPaused(true),
    resume: () => host.setPaused(false),
    step(frames = 1) {
      for (let f = 0; f < frames; f++) host.simulate(1 / 60);
      host.draw(1 / 60);
    },
    seed(n) {
      game.random = seeded(n);
    },

    state() {
      return {
        t: game.t,
        frame: host.frame(),
        paused: host.paused(),
        hand: progress.save.hand,
        banked: progress.save.banked,
        given: progress.save.given,
        live: world.live,
        flying: board.count,
        funnel: game.funnel,
        pushers: Array.from({ length: TIERS }, (_, k) => pushers.extension(k)),
      };
    },
    bodies(kind) {
      const out: Body[] = [];
      for (let i = 0; i < world.count; i++) {
        if (!world.alive[i]) continue;
        const name = KIND_NAME[world.kind[i]];
        if (kind !== undefined && name !== kind) continue;
        out.push({
          slot: i,
          kind: name,
          x: world.x[i],
          y: world.y[i],
          z: world.z[i],
          asleep: !!world.asleep[i],
          tier: tierAt(world.y[i]),
        });
      }
      return out;
    },
    board() {
      const out: Flying[] = [];
      for (let i = 0; i < board.count; i++) out.push({ x: board.x[i], h: board.h[i] });
      return out;
    },
    content: () => ({
      width: WIDTH,
      tiers: TIER.map((t, k) => ({ z: t.z, back: t.back, front: t.front, top: pusherTop(k) })),
      board: { height: BOARD.height, foot: BOARD.foot, reach: BOARD.reach, pins: PINS.map((p) => ({ ...p })) },
      chute: FRONT,
      fill: FILL,
      capacity: BODY_CAPACITY,
    }),
    events() {
      return host.events.splice(0);
    },
    invariants: () => checkInvariants(game),

    drop(x) {
      if (x !== undefined) game.slide(x);
      return game.drop();
    },
    slide: (x) => game.slide(x),
    feed: (on) => host.setControls(on ? { funnel: null, drop: true } : null),
    place(slot, x, y, z) {
      if (!world.alive[slot]) return;
      world.x[slot] = x;
      world.y[slot] = y;
      if (z !== undefined) world.z[slot] = z;
      world.vx[slot] = world.vy[slot] = world.vz[slot] = 0;
      world.wake(slot);
    },
    give(n) {
      progress.save.hand += n;
      progress.save.given += n;
    },
    fill(n) {
      let put = 0;
      for (let k = 0; put < n; k++) {
        const t = TIER[k % TIERS];
        const x = (game.random() * 2 - 1) * (WIDTH / 2 - 1),
          y = t.front + 1 + game.random() * (t.back - t.front - 2);
        if (world.spawn(COIN, x, y, t.z + 6 + game.random() * 6) < 0) break;
        put++;
      }
      progress.save.given += put;
      return put;
    },
    save() {
      game.persist();
      return JSON.stringify(progress.save);
    },

    look: (x, y, z, view = {}) => host.look(x, y, z, view),
    measureFrame: () => host.measureFrame(),
  };
}
