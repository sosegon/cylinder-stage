/**
 * Erect dome-rib profile in the radial plane.
 * t = 0 at the base, t = 1 at the tip, parameterized by fraction of arc length L.
 * Inward offset x(t) = offset · t^power, so the base tangent is vertical when power > 1
 * and higher power concentrates curvature near the tip (SPEC §2).
 * y is integrated so (dx)^2 + (dy)^2 = L^2.
 */

function inwardSlope(t, offset, power) {
  if (t <= 1e-8) return power > 1 ? 0 : offset * power;
  return offset * power * t ** (power - 1);
}

export function integrateProfile(length, offset, power, segments) {
  const seg = Math.max(1, segments | 0);
  const y = new Float32Array(seg + 1);
  const z = new Float32Array(seg + 1);
  const ny = new Float32Array(seg + 1);
  const nz = new Float32Array(seg + 1);

  let valid = Math.abs(inwardSlope(1, offset, power)) <= length;
  const sub = 16;
  let cy = 0;
  let cz = 0;
  const slopeLimit = length * 0.999999;

  for (let i = 0; i < seg; i += 1) {
    const t0 = i / seg;
    const t1 = (i + 1) / seg;
    const dt = (t1 - t0) / sub;
    for (let s = 0; s < sub; s += 1) {
      const t = t0 + (s + 0.5) * dt;
      let dz = inwardSlope(t, offset, power);
      if (dz > slopeLimit) {
        dz = slopeLimit;
        valid = false;
      } else if (dz < -slopeLimit) {
        dz = -slopeLimit;
        valid = false;
      }
      const dy = Math.sqrt(Math.max(0, length * length - dz * dz));
      cy += dy * dt;
      cz += dz * dt;
    }
    y[i + 1] = cy;
    z[i + 1] = cz;
  }

  if (valid) {
    for (let i = 0; i <= seg; i += 1) {
      const t = i / seg;
      z[i] = offset * t ** power;
    }
  }

  for (let i = 0; i <= seg; i += 1) {
    const t = i / seg;
    let dz = inwardSlope(t, offset, power);
    if (dz > slopeLimit) dz = slopeLimit;
    else if (dz < -slopeLimit) dz = -slopeLimit;
    const dy = Math.sqrt(Math.max(0, length * length - dz * dz));
    const len = Math.hypot(dy, dz) || 1;
    // Outward normal of tangent (dy, dz): (dz, -dy). At the base this is (0, -1).
    ny[i] = dz / len;
    nz[i] = -dy / len;
  }

  let arcLength = 0;
  for (let i = 0; i < seg; i += 1) {
    arcLength += Math.hypot(y[i + 1] - y[i], z[i + 1] - z[i]);
  }

  return {
    y,
    z,
    ny,
    nz,
    height: y[seg],
    tipInward: z[seg],
    valid,
    arcLength,
    segments: seg,
  };
}
