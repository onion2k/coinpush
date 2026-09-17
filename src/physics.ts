/**
 * The physics is a package of its own, artshape-physics, which knows nothing
 * of coins or machines: a body is a ball of some radius, the floor is a
 * grid of tiles at heights, and what falls out of the bottom is reported
 * back. This is the game's side of it: a world made from this machine.
 * Everything in the game that steps or reads bodies imports from here, so
 * the package stays behind one door, and a change it needs goes in its own
 * repo with a version bump here.
 */
import { World, type WorldOptions } from 'artshape-physics/world';
import { BODY_CAPACITY, BOTTOM, COLS, KIND_RADIUS, ORIGIN_X, ORIGIN_Y, ROWS, TILE, type Tiles } from './machine';
import type { Random } from './random';

export { World, type Pusher } from 'artshape-physics/world';

/** A world for this machine: its grid, floors and bottom, the coin's radius, and chance from the game's own source. */
export function makeWorld(tiles: Tiles, random: Random): World {
  const options: WorldOptions = {
    capacity: BODY_CAPACITY,
    grid: { cols: COLS, rows: ROWS, originX: ORIGIN_X, originY: ORIGIN_Y, tile: TILE },
    solid: tiles.solid,
    floor: tiles.floor,
    bottom: BOTTOM,
    radii: KIND_RADIUS,
    random,
    // the hash cell a coin and a bit across, since every body is a coin
    tuning: { cell: 1.2 },
  };
  return new World(options);
}
