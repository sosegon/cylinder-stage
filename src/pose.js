import { HALF_SHIFT } from './mapping.js';

/**
 * Local pose of a bar vertex, before it is placed on the arc.
 * Keep this in sync with src/shaders.js.
 *
 * SPEC §4 asks for two things a single rigid rotation cannot do at once:
 * the erect rib is curved inward in the radial plane, and the rest pose lies
 * flat on the floor. A 90° rotation of that curve maps inward offset to
 * negative Y, so the bar would cut through the floor. A curve that stays in
 * the radial plane and lies on the floor has to be straight, because that
 * plane meets the floor in a line.
 *
 * Assumption (see the spec-change issue): rest is a straight ribbon of length L
 * on the floor, pointing at the center. The rise rotates that straight bar up
 * about the base tangent while the dome-rib curvature eases in. Tilt (SPEC §5)
 * and deformation (SPEC §6) are applied on the erect pose and weighted by the
 * erect amount, so a fallen bar is undeformed and untilted.
 *
 *   py, pz = mix(straight vertical, tilted erect, erectAmount)
 *   then rotate about local X by (1 − erectAmount) · 90° toward the center.
 */

export function localPose(x, y, z, ny, nz, t, erect, tilt, amp, barLength) {
  const cy = y + ny * amp;
  const cz = z + nz * amp;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  const ey = cy * cosTilt - cz * sinTilt;
  const ez = cy * sinTilt + cz * cosTilt;

  const sLen = t * barLength;
  const py = (1 - erect) * sLen + erect * ey;
  const pz = erect * ez;
  const ang = (1 - erect) * Math.PI * 0.5;
  const cosAng = Math.cos(ang);
  const sinAng = Math.sin(ang);

  return {
    x,
    y: py * cosAng - pz * sinAng,
    z: py * sinAng + pz * cosAng,
  };
}

/** Place a local point on its half-circle. theta is the bar center angle. */
export function placeOnArc(local, theta, radius) {
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const side = sinTheta >= 0 ? 1 : -1;
  return {
    x: local.x * cosTheta - local.z * sinTheta + radius * sinTheta + side * radius * HALF_SHIFT,
    y: local.y,
    z: local.x * sinTheta + local.z * cosTheta - radius * cosTheta,
  };
}
