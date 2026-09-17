/**
 * The machine as it is drawn: the cabinet, the tiers with their step faces,
 * the walls, the board with its pins and the chute, which do not move; and
 * the coins, the pushers and the funnel, which do. The groups are fixed
 * once, and each frame only where everything is written into them. It is
 * handed what it draws from, and never the renderer.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import type { Game } from './game';
import {
  BACK,
  BOARD,
  BOARD_CAPACITY,
  BODY_CAPACITY,
  CHUTE,
  COIN_LOOK,
  FRONT,
  HALF,
  ORIGIN_X,
  ORIGIN_Y,
  PINS,
  PIT,
  PUSHER,
  TIER,
  TIERS,
  WIDTH,
} from './machine';
import { place, placeTurned, placeUpright } from './matrix';
import { box, coin } from './meshes';

/** How tall the side walls stand above the top tier, and how thick the cabinet is under the bottom one. */
const WALL_HEIGHT = TIER[0].z + 3,
  PLINTH = 1;
/** The board's slab, the pegs standing out of it, and the funnel. */
const BOARD_THICK = 0.4,
  PEG = { across: 0.7, out: 1.4 },
  FUNNEL = { width: 2.4, depth: 1.6, height: 2.2 };
/** The coins' gold, the cabinet's dark felt and metal, the board's blue. */
const GOLD: [number, number, number] = [0.93, 0.72, 0.28],
  FELT: [number, number, number] = [0.17, 0.12, 0.14],
  METAL: [number, number, number] = [0.36, 0.38, 0.44],
  DARK: [number, number, number] = [0.08, 0.08, 0.1],
  BLUE: [number, number, number] = [0.1, 0.16, 0.34],
  IVORY: [number, number, number] = [0.85, 0.83, 0.78];

export class Scene {
  /** The moving placements, one pool a group: the coins in the machine, the coins on the board, the pushers, the funnel. */
  readonly coins = new Float32Array(BODY_CAPACITY * 16);
  readonly flying = new Float32Array(BOARD_CAPACITY * 16);
  readonly pushers = new Float32Array(TIERS * 16);
  readonly funnel = new Float32Array(16);

  /** What does not move. */
  static(): GameGroup[] {
    const one = (
      mesh: ReturnType<typeof box>,
      x: number,
      y: number,
      z: number,
      albedo: [number, number, number],
      roughness: number,
    ): GameGroup => {
      const m = new Float32Array(16);
      place(m, 0, x, y, z);
      return { mesh, matrices: m, albedo, roughness };
    };
    const depth = BACK + 1 - ORIGIN_Y;
    const groups: GameGroup[] = [];
    // each tier a block from the cabinet's floor up to its own, so its front is the step face below it
    for (const t of TIER)
      groups.push(one(box(WIDTH, t.back - t.front, t.z + PLINTH), 0, (t.back + t.front) / 2, -PLINTH, FELT, 0.9));
    // the chute's pit, and the lip in front of it
    groups.push(one(box(WIDTH, CHUTE, 0.5), 0, FRONT - CHUTE / 2, PIT + 0.5, DARK, 1));
    groups.push(one(box(WIDTH + 2, 1, 2.5), 0, ORIGIN_Y - 0.5, -PLINTH, METAL, 0.45));
    // the side walls, the back wall, and the board standing on it
    for (const side of [-1, 1])
      groups.push(
        one(box(1, depth, WALL_HEIGHT + PLINTH), side * (HALF + 0.5), (BACK + 1 + ORIGIN_Y) / 2, -PLINTH, METAL, 0.45),
      );
    groups.push(one(box(WIDTH, 1, BOARD.foot + PLINTH), 0, BACK + 0.5, -PLINTH, METAL, 0.45));
    groups.push(
      one(box(WIDTH, BOARD_THICK, BOARD.height + 2), 0, BOARD.y + BOARD_THICK / 2, BOARD.foot - 1, BLUE, 0.7),
    );
    // the pegs, standing out of the board toward the player
    const pegs = new Float32Array(PINS.length * 16);
    PINS.forEach((p, i) =>
      place(pegs, i, p.x, BOARD.y - PEG.out / 2, BOARD.foot + BOARD.height - p.h - PEG.across / 2),
    );
    groups.push({ mesh: box(PEG.across, PEG.out, PEG.across), matrices: pegs, albedo: IVORY, roughness: 0.35 });
    // the rail the funnel slides along
    groups.push(one(box(WIDTH, 1, 0.6), 0, BOARD.y - 0.5, BOARD.foot + BOARD.height + 0.4, METAL, 0.45));
    return groups;
  }

  /** What moves: the pools, sized once. `detail` is a rung of the coin's ladder. */
  dynamic(detail = 0): GameGroup[] {
    const mesh = coin(COIN_LOOK.radius, COIN_LOOK.thickness, detail);
    return [
      { mesh, matrices: this.coins, count: 0, albedo: GOLD, roughness: 0.32 },
      { mesh, matrices: this.flying, count: 0, albedo: GOLD, roughness: 0.32 },
      { mesh: box(WIDTH, PUSHER.length, PUSHER.height), matrices: this.pushers, albedo: METAL, roughness: 0.4 },
      { mesh: box(FUNNEL.width, FUNNEL.depth, FUNNEL.height), matrices: this.funnel, albedo: IVORY, roughness: 0.4 },
    ];
  }

  /** Everything where it is this frame: how many coins are placed in the machine and on the board. */
  write(game: Game): { coins: number; flying: number } {
    const { world, board, pushers } = game;
    let n = 0;
    for (let i = 0; i < world.count; i++) {
      if (!world.alive[i]) continue;
      placeTurned(this.coins, n++, world.x[i], world.y[i], world.z[i], world.q, i * 4);
    }
    const lie = BOARD.y - COIN_LOOK.thickness / 2 - 0.05;
    for (let i = 0; i < board.count; i++)
      placeUpright(this.flying, i, board.x[i], lie, BOARD.foot + BOARD.height - board.h[i], board.roll[i]);
    for (let k = 0; k < TIERS; k++) place(this.pushers, k, 0, pushers.boxes[k].y, TIER[k].z);
    place(this.funnel, 0, game.funnel, BOARD.y - FUNNEL.depth / 2 - 0.1, BOARD.foot + BOARD.height + 0.7);
    return { coins: n, flying: board.count };
  }
}

/** The machine's whole extent, for the sun's shadow to be fitted to and the camera to take in. */
export const MACHINE_BOX = {
  min: [ORIGIN_X, ORIGIN_Y - 1, -PLINTH - 1] as [number, number, number],
  max: [-ORIGIN_X, BACK + 1.5, BOARD.foot + BOARD.height + 3] as [number, number, number],
};
