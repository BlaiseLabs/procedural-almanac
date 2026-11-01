// Raster: drawing in whole pixels into a buffer { w, h, px } (px a Uint32Array of packed colours, 0 for nothing), with
// no canvas and no anti-aliasing: rows of an ellipse, a capsule as a run of discs, a line cell by cell, a polygon row by
// row, a dithered and a shaded ellipse, sprites stamped (flipped, or each row shifted), a line drawn round what is
// drawn, a sprite cut out, the bounds of what is drawn. Every edge is a pixel edge.
import { bayerThreshold } from './pixels.js';

// a row of a buffer filled from xa to xb, clipped to the buffer
function fillRow(r, y, xa, xb, c) {
  if (y < 0 || y >= r.h) return;
  if (xa < 0) xa = 0;
  if (xb >= r.w) xb = r.w - 1;
  if (xb >= xa) r.px.fill(c, y * r.w + xa, y * r.w + xb + 1);
}

/**
 * The rows a filled ellipse covers, each given as a run of whole pixels: for every row from the top of the ellipse to
 * its bottom, the half-width at that row from the ellipse's equation, rounded inward. An ellipse under half a pixel
 * across is the one pixel at its middle.
 * @param {number} cx middle x
 * @param {number} cy middle y
 * @param {number} rx half-width
 * @param {number} ry half-height
 * @param {function(number, number, number): void} row row(y, xa, xb) for each run (xa..xb inclusive)
 * @see ellipse-wikipedia
 * @see scanline-rendering-wikipedia
 */
export function ellipseRows(cx, cy, rx, ry, row) {
  if (rx < 0.5 || ry < 0.5) {
    const x = Math.round(cx);
    row(Math.round(cy), x, x);
    return;
  }
  const ya = Math.ceil(cy - ry),
    yb = Math.floor(cy + ry);
  for (let y = ya; y <= yb; y++) {
    const t = (y - cy) / ry,
      dx = rx * Math.sqrt(Math.max(0, 1 - t * t));
    row(y, Math.ceil(cx - dx), Math.floor(cx + dx));
  }
}

/**
 * A filled ellipse in one colour, clipped to the buffer.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {number} c a packed colour
 * @see ellipse-wikipedia
 * @see scanline-rendering-wikipedia
 */
export function fillEllipse(r, cx, cy, rx, ry, c) {
  ellipseRows(cx, cy, rx, ry, (y, xa, xb) => fillRow(r, y, xa, xb, c));
}

/**
 * A capsule (a stadium: a line with a thickness at each end, the thickness changing evenly between them) as discs set
 * along the line, about one and a half to a pixel of its length, so the discs leave no gap.
 * @param {number} xa one end
 * @param {number} ya
 * @param {number} ra its radius
 * @param {number} xb the other end
 * @param {number} yb
 * @param {number} rb its radius
 * @param {function(number, number, number): void} disc disc(x, y, radius) for each
 * @see stadium-wikipedia
 */
export function capsuleSteps(xa, ya, ra, xb, yb, rb, disc) {
  const d = Math.hypot(xb - xa, yb - ya),
    n = Math.max(1, Math.ceil(d * 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disc(xa + (xb - xa) * t, ya + (yb - ya) * t, ra + (rb - ra) * t);
  }
}

/**
 * The cells of a line between two points rounded to whole pixels, one step at a time with an error kept in whole
 * numbers (Bresenham's algorithm), in every direction; at most 4096 cells.
 * @param {number} xa
 * @param {number} ya
 * @param {number} xb
 * @param {number} yb
 * @param {function(number, number): void} plot plot(x, y) for each cell, from (xa, ya) to (xb, yb)
 * @see bresenham-wikipedia
 */
export function lineCells(xa, ya, xb, yb, plot) {
  xa = Math.round(xa);
  ya = Math.round(ya);
  xb = Math.round(xb);
  yb = Math.round(yb);
  const dx = Math.abs(xb - xa),
    dy = -Math.abs(yb - ya),
    sx = xa < xb ? 1 : -1,
    sy = ya < yb ? 1 : -1;
  for (let e = dx + dy, n = 0; n < 4096; n++) {
    plot(xa, ya);
    if (xa === xb && ya === yb) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      xa += sx;
    }
    if (e2 <= dx) {
      e += dx;
      ya += sy;
    }
  }
}

/**
 * The rows a filled polygon covers: on each whole-pixel row, where its edges cross the row, sorted, taken in pairs (the
 * even-odd rule), each pair a run rounded inward. Rows outside 0..h-1 are left out.
 * @param {number[][]} pts its corners, [[x, y], ...], any simple polygon
 * @param {number} h the buffer's height
 * @param {function(number, number, number): void} row row(y, xa, xb) for each run
 * @see scanline-rendering-wikipedia
 * @see even-odd-rule-wikipedia
 */
export function polygonRows(pts, h, row) {
  let ya = 1e9,
    yb = -1e9;
  for (const p of pts) {
    if (p[1] < ya) ya = p[1];
    if (p[1] > yb) yb = p[1];
  }
  for (let y = Math.max(0, Math.ceil(ya)); y <= Math.min(h - 1, Math.floor(yb)); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) row(y, Math.ceil(xs[i]), Math.floor(xs[i + 1]));
  }
}

const BAY = Array.from({ length: 16 }, (_, i) => bayerThreshold(i & 3, i >> 2) * 16 - 0.5); // (the 4 x 4 matrix's 0..15)

/**
 * A see-through ellipse without mixing colours: a share alpha of its pixels set, chosen by the 4 x 4 ordered-dither
 * pattern, the rest left as they are.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {number} c a packed colour
 * @param {number} alpha the share set, 0..1
 * @see ordered-dithering-wikipedia
 * @see ellipse-wikipedia
 */
export function ditherEllipse(r, cx, cy, rx, ry, c, alpha) {
  const ya = Math.max(0, Math.ceil(cy - ry)),
    yb = Math.min(r.h - 1, Math.floor(cy + ry)),
    th = alpha * 16;
  for (let y = ya; y <= yb; y++) {
    const t = (y - cy) / ry,
      dx = rx * Math.sqrt(Math.max(0, 1 - t * t));
    for (let x = Math.max(0, Math.ceil(cx - dx)); x <= Math.min(r.w - 1, Math.floor(cx + dx)); x++)
      if (BAY[((y & 3) << 2) | (x & 3)] < th) r.px[y * r.w + x] = c;
  }
}

/**
 * A shadow: the pixels under an ellipse made darker by k and a little bluer (blue kept a little more, red a little
 * less), a multiply that keeps the edge a pixel edge.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {number} [k] how much is kept, 0..1
 * @see blend-modes-wikipedia
 * @see ellipse-wikipedia
 */
export function shadeEllipse(r, cx, cy, rx, ry, k = 0.72) {
  const ya = Math.max(0, Math.ceil(cy - ry)),
    yb = Math.min(r.h - 1, Math.floor(cy + ry));
  for (let y = ya; y <= yb; y++) {
    const t = (y - cy) / ry,
      dx = rx * Math.sqrt(Math.max(0, 1 - t * t));
    for (let x = Math.max(0, Math.ceil(cx - dx)); x <= Math.min(r.w - 1, Math.floor(cx + dx)); x++) {
      const i = y * r.w + x,
        c = r.px[i];
      r.px[i] =
        ((255 << 24) |
          (Math.min(255, ((c >>> 16) & 255) * (k + 0.06)) << 16) |
          ((((c >>> 8) & 255) * k) << 8) |
          ((c & 255) * (k - 0.02))) >>>
        0;
    }
  }
}

/**
 * A sprite stamped into a buffer: its anchor (ax, ay) on (x, y), mirrored left to right if asked, its empty pixels
 * (0) see-through, clipped to the buffer.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {{w: number, h: number, px: Uint32Array, ax: number, ay: number}} s the sprite
 * @param {number} x
 * @param {number} y
 * @param {boolean} [flip] mirrored
 * @see bit-blit-wikipedia
 * @see sprite-wikipedia
 */
export function blitSprite(r, s, x, y, flip = false) {
  const ox = Math.round(x) - (flip ? s.w - 1 - s.ax : s.ax),
    oy = Math.round(y) - s.ay,
    W = r.w,
    H = r.h;
  const ya = Math.max(0, -oy),
    yb = Math.min(s.h, H - oy),
    xa = Math.max(0, -ox),
    xb = Math.min(s.w, W - ox);
  for (let sy = ya; sy < yb; sy++) {
    const row = sy * s.w,
      drow = (oy + sy) * W + ox;
    if (flip) {
      for (let sx = xa; sx < xb; sx++) {
        const c = s.px[row + s.w - 1 - sx];
        if (c) r.px[drow + sx] = c;
      }
    } else
      for (let sx = xa; sx < xb; sx++) {
        const c = s.px[row + sx];
        if (c) r.px[drow + sx] = c;
      }
  }
}

/**
 * A sprite stamped with each row shifted sideways by sway(height above its anchor), rounded: a shear that bends it
 * (a tree leaning in the wind) without drawing it again.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {{w: number, h: number, px: Uint32Array, ax: number, ay: number}} s the sprite
 * @param {number} x
 * @param {number} y
 * @param {function(number): number} sway the shift at a height above the anchor, in pixels
 * @see shear-mapping-wikipedia
 * @see bit-blit-wikipedia
 */
export function blitSway(r, s, x, y, sway) {
  const ox = Math.round(x) - s.ax,
    oy = Math.round(y) - s.ay,
    W = r.w,
    H = r.h;
  for (let sy = Math.max(0, -oy); sy < Math.min(s.h, H - oy); sy++) {
    const dx = ox + Math.round(sway(s.ay - sy)),
      row = sy * s.w,
      drow = (oy + sy) * W;
    for (let sx = Math.max(0, -dx); sx < Math.min(s.w, W - dx); sx++) {
      const c = s.px[row + sx];
      if (c) r.px[drow + dx + sx] = c;
    }
  }
}

/**
 * A line drawn round everything drawn in a buffer: every empty pixel that touches a drawn one on a side becomes the
 * line's colour (the drawn shape grown by one pixel, less itself), found first and set after, within a box a pixel
 * wider than the one given and a pixel in from the buffer's edge. Small gaps between parts become lines too.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {number} c the line's packed colour
 * @param {number} [xa] the box drawn in (the whole buffer if not given)
 * @param {number} [ya]
 * @param {number} [xb]
 * @param {number} [yb]
 * @see dilation-morphology-wikipedia
 * @see pixel-art-wikipedia
 */
export function outlinePass(r, c, xa = 0, ya = 0, xb = r.w - 1, yb = r.h - 1) {
  const W = r.w,
    p = r.px,
    hit = [];
  xa = Math.max(1, xa - 1);
  ya = Math.max(1, ya - 1);
  xb = Math.min(W - 2, xb + 1);
  yb = Math.min(r.h - 2, yb + 1);
  for (let y = ya; y <= yb; y++)
    for (let x = xa, i = y * W + xa; x <= xb; x++, i++) {
      if (!p[i] && (p[i - 1] || p[i + 1] || p[i - W] || p[i + W])) hit.push(i);
    }
  for (const i of hit) p[i] = c;
}

/**
 * A sprite cut out of a buffer: the box xa..xb, ya..yb (clipped to the buffer) copied, its anchor the point (ax, ay)
 * of the buffer.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {number} xa
 * @param {number} ya
 * @param {number} xb
 * @param {number} yb
 * @param {number} ax
 * @param {number} ay
 * @returns {{w: number, h: number, px: Uint32Array, ax: number, ay: number}}
 * @see sprite-wikipedia
 */
export function cutSprite(r, xa, ya, xb, yb, ax, ay) {
  xa = Math.max(0, xa);
  ya = Math.max(0, ya);
  xb = Math.min(r.w - 1, xb);
  yb = Math.min(r.h - 1, yb);
  const w = xb - xa + 1,
    h = yb - ya + 1,
    px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) px.set(r.px.subarray((ya + y) * r.w + xa, (ya + y) * r.w + xa + w), y * w);
  return { w, h, px, ax: ax - xa, ay: ay - ya };
}

/**
 * The box round everything drawn in a buffer (its non-empty pixels), or null if nothing is.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @returns {number[]|null} [xa, ya, xb, yb]
 * @see minimum-bounding-box-wikipedia
 */
export function drawnBounds(r) {
  let xa = r.w,
    ya = r.h,
    xb = -1,
    yb = -1;
  for (let y = 0; y < r.h; y++)
    for (let x = 0, i = y * r.w; x < r.w; x++, i++)
      if (r.px[i]) {
        if (x < xa) xa = x;
        if (x > xb) xb = x;
        if (y < ya) ya = y;
        if (y > yb) yb = y;
      }
  return xb < 0 ? null : [xa, ya, xb, yb];
}
