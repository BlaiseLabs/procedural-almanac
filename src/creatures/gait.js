// Walking: where a foot is at each moment of its step, how fast the step turns as the body moves, and which legs
// step together. A step's moment is its phase, an angle: a whole step is 2π, and two legs whose phases differ by π
// are half a step apart.

const PI = Math.PI;

/**
 * Where a foot is at a moment of its step, from where it rests: for half the step it is lifted and swings forward
 * (highest in the middle of the swing), and for the other half it is planted on the ground and moves back as the
 * body passes over it.
 * @param {number} phase the moment of the step (an angle; a whole step is 2π)
 * @param {number} stride how far the foot reaches forward and back of its rest point
 * @param {number} lift how high it rises at the top of its swing
 * @returns {{x: number, y: number}} forward of the rest point, and up from the ground
 * @example footStep(0, 3, 1) // { x: 0, y: 1 }: mid-swing, at the top
 * @see gait-wikipedia
 * @see gait-analysis-wikipedia
 */
export function footStep(phase, stride, lift) {
  return { x: Math.sin(phase) * stride, y: Math.max(0, Math.cos(phase)) * lift };
}

/**
 * How far a step's phase turns for each unit the body walks, so a planted foot does not slide: while planted (half a
 * step, π) the foot moves back by twice its stride, so the body must move forward as far in that time.
 * @param {number} stride the stride footStep is given
 * @returns {number} phase per unit of distance walked
 * @example strideRate(3) // π/6: walk 6 units, and the step turns half way
 */
export function strideRate(stride) {
  return PI / (2 * stride);
}

// the gaits: for each pair of legs, front to back, the phase of its near leg and of its far leg
const GAITS = {
  // four legs
  walk: () => [
    { near: 0, far: PI * 0.5 },
    { near: PI, far: PI * 1.5 },
  ], // each leg a quarter step after another
  trot: () => [
    { near: 0, far: PI },
    { near: PI, far: 0 },
  ], // diagonal legs together
  bound: () => [
    { near: 0, far: 0.4 },
    { near: PI, far: PI + 0.4 },
  ], // the fore legs together, the hind legs together, half a step apart
  // two legs
  stride: () => [{ near: 0, far: PI }],
  // six or more legs
  tripod: (pairs) => Array.from({ length: pairs }, (_, i) => ({ near: ((i + 1) % 2) * PI, far: (i % 2) * PI })),
  wave: (pairs) => Array.from({ length: pairs }, (_, i) => ({ near: i * PI * 0.5 + PI, far: i * PI * 0.5 })),
};
const PAIRS = { walk: 2, trot: 2, bound: 2, stride: 1 };

/**
 * Which legs step together in a gait: for each pair of legs, front to back, the phase offset of its near leg and of
 * its far leg (near and far: the two sides, as seen side-on). Add a leg's offset to the walk's phase and give it to
 * footStep.
 * @param {'walk'|'trot'|'bound'|'stride'|'tripod'|'wave'} gait walk, trot and bound have two pairs (four legs); stride
 *   has one (two legs); tripod and wave have as many as asked for
 * @param {number} [pairs] how many pairs of legs (tripod and wave only; 3 for an insect, 4 for a spider)
 * @returns {{near: number, far: number}[]} a new table each time
 * @example gaitTiming('trot') // [{ near: 0, far: π }, { near: π, far: 0 }]
 * @see muybridge-1887
 * @see hildebrand-1965
 * @see horse-gait-wikipedia
 * @see wilson-1966
 * @see tripod-gait-wikipedia
 */
export function gaitTiming(gait, pairs = PAIRS[gait] || 3) {
  if (!GAITS[gait]) throw new Error(`"${gait}" is not a gait (one of: ${Object.keys(GAITS).join(', ')})`);
  if (PAIRS[gait] && pairs !== PAIRS[gait])
    throw new Error(`a ${gait} has ${PAIRS[gait]} pair${PAIRS[gait] > 1 ? 's' : ''} of legs, not ${pairs}`);
  if (!Number.isInteger(pairs) || pairs < 1) throw new Error(`pairs: a whole number of at least 1, not ${pairs}`);
  return GAITS[gait](pairs);
}
