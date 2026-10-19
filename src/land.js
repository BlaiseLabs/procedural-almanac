// Land: the outline of hills seen side-on, and an island's height seen from above, both from noise; and land seen from
// above made by rules on noise: lower is water, a little higher the shore, higher the ground; a path that wanders.
import { clamp, lerp, angleDiff } from './numbers.js';
import { noiseLine, fractalNoise, valueNoise, ridgedNoise } from './noise.js';

/**
 * The height of a line of hills at a point, seen side-on: noise along the line at four scales, sharpened into peaks
 * or flattened into terraces if asked, and stretched to fill the range from the hills' base up to their height.
 * @param {number} x where along the line (in the same units as width)
 * @param {{freq?: number, seed?: number, flat?: boolean, base?: number, height?: number, sharp?: number, rough?: number,
 *   terrace?: number}} hill freq: hills across the width (2); base: where the lowest land sits, as a share of the
 *   picture's height down from the top (0.7); height: how much higher the highest stands (0.15); sharp: 0 round to 1
 *   pointed; rough: how strong each finer scale is (0.45); terrace: how many flat steps (none); flat: a level line
 * @param {number} width the picture's width
 * @param {number} height the picture's height
 * @returns {number} y of the land at x (down from the top)
 * @example hillLine(120, { seed: 4, sharp: 0.6 }, 320, 200) // a y between 110 and 140
 * @see fbm-wikipedia
 */
export function hillLine(x, hill, width, height) {
  const f = (hill.freq || 2) / width,
    s = (hill.seed || 0) % 9973;
  if (hill.flat) return height * (hill.base === undefined ? 0.8 : hill.base);
  let v = 0,
    a = 1,
    norm = 0,
    fr = f;
  for (let o = 0; o < 4; o++) {
    let n = noiseLine(x * fr, s + o * 13);
    if (hill.sharp) n = lerp(n, 1 - Math.abs(n * 2 - 1), hill.sharp);
    v += n * a;
    norm += a;
    a *= hill.rough === undefined ? 0.45 : hill.rough;
    fr *= 2.1;
  }
  v = clamp(0.5 + (v / norm - 0.5) * 2.6, 0, 1); // (an average of noise hugs the middle: stretched to the full range)
  if (hill.terrace) v = Math.round(v * hill.terrace) / hill.terrace;
  return height * ((hill.base === undefined ? 0.7 : hill.base) - (hill.height === undefined ? 0.15 : hill.height) * v);
}

/**
 * The height of an island at a tile, 0..1: fractal noise, lowered toward the edge of the map and raised toward its
 * middle, so the land rises from the sea in the centre and sinks into it all round.
 * @param {number} x the tile, 0 to size - 1
 * @param {number} y
 * @param {number} size tiles across the map
 * @param {number} seed
 * @param {{rough?: number, long?: boolean}} [o] rough: the noise's gain (0.5); long: an island stretched along x
 * @returns {number} 0..1 (multiply by the levels and round, for terraces)
 * @see redblob-terrain-from-noise
 * @see heightmap-wikipedia
 */
export function islandHeight(x, y, size, seed, o = {}) {
  const dx = (x + 0.5) / size - 0.5,
    dy = (y + 0.5) / size - 0.5,
    d = Math.hypot(dx, dy) * 2,
    shape = o.long ? Math.hypot(dx * 0.7, dy * 1.6) * 2 : d;
  let v =
    fractalNoise(x / (size * 0.28), y / (size * 0.28), seed % 9973, 4, o.rough === undefined ? 0.5 : o.rough) * 1.25 -
    0.1;
  // falling away toward the edge (as the square of the distance, and faster), and a lift in the middle
  v = clamp(v * (1 - Math.pow(clamp(shape, 0, 1.2), 2.2)) + 0.25 * (1 - shape), 0, 1);
  return v;
}

// the height below which a share of fractal noise lies, at each twentieth (fractal noise is about bell-shaped round 0.5:
// these are the normal distribution's quantiles, its probits, cut off at three standard deviations)
const QUANT = [
  -3, -1.64, -1.28, -1.04, -0.84, -0.67, -0.52, -0.39, -0.25, -0.13, 0, 0.13, 0.25, 0.39, 0.52, 0.67, 0.84, 1.04, 1.28,
  1.64, 3,
];

/**
 * The height that a given share of a land lies below, for land made from fractal noise: ask for 0.3 and about 30% of
 * the land is under it (so the water can be set by how much of the land it covers, not by a height that means nothing
 * on its own). Fractal noise is about bell-shaped round 0.5, so this is 0.5 plus the normal distribution's quantile at
 * that share, scaled to the noise's spread.
 * @param {number} level the share of the land wanted under it, 0..1
 * @returns {number} a height, about 0.18..0.82
 * @see redblob-terrain-from-noise
 * @see probit-wikipedia
 */
export function levelCut(level) {
  const u = clamp(level) * 20,
    k = Math.min(19, Math.floor(u));
  return 0.5 + 0.105 * lerp(QUANT[k], QUANT[k + 1], u - k);
}

/**
 * What a height of the land makes it, by the rule "lower is water, higher is ground": under the cut it is water, as
 * deep as it is low (a fixed step of height to the deepest), and just above the cut it is the shore.
 * @param {number} e the land's height there (fractal noise, 0..1)
 * @param {number} cut the water's height (levelCut)
 * @returns {{under: number, depth: number, shore: boolean}} under: how far under the water's height, in steps (below
 *   0 above it); depth: 0 on land, else 0.02..1; shore: a band just above the water
 * @see redblob-terrain-from-noise
 */
export function heightWater(e, cut) {
  const under = (cut - e) / 0.15;
  return { under, depth: under <= 0 ? 0 : clamp(under, 0.02, 1), shore: under <= 0 && e - cut < 0.016 };
}

/**
 * The next heading of a path that wanders by itself: it turns toward a heading that drifts with noise along its
 * length (slowly, over hundreds of steps, and a little faster over tens), never more than a set turn a step, so it
 * curves and never zigzags. Walked step by step it is a trail across a land, the same from the same seed.
 * @param {number} a its heading now (radians)
 * @param {number} s how far along it is (in the same units as the step)
 * @param {number} seed
 * @param {number} [bias] the way it tends overall (radians)
 * @param {number} [turn] the most it turns in a step (radians, 0.06)
 * @returns {number} the heading for the next step
 * @see random-walk-wikipedia
 */
export function wanderingHeading(a, s, seed, bias = 0, turn = 0.06) {
  const want =
    bias +
    1.15 * (fractalNoise(s / 560, 3.1, seed + 5, 3) - 0.5) * 2 +
    0.3 * (valueNoise(s / 120, 9.7, seed + 6) - 0.5) * 2;
  return a + clamp(angleDiff(a, want), -turn, turn);
}

/**
 * The chamfer distance transform: for every cell of a grid marked nonzero, how far it is from the nearest cell marked
 * zero, as a step across costs 3 and a step diagonally 4 (so the distance is about three times the true one, without
 * a square root). Two passes over the grid: down and right, then up and left, each taking the least of its own
 * distance and its already-visited neighbours' plus the step.
 * @param {Uint8Array} mask w by h, row by row: 0 where the distance is measured from, nonzero elsewhere
 * @param {number} w
 * @param {number} h
 * @returns {Uint16Array} the distances, in thirds of a cell (60000 where no zero cell was reached)
 * @see distance-transform-wikipedia
 * @see borgefors-1986
 */
export function chamferDistance(mask, w, h) {
  const INF = 60000,
    D = new Uint16Array(w * h);
  for (let i = 0; i < D.length; i++) D[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = D[i];
      if (!d) continue;
      if (x > 0) d = Math.min(d, D[i - 1] + 3);
      if (y > 0) {
        d = Math.min(d, D[i - w] + 3);
        if (x > 0) d = Math.min(d, D[i - w - 1] + 4);
        if (x < w - 1) d = Math.min(d, D[i - w + 1] + 4);
      }
      D[i] = d;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = D[i];
      if (!d) continue;
      if (x < w - 1) d = Math.min(d, D[i + 1] + 3);
      if (y < h - 1) {
        d = Math.min(d, D[i + w] + 3);
        if (x < w - 1) d = Math.min(d, D[i + w + 1] + 4);
        if (x > 0) d = Math.min(d, D[i + w - 1] + 4);
      }
      D[i] = d;
    }
  return D;
}

/**
 * How far a point is past the edge of a round world whose edge wobbles: a circle round the middle, its radius pushed
 * in and out by a broad value noise (up to 17% of the radius each way) and a fine one (5 each way), so the edge reads
 * as a coast or a mountain wall, not a ring.
 * @param {number} x the point
 * @param {number} y
 * @param {number} cx the world's middle
 * @param {number} cy
 * @param {number} r its radius
 * @param {number} seed the broad noise's (the fine one takes seed + 1)
 * @returns {number} distance past the edge (negative inside)
 * @see value-noise-wikipedia
 */
export function wobbledRing(x, y, cx, cy, r, seed) {
  const wob = (valueNoise(x / 110, y / 110, seed) - 0.5) * 0.34 * r + (valueNoise(x / 31, y / 31, seed + 1) - 0.5) * 10;
  return Math.hypot(x - cx, y - cy) - (r + wob);
}

/**
 * How high a mountain wall stands at a point past a world's edge, 0..1: rising from 6 inside the edge to full height
 * 110 past it, and broken by ridged noise so it is a range, not a ramp.
 * @param {number} past how far past the edge the point is (wobbledRing)
 * @param {number} x the point
 * @param {number} y
 * @param {number} seed the ridges'
 * @returns {number} 0..1
 * @see value-noise-wikipedia
 */
export const mountainRise = (past, x, y, seed) => clamp((past + 6) / 110) * (0.55 + 0.45 * ridgedNoise(x / 34, y / 34, seed, 3));

/**
 * A river that winds across a land on its own: it runs where a slow fractal noise crosses its middle value, so it is
 * one unbroken winding line; the further from the middle, the further from the river. Its width is a fifth of its level.
 * @param {number} x the point
 * @param {number} y
 * @param {number} seed
 * @param {number} level how much of the land is river, 0..1 (its width is level / 5 of the noise's half-range)
 * @returns {{depth: number, band: number, width: number}} depth: above 0 in the river (1 at its line); band: how far
 *   from the line, 0..1; width
 * @see value-noise-wikipedia
 * @see fbm-wikipedia
 */
export function windingRiver(x, y, seed, level) {
  const v = fractalNoise(x / 300, y / 300, seed, 3),
    band = Math.abs(v - 0.5) * 2,
    width = level * 0.2;
  return { depth: (width - band) / width, band, width };
}

/**
 * Plots in a grid laid at an angle (paddy fields, salt pans): which plot a point is in, and how far it is from the
 * plot's nearest edge, so a bank can be drawn round each.
 * @param {number} x the point
 * @param {number} y
 * @param {number} size a plot's side
 * @param {number} angle the grid's angle (radians)
 * @returns {{iu: number, iv: number, edge: number}} the plot's place in the grid, and the distance to its nearest edge
 * @see rotation-matrix-wikipedia
 */
export function plotGrid(x, y, size, angle) {
  const u = x * Math.cos(angle) + y * Math.sin(angle),
    v = -x * Math.sin(angle) + y * Math.cos(angle);
  const iu = Math.floor(u / size),
    iv = Math.floor(v / size),
    fu = u - iu * size,
    fv = v - iv * size;
  return { iu, iv, edge: Math.min(fu, fv, size - fu, size - fv) };
}
