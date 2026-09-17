/**
 * The machine's content, checked for the things a wrong number would break:
 * the tiers step down toward the chute and meet edge to edge, the pins are
 * far enough apart for a coin to pass between any two, and the primed fill
 * puts every coin over a floor of its own tier.
 */
import { describe, expect, it } from 'vitest';
import {
  BACK,
  BOARD,
  BOTTOM,
  CHUTE,
  COLS,
  FILL,
  FRONT,
  HALF,
  KIND_RADIUS,
  KIND_THICKNESS,
  PINS,
  PIT,
  PUSHER,
  RAIN,
  ROWS,
  STEP,
  TIER,
  TIERS,
  buildTiles,
  fillPositions,
  floorAt,
  pusherFront,
  pusherTop,
  rainPositions,
  tierAt,
  wallAt,
} from '../src/machine';
import { seeded } from '../src/random';

const R = KIND_RADIUS[0],
  H = KIND_THICKNESS[0];

describe('the machine', () => {
  it('steps its tiers down from the back to the chute, edge to edge', () => {
    expect(TIER).toHaveLength(TIERS);
    expect(TIER[0].back).toBe(BACK);
    for (let k = 0; k < TIERS; k++) {
      expect(TIER[k].front).toBeLessThan(TIER[k].back);
      if (k) {
        expect(TIER[k].back).toBe(TIER[k - 1].front);
        expect(TIER[k - 1].z - TIER[k].z).toBe(STEP);
      }
      // a coin on the tier above clears the pusher's top on its way down to it
      expect(STEP).toBeGreaterThan(PUSHER.height + R * 2);
    }
    expect(TIER[TIERS - 1].z).toBe(0);
    expect(TIER[TIERS - 1].front).toBe(FRONT);
    expect(BOTTOM).toBeGreaterThan(PIT);
    expect(BOTTOM).toBeLessThan(0);
  });

  it('has rock round the sides and the back, a floor a tier high on each tier, and a pit in front', () => {
    const tiles = buildTiles();
    expect(tiles.solid).toHaveLength(COLS * ROWS);
    expect(tiles.floor).toHaveLength(COLS * ROWS);
    expect(wallAt(tiles, -100, -20, 1), 'off the grid').toBe(true);
    expect(wallAt(tiles, 0, BACK + 0.5, 100), 'the back wall').toBe(true);
    for (let k = 0; k < TIERS; k++) {
      const y = (TIER[k].back + TIER[k].front) / 2;
      expect(floorAt(tiles, 0, y)).toBe(TIER[k].z);
      expect(tierAt(y)).toBe(k);
      expect(wallAt(tiles, 0, y, TIER[k].z + R), 'on its own tier').toBe(false);
      // a step face is a wall from the tier below, and not from above
      if (k) {
        expect(wallAt(tiles, 0, TIER[k].back + 0.5, TIER[k].z + R), 'the face from below').toBe(true);
        expect(wallAt(tiles, 0, TIER[k].back + 0.5, TIER[k - 1].z + R), 'the face from above').toBe(false);
      }
    }
    expect(floorAt(tiles, 0, FRONT - CHUTE / 2)).toBe(PIT);
    expect(tierAt(FRONT - 1)).toBe(-1);
    expect(tierAt(BACK + 1)).toBe(-1);
  });

  it('leaves room between every two pins for a coin to fall, and keeps them inside the board', () => {
    expect(PINS.length).toBeGreaterThan(10);
    for (const p of PINS) {
      expect(Math.abs(p.x)).toBeLessThan(BOARD.half - BOARD.pinRadius);
      expect(p.h).toBeGreaterThan(0);
      expect(p.h).toBeLessThan(BOARD.height);
    }
    for (let a = 0; a < PINS.length; a++)
      for (let b = a + 1; b < PINS.length; b++) {
        const gap = Math.hypot(PINS[a].x - PINS[b].x, PINS[a].h - PINS[b].h) - 2 * BOARD.pinRadius;
        expect(gap, `pins ${a} and ${b}`).toBeGreaterThan(R * 2 + 0.3);
      }
    // and the funnel never drops a coin straight onto a wall
    expect(BOARD.reach + R).toBeLessThan(BOARD.half);
  });

  it('primes the machine with beds two layers deep clear of the pushers, and a row along the back of each pusher, fourteen hundred in all', () => {
    const tiles = buildTiles();
    const coins = fillPositions(seeded(1));
    expect(coins.length + RAIN.each * TIERS).toBe(FILL);
    expect(FILL).toBeGreaterThanOrEqual(1400);
    const first = new Array<number>(TIERS).fill(0),
      second = new Array<number>(TIERS).fill(0),
      riding = new Array<number>(TIERS).fill(0);
    for (const [x, y, z] of coins) {
      const k = tierAt(y);
      expect(k, `coin at ${x},${y}`).toBeGreaterThanOrEqual(0);
      expect(wallAt(tiles, x, y, z), `coin at ${x},${y},${z} in a wall`).toBe(false);
      if (z > pusherTop(k)) {
        // on the pusher's top, lying flat, in the strip against the step face that the top never leaves
        expect(z).toBeLessThan(pusherTop(k) + H);
        expect(y - R).toBeGreaterThan(TIER[k].back - (PUSHER.length - PUSHER.travel));
        expect(y + R).toBeLessThan(TIER[k].back);
        riding[k]++;
        continue;
      }
      // lying flat on the floor or on the layer below, and in front of the pusher's face as the game starts: never inside it
      expect(z).toBeGreaterThanOrEqual(TIER[k].z + H / 2 - 1e-6);
      expect(z).toBeLessThan(TIER[k].z + H * 2);
      expect(y, `coin at ${x},${y} inside tier ${k}'s pusher`).toBeLessThan(pusherFront(k, 0) - R);
      expect(y - R, 'and not over the edge').toBeGreaterThan(TIER[k].front);
      if (z < TIER[k].z + H) first[k]++;
      else second[k]++;
    }
    for (let k = 0; k < TIERS; k++) {
      expect(first[k]).toBeGreaterThan(200);
      // a second layer on something like a third of the first, and a row the width of the machine on the pusher
      expect(second[k] / first[k]).toBeGreaterThan(0.2);
      expect(second[k] / first[k]).toBeLessThan(0.45);
      expect(riding[k]).toBeGreaterThan(40);
    }
    // the same seed lays them the same way; another seed a little differently, and as many
    expect(fillPositions(seeded(1))).toEqual(coins);
    expect(fillPositions(seeded(2))).not.toEqual(coins);
    expect(fillPositions(seeded(2))).toHaveLength(coins.length);
  });

  it('rains more onto each bed from a little above it, clear of the edge and of the pusher', () => {
    const rain = rainPositions(seeded(1));
    expect(rain).toHaveLength(RAIN.each * TIERS);
    const onTier = new Array<number>(TIERS).fill(0);
    for (const [x, y, z] of rain) {
      const k = tierAt(y);
      expect(k).toBeGreaterThanOrEqual(0);
      onTier[k]++;
      expect(Math.abs(x)).toBeLessThan(HALF - R);
      expect(y, 'clear of the edge, or it would be rained straight off it').toBeGreaterThan(
        TIER[k].front + RAIN.clear - 1e-6,
      );
      expect(y, 'and of the pusher').toBeLessThan(pusherFront(k, 0) - R);
      expect(z).toBeGreaterThan(TIER[k].z + H);
      expect(z).toBeLessThan(TIER[k].z + 3);
    }
    for (const n of onTier) expect(n).toBe(RAIN.each);
    expect(rainPositions(seeded(1))).toEqual(rain);
    expect(rainPositions(seeded(2))).not.toEqual(rain);
  });
});
