/**
 * Column-major 4×4 placements, as WebGPU reads them: element (row r, column
 * c) lives at c * 4 + r, so the translation is the last four floats.
 */

/** A turn about Z, a scale each way, and somewhere to put it. */
export function place(
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): void {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const k = i * 16;
  out[k] = c * sx;
  out[k + 1] = s * sx;
  out[k + 2] = 0;
  out[k + 3] = 0;
  out[k + 4] = -s * sy;
  out[k + 5] = c * sy;
  out[k + 6] = 0;
  out[k + 7] = 0;
  out[k + 8] = 0;
  out[k + 9] = 0;
  out[k + 10] = sz;
  out[k + 11] = 0;
  out[k + 12] = x;
  out[k + 13] = y;
  out[k + 14] = z;
  out[k + 15] = 1;
}

/** A turn from a unit quaternion, x y z w at `q[o]` onward, as the physics keeps a body's: how a coin lies or tumbles. */
export function placeTurned(
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  q: Float32Array,
  o: number,
): void {
  const qx = q[o],
    qy = q[o + 1],
    qz = q[o + 2],
    qw = q[o + 3];
  const xx = qx * qx,
    yy = qy * qy,
    zz = qz * qz;
  const xy = qx * qy,
    xz = qx * qz,
    yz = qy * qz;
  const wx = qw * qx,
    wy = qw * qy,
    wz = qw * qz;
  const k = i * 16;
  out[k] = 1 - 2 * (yy + zz);
  out[k + 1] = 2 * (xy + wz);
  out[k + 2] = 2 * (xz - wy);
  out[k + 3] = 0;
  out[k + 4] = 2 * (xy - wz);
  out[k + 5] = 1 - 2 * (xx + zz);
  out[k + 6] = 2 * (yz + wx);
  out[k + 7] = 0;
  out[k + 8] = 2 * (xz + wy);
  out[k + 9] = 2 * (yz - wx);
  out[k + 10] = 1 - 2 * (xx + yy);
  out[k + 11] = 0;
  out[k + 12] = x;
  out[k + 13] = y;
  out[k + 14] = z;
  out[k + 15] = 1;
}

/** Stood on edge facing -y, the player's side, and rolled about its own axis by `roll`: a coin on the board. */
export function placeUpright(out: Float32Array, i: number, x: number, y: number, z: number, roll: number): void {
  const c = Math.cos(roll),
    s = Math.sin(roll);
  const k = i * 16;
  out[k] = c;
  out[k + 1] = 0;
  out[k + 2] = -s;
  out[k + 3] = 0;
  out[k + 4] = s;
  out[k + 5] = 0;
  out[k + 6] = c;
  out[k + 7] = 0;
  out[k + 8] = 0;
  out[k + 9] = -1;
  out[k + 10] = 0;
  out[k + 11] = 0;
  out[k + 12] = x;
  out[k + 13] = y;
  out[k + 14] = z;
  out[k + 15] = 1;
}
