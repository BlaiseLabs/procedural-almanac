// The basics every other technique leans on: keeping a number in a range, going part of the way from one number to
// another (straight, or eased), and wrapping a number round a span.

/**
 * A number kept inside a range: below it gives the low end, above it the high end.
 * @param {number} v
 * @param {number} [lo] 0 if not given
 * @param {number} [hi] 1 if not given
 * @returns {number}
 * @example clamp(1.4) // 1
 * @see clamping-wikipedia
 */
export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Part of the way from a to b: t = 0 gives a, t = 1 gives b, t = 0.5 half way (t outside 0..1 goes beyond them).
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 * @example lerp(10, 20, 0.25) // 12.5
 * @see lerp-wikipedia
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Where v is between two edges, eased: 0 at the first edge or before it, 1 at the second or beyond, and a smooth S in
 * between that starts and ends level (3t² - 2t³), so nothing it drives jerks at either end.
 * @param {number} edge0
 * @param {number} edge1
 * @param {number} v
 * @returns {number} 0..1
 * @example smoothstep(0, 10, 5) // 0.5
 * @see smoothstep-wikipedia
 */
export const smoothstep = (edge0, edge1, v) => {
  const t = clamp((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * A number wrapped round a span, always 0 or more and less than the span (a remainder that never goes negative): what
 * scrolls off one side comes back on the other.
 * @param {number} v
 * @param {number} span
 * @returns {number} 0 <= result < span
 * @example wrap(-30, 100) // 70
 * @see modulo-wikipedia
 */
export const wrap = (v, span) => ((v % span) + span) % span;

/**
 * The signed turn from one angle to another, the short way round: between -pi and pi radians, however many times
 * round either angle has gone. What a heading turns by to face a target.
 * @param {number} a radians
 * @param {number} b radians
 * @returns {number} -pi..pi
 * @example angleDiff(0.1, 2 * Math.PI - 0.1) // -0.2 (not 6.08)
 * @see modulo-wikipedia
 */
export const angleDiff = (a, b) => {
  const TAU = Math.PI * 2;
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
