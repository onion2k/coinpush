/**
 * The backboard, without its picture: coins falling down a plane of pins.
 * Its own small physics, since the world's is a floor seen from above and
 * this is a wall seen from the front: a coin is a circle, a pin is a
 * smaller one, gravity runs down the board, and a coin that reaches the
 * foot is handed over to whoever is listening, with its speed.
 *
 * Chance is handed in and used only to jog a dropped coin a hair, and to
 * nudge one that has come to rest on a pin; the pins do the rest, and the
 * same seed gives the same fall.
 */
import type { Pin } from './machine';
import type { Random } from './random';

export interface BoardOptions {
  /** Half the board's width: the walls are at ±half. */
  half: number;
  /** From the top, where a coin is dropped, to the foot, where it leaves. */
  height: number;
  pins: readonly Pin[];
  pinRadius: number;
  /** How many coins can be on the board at once. */
  capacity: number;
  /** A coin's radius. */
  radius: number;
  gravity: number;
  restitution: number;
  random: Random;
}

/** A coin slower than this, touching a pin, is resting on it and gets a nudge. */
const RESTING = 0.6;
/** The board is stepped twice a frame: a coin at full fall still moves less than a pin's width a step. */
const SUBSTEPS = 2;

export class Board {
  count = 0;
  /** How many times a coin has struck a pin, for the tests to see that they are in the way. */
  hits = 0;
  readonly x: Float32Array;
  /** Down from the top. */
  readonly h: Float32Array;
  readonly vx: Float32Array;
  readonly vh: Float32Array;
  /** How far each has rolled, for drawing it turning. */
  readonly roll: Float32Array;
  private readonly o: BoardOptions;

  constructor(options: BoardOptions) {
    this.o = options;
    const n = options.capacity;
    this.x = new Float32Array(n);
    this.h = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vh = new Float32Array(n);
    this.roll = new Float32Array(n);
  }

  /** A coin into the top of the board at `x`, jogged a hair; false if the board is full. */
  drop(x: number): boolean {
    const { half, radius, random } = this.o;
    const at = Math.max(-half + radius, Math.min(half - radius, x));
    return this.put(at + (random() - 0.5) * 0.3, 0, (random() - 0.5) * 1.5, 1);
  }

  /** A coin put back on the board where it was, from a save. */
  put(x: number, h: number, vx: number, vh: number): boolean {
    if (this.count >= this.o.capacity) return false;
    const i = this.count++;
    this.x[i] = x;
    this.h[i] = h;
    this.vx[i] = vx;
    this.vh[i] = vh;
    this.roll[i] = 0;
    return true;
  }

  /** Advance by `dt` seconds; what reaches the foot is handed to `landed` with where it was and how it was moving, and taken off the board. */
  step(dt: number, landed: (x: number, vx: number, vh: number) => void) {
    const { x, h, vx, vh, roll } = this;
    const { half, height, pins, pinRadius, radius, gravity, restitution, random } = this.o;
    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (let i = 0; i < this.count; i++) {
        vh[i] += gravity * sub;
        x[i] += vx[i] * sub;
        h[i] += vh[i] * sub;
        roll[i] += (vx[i] * sub) / radius;
        // the pins: pushed out of each it overlaps, and bounced off it
        for (const p of pins) {
          const dx = x[i] - p.x,
            dh = h[i] - p.h;
          const rr = radius + pinRadius;
          const d2 = dx * dx + dh * dh;
          if (d2 >= rr * rr || d2 < 1e-9) continue;
          const d = Math.sqrt(d2),
            nx = dx / d,
            nh = dh / d;
          x[i] += nx * (rr - d);
          h[i] += nh * (rr - d);
          const vn = vx[i] * nx + vh[i] * nh;
          if (vn < 0) {
            vx[i] -= (1 + restitution) * vn * nx;
            vh[i] -= (1 + restitution) * vn * nh;
            this.hits++;
          }
          // one that has come to rest on top of a pin is nudged off it, one way or the other
          if (nh < -0.5 && Math.abs(vx[i]) < RESTING && Math.abs(vh[i]) < RESTING)
            vx[i] += (random() < 0.5 ? -1 : 1) * (RESTING + random());
        }
        // the walls
        if (x[i] < -half + radius) {
          x[i] = -half + radius;
          if (vx[i] < 0) vx[i] = -vx[i] * restitution;
        } else if (x[i] > half - radius) {
          x[i] = half - radius;
          if (vx[i] > 0) vx[i] = -vx[i] * restitution;
        }
      }
      // each other: pushed apart evenly, and the closing speed between them bounced
      for (let i = 0; i < this.count; i++) {
        for (let j = i + 1; j < this.count; j++) {
          const dx = x[j] - x[i],
            dh = h[j] - h[i];
          const rr = radius * 2;
          const d2 = dx * dx + dh * dh;
          if (d2 >= rr * rr || d2 < 1e-9) continue;
          const d = Math.sqrt(d2),
            nx = dx / d,
            nh = dh / d;
          const fix = (rr - d) / 2;
          x[i] -= nx * fix;
          h[i] -= nh * fix;
          x[j] += nx * fix;
          h[j] += nh * fix;
          const vn = (vx[j] - vx[i]) * nx + (vh[j] - vh[i]) * nh;
          if (vn < 0) {
            const jn = (-(1 + restitution) * vn) / 2;
            vx[i] -= nx * jn;
            vh[i] -= nh * jn;
            vx[j] += nx * jn;
            vh[j] += nh * jn;
          }
        }
      }
    }
    // off the foot, and out: the last coin takes the place of one that has gone
    for (let i = 0; i < this.count;) {
      if (h[i] < height) {
        i++;
        continue;
      }
      landed(x[i], vx[i], vh[i]);
      const last = --this.count;
      x[i] = x[last];
      h[i] = h[last];
      vx[i] = vx[last];
      vh[i] = vh[last];
      roll[i] = roll[last];
    }
  }
}
