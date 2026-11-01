// Pixels: drawing in whole pixels into a buffer of 32-bit numbers (the way an ImageData's bytes read as one Uint32Array
// on a little-endian machine: 0xAABBGGRR), with no canvas and no anti-aliasing; colours mixed and shaded as a pixel
// artist does; ordered dithering, where a share of one thing is set among another in a fixed pattern of pixels.

/**
 * A colour as one number, the way an ImageData keeps a pixel when its bytes are read as a Uint32Array (on every
 * little-endian machine, which is nearly every machine): red in the lowest byte, then green, blue and an opaque alpha.
 * Parts outside 0..255 or with a fraction are cut to their whole low byte, as the bytes would be.
 * @param {number} r 0..255
 * @param {number} g 0..255
 * @param {number} b 0..255
 * @returns {number} 0xFFBBGGRR
 * @see imagedata-mdn
 * @see endianness-wikipedia
 */
export const packRgb = (r, g, b) => ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;

const R = (c) => c & 255,
  G = (c) => (c >>> 8) & 255,
  B = (c) => (c >>> 16) & 255;

/**
 * Two packed colours mixed: t of the way from a to b, each of red, green and blue on its own (alpha made opaque).
 * @param {number} a 0xAABBGGRR
 * @param {number} b 0xAABBGGRR
 * @param {number} t 0 (a) .. 1 (b)
 * @returns {number} 0xFFBBGGRR
 * @see lerp-wikipedia
 */
export const mixPacked = (a, b, t) =>
  packRgb(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);

/**
 * A packed colour from hue, saturation and lightness.
 * @param {number} h hue in degrees (any: it is taken round 360)
 * @param {number} s saturation 0..1
 * @param {number} l lightness 0..1
 * @returns {number} 0xFFBBGGRR
 * @see hsl-hsv-wikipedia
 */
export function packedHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return packRgb((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * A packed colour's hue, saturation and lightness.
 * @param {number} c 0xAABBGGRR
 * @returns {number[]} [hue in degrees (-60..300), saturation 0..1, lightness 0..1]
 * @see hsl-hsv-wikipedia
 */
export function packedToHsl(c) {
  const r = R(c) / 255,
    g = G(c) / 255,
    b = B(c) / 255,
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, Math.min(1, s), l];
}

/**
 * A pixel artist's shade of a colour: darker turns its hue toward blue-violet and makes it richer, lighter turns it
 * toward warm yellow and paler, about one step of a ramp per unit of k (and pale colours turn less). Shadows that only
 * darken look dead; ones that shift hue look lit.
 * @param {number} c 0xAABBGGRR
 * @param {number} k below 0 darker, above 0 lighter (steps)
 * @returns {number} 0xFFBBGGRR
 * @see slynyrd-pixelblog-1
 */
export function hueShiftTone(c, k) {
  const [h, s, l] = packedToHsl(c),
    to = k < 0 ? 250 : 52,
    d = ((to - h + 540) % 360) - 180,
    pale = l > 0.72 ? 0.45 : 1;
  return packedHsl(
    h + d * Math.min(0.32, Math.abs(k) * 0.075) * pale,
    Math.max(0, Math.min(1, s * (k < 0 ? 1 + 0.07 * -k * pale : 1 - 0.14 * k))),
    Math.max(
      0.02,
      Math.min(0.97, l * (k < 0 ? Math.pow(0.8, -k) : 1) + (k > 0 ? (1 - l) * (1 - Math.pow(0.72, k)) : 0)),
    ),
  );
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * The ordered-dithering threshold at a pixel: the 4 x 4 Bayer matrix, repeated across the picture, as a number in
 * 0..1. Where a share t of something is to show among something else, put it where t is above this: the pixels it
 * takes are spread as evenly as 16 can be, never in clumps, and the pattern holds still as the picture moves.
 * @param {number} x a whole pixel
 * @param {number} y a whole pixel
 * @returns {number} (n + 0.5) / 16 for the matrix's n, 0..15
 * @see ordered-dithering-wikipedia
 */
export const bayerThreshold = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/**
 * Whether a pixel near the border of two regions belongs to the other one: the share of the other there (0 at the
 * border's far side, rising toward it) set against the Bayer pattern, with a little noise so the dither does not read
 * as a screen. The border is a band of mixed pixels that thins out, not a line.
 * @param {number} f the share of the other region at this pixel (0..0.5 or more)
 * @param {number} x a whole pixel
 * @param {number} y a whole pixel
 * @param {number} n a random number for the pixel (0..1)
 * @returns {boolean} true: the pixel is the other region's
 * @see ordered-dithering-wikipedia
 */
export const ditheredBorder = (f, x, y, n) => f > 0 && f > bayerThreshold(x, y) * 0.5 + 0.25 * (n - 0.5);

/**
 * A packed colour with each of red, green and blue multiplied by k and held at 255 (darker below 1, brighter above),
 * alpha made opaque: a multiply by a grey.
 * @param {number} c 0xAABBGGRR
 * @param {number} k the factor
 * @returns {number} 0xFFBBGGRR
 * @see blend-modes-wikipedia
 */
export const scalePacked = (c, k) => packRgb(Math.min(255, R(c) * k), Math.min(255, G(c) * k), Math.min(255, B(c) * k));
