// Light: the day turning (the sky's colours, how much light there is, where the sun and moon are), a colour as that
// light shows it at a distance, and stars that twinkle.
import { clamp, lerp } from './numbers.js';
import { hexToRgb, mixColour } from './colour.js';

const TAU = Math.PI * 2;

// the day's keys: t (0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk) and which of the sky's colours holds there
const KEYS = [
  [0, 'night'],
  [0.21, 'night'],
  [0.27, 'dawn'],
  [0.36, 'day'],
  [0.64, 'day'],
  [0.73, 'dusk'],
  [0.79, 'night'],
  [1, 'night'],
];

/**
 * The day at a moment: the sky's colours (top and horizon), blended between the four given for night, dawn, day and
 * dusk; how much light there is (full from about 7:40 to 16:20, none from about 18:50 to 5:10, rising and falling
 * between); and where the sun and the moon are.
 * @param {{night: string[], dawn?: string[], day: string[], dusk?: string[]}} sky each a [top, horizon] pair of
 *   "#rrggbb" colours; a missing time uses day's
 * @param {number} t the time of day: 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk (any number; it wraps)
 * @returns {{t: number, top: number[], horizon: number[], light: number, night: number, sun: {x: number, y: number},
 *   moon: {x: number, y: number}}} the sun and moon: x from 0 (rising) to 2 (setting), y their height (below 0: set)
 * @example dayCycle({ night: ['#0a1030', '#203060'], day: ['#4080d0', '#a0d0f0'] }, 0.5).light // 1
 * @see keyframe-wikipedia
 */
export function dayCycle(sky, t) {
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const [ta, ka] = KEYS[i],
    [tb, kb] = KEYS[i + 1],
    u = tb > ta ? (t - ta) / (tb - ta) : 0;
  const A = (sky[ka] || sky.day).map(hexToRgb),
    B = (sky[kb] || sky.day).map(hexToRgb);
  const light = clamp(Math.sin((t - 0.25) * Math.PI * 2) * 1.6 + 0.35, 0, 1); // a sine of the day, lifted and stretched
  return {
    t,
    top: mixColour(A[0], B[0], u),
    horizon: mixColour(A[1], B[1], u),
    light,
    night: 1 - light,
    sun: { x: (t - 0.25) * 2, y: Math.sin((t - 0.25) * Math.PI * 2) },
    moon: { x: ((t + 0.25) % 1) * 2, y: Math.sin((t + 0.25) * Math.PI * 2) },
  };
}

/**
 * A colour as the day shows it at a distance: after dark, dimmed and cooled toward the night sky; far off, faded
 * toward the horizon's colour (aerial perspective), the more the further and the hazier.
 * @param {number[]} c [r, g, b]
 * @param {{top: number[], horizon: number[], night: number}} day from dayCycle
 * @param {number} [depth] 0 at the horizon, 1 near (1)
 * @param {number} [haze] how much distance fades (0.6)
 * @returns {number[]} [r, g, b]
 * @see aerial-perspective-wikipedia
 */
export function aerialPerspective(c, day, depth = 1, haze = 0.6) {
  let o = mixColour(
    c,
    mixColour(c, day.top, 0.55).map((v) => v * 0.45),
    day.night * 0.85,
  );
  o = mixColour(o, day.horizon, clamp((1 - depth) * haze, 0, 0.92));
  return o;
}

/**
 * How bright a twinkling star is at a moment: a slow swell and fade, each star at its own phase.
 * @param {number} t the time, in seconds
 * @param {number} phase the star's own (an angle)
 * @param {number} [depth] how deep the twinkle goes (0.4: between 0.2 and 1 of full brightness)
 * @returns {number} the share of full brightness
 * @see scintillation-wikipedia
 */
export const twinkle = (t, phase, depth = 0.4) => 1 - depth + depth * Math.sin(t * 2 + phase);

/**
 * The hour's light for a picture of the land, as three numbers and a key: how much it is night, how much it is the
 * low light of dusk or dawn, and whether that is the morning. tod is the time of day, 0..1, with noon at 0.25 and
 * midnight at 0.75. The key rounds them (and the shade and the wet) to the steps a colour table is made for, so a
 * table need only be made again when the key changes; the plain day needs none.
 * @param {number} tod the time of day, 0..1 (0.25 noon, 0.75 midnight)
 * @param {number} [dim] how shaded the land is (1 open; a wood's shade below)
 * @param {number} [wet] how wet the air is, 0..1 (rain)
 * @returns {{night: number, dusk: number, morning: boolean, key: string, plain: boolean}}
 * @see color-grading-wikipedia
 */
export function hourLight(tod, dim = 1, wet = 0) {
  const day = Math.cos((tod - 0.25) * TAU),
    night = clamp((-day - 0.15) * 1.6),
    dusk = clamp(1 - Math.abs(day) * 3.2) * (1 - night * 0.5),
    morning = tod < 0.25 || tod > 0.9;
  const key = [Math.round(night * 24), Math.round(dusk * 24), morning ? 1 : 0, Math.round(dim * 40), Math.round(wet * 10)].join(',');
  return { night, dusk, morning, key, plain: key === '0,0,0,40,0' || key === '0,0,1,40,0' };
}

/**
 * The hour as three colour tables, one a channel (a value 0..255 in, its graded value out): night sinks to a deep blue;
 * evening warms the lights only a little and lifts the shadows into violet (a plain multiply would turn snow to peach);
 * dawn the same, cooler and paler; shade darkens and wet air greys a little.
 * @param {number} night how much it is night, 0..1 (hourLight)
 * @param {number} dusk how much it is the low light, 0..1 (hourLight)
 * @param {boolean} morning dawn rather than dusk
 * @param {number} [dim] how shaded the land is (1 open)
 * @param {number} [wet] how wet the air is, 0..1
 * @returns {Uint8Array[]} [red, green, blue] tables of 256
 * @see color-grading-wikipedia
 * @see lookup-table-wikipedia
 */
export function hourTables(night, dusk, morning, dim = 1, wet = 0) {
  const k = dusk * (morning ? 0.7 : 1),
    wr = morning ? 0.02 : 0.03,
    wg = morning ? 0.05 : 0.08,
    wb = morning ? 0.04 : 0.17,
    sr = morning ? 6 : 12,
    sb = morning ? 20 : 28;
  const r = lerp(1, 0.34, night) * (1 + wr * k) * dim * lerp(1, 0.86, wet),
    g = lerp(1, 0.43, night) * (1 - wg * k) * dim * lerp(1, 0.9, wet),
    b = lerp(1, 0.72, night) * (1 - wb * k) * Math.min(1, dim + 0.06) * lerp(1, 0.96, wet);
  const lift = night * 10,
    T = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let v = 0; v < 256; v++) {
    const sh = ((255 - v) / 255) * k;
    T[0][v] = Math.min(255, v * r + lift * 0.3 + sh * sr);
    T[1][v] = Math.min(255, v * g + lift * 0.5);
    T[2][v] = Math.min(255, v * b + lift + sh * sb);
  }
  return T;
}

/**
 * A frame graded by the hour's tables (hourTables), with lamps holding off the dark: each light reaches round itself
 * (squashed to an ellipse, as the ground is seen from above), strongest at its middle and falling off with the square
 * of the distance; where a light reaches, the graded colour is drawn back toward the ungraded one in steps of a sixth,
 * dithered at their edges, and never more than 85% of the way. By day (or with no lights) every pixel is graded alike.
 * @param {Uint32Array} px the frame's pixels, changed in place
 * @param {number} w its width
 * @param {number} h its height
 * @param {Uint8Array[]} T the tables (hourTables)
 * @param {{night: number, lights?: {x: number, y: number, r: number, k: number}[], scratch?: Float32Array}} o night:
 *   0..1 (lamps count from 0.15); lights in the frame's pixels; scratch: the buffer kept from the last frame
 * @returns {Float32Array|undefined} the buffer of how much each pixel is held back, to pass back as scratch
 * @see color-grading-wikipedia
 * @see lookup-table-wikipedia
 * @see ordered-dithering-wikipedia
 */
export function gradeFrame(px, w, h, T, o) {
  const [LR, LG, LB] = T,
    lights = o.lights || [];
  if (!lights.length || o.night < 0.15) {
    for (let i = 0; i < px.length; i++) {
      const c = px[i];
      px[i] = (0xff000000 | (LB[(c >>> 16) & 255] << 16) | (LG[(c >>> 8) & 255] << 8) | LR[c & 255]) >>> 0;
    }
    return o.scratch;
  }
  // where the dark is held off: each light laid into a buffer over its own reach only (many small lights cost little)
  const K = o.scratch && o.scratch.length === px.length ? o.scratch : new Float32Array(px.length);
  K.fill(0);
  for (const L of lights) {
    const xa = Math.max(0, Math.floor(L.x - L.r)),
      xb = Math.min(w - 1, Math.ceil(L.x + L.r)),
      ya = Math.max(0, Math.floor(L.y - L.r / 1.5)),
      yb = Math.min(h - 1, Math.ceil(L.y + L.r / 1.5));
    for (let y = ya; y <= yb; y++)
      for (let x = xa, i = y * w + xa; x <= xb; x++, i++) {
        const dx = x - L.x,
          dy = (y - L.y) * 1.5,
          d = Math.sqrt(dx * dx + dy * dy) / L.r;
        if (d < 1) {
          const v = (1 - d) * (1 - d) * L.k;
          if (v > K[i]) K[i] = v;
        }
      }
  }
  for (let y = 0, i = 0; y < h; y++)
    for (let x = 0; x < w; x++, i++) {
      const c = px[i];
      let keep = K[i];
      if (keep > 0.02) {
        keep = Math.min(0.85, Math.floor(keep * 6 + ((x * 3 + y * 5) & 3) / 4) / 6); // light in steps, dithered at the edges
        const r = c & 255,
          g = (c >>> 8) & 255,
          b = (c >>> 16) & 255;
        px[i] = (0xff000000 | ((LB[b] + (b - LB[b]) * keep) << 16) | ((LG[g] + (g - LG[g]) * keep) << 8) | (LR[r] + (r - LR[r]) * keep)) >>> 0;
      } else px[i] = (0xff000000 | (LB[(c >>> 16) & 255] << 16) | (LG[(c >>> 8) & 255] << 8) | LR[c & 255]) >>> 0;
    }
  return K;
}
