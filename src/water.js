// Water seen from above, drawn a pixel at a time: a surface you can see into
// (weed on the bed, sand in the shallows by a beach), broad swells and fine ripples drifting across it, glints that
// come and go on the crests, foam that laps a beach, and shade at the foot of a bank. Everything that moves is a few
// tiles of wrapping noise read at offsets that grow with time, so nothing is stepped: a pixel at a time is all of it.
import { linearCongruential } from './random.js';
import { noiseTile } from './noise.js';

const N = 128;
// a tile of wrapping noise from a seed (its grid of random values from a linear congruential generator)
function tile(cells, seed) {
  const rnd = linearCongruential(seed),
    g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return Float32Array.from(noiseTile(N, cells, (x, y) => g[y * cells + x]));
}
const SWELL = tile(8, 11),
  RIP1 = tile(32, 23),
  RIP2 = tile(26, 37),
  BED = tile(10, 51);
// a random number for a point of a 3D lattice (x, y, and a beat of time)
function h3(x, y, z) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * The water's clock at a moment: the offsets its swells, ripples and glints have drifted to (whole pixels), worked
 * out once a frame for every pixel to share. The water moves about fifteen times a second: pass tq, the frame count at
 * that rate, for the foam's flicker.
 * @param {number} t seconds
 * @param {number} tq t at fifteen a second, a whole number (Math.floor(t * 15))
 * @returns {{t: number, tq: number, sw: number, sv: number, r1: number, r2: number, r2v: number, glz: number}}
 * @see value-noise-wikipedia
 */
export function waterTime(t, tq) {
  return {
    t,
    tq,
    sw: (t * 6) | 0,
    sv: (t * 2) | 0,
    r1: (t * 15) | 0,
    r2: (t * 10) | 0,
    r2v: (t * 4) | 0,
    glz: (t * 3) | 0,
  };
}

/**
 * One pixel of water, as a colour of a palette: foam lapping a beach (its width breathing) or a thin line along a
 * wall; deeper water darker; broad swells and fine ripples (crests drawn out sideways, like wind on water) lightening
 * and darkening it a step at a time; glints, short dashes on the crests each coming and going on its own beat; sand
 * under clear water in the shallows by a beach; weed patches on the bed, seen through it, shimmering.
 * @param {number} wx the pixel (whole world pixels)
 * @param {number} wy
 * @param {number} d how far from the shore, in pixels
 * @param {boolean} near a beach is close by (foam laps it, sand shows under it)
 * @param {number} sh shade at the foot of a bank or a wall: 0, 1 or 2 steps darker
 * @param {object} T the water's clock (waterTime)
 * @param {number} wob the bed's sway for this row of pixels (a whole number: Math.round(Math.sin(y * 0.35 + t * 2.2)))
 * @param {{LV: number[], FOAM: number, FOAM2: number, GLINT: number, GLINT2: number, WEED: number, WEED2: number,
 *   SAND: number[]}} P the palette: LV seven steps light to deep, SAND three from the beach out (any colour form)
 * @returns {*} one of the palette's colours
 * @see value-noise-wikipedia
 */
export function waterPixel(wx, wy, d, near, sh, T, wob, P) {
  const { t, tq, sw, sv, r1, r2, r2v, glz } = T;
  // foam: lapping a beach (its width breathing in and out), a thin line along walls
  if (near) {
    const fw = 1.4 + 1.6 * (1 + Math.sin(t * 1.5 + wx * 0.11 + wy * 0.05));
    if (d < fw || (d < fw + 1 && (wx + wy + tq) & 1)) return d < fw - 1 ? P.FOAM : P.FOAM2;
  } else if (d <= 1) return (wx + tq) % 4 ? P.FOAM2 : P.FOAM;
  let lv = d > 48 ? 4 : d > 16 ? 3 : 2; // deeper is darker
  const s1 = SWELL[((wy + sv) & 127) * N + ((wx + sw) & 127)];
  if (s1 < 0.33) lv++;
  else if (s1 > 0.7) lv--;
  const r =
    (RIP1[((wy * 3) & 127) * N + ((wx + r1) & 127)] + RIP2[((wy * 3 + r2v) & 127) * N + ((wx - r2 + 64) & 127)]) * 0.5;
  if (r > 0.7) lv -= 2;
  else if (r > 0.62) lv--;
  else if (r < 0.33) lv++;
  if (sh) lv += sh;
  // glints: short dashes on the crests, each coming and going on its own beat
  if (r > 0.6 && d > 2) {
    const gx = (wx + r1) >> 2,
      beat = (glz + ((h3(gx, wy, 3) * 9) | 0)) | 0;
    const g = h3(gx, wy, beat);
    if (g < 0.02) return g < 0.01 ? P.GLINT : P.GLINT2;
  }
  // the shallows by a beach: sand under clear water
  if (near && d < 12) return r > 0.66 ? P.LV[1] : P.SAND[d < 5 ? 0 : d < 8 ? 1 : 2];
  // the bed: weed patches seen through the water, shimmering
  if (d > 3) {
    const b = BED[((wy >> 1) & 127) * N + (((wx + wob) >> 1) & 127)];
    if (b > 0.69 || (b > 0.65 && (wx + wy) & 1)) return b > 0.73 && (wx ^ wy) & 2 ? P.WEED2 : P.WEED;
  }
  return P.LV[lv < 0 ? 0 : lv > 6 ? 6 : lv];
}
