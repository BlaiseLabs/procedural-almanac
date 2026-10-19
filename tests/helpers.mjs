// What the checks share: small comparisons, and independent transcriptions of published code to check against.
import assert from 'node:assert/strict';
export { assert };

export const PI = Math.PI;
export const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
export const bits = (n) =>
  n
    .toString(2)
    .split('')
    .filter((c) => c === '1').length;
export const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

// ---- independent transcriptions of the published C, in exact 32-bit arithmetic (BigInt), to check against
const M = 0xffffffffn;
export function jenkinsC(n) {
  let a = BigInt(n >>> 0);
  a = (a + 0x7ed55d16n + (a << 12n)) & M;
  a = (a ^ 0xc761c23cn ^ (a >> 19n)) & M;
  a = (a + 0x165667b1n + (a << 5n)) & M;
  a = ((a + 0xd3a2646cn) ^ (a << 9n)) & M;
  a = (a + 0xfd7046c5n + (a << 3n)) & M;
  a = (a ^ 0xb55a4f09n ^ (a >> 16n)) & M;
  return Number(a);
}
export function mulberry32C(state) {
  let x = BigInt(state >>> 0);
  return () => {
    x = (x + 0x6d2b79f5n) & M;
    let z = x;
    z = ((z ^ (z >> 15n)) * (z | 1n)) & M;
    z = (z ^ (z + (((z ^ (z >> 7n)) * (z | 61n)) & M))) & M;
    return Number((z ^ (z >> 14n)) & M) / 4294967296;
  };
}

// ---- a real canvas for the drawing checks (@napi-rs/canvas, a dev dependency only), and ways to read its pixels
import { createCanvas } from '@napi-rs/canvas';
import { setCanvasMaker } from '../src/canvas.js';
setCanvasMaker((w, h) => createCanvas(w, h));
export const canvas = (w, h, fill) => {
  const c = createCanvas(w, h),
    g = c.getContext('2d');
  if (fill) {
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
  }
  return g;
};
export const pixel = (g, x, y) => [...g.getImageData(x, y, 1, 1).data];
// the box round every pixel that passes a test: [x0, y0, x1, y1] (inclusive), or null
export function bbox(g, w, h, test) {
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (test(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}
export const pixels = (g, w, h) => Buffer.from(g.getImageData(0, 0, w, h).data).toString('base64');
