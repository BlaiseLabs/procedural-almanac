// Colour: colours as [red, green, blue] lists of 0..255 (fractions allowed while working), read from and written to
// "#rrggbb", mixed, lightened and darkened, weighed for brightness, and moved round the colour wheel.
import { clamp } from './numbers.js';

/**
 * A "#rrggbb" (or "#rgb") colour as [r, g, b]; anything missing reads as middle grey.
 * @param {string} hex
 * @returns {number[]} [r, g, b], each 0..255
 * @example hexToRgb('#ff8000') // [255, 128, 0]
 * @see web-colors-wikipedia
 */
export const hexToRgb = (hex) => {
  const s = String(hex || '#808080').replace('#', ''),
    n = parseInt(
      s.length === 3
        ? s
            .split('')
            .map((c) => c + c)
            .join('')
        : s,
      16,
    );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * [r, g, b] as "#rrggbb", each channel rounded and kept in 0..255.
 * @param {number[]} c
 * @returns {string}
 * @example rgbToHex([255, 127.6, -3]) // "#ff8000"
 * @see web-colors-wikipedia
 */
export const rgbToHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/**
 * [r, g, b] (and an opacity) as a CSS colour for a canvas: "rgba(r,g,b,a)", channels cut to whole numbers.
 * @param {number[]} c
 * @param {number} [alpha] 0..1 (1)
 * @returns {string}
 * @example rgba([255, 128.9, 0], 0.5) // "rgba(255,128,0,0.5)"
 * @see web-colors-wikipedia
 */
export const rgba = (c, alpha = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

/**
 * Part of the way from one colour to another, channel by channel.
 * @param {number[]} a
 * @param {number[]} b
 * @param {number} t 0: a; 1: b
 * @returns {number[]}
 * @see lerp-wikipedia
 */
export const mixColour = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * A colour darkened toward black (k below 0) or lightened toward white (k above 0), by that share of the way.
 * @param {number[]} c
 * @param {number} k -1..1
 * @returns {number[]}
 * @example shade([200, 100, 50], -0.5) // [100, 50, 25]
 * @see tints-and-shades-wikipedia
 */
export const shade = (c, k) => (k < 0 ? mixColour(c, [0, 0, 0], -k) : mixColour(c, [255, 255, 255], k));

/**
 * How bright a colour looks, 0..1: green counts most and blue least, as the eye weighs them (the luma of the
 * television standard BT.601: 0.299 red, 0.587 green, 0.114 blue).
 * @param {number[]} c
 * @returns {number} 0..1
 * @see luma-wikipedia
 * @see bt601-itu
 */
export const luma = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

/**
 * [r, g, b] as [hue in degrees 0..360, saturation 0..1, lightness 0..1]: the colour wheel's terms, in which "more
 * orange" or "paler" is one number.
 * @param {number[]} c
 * @returns {number[]} [h, s, l]
 * @see hsl-hsv-wikipedia
 * @see smith-1978
 */
export function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)),
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/**
 * [hue, saturation, lightness] back to [r, g, b] (0..255, fractions kept).
 * @param {number[]} hsl
 * @returns {number[]}
 * @see hsl-hsv-wikipedia
 * @see smith-1978
 */
export function hslToRgb([h, s, l]) {
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
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * A hue moved part of the way toward another, the short way round the wheel. A hue more than 100 degrees away moves
 * only a quarter as far: half way round would pass through a third colour (orange pulled toward blue goes by
 * magenta), so a far hue only leans.
 * @param {number} h degrees
 * @param {number} to degrees
 * @param {number} t 0..1
 * @returns {number} degrees, 0..360
 * @example hueToward(30, 60, 0.5) // 45
 */
export const hueToward = (h, to, t) => {
  const d = ((to - h + 540) % 360) - 180,
    far = Math.abs(d) > 100 ? 0.25 : 1;
  return (h + d * t * far + 360) % 360;
};

/**
 * A colour graded, as a film is graded: first, if given, the colours in a range of hues (the greens of leaves and
 * grass, say) moved toward a hue of their own; then every colour moved toward the grade's hue, its saturation scaled,
 * its lightness raised and its contrast stretched round the middle, and warmed (toward amber) or cooled (toward blue).
 * @param {string} hex "#rrggbb"
 * @param {{hue?: number, hueMix?: number, sat?: number, light?: number, contrast?: number, warm?: number, fade?: number}} grade
 *   fade: the saturation of every colour scaled after the hue range, before the rest (a winter's paling)
 * @param {{hues: number[], hue: number, mix: number, sat: number, light: number}} [range] the colours whose hue is in
 *   hues [from, to] (and that are coloured: saturation over 0.12, lightness between 0.08 and 0.88), and what to do to
 *   them
 * @returns {string} "#rrggbb"
 * @example gradeColour('#4a8a3a', { warm: 0.3 }) // warmer
 * @see color-grading-wikipedia
 */
export function gradeColour(hex, grade = {}, range = null) {
  let [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (range && h >= range.hues[0] && h <= range.hues[1] && s > 0.12 && l > 0.08 && l < 0.88) {
    h = hueToward(h, range.hue, range.mix);
    s = clamp(s * range.sat, 0, 1);
    l = clamp(l + range.light, 0, 1);
  }
  if (grade.fade !== undefined) s *= grade.fade;
  if (grade.hue !== undefined && grade.hueMix) h = hueToward(h, grade.hue, grade.hueMix);
  s = clamp(s * (grade.sat === undefined ? 1 : grade.sat), 0, 1);
  l = clamp(
    0.5 + (clamp(l + (grade.light || 0), 0, 1) - 0.5) * (grade.contrast === undefined ? 1 : grade.contrast),
    0,
    1,
  );
  let c = hslToRgb([h, s, l]);
  if (grade.warm) c = [c[0] + 46 * grade.warm, c[1] + 12 * grade.warm, c[2] - 46 * grade.warm];
  return rgbToHex(c);
}
