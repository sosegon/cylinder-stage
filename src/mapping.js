/** Confirmed layout values from SPEC §1 and §6. Not tunable. */

export const BAR_COUNT = 32;
export const BAND_COUNT = 16;
export const ARC_DEGREES = 360;
export const YAW_LIMIT_DEG = 90;

export const DEG = Math.PI / 180;
export const YAW_LIMIT = YAW_LIMIT_DEG * DEG;
export const SLOT_ANGLE = (ARC_DEGREES * DEG) / BAR_COUNT;
/** How far each half-circle shifts off center, as a fraction of the radius. */
export const HALF_SHIFT = 1;

/** SPEC §1: base width = π · R / 64, half of each equal angular slot. */
export function baseWidth(radius) {
  return (Math.PI * radius) / (BAR_COUNT * 2);
}

export function halfWidthAt(t, radius, tipWidthRatio) {
  const base = baseWidth(radius);
  const tip = base * tipWidthRatio;
  return 0.5 * (base + (tip - base) * t);
}

/** Center angle of bar i, evenly spaced around a full circle. */
export function barAngle(index) {
  const degrees = -90 + (ARC_DEGREES / BAR_COUNT) * (index + 0.5);
  return degrees * DEG;
}

/**
 * SPEC §6 symmetric mapping.
 * Band 0 (lowest) drives bars 15 and 16. Band 15 (highest) drives bars 0 and 31.
 */
export function bandIndexForBar(index) {
  const mirror = index <= 15 ? index : BAR_COUNT - 1 - index;
  return BAND_COUNT - 1 - mirror;
}

/** Delay before bar `index` starts a rise/fall. SPEC §4. */
export function riseDelay(index, pattern, stagger) {
  const dist = Math.abs(index - 15.5) - 0.5;
  if (pattern === 'simultaneous') return 0;
  if (pattern === 'centerOut') return dist * stagger;
  if (pattern === 'edgesIn') return (15 - dist) * stagger;
  if (pattern === 'leftToRight') return index * stagger;
  return 0;
}

export function easeInOutCubic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.5) return 4 * t * t * t;
  return 1 - ((-2 * t + 2) ** 3) / 2;
}

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function clamp01(value) {
  return clamp(value, 0, 1);
}

/**
 * SPEC §3: looking around stops smoothly at the yaw and pitch limits and
 * never points past them. Motion is free until `zone` radians from the stop,
 * then each step covers at most half the remaining distance.
 */
export function soften(value, delta, min, max, zone) {
  if (delta === 0) return clamp(value, min, max);
  const towardMax = delta > 0;
  const limit = towardMax ? max : min;
  let current = clamp(value, min, max);
  const room = towardMax ? limit - current : current - limit;
  if (room <= 0) return current;
  const magnitude = Math.abs(delta);
  if (room > zone) {
    const free = room - zone;
    if (magnitude <= free) return current + delta;
    current += towardMax ? free : -free;
    const leftover = magnitude - free;
    const step = Math.min(leftover, zone * 0.5);
    return current + (towardMax ? step : -step);
  }
  const step = Math.min(magnitude, room * 0.5);
  return current + (towardMax ? step : -step);
}
