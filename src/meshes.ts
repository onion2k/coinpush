/**
 * The few shapes the machine is made of, built flat-shaded on purpose: a
 * box, a coin, a square. Cartoon geometry wants hard edges, so faces do not
 * share vertices and every normal is a face's.
 *
 * Everything is in world units and Z is up, as the renderer has it.
 */
import { MeshBuilder, type Mesh } from 'artshape-render/mesh/types';

type V3 = [number, number, number];

/** One flat-shaded quad, wound counter-clockwise seen from the normal. */
function face(b: MeshBuilder, p0: V3, p1: V3, p2: V3, p3: V3) {
  const ux = p1[0] - p0[0],
    uy = p1[1] - p0[1],
    uz = p1[2] - p0[2];
  const vx = p3[0] - p0[0],
    vy = p3[1] - p0[1],
    vz = p3[2] - p0[2];
  let nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const a = b.vertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0);
  b.vertex(p1[0], p1[1], p1[2], nx, ny, nz, 1, 0);
  b.vertex(p2[0], p2[1], p2[2], nx, ny, nz, 1, 1);
  b.vertex(p3[0], p3[1], p3[2], nx, ny, nz, 0, 1);
  b.quad(a, a + 1, a + 2, a + 3);
}

function tri(b: MeshBuilder, p0: V3, p1: V3, p2: V3) {
  const ux = p1[0] - p0[0],
    uy = p1[1] - p0[1],
    uz = p1[2] - p0[2];
  const vx = p2[0] - p0[0],
    vy = p2[1] - p0[1],
    vz = p2[2] - p0[2];
  let nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const a = b.vertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0);
  b.vertex(p1[0], p1[1], p1[2], nx, ny, nz, 1, 0);
  b.vertex(p2[0], p2[1], p2[2], nx, ny, nz, 0.5, 1);
  b.triangle(a, a + 1, a + 2);
}

/** A box `w` along X, `d` along Y and `h` up Z, centred in X and Y and standing on z = 0, or centred in Z too. */
export function box(w: number, d: number, h: number, centred = false): Mesh {
  const b = new MeshBuilder();
  const x = w / 2,
    y = d / 2,
    z0 = centred ? -h / 2 : 0,
    z1 = z0 + h;
  face(b, [-x, -y, z1], [x, -y, z1], [x, y, z1], [-x, y, z1]);
  face(b, [-x, y, z0], [x, y, z0], [x, -y, z0], [-x, -y, z0]);
  face(b, [-x, -y, z0], [x, -y, z0], [x, -y, z1], [-x, -y, z1]);
  face(b, [x, y, z0], [-x, y, z0], [-x, y, z1], [x, y, z1]);
  face(b, [x, -y, z0], [x, y, z0], [x, y, z1], [x, -y, z1]);
  face(b, [-x, y, z0], [-x, -y, z0], [-x, -y, z1], [-x, y, z1]);
  return b.build();
}

/**
 * The coin's rungs, finest first: what a slower machine steps down to. Both
 * keep a straight edge, which is what makes a coin read as a coin: the
 * bevel goes first, then the roundness.
 */
export const COIN_LADDER = [
  { name: 'bevelled', segments: 12, bevel: true }, // 92 triangles
  { name: 'plain', segments: 8, bevel: false }, // 28
] as const;

/**
 * A chunky coin, centred on the origin with its axis up Z, turned from one
 * profile: a straight milled edge nearly the full thickness with a thin
 * bevel each side, which is what makes a coin on its side read as a coin
 * rather than a lozenge. `detail` is a rung of `COIN_LADDER`.
 */
export function coin(radius: number, thickness: number, detail = 0): Mesh {
  const rung = COIN_LADDER[Math.max(0, Math.min(COIN_LADDER.length - 1, detail))];
  const { segments } = rung;
  const b = new MeshBuilder();
  const h = thickness / 2;
  const bevel = thickness * 0.15;
  // the top half of the outside, from the edge in to the middle
  const top: [number, number][] = rung.bevel
    ? [
        [radius, h - bevel],
        [radius - bevel, h],
      ]
    : [[radius, h]];
  // the outside of the solid from the bottom middle round to the top one: with each
  // band wound the same way along it, every face's normal points out
  const profile = [...top.map(([r, z]) => [r, -z] as [number, number]).reverse(), ...top];
  const ring = (r: number, z: number): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      out.push([Math.cos(a) * r, Math.sin(a) * r, z]);
    }
    return out;
  };
  const rings = profile.map(([r, z]) => ring(r, z));
  for (let k = 0; k + 1 < rings.length; k++) {
    const lo = rings[k],
      hi = rings[k + 1];
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      face(b, lo[i], lo[j], hi[j], hi[i]);
    }
  }
  const up = rings[rings.length - 1],
    down = rings[0];
  for (let i = 1; i < segments - 1; i++) {
    tri(b, up[0], up[i], up[i + 1]);
    tri(b, down[0], down[i + 1], down[i]);
  }
  return b.build();
}

/** A flat unit square at z = 0, facing up, centred: stretched to size where it is placed. */
export function square(): Mesh {
  const b = new MeshBuilder();
  face(b, [-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]);
  return b.build();
}
