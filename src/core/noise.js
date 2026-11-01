// Noise: numbers that vary smoothly from place to place, the same at the same place for the same seed. Land, clouds,
// water and the wobble of anything alive are this noise at some scale.
import { hash32 } from './random.js';

/**
 * A number in [0, 1) for a point of a grid (whole x and y) and a seed: the same point gives the same number, and
 * neighbouring points give unrelated ones. Value noise is built by blending these.
 * @param {number} x a whole number
 * @param {number} y a whole number
 * @param {number} [seed]
 * @returns {number} 0 <= result < 1
 * @see value-noise-wikipedia
 * @see jenkins-integer-hashing
 */
export const latticeRandom = (x, y, seed = 0) =>
  hash32((x * 374761393) ^ hash32((y * 668265263) ^ (seed * 1274126177))) / 4294967296;

const fade = (t) => t * t * (3 - 2 * t);

/**
 * Value noise: a number in 0..1 that varies smoothly across the plane. Each grid point has a random number
 * (latticeRandom); between them the four nearest are blended, eased so that the grid does not show as creases.
 * @param {number} x
 * @param {number} y
 * @param {number} [seed]
 * @returns {number} 0..1
 * @example valueNoise(3.7, 1.2, 7) // the same number every time
 * @see value-noise-wikipedia
 * @see texturing-and-modeling-2003
 */
export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    u = fade(x - xi),
    v = fade(y - yi);
  const a = latticeRandom(xi, yi, seed),
    b = latticeRandom(xi + 1, yi, seed),
    c = latticeRandom(xi, yi + 1, seed),
    d = latticeRandom(xi + 1, yi + 1, seed);
  // the four corners blended: along x, along y, and the cross term that makes the square a smooth saddle
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Fractal noise (fractional Brownian motion): value noise at several scales added together, each finer one fainter,
 * so there is detail at every size, as in a coastline or a mountain range.
 * @param {number} x
 * @param {number} y
 * @param {number} [seed]
 * @param {number} [octaves] how many scales (4)
 * @param {number} [gain] how much fainter each finer scale is (0.5: half)
 * @param {number} [lacunarity] how much finer each scale is (2: twice)
 * @returns {number} 0..1
 * @see fbm-wikipedia
 * @see mandelbrot-van-ness-1968
 * @see texturing-and-modeling-2003
 */
export function fractalNoise(x, y, seed = 0, octaves = 4, gain = 0.5, lacunarity = 2) {
  let s = 0,
    a = 1,
    t = 0;
  for (let o = 0; o < octaves; o++) {
    s += a * valueNoise(x, y, seed + o * 101);
    t += a;
    a *= gain;
    x *= lacunarity;
    y *= lacunarity;
  }
  return s / t;
}

/**
 * Ridged noise: fractal noise folded at its middle, so its highs are thin sharp lines (cracks in ice, veins, ridges,
 * streams) rather than round hills.
 * @param {number} x
 * @param {number} y
 * @param {number} [seed]
 * @param {number} [octaves] how many scales (3)
 * @returns {number} 0..1
 * @see texturing-and-modeling-2003
 */
export function ridgedNoise(x, y, seed = 0, octaves = 3) {
  let s = 0,
    a = 1,
    t = 0;
  for (let o = 0; o < octaves; o++) {
    s += a * (1 - Math.abs(valueNoise(x, y, seed + o * 57) * 2 - 1));
    t += a;
    a *= 0.5;
    x *= 2;
    y *= 2;
  }
  return s / t;
}

/**
 * Value noise along a line: a number in 0..1 that wanders smoothly as x moves (a heading that drifts, a gust, the
 * outline of a hill).
 * @param {number} x
 * @param {number} [seed]
 * @returns {number} 0..1
 * @see value-noise-wikipedia
 */
export const noiseLine = (x, seed = 0) => valueNoise(x, seed * 0.731 + 7.3, seed);

/**
 * A square of value noise that tiles: its right edge meets its left and its bottom its top, so it can be scrolled for
 * ever (water, cloud shadows, a texture) by reading it at a moving offset, wrapped. A grid of cells random values, the
 * grid read round (the last column's neighbour is the first), blended as valueNoise blends.
 * @param {number} size pixels across (and down)
 * @param {number} cells grid cells across: fewer is broader
 * @param {function(number, number): number} lattice the value (0..1) at a grid point, given whole x and y in
 *   0..cells-1 (latticeRandom with a seed, or a table)
 * @returns {Float64Array} size * size values, 0..1, row by row
 * @see value-noise-wikipedia
 * @see wraparound-wikipedia
 */
export function noiseTile(size, cells, lattice) {
  const out = new Float64Array(size * size),
    f = size / cells,
    w = (i) => ((i % cells) + cells) % cells;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = x / f,
        gy = y / f,
        xi = Math.floor(gx),
        yi = Math.floor(gy),
        u = fade(gx - xi),
        v = fade(gy - yi);
      const a = lattice(w(xi), w(yi)),
        b = lattice(w(xi + 1), w(yi)),
        c = lattice(w(xi), w(yi + 1)),
        d = lattice(w(xi + 1), w(yi + 1));
      out[y * size + x] = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
  return out;
}
