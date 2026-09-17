/** The pushers: one a tier, sliding back and forth on their own time, each a box the physics shoves with. */
import { describe, expect, it } from 'vitest';
import { PUSHER, TIER, TIERS } from '../src/machine';
import { Pushers } from '../src/pushers';

describe('the pushers', () => {
  it('slide out and back within their travel, once a period, and say how fast', () => {
    const p = new Pushers();
    expect(p.boxes).toHaveLength(TIERS);
    let least = Infinity,
      most = -Infinity;
    let wasY = NaN;
    for (let t = 0; t <= PUSHER.period * 2; t += 1 / 60) {
      p.step(t);
      const box = p.boxes[0];
      const e = p.extension(0);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
      least = Math.min(least, e);
      most = Math.max(most, e);
      // the box's own velocity is the change in where it is, so the physics sweeps it
      if (!Number.isNaN(wasY)) expect(box.vy).toBeCloseTo((box.y - wasY) * 60, 0);
      wasY = box.y;
      // the box stands on its tier's floor and spans the machine
      expect(box.z - box.hz).toBeCloseTo(TIER[0].z, 6);
      expect(box.hz * 2).toBeCloseTo(PUSHER.height, 6);
      // its back never leaves the step face's cover, its front never passes its full reach
      expect(box.y + box.hy).toBeGreaterThanOrEqual(TIER[0].back - 1e-6);
      expect(box.y - box.hy).toBeGreaterThanOrEqual(TIER[0].back - PUSHER.length - 1e-6);
    }
    expect(least).toBeCloseTo(0, 2);
    expect(most).toBeCloseTo(1, 2);
  });

  it('runs each tier on its own phase, so they are not all out at once', () => {
    const p = new Pushers();
    p.step(0);
    const at0 = p.boxes.map((_, k) => p.extension(k));
    expect(new Set(at0.map((e) => Math.round(e * 100))).size).toBe(TIERS);
  });
});
