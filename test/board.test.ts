/**
 * The backboard on its own: a coin dropped at the top falls through the
 * pins and leaves at the bottom, somewhere else each time, inside the
 * walls, and the same way twice from a seed.
 */
import { describe, expect, it } from 'vitest';
import { Board } from '../src/board';
import { BOARD, BOARD_CAPACITY, KIND_RADIUS, PINS } from '../src/machine';
import { seeded } from '../src/random';

const DT = 1 / 60;
const R = KIND_RADIUS[0];
const board = (seed = 1) =>
  new Board({ ...BOARD, pins: PINS, capacity: BOARD_CAPACITY, radius: R, random: seeded(seed) });

/** Play a board until it is empty or the frames are up, noting every coin that lands. */
function play(b: Board, frames: number): { x: number; vx: number; vh: number }[] {
  const landed: { x: number; vx: number; vh: number }[] = [];
  for (let f = 0; f < frames && (b.count > 0 || f === 0); f++) b.step(DT, (x, vx, vh) => landed.push({ x, vx, vh }));
  return landed;
}

describe('the board', () => {
  it('drops a coin through the pins to the bottom within a few seconds, hitting at least one on the way', () => {
    const b = board();
    expect(b.drop(0)).toBe(true);
    expect(b.count).toBe(1);
    const landed = play(b, 60 * 6);
    expect(landed).toHaveLength(1);
    expect(b.count).toBe(0);
    expect(b.hits).toBeGreaterThan(0);
    expect(landed[0].vh).toBeGreaterThan(0);
    expect(Math.abs(landed[0].x)).toBeLessThan(BOARD.half - R);
  });

  it('lands the same drop somewhere different each time, and the same way twice from a seed', () => {
    const xs = new Set<number>();
    const b = board(3);
    for (let n = 0; n < 8; n++) {
      b.drop(0);
      const [one] = play(b, 60 * 6);
      xs.add(Math.round(one.x * 10));
    }
    expect(xs.size).toBeGreaterThan(3);
    const twice = (seed: number) => {
      const c = board(seed);
      c.drop(2);
      return play(c, 60 * 6)[0].x;
    };
    expect(twice(5)).toBe(twice(5));
  });

  it('keeps every coin inside the walls, and no two in one place, however many fall at once', () => {
    const b = board(4);
    // a dozen coins as fast as the funnel takes them, so many are on the board at once
    for (let f = 0; f < 60 * 12; f++) {
      if (f % 15 === 0 && f < 12 * 15) b.drop(-BOARD.reach + ((f / 15) % 3) * BOARD.reach);
      else if (!b.count) break;
      b.step(DT, () => {});
      for (let i = 0; i < b.count; i++) {
        expect(Math.abs(b.x[i]), `frame ${f} coin ${i}`).toBeLessThanOrEqual(BOARD.half - R + 1e-3);
        expect(b.h[i]).toBeGreaterThanOrEqual(-R - 1e-3);
        for (let j = i + 1; j < b.count; j++)
          expect(Math.hypot(b.x[i] - b.x[j], b.h[i] - b.h[j]), `frame ${f} coins ${i} ${j}`).toBeGreaterThan(
            R * 2 - 0.15,
          );
      }
    }
    expect(b.count).toBe(0);
  });

  it('nudges a coin that has come to rest on top of a pin, so none stays there', () => {
    const b = board(6);
    // balanced dead on the first pin, not moving at all
    const pin = PINS[0];
    expect(b.put(pin.x, pin.h - R - BOARD.pinRadius - 0.001, 0, 0)).toBe(true);
    const landed = play(b, 60 * 6);
    expect(landed).toHaveLength(1);
    expect(b.count).toBe(0);
  });

  it('refuses a coin when it is full, and takes one again once one has landed', () => {
    const b = board(2);
    for (let n = 0; n < BOARD_CAPACITY; n++) expect(b.drop(0)).toBe(true);
    expect(b.drop(0)).toBe(false);
    play(b, 60 * 10);
    expect(b.drop(0)).toBe(true);
  });
});
