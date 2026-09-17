/**
 * What must always be true of the game, however it has been played: the
 * rules that, broken, are a bug whatever the feature was.
 *
 * Every coin is a number, of a kind, out of the walls and the step faces,
 * its lowest point on or above the floor under it, and above the chute.
 * No two coins at rest cut into each other. Every coin on the
 * board is on it. Coins are neither made nor lost: the hand, the machine
 * and the board together hold what the machine was filled with, by the
 * save's own account, and has given. The hand, the winnings and the gifts are whole numbers that make
 * sense. The funnel is within reach and the pushers within their travel.
 *
 * Checked by the fuzzer after everything it does, by the test API on asking,
 * and by the unit tests. Each broken rule is a line saying what and where.
 */
import {
  BOARD,
  BOTTOM,
  HAND0,
  KINDS,
  KIND_NAME,
  KIND_RADIUS,
  KIND_THICKNESS,
  TIERS,
  floorAt,
  wallAt,
  type Tiles,
} from './machine';
import type { Game } from './game';
import type { World } from './physics';

/**
 * How far a coin's lowest point may be below the floor under it before it
 * is a rule broken, and how far two coins at rest may be into each other:
 * a twentieth of a unit, which is as far in as the physics lets a coin go
 * to sleep, and a hair for the rounding.
 */
const SUNK = 0.06,
  CUT = 0.0501;

/** How far below the floor under it a coin's lowest point is: the low side of its rim, on its lower face. */
function sunkBy(world: World, tiles: Tiles, i: number): number {
  const [nx, ny, nz] = world.axis(i);
  const r = KIND_RADIUS[world.kind[i]],
    half = KIND_THICKNESS[world.kind[i]] / 2;
  const across = Math.sqrt(Math.max(0, 1 - nz * nz));
  const side = nz >= 0 ? 1 : -1;
  // the way across the coin that goes down the steepest, or none if it lies flat
  const ux = across > 1e-4 ? (nz * nx) / across : 0,
    uy = across > 1e-4 ? (nz * ny) / across : 0;
  const px = world.x[i] + r * ux - side * half * nx,
    py = world.y[i] + r * uy - side * half * ny,
    pz = world.z[i] - r * across - half * Math.abs(nz);
  // a floor standing well above the coin is a step's face to it, not its floor: the floor under its middle then
  let floor = floorAt(tiles, px, py);
  if (floor > world.z[i] + r) floor = floorAt(tiles, world.x[i], world.y[i]);
  return floor - pz;
}

/** How many broken rules of one sort are reported before the rest are only counted. */
const EACH = 3;

export function checkInvariants(game: Game): string[] {
  const out: string[] = [];
  const { world, board, tiles, progress, pushers } = game;
  const report = (sort: string, found: string[]) => {
    if (!found.length) return;
    out.push(...found.slice(0, EACH).map((f) => `${sort}: ${f}`));
    if (found.length > EACH) out.push(`${sort}: and ${found.length - EACH} more`);
  };
  const at = (i: number) =>
    `${KIND_NAME[world.kind[i]] ?? `kind ${world.kind[i]}`} ${i} at ${world.x[i].toFixed(1)},${world.y[i].toFixed(1)},${world.z[i].toFixed(1)}`;

  const notNumbers: string[] = [],
    walled: string[] = [],
    sunk: string[] = [],
    gone: string[] = [];
  let live = 0;
  for (let i = 0; i < world.count; i++) {
    if (!world.alive[i]) continue;
    live++;
    if (world.kind[i] >= KINDS) {
      notNumbers.push(`slot ${i} is of no kind (${world.kind[i]})`);
      continue;
    }
    const values = [world.x[i], world.y[i], world.z[i], world.vx[i], world.vy[i], world.vz[i]];
    if (!values.every(Number.isFinite)) notNumbers.push(at(i));
    else if (wallAt(tiles, world.x[i], world.y[i], world.z[i])) walled.push(at(i));
    else if (sunkBy(world, tiles, i) > SUNK) sunk.push(at(i));
    else if (world.z[i] <= BOTTOM) gone.push(at(i));
  }
  report('not a number', notNumbers);
  report('in a wall', walled);
  report('below its floor', sunk);
  report('below the chute', gone);
  if (live !== world.live) out.push(`the world counts ${world.live} live, and has ${live}`);
  // what is being shoved may be a little into what shoves it, for a step or two; what has come to rest may not
  const cut = world.deepest(true);
  if (cut.depth > CUT) out.push(`at rest, ${at(cut.i)} is ${cut.depth.toFixed(2)} into ${at(cut.j)}`);

  const flying: string[] = [];
  for (let i = 0; i < board.count; i++) {
    const x = board.x[i],
      h = board.h[i];
    if (![x, h, board.vx[i], board.vh[i]].every(Number.isFinite)) flying.push(`coin ${i} at ${x},${h}`);
    else if (Math.abs(x) > BOARD.half || h < -1 || h > BOARD.height + 1)
      flying.push(`coin ${i} at ${x.toFixed(1)},${h.toFixed(1)} is outside it`);
  }
  report('on the board', flying);

  const { hand, banked, given, filled } = progress.save;
  if (!Number.isInteger(hand) || hand < 0) out.push(`the hand is ${hand}`);
  if (!Number.isInteger(banked) || banked < 0) out.push(`won ${banked}`);
  if (!Number.isInteger(given) || given < HAND0) out.push(`given ${given}, less than the starting hand`);
  const sum = hand + live + board.count;
  if (!Number.isInteger(filled) || filled <= 0) out.push(`the machine was filled with ${filled}`);
  else if (sum !== filled + given)
    out.push(
      `coins made or lost: hand ${hand} + machine ${live} + board ${board.count} = ${sum}, not the fill ${filled} + given ${given} = ${filled + given}`,
    );

  if (!Number.isFinite(game.funnel) || Math.abs(game.funnel) > BOARD.reach)
    out.push(`the funnel is at ${game.funnel}, past its reach of ${BOARD.reach}`);
  for (let k = 0; k < TIERS; k++) {
    const e = pushers.extension(k),
      box = pushers.boxes[k];
    if (!Number.isFinite(e) || e < -1e-6 || e > 1 + 1e-6 || !Number.isFinite(box.y) || !Number.isFinite(box.vy))
      out.push(`the pusher on tier ${k} is at ${e} of its travel, at y ${box.y} going ${box.vy}`);
  }
  return out;
}
