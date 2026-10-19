// Scattering: where things go when they are placed by number, not by hand (trees along a hillside, buildings along a
// street, lit windows in them), the same every time for the same seed and never all in a row.
import { lerp } from './numbers.js';
import { indexRandom } from './random.js';

/**
 * Things scattered along a stretch of a line: one slot every so often, each kept or skipped by chance, nudged
 * within its slot, with a variant and a size of its own. Slots are numbered from the start of the line, so the same
 * slot is the same thing every time it scrolls into view.
 * @param {number} from where the stretch starts (any units)
 * @param {number} to where it ends
 * @param {number} every the slot width
 * @param {number} seed
 * @param {{chance?: number, salt?: number, variants?: number, size?: number[]}} [o] chance a slot is kept (0.7); salt:
 *   a number that gives another pattern with the same seed; variants (4); size: the range of sizes ([0.85, 1.15])
 * @returns {{i: number, x: number, variant: number, size: number}[]} the kept slots, in order
 * @see cook-1986
 */
export function scatterAlong(from, to, every, seed, o = {}) {
  const out = [],
    i0 = Math.floor(from / every),
    i1 = Math.ceil(to / every);
  for (let i = i0; i <= i1; i++) {
    if (indexRandom(i, seed + 31 + (o.salt || 0)) > (o.chance === undefined ? 0.7 : o.chance)) continue;
    out.push({
      i,
      x: (i + (indexRandom(i, seed + 37) - 0.5) * 0.8) * every, // nudged by up to 40% of a slot either way
      variant: Math.floor(indexRandom(i, seed + 41) * (o.variants || 4)),
      size: lerp(...(o.size || [0.85, 1.15]), indexRandom(i, seed + 43)),
    });
  }
  return out;
}

/**
 * Whether a window is lit: a fixed pattern of lit and dark windows, a share of them lit, that changes every 25
 * seconds, each building on its own schedule, so a city at night is never still and never flickers.
 * @param {number} building the building's number
 * @param {number} row the window's row
 * @param {number} col its column
 * @param {number} seed
 * @param {number} t the time, in seconds
 * @param {number} share how many windows are lit, 0..1
 * @returns {boolean}
 */
export const windowLit = (building, row, col, seed, t, share) =>
  indexRandom(building * 977 + row * 31 + col, seed + 3 + Math.floor((t + indexRandom(building, 5) * 40) / 25)) < share;

/**
 * Whether a blinking light is on: a wave at its own rate and phase, on while it is above a threshold. It is on for
 * a share of each cycle of 1/2 - asin(threshold)/π: about 30% at 0.6 (a beacon), about 82% at -0.85 (a neon sign that
 * fails in brief dips).
 * @param {number} t the time, in seconds
 * @param {number} rate how fast it cycles (radians a second)
 * @param {number} phase the light's own (an angle)
 * @param {number} threshold -1..1: above it, on
 * @returns {boolean}
 */
export const blink = (t, rate, phase, threshold) => Math.sin(t * rate + phase) > threshold;
