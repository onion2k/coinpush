/**
 * The pushers: one slab a tier, sliding forward and back on the tier's
 * floor, each a box the physics shoves with and carries what rests on.
 * Its back end runs under the step face behind it, so however far out it
 * is, nothing can fall in behind. Where each is comes from the game's own
 * time, so the same second gives the same stroke.
 */
import { HALF, PUSHER, TIER, TIERS, pusherExtension, pusherFront } from './machine';
import type { Pusher } from './physics';

export class Pushers {
  /** The boxes, written in place each step, so nothing is made each frame. */
  readonly boxes: Pusher[];
  private t = 0;

  constructor() {
    this.boxes = TIER.map((tier, k) => ({
      x: 0,
      y: pusherFront(k, 0) + PUSHER.length / 2,
      z: tier.z + PUSHER.height / 2,
      yaw: 0,
      // wider than the machine, so its ends are inside the walls and never the nearest way out of it
      hx: HALF + 2,
      hy: PUSHER.length / 2,
      hz: PUSHER.height / 2,
      vx: 0,
      vy: 0,
      spin: 0,
      px: 0,
      py: pusherFront(k, 0) + PUSHER.length / 2,
      owner: k,
    }));
  }

  /** How far out a tier's pusher is, 0 back to 1 at its fullest reach, at the time last stepped to. */
  extension(k: number): number {
    return pusherExtension(k, this.t);
  }

  /** Every box put where it is at game time `t`, standing still: where a machine loaded from a save starts from. */
  place(t: number) {
    this.t = t;
    for (let k = 0; k < TIERS; k++) {
      const box = this.boxes[k];
      box.y = box.py = pusherFront(k, t) + PUSHER.length / 2;
      box.vy = 0;
    }
  }

  /** Every box where it is at game time `t`, moving as fast as it did to get there. */
  step(t: number) {
    const dt = t - this.t;
    this.t = t;
    for (let k = 0; k < TIERS; k++) {
      const box = this.boxes[k];
      const y = pusherFront(k, t) + PUSHER.length / 2;
      box.vy = dt > 0 ? (y - box.y) / dt : 0;
      box.y = y;
      box.py = y;
    }
  }
}
