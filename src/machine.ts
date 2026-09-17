/**
 * The machine: content, not logic. The tiers stepping down from the back
 * wall to the chute, the pusher on each, the backboard with its pins and
 * the funnel that slides along its top, the coin, and the heap the machine
 * is primed with. The game reads it and the page draws it; the lower
 * modules go on knowing nothing of any of it.
 *
 * Units are about a coin and a fifth across: the physics' own scale. The
 * back wall's face is y = 0 and the machine runs toward the player along
 * -y, so "forward" is down the y axis; z is up, the bottom tier's floor is
 * at 0, and the chute is a pit below it.
 */
import type { Random } from './random';

/** The tile grid is half a coin: every step face, wall and edge falls on a tile edge. */
export const TILE = 0.5;
/** Inside the side walls, across x: what sets how many coins the machine holds, since a bed can be only so deep. */
export const WIDTH = 42;
export const HALF = WIDTH / 2;
/** How many tiles thick the rock is: the side walls and the back, a coin's width. */
export const WALL = 2;
export const TIERS = 3;
/** From one tier's floor up to the next: room for the pusher and a coin falling onto it. */
export const STEP = 4;
/**
 * The pusher on each tier: a slab standing on the tier's floor, spanning it
 * side to side, sliding forward and back. Its back end runs under the step
 * face behind it, so no gap ever opens there; `travel` is how far it slides,
 * and is nearly its whole length, so the face behind sweeps almost all of
 * its top each stroke and only a coin on its very lip can ride it for ever.
 * `phase` is where each tier's is in its stroke at the start, in turns.
 */
export const PUSHER = { length: 6, travel: 5, height: 1.6, period: 5, phase: [0, 0.4, 0.75] };
/**
 * The floor in front of the pusher at its fullest reach, up to the edge:
 * short, since a push through a bed of balls dies out in a few rows. At
 * eight the machine jams and pays nothing, measured; at six and a half it
 * pays about a coin for a coin fed.
 */
export const SHELF = 6.5;
/** A tier, from its back edge (the step face behind it) to its front edge. */
export const DEPTH = PUSHER.length + SHELF;
/** Tiles of pit in front of the bottom tier: the chute. */
export const CHUTE = 4;
/** The chute's floor, and the height below which a coin has gone down it. */
export const PIT = -20;
export const BOTTOM = -6;
/** The back wall's face: the top tier's back edge, and the foot of the board. */
export const BACK = 0;

export interface Tier {
  /** Its floor. */
  z: number;
  /** Its back edge, where the step face behind it stands, and its front edge, where a coin falls off. */
  back: number;
  front: number;
}
export const TIER: readonly Tier[] = Array.from({ length: TIERS }, (_, k) => ({
  z: (TIERS - 1 - k) * STEP,
  back: BACK - k * DEPTH,
  front: BACK - (k + 1) * DEPTH,
}));
/** The bottom tier's front edge: the lip of the chute. */
export const FRONT = TIER[TIERS - 1].front;

export const ORIGIN_X = -HALF - WALL * TILE;
export const COLS = (WIDTH + 2 * WALL) / TILE;
export const ORIGIN_Y = FRONT - CHUTE;
export const ROWS = (BACK - ORIGIN_Y) / TILE + WALL;

/** The kinds of body there are, one radius each, and what each is called: coins, and only coins. */
export const KIND_RADIUS = [0.42];
export const KIND_NAME = ['coin'];
export const COIN = 0;
export const KINDS = KIND_RADIUS.length;
/** How a coin is drawn: a little wider than the ball it is to the physics, and thick enough to read as a coin. */
export const COIN_LOOK = { radius: 0.5, thickness: 0.24 };
/** The most coins the machine can hold. */
export const BODY_CAPACITY = 4000;

/**
 * The backboard: a plane standing on the back wall above the top tier, with
 * pins in staggered rows. A coin dropped at the top falls down it, `height`
 * from the top to its foot, and leaves it at the foot onto the top tier's
 * pusher. `reach` is how far the funnel slides either side of the middle.
 */
export const BOARD = {
  half: HALF,
  height: 26,
  /** The plane's y, just behind the wall's face, and its foot, above the top tier's pusher. */
  y: 0.6,
  foot: TIER[0].z + PUSHER.height + 1,
  reach: HALF - 4,
  pinRadius: 0.35,
  gravity: 30,
  restitution: 0.45,
  /** Where a coin leaves the board for the machine: just in front of the wall, and how fast forward. */
  exitY: -1.6,
  exitSpeed: 3,
};
/** How many coins can be on the board at once. */
export const BOARD_CAPACITY = 64;

export interface Pin {
  x: number;
  /** Down from the top of the board. */
  h: number;
}
/** Six rows, staggered, as many across as the board's width takes, with room for a coin to pass between any two and between the outer ones and the walls. */
export const PINS: readonly Pin[] = (() => {
  const out: Pin[] = [];
  const across = 3.6,
    down = 3.4;
  const most = Math.floor((WIDTH - 4) / across);
  for (let row = 0; row < 6; row++) {
    const cols = row % 2 ? most - 1 : most;
    for (let c = 0; c < cols; c++) out.push({ x: (c - (cols - 1) / 2) * across, h: 4 + row * down });
  }
  return out;
})();

/** Coins in the player's hand to begin with, and what the machine gives when it is empty. */
export const HAND0 = 100;
export const TOP_UP = 25;
/** How often the funnel takes a coin, in seconds. */
export const DROP_EVERY = 0.25;
/** How long a changed game waits before the save is written, in seconds. */
export const SAVE_EVERY = 5;

export interface Tiles {
  /** Which tiles are rock, one byte a tile, row by row. */
  solid: Uint8Array;
  /** How high each tile's floor stands. */
  floor: Float32Array;
}

/** The grid: rock down each side and across the back, each tier's floor at its height, and the pit in front. */
export function buildTiles(): Tiles {
  const solid = new Uint8Array(COLS * ROWS);
  const floor = new Float32Array(COLS * ROWS);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const t = ty * COLS + tx;
      const cy = ORIGIN_Y + (ty + 0.5) * TILE;
      if (tx < WALL || tx >= COLS - WALL || cy > BACK) solid[t] = 1;
      const k = tierAt(cy);
      floor[t] = k >= 0 ? TIER[k].z : cy < FRONT ? PIT : 0;
    }
  }
  return { solid, floor };
}

/** The tile a point is in, or -1 off the grid. */
export function tileAt(x: number, y: number): number {
  const tx = Math.floor((x - ORIGIN_X) / TILE),
    ty = Math.floor((y - ORIGIN_Y) / TILE);
  return tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS ? -1 : ty * COLS + tx;
}

/** How high the floor stands under a point, or nothing off the grid. */
export function floorAt(tiles: Tiles, x: number, y: number): number {
  const t = tileAt(x, y);
  return t < 0 ? 0 : tiles.floor[t];
}

/** Whether a point is a wall to a body whose middle is at `z`: off the grid, rock, or a floor standing above it. */
export function wallAt(tiles: Tiles, x: number, y: number, z: number): boolean {
  const t = tileAt(x, y);
  return t < 0 || tiles.solid[t] === 1 || tiles.floor[t] > z;
}

/** Which tier a y is on, or -1 in the chute or behind the back wall. */
export function tierAt(y: number): number {
  for (let k = 0; k < TIERS; k++) if (y >= TIER[k].front && y < TIER[k].back) return k;
  return -1;
}

/** The top of a tier's pusher: where a coin carried on it rests. */
export function pusherTop(k: number): number {
  return TIER[k].z + PUSHER.height;
}

/** How far out a tier's pusher is at game time `t`: 0 fully back, 1 at its fullest reach, once a period. */
export function pusherExtension(k: number, t: number): number {
  return (1 - Math.cos(2 * Math.PI * (t / PUSHER.period + PUSHER.phase[k]))) / 2;
}

/** Where a tier's pusher's front face is at game time `t`. */
export function pusherFront(k: number, t: number): number {
  return TIER[k].back + PUSHER.travel * (1 - pusherExtension(k, t)) - PUSHER.length;
}

/** How close together the primed coins lie: a hair apart, so they settle without a pop. */
const PITCH = 0.9,
  ROW = 0.8;
/** How far in from the side walls, the step faces and the edges the primed coins keep. */
const MARGIN = 0.6;
/**
 * How far inside each pusher's fullest reach the primed bed begins: the
 * first strokes push a row or two over each edge, a small welcome of some
 * fifty coins in the first minute, and after that the beds move only as
 * fed coins are swept into them, which is the balance a coin pusher lives
 * on. A second layer of coins anywhere on a bed was measured to turn into
 * payout, hundreds in a minute, so the beds are primed one deep.
 */
const PRIME = 2.5;

/**
 * Where the machine's coins lie when it is primed: a bed of them on each
 * tier's shelf from just inside the pusher's fullest reach right up to the
 * edge, a hair apart in staggered rows, jittered a little so no two games
 * are quite alike. The pushers' tops start bare: what lands there comes
 * from the board.
 */
export function fillPositions(random: Random): [number, number, number][] {
  const r = KIND_RADIUS[COIN];
  const out: [number, number, number][] = [];
  const bed = (y0: number, y1: number, z: number) => {
    for (let y = y0, row = 0; y >= y1; y -= ROW, row++) {
      const offset = row % 2 ? PITCH / 2 : 0;
      for (let x = -HALF + MARGIN + offset; x <= HALF - MARGIN; x += PITCH)
        out.push([x + (random() - 0.5) * 0.06, y + (random() - 0.5) * 0.06, z]);
    }
  };
  for (let k = 0; k < TIERS; k++) {
    const t = TIER[k];
    // the shelf, from just inside the pusher's fullest reach to just short of the edge
    bed(t.back - PUSHER.length + PRIME, t.front + MARGIN, t.z + r + 0.002);
  }
  return out;
}

/** How many coins the machine is primed with: the layout's count, whatever the jitter. */
export const FILL = fillPositions(() => 0.5).length;
