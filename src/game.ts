/**
 * The game itself, without the picture or the page: the machine and the
 * coins in it, the board and the coins on it, the pushers, the funnel and
 * the hand, a step at a time.
 *
 * What happens is told to `events`, for whoever shows it: the browser turns
 * it into words on the screen; the fuzzer and the tests leave it out, or
 * keep a note of it. Nothing here waits on anything there, so the same game
 * runs in the page and in Node, and what the tests try is what is played.
 */
import { Board } from './board';
import {
  BOARD,
  BOARD_CAPACITY,
  COIN,
  DROP_EVERY,
  HALF,
  KIND_RADIUS,
  PINS,
  SAVE_EVERY,
  TIER,
  TIERS,
  buildTiles,
  fillPositions,
  pusherFront,
  type Tiles,
} from './machine';
import { makeWorld, type World } from './physics';
import { Progress } from './progress';
import { Pushers } from './pushers';
import type { Random } from './random';

/** What the player is doing this frame: where the funnel is being put, as a share of its reach, and whether a coin is being dropped. */
export interface Controls {
  funnel: number | null;
  drop: boolean;
}

/** What happens, for whoever shows it. Every one may be left out. */
export interface GameEvents {
  /** A coin from the hand into the board, at x. */
  dropped?(x: number): void;
  /** A coin off the board onto the machine, at (x, y), in slot `slot`. */
  landed?(x: number, y: number, slot: number): void;
  /** A coin down the chute, from (x, y). */
  banked?(x: number, y: number): void;
  /** A coin that came off the board with no room in the machine, back to the hand. */
  returned?(): void;
  /** A drop the board had no room for. */
  refused?(): void;
  /** The machine's gift to an empty hand. */
  topUp?(n: number): void;
}

/** How fast a pusher must be advancing to wake what is ahead of it, how far ahead, and how high above the tier's floor. */
const WAKE_SPEED = 0.3,
  WAKE_RADIUS = 4.5,
  WAKE_HEIGHT = 3;

export interface GameOptions {
  /** Chance; Math.random unless told otherwise, and the tests always tell. */
  random?: Random;
}

export class Game {
  readonly tiles: Tiles = buildTiles();
  readonly world: World;
  readonly board: Board;
  readonly pushers = new Pushers();
  /** Game time, in seconds. */
  t = 0;
  /** Where chance comes from: replaced by the test API's `seed`. */
  random: Random;
  /** Where the funnel is along the top of the board. */
  funnel = 0;
  private lastDrop = -Infinity;
  /** Whether anything has changed since the save was last written, and when that was. */
  private dirty = false;
  private savedAt = 0;

  constructor(
    readonly progress: Progress,
    private readonly events: GameEvents = {},
    options: GameOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    const random = () => this.random();
    this.world = makeWorld(this.tiles, random);
    this.board = new Board({ ...BOARD, pins: PINS, capacity: BOARD_CAPACITY, radius: KIND_RADIUS[COIN], random });
    this.world.pushers = this.pushers.boxes;
    this.pushers.step(0);
    const { coins, flight } = progress.save;
    if (coins.length) {
      // the machine as it was saved, coin by coin
      for (let i = 0; i + 2 < coins.length; i += 3) this.world.spawn(COIN, coins[i], coins[i + 1], coins[i + 2]);
      for (let i = 0; i + 3 < flight.length; i += 4)
        this.board.put(flight[i], flight[i + 1], flight[i + 2], flight[i + 3]);
    } else {
      for (const [x, y, z] of fillPositions(random)) this.world.spawn(COIN, x, y, z);
    }
  }

  /** One frame of `dt` seconds, with the player doing so. */
  step(dt: number, controls: Controls) {
    this.t += dt;
    if (controls.funnel !== null) this.slide(-BOARD.reach + controls.funnel * 2 * BOARD.reach);
    if (controls.drop) this.drop();
    this.pushers.step(this.t);
    this.wakeAhead();
    this.board.step(dt, (x, vx, vh) => this.land(x, vx, vh));
    this.world.step(dt, (_kind, x, y) => this.bank(x, y));
    if (this.dirty && this.t - this.savedAt >= SAVE_EVERY) this.persist();
  }

  /**
   * What lies ahead of an advancing pusher wakes before the face arrives. A
   * bed asleep is a wall to a slow push, by the physics' own rule, so a
   * face that crept into sleepers would pile them up rather than move them;
   * awake, the bed flows. The band is the tier's own, so the tiers above
   * and below sleep on.
   */
  private wakeAhead() {
    for (let k = 0; k < TIERS; k++) {
      const box = this.pushers.boxes[k];
      if (box.vy > -WAKE_SPEED) continue;
      const front = pusherFront(k, this.t);
      for (let x = -HALF + WAKE_RADIUS; x < HALF + WAKE_RADIUS; x += WAKE_RADIUS * 1.4)
        this.world.wakeNear(x, front - WAKE_RADIUS * 0.6, WAKE_RADIUS, TIER[k].z, TIER[k].z + WAKE_HEIGHT);
    }
  }

  /** The funnel to `x` along the top of the board, within its reach. */
  slide(x: number) {
    this.funnel = Math.max(-BOARD.reach, Math.min(BOARD.reach, x));
  }

  /**
   * A coin from the hand into the board at the funnel: no faster than the
   * machine takes them, from a hand the machine tops up when it is empty,
   * and only if the board has room. Whether one went.
   */
  drop(): boolean {
    if (this.t - this.lastDrop < DROP_EVERY) return false;
    if (this.progress.hand <= 0) this.events.topUp?.(this.progress.topUp());
    if (!this.board.drop(this.funnel)) {
      this.events.refused?.();
      return false;
    }
    this.progress.spend();
    this.lastDrop = this.t;
    this.dirty = true;
    this.events.dropped?.(this.funnel);
    return true;
  }

  /** A coin off the foot of the board onto the top tier, moving as it was; or back to the hand if the machine is full. */
  private land(x: number, vx: number, vh: number) {
    const slot = this.world.spawn(COIN, x, BOARD.exitY, BOARD.foot, vx * 0.3, -BOARD.exitSpeed, -vh * 0.2);
    if (slot < 0) {
      this.progress.refund();
      this.events.returned?.();
      return;
    }
    this.events.landed?.(x, BOARD.exitY, slot);
  }

  private bank(x: number, y: number) {
    this.progress.win(1);
    this.dirty = true;
    this.events.banked?.(x, y);
  }

  /** The save written now: the hand and the winnings, and every coin where it is. */
  persist() {
    const { world, board } = this;
    const coins: number[] = [];
    for (let i = 0; i < world.count; i++) {
      if (!world.alive[i]) continue;
      coins.push(near(world.x[i]), near(world.y[i]), near(world.z[i]));
    }
    const flight: number[] = [];
    for (let i = 0; i < board.count; i++)
      flight.push(near(board.x[i]), near(board.h[i]), near(board.vx[i]), near(board.vh[i]));
    this.progress.save.coins = coins;
    this.progress.save.flight = flight;
    this.progress.persist();
    this.dirty = false;
    this.savedAt = this.t;
  }
}

/** To a hundredth: what a save keeps of a position, and all a coin needs to be put back where it was. */
function near(n: number): number {
  return Math.round(n * 100) / 100;
}
