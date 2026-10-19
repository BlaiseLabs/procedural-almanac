// Weather over a picture seen from above: the shadows of clouds drifting over the land, banks of fog, how strong a
// passing front is at a moment, and lightning lighting everything for an instant. Each works on a frame of packed
// pixels (an ImageData's 32-bit words, 0xAABBGGRR) in place.
import { smoothstep } from './numbers.js';
import { fractalNoise } from './noise.js';
import { mixPacked } from './pixels.js';

const C = 8; // the coarse grid the slow fields are read on, in pixels
// a channel darkened in the shadow of a cloud: red and green to 82%, blue to 90% (a shadow is a little blue)
const DARK = new Uint8Array(256).map((_, v) => Math.round(v * 0.82)),
  DARK_B = new Uint8Array(256).map((_, v) => Math.round(v * 0.9));
// the 4 by 4 Bayer thresholds (0..15) in the order ((y & 3) << 2) | (x & 3) reads them
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// a slow field on a grid of C-pixel cells covering a frame and one cell more each way, its cells read from f(wx, wy)
function coarse(w, h, x, y, scratch, f) {
  const gw = Math.ceil(w / C) + 2,
    gh = Math.ceil(h / C) + 2,
    x0 = Math.floor(x / C),
    y0 = Math.floor(y / C);
  const g = scratch && scratch.length === gw * gh ? scratch : new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const wx = (x0 + i) * C,
        wy = (y0 + j) * C;
      g[j * gw + i] = f(wx, wy);
    }
  return { g, gw, fx0: x - x0 * C, fy0: y - y0 * C };
}

/**
 * The shadows of clouds over a frame seen from above: a bent fractal noise (so the clouds come out round, not square)
 * read on a coarse grid and smoothed between its points, darkening the land where it is high. How much of the sky is
 * cloud sets the height it must reach; a soft edge is dithered, and in weak light (dawn, dusk) the shadow is a half
 * dither. Moving x and y with the wind moves the shadows over the land.
 * @param {Uint32Array} px the frame's pixels, changed in place
 * @param {number} w its width
 * @param {number} h its height
 * @param {{x: number, y: number, seed: number, cover: number, strong?: boolean, scratch?: Float32Array}} o x, y: where
 *   the frame's corner is over the clouds (the view plus the wind's drift); cover: how much of the sky is cloud, 0..1;
 *   strong: full shadows (by day) or half (dawn, dusk); scratch: the grid kept from the last frame, if any
 * @returns {Float32Array} the grid, to pass back as scratch
 * @see value-noise-wikipedia
 * @see fbm-wikipedia
 * @see bilinear-interpolation-wikipedia
 */
export function cloudShadows(px, w, h, o) {
  const { g, gw, fx0, fy0 } = coarse(w, h, o.x, o.y, o.scratch, (wx, wy) =>
      fractalNoise(wx / 120 + 0.55 * Math.sin(wy / 53 + 1.3), wy / 84 + 0.55 * Math.sin(wx / 67 + 0.7), o.seed, 3),
    ),
    thr = 0.74 - o.cover * 0.36,
    strong = o.strong !== false;
  for (let y = 0; y < h; y++) {
    const gy = (y + fy0) / C,
      j = Math.floor(gy),
      v = gy - j,
      r0 = j * gw,
      r1 = r0 + gw;
    for (let x = 0; x < w; x++) {
      const gx = (x + fx0) / C,
        i = Math.floor(gx),
        u = gx - i;
      const n = (g[r0 + i] * (1 - u) + g[r0 + i + 1] * u) * (1 - v) + (g[r1 + i] * (1 - u) + g[r1 + i + 1] * u) * v;
      if (n < thr) continue;
      if (n < thr + 0.035 && (x + y) & 1) continue; // a soft edge, in dither
      if (!strong && (x ^ y) & 1) continue;
      const c = px[y * w + x];
      px[y * w + x] = (0xff000000 | (DARK_B[(c >>> 16) & 255] << 16) | (DARK[(c >>> 8) & 255] << 8) | DARK[c & 255]) >>> 0;
    }
  }
  return g;
}

/**
 * Banks of fog over a frame: a slow bent fractal noise, read on a coarse grid and smoothed between, says where the fog
 * is thick and where thin; thick fog is laid over the land in its colour, middling fog in an even ordered dither, and
 * thin fog as a faint veil, so the land shows through it evenly. Moving x and y drifts the banks.
 * @param {Uint32Array} px the frame's pixels, changed in place
 * @param {number} w its width
 * @param {number} h its height
 * @param {{x: number, y: number, density: number, colour?: number, seed?: number, scratch?: Float32Array}} o x, y: the
 *   frame's corner over the fog (the view plus the drift); density 0..1; colour: a packed colour (a pale grey);
 *   seed: the fog's own (77); scratch: the grid kept from the last frame
 * @returns {Float32Array} the grid, to pass back as scratch
 * @see value-noise-wikipedia
 * @see fbm-wikipedia
 * @see bilinear-interpolation-wikipedia
 * @see ordered-dithering-wikipedia
 */
export function fogBanks(px, w, h, o) {
  const c = o.colour === undefined ? 0xfff4f0ea : o.colour,
    seed = o.seed === undefined ? 77 : o.seed,
    density = o.density;
  const { g, gw, fx0, fy0 } = coarse(w, h, o.x, o.y, o.scratch, (wx, wy) =>
    fractalNoise(wx / 70 + 0.5 * Math.sin(wy / 37 + 0.4), wy / 46 + 0.5 * Math.sin(wx / 43 + 2.1), seed, 3),
  );
  for (let y = 0; y < h; y++) {
    const gy = (y + fy0) / C,
      j = Math.floor(gy),
      v = gy - j,
      r0 = j * gw,
      r1 = r0 + gw;
    for (let x = 0; x < w; x++) {
      const gx = (x + fx0) / C,
        i = Math.floor(gx),
        u = gx - i;
      const n = (g[r0 + i] * (1 - u) + g[r0 + i + 1] * u) * (1 - v) + (g[r1 + i] * (1 - u) + g[r1 + i + 1] * u) * v;
      const a = density * 1.15 - 0.42 + (n - 0.5) * 1.5;
      if (a <= 0) continue;
      const k = y * w + x;
      if (a >= 1) px[k] = mixPacked(px[k], c, 0.86);
      else if (BAY[((y & 3) << 2) | (x & 3)] < a * 16) px[k] = mixPacked(px[k], c, 0.74);
      else if (a > 0.3) px[k] = mixPacked(px[k], c, 0.22);
    }
  }
  return g;
}

/**
 * How strong a passing front of rain or snow is at a moment of it: nothing at first, building over its first seconds
 * (4 to 14), full through its middle, and easing off over its last 9 seconds.
 * @param {number} t seconds since the front came
 * @param {number} dur how long it lasts, in seconds
 * @returns {number} 0..1
 * @see smoothstep-wikipedia
 */
export const frontStrength = (t, dur) => smoothstep(4, 14, t) * (1 - smoothstep(dur - 9, dur, t));

/**
 * Lightning: the whole frame lit for an instant, twice, the way a flash flickers. Given how long the flash has left
 * (it starts at 0.34 s), the frame is lit full, then not, then full again, then faintly as it fades; each channel is
 * drawn toward white (red by 60%, green 62%, blue 70%: a cold light).
 * @param {Uint32Array} px the frame's pixels, changed in place
 * @param {number} left seconds of the flash left (0.34 when it strikes)
 * @returns {number} how lit the frame was, 0..1
 */
export function lightningFlash(px, left) {
  const k = left > 0.26 || (left > 0.1 && left < 0.18) ? 1 : left > 0.18 ? 0 : 0.35;
  if (k > 0)
    for (let i = 0; i < px.length; i++) {
      const c = px[i],
        r = c & 255,
        g = (c >>> 8) & 255,
        b = (c >>> 16) & 255;
      px[i] = (0xff000000 | ((b + (255 - b) * 0.7 * k) << 16) | ((g + (255 - g) * 0.62 * k) << 8) | (r + (255 - r) * 0.6 * k)) >>> 0;
    }
  return k;
}
