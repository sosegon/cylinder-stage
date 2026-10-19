import { SLOT_ANGLE, halfWidthAt } from './mapping.js';
import { localPose } from './pose.js';

/**
 * Worst-case floor height and neighbor gap for the current parameters.
 * Samples the rise, both tilt extremes, and both signs of full deformation.
 * Neighbor gap is the angular gap between adjacent bar edges (radians).
 * Positive gap means the ribbons do not meet.
 */
export function measureClearance(profile, params) {
  const amplitude = params.deformAmplitude * params.barLength;
  const maxTilt = params.maxTilt * Math.PI / 180;
  const radius = params.radius;
  const seg = profile.segments;
  let minY = Infinity;
  let maxHalf = 0;
  let crossed = false;

  for (let i = 0; i <= seg; i += 1) {
    const t = i / seg;
    const halfW = halfWidthAt(t, radius, params.tipWidthRatio);
    for (let step = 0; step <= 8; step += 1) {
      const erect = step / 8;
      for (let tiltIndex = 0; tiltIndex < 2; tiltIndex += 1) {
        const tilt = tiltIndex === 0 ? 0 : maxTilt;
        for (let sign = -1; sign <= 1; sign += 2) {
          const amp = sign * amplitude * t;
          const pose = localPose(
            0,
            profile.y[i],
            profile.z[i],
            profile.ny[i],
            profile.nz[i],
            t,
            erect,
            tilt,
            amp,
            params.barLength,
          );
          if (pose.y < minY) minY = pose.y;
          const radial = radius - pose.z;
          if (radial <= halfW) {
            crossed = true;
          } else {
            const half = Math.atan(halfW / radial);
            if (half > maxHalf) maxHalf = half;
          }
        }
      }
    }
  }

  const angularGap = crossed ? -1 : SLOT_ANGLE - 2 * maxHalf;
  return { minY, angularGap };
}
