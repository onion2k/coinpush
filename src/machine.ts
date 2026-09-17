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
 * The floor in front of the pusher at its fullest reach, up to the edge,
 * which is all of a tier its bed lies on once the machine is running: what
 * is behind it the pusher sweeps clear every stroke. A bed of coins pays a
 * coin for a coin only once it lies nearly two deep from the pusher's reach
 * to the edge; shallower, what is pushed into its back climbs onto it and
 * nothing moves at the front. So the shelf sets how many coins the machine
 * holds at rest, and what a frame of it costs: at six and a half it came to
 * rest at twenty-five hundred coins and more than three milliseconds a
 * frame, measured, and at four and a half at sixteen hundred and two.
 */
export const SHELF = 4.5;
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
/** How thick each kind is: a coin is a disc to the physics, with a turn of its own, and lies, leans and piles as one. */
export const KIND_THICKNESS = [0.24];
export const KIND_NAME = ['coin'];
export const COIN = 0;
export const KINDS = KIND_RADIUS.length;
/** How a coin is drawn: exactly as the physics has it, so nothing drawn cuts into anything else. */
export const COIN_LOOK = { radius: KIND_RADIUS[0], thickness: KIND_THICKNESS[0] };
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

/**
 * How close together the primed coins lie: a hair apart, so they settle
 * without a pop, and no more than a hair, since a bed laid loose takes up
 * the first minute's strokes in closing up before anything moves at its edge.
 */
const PITCH = 0.87,
  ROW = 0.76;
/** How far in from the side walls, the step faces and the edges the primed coins keep. */
const MARGIN = 0.6;
/**
 * How far inside each pusher's fullest reach the primed bed begins: the
 * first strokes push a row over each edge, a small welcome, and after that
 * the beds move only as fed coins are swept into them, which is the balance
 * a coin pusher lives on.
 */
const PRIME = 0.75;
/**
 * How much of a second layer is laid on each bed, as the share of its places
 * that have a coin, and how far it keeps from the edge. A machine that has
 * been running lies more than one deep right up to its edges, measured, and
 * one primed with a single layer pays nothing for six minutes while what is
 * fed fills it up: so it is primed about as deep as it runs. With the rain
 * it holds fourteen hundred, where a machine fed for ten minutes holds
 * thirteen and a half; primed deeper it pays out the difference first.
 */
const SECOND = { share: 0.4, clear: 0.5 };
/**
 * The coins rained onto each bed as the machine is primed: how many a tier,
 * from how high above the floor, and how far they keep from the edge, so
 * none is rained straight off it. Beds laid flat are a machine nobody has
 * played; these land as coins do, on the bed and on each other, lying,
 * leaning and lapped, and the game lets them settle before its first frame.
 */
export const RAIN = { each: 40, from: 1, to: 2, clear: 1.2 };
/** How long the primed machine is given to settle before the game begins, in frames, and how often it is looked at to see whether it has. */
export const SETTLE = { frames: 240, every: 10 };

/** Where a tier's primed bed begins: in front of the pusher's face as the game starts, and never inside the pusher, where a coin has no way out that is not through something. */
function bedBack(k: number): number {
  return Math.min(pusherFront(k, 0) - MARGIN, TIER[k].back - PUSHER.length + PRIME);
}

/**
 * Where the machine's coins lie when it is primed: a bed of them on each
 * tier's shelf from just inside the pusher's fullest reach right up to the
 * edge, a hair apart in staggered rows, jittered a little so no two games
 * are quite alike, most of a second layer on it, and a row along the back
 * of each pusher's top.
 */
export function fillPositions(random: Random): [number, number, number][] {
  const r = KIND_THICKNESS[COIN] / 2;
  const out: [number, number, number][] = [];
  const bed = (y0: number, y1: number, z: number) => {
    for (let y = y0, row = 0; y >= y1; y -= ROW, row++) {
      const offset = row % 2 ? PITCH / 2 : 0;
      for (let x = -HALF + MARGIN + offset; x <= HALF - MARGIN; x += PITCH)
        out.push([x + (random() - 0.5) * 0.03, y + (random() - 0.5) * 0.03, z]);
    }
  };
  for (let k = 0; k < TIERS; k++) {
    const t = TIER[k];
    bed(bedBack(k), t.front + MARGIN, t.z + r + 0.002);
  }
  // A row along the back of each pusher's top, against the step face, where the face never sweeps: a machine
  // that has been running keeps a row there, and what lands behind it is what pushes coins off the pusher's lip
  // and into the bed. Without it a new machine pays nothing until sixty coins a tier have filled it.
  for (let k = 0; k < TIERS; k++) {
    const y = TIER[k].back - MARGIN + 0.1;
    for (let x = -HALF + MARGIN; x <= HALF - MARGIN; x += PITCH)
      out.push([x + (random() - 0.5) * 0.06, y + (random() - 0.5) * 0.04, pusherTop(k) + r + 0.002]);
  }
  // and a second layer over the first, in the hollows between its coins: its share of the places, which ones by chance
  for (let k = 0; k < TIERS; k++) {
    const t = TIER[k];
    const from = out.length;
    bed(bedBack(k) - ROW / 2, t.front + MARGIN + SECOND.clear, t.z + r * 3 + 0.004);
    const keep = from + Math.round((out.length - from) * SECOND.share);
    for (let i = from; i < keep; i++) {
      const j = i + Math.floor(random() * (out.length - i));
      [out[i], out[j]] = [out[j], out[i]];
    }
    out.length = keep;
  }
  return out;
}

/** Where the coins rained onto the beds start from: over each bed, clear of its edge, a little above it. */
export function rainPositions(random: Random): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k < TIERS; k++) {
    const t = TIER[k];
    const y0 = t.front + RAIN.clear,
      y1 = bedBack(k);
    for (let n = 0; n < RAIN.each; n++)
      out.push([
        (random() * 2 - 1) * (HALF - 1),
        y0 + random() * (y1 - y0),
        t.z + RAIN.from + random() * (RAIN.to - RAIN.from),
      ]);
  }
  return out;
}

/** How many coins the machine is primed with: the beds' count, whatever the chance, and the rain. */
export const FILL = fillPositions(() => 0.5).length + RAIN.each * TIERS;
