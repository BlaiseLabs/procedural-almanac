// Sprites: small pictures made of pixels in code. Written as rows of letters, one letter a pixel, read through a palette;
// put together from templates laid one over another on a grid of letters; outlined; packed into a sheet; and the parts
// of plants drawn into a buffer: a crown of leaves shaded clump by clump, a trunk.
import { fillEllipse } from './raster.js';

/**
 * A sprite's pixels with a line round them: every empty pixel touching a drawn one on a side, the picture's own edge
 * included, set to the line's colour (the drawn shape grown by one pixel, less itself). The pixels given are left as
 * they are.
 * @param {Uint32Array} px the sprite's pixels, 0 for none
 * @param {number} w its width
 * @param {number} h its height
 * @param {number} ink the line's packed colour
 * @returns {Uint32Array} a new array
 * @see dilation-morphology-wikipedia
 * @see pixel-art-wikipedia
 */
export function outlineSprite(px, w, h, ink) {
  const out = px.slice();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (px[y * w + x]) continue;
      if (
        (x > 0 && px[y * w + x - 1]) ||
        (x < w - 1 && px[y * w + x + 1]) ||
        (y > 0 && px[(y - 1) * w + x]) ||
        (y < h - 1 && px[(y + 1) * w + x])
      )
        out[y * w + x] = ink;
    }
  return out;
}

/**
 * A sprite written as rows of letters, one letter a pixel, read through a palette ('.' and ' ' are empty), with a
 * pixel of room round it for the line drawn round it (unless o.outline is false), anchored at the middle of its foot
 * unless given.
 * @param {string[]} rows the picture, top row first
 * @param {function(string): number} colourOf a letter's packed colour
 * @param {{outline?: boolean, ink?: number, ax?: number, ay?: number}} [o] ink: the line's colour; ax, ay: the anchor
 *   in the rows' own pixels
 * @returns {{w: number, h: number, px: Uint32Array, ax: number, ay: number}}
 * @see indexed-color-wikipedia
 * @see sprite-wikipedia
 */
export function spriteFromRows(rows, colourOf, o = {}) {
  const iw = Math.max(...rows.map((r) => r.length)),
    ih = rows.length,
    w = iw + 2,
    h = ih + 2;
  let px = new Uint32Array(w * h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      px[(y + 1) * w + x + 1] = colourOf(ch);
    }
  });
  if (o.outline !== false) px = outlineSprite(px, w, h, o.ink);
  return { w, h, px, ax: o.ax === undefined ? w >> 1 : o.ax + 1, ay: o.ay === undefined ? h - 2 : o.ay + 1 };
}

/**
 * A template laid onto a grid of letters at a row: each letter that is not '.' is written over what is there, the
 * template mirrored left to right if asked, a letter kept back where keep(what is there, the new letter) says so, and
 * nothing written outside the grid. How a picture is built up from parts (a head, then hair, then a hat).
 * @param {string[][]} grid rows of single letters, '.' for empty (changed in place)
 * @param {string[]} rows the template, each row as wide as the grid
 * @param {number} top the grid row the template's first row lands on
 * @param {boolean} [flip] mirrored
 * @param {function(string, string): boolean} [keep] keep(old, new): true to leave the old letter
 * @see sprite-wikipedia
 * @see indexed-color-wikipedia
 */
export function layTemplate(grid, rows, top, flip, keep) {
  const W = grid[0].length,
    H = grid.length;
  rows.forEach((r, y) => {
    for (let x = 0; x < W; x++) {
      const c = r[flip ? W - 1 - x : x];
      if (c !== '.' && c !== undefined && !(keep && keep(grid[top + y]?.[x], c)))
        if (top + y >= 0 && top + y < H) grid[top + y][x] = c;
    }
  });
}

/**
 * Rows of a letter grid filled across between their outermost drawn letters: the two edges in one letter, the near
 * half in another and the far half in a third. What draws a robe over two legs as one piece.
 * @param {string[][]} grid rows of single letters, '.' for empty (changed in place)
 * @param {number} y0 the first row
 * @param {number} y1 the row after the last
 * @param {string} edge the letter at each end
 * @param {string} near the letter from the left end to the middle
 * @param {string} far the letter from past the middle to the right end
 * @see scanline-rendering-wikipedia
 */
export function fillBetweenEdges(grid, y0, y1, edge, near, far) {
  const W = grid[0].length;
  for (let y = y0; y < y1; y++) {
    const xs = [];
    for (let x = 0; x < W; x++) if (grid[y][x] !== '.') xs.push(x);
    if (!xs.length) continue;
    const a = Math.min(...xs),
      b = Math.max(...xs);
    for (let x = a; x <= b; x++) grid[y][x] = x === a || x === b ? edge : x <= (a + b) / 2 ? near : far;
  }
}

/**
 * A grid of letters as pixels, each letter read through a palette of packed colours; '.' and letters the palette does
 * not have are empty (0).
 * @param {string[][]} grid rows of single letters
 * @param {Object<string, number>} palette a letter's packed colour
 * @returns {Uint32Array} the pixels, row by row
 * @see indexed-color-wikipedia
 */
export function gridPixels(grid, palette) {
  const H = grid.length,
    W = grid[0].length,
    out = new Uint32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (c !== '.' && palette[c]) out[y * W + x] = palette[c];
    }
  return out;
}

/**
 * Frames of one size packed into a sheet, so many across a row, row after row.
 * @param {Uint32Array[]} frames each fw x fh pixels
 * @param {number} fw a frame's width
 * @param {number} fh its height
 * @param {number} across frames a row
 * @returns {{w: number, h: number, data: Uint32Array}}
 * @see texture-atlas-wikipedia
 */
export function packSheet(frames, fw, fh, across) {
  const w = fw * across,
    h = fh * Math.ceil(frames.length / across),
    data = new Uint32Array(w * h);
  frames.forEach((px, i) => {
    const ox = (i % across) * fw,
      oy = Math.floor(i / across) * fh;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) data[(oy + y) * w + ox + x] = px[y * fw + x];
  });
  return { w, h, data };
}

/**
 * A crown of leaves drawn into a buffer: a blob of round clumps scattered round the middle (more for a bigger crown,
 * one at the middle too), every pixel inside shaded by the clump nearest it (in clump radii) lit on its own upper left
 * and by the whole crown lit from the upper left, the light in four steps of the leaf's colours, and a few pixels
 * in a fixed pattern given a blossom colour if asked. The light is from the upper left.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {{range: function(number, number): number, next: function(): number}} rng a seeded generator
 * @param {number} cx the crown's middle
 * @param {number} cy
 * @param {number} rx its half-width
 * @param {number} ry its half-height
 * @param {number[]} leaf four packed colours, darkest first
 * @param {{clumps?: number, spread?: number, bloom?: number, bloomEvery?: number, seed?: number}} [o]
 * @returns {number[][]} the clumps, [[x, y, radius], ...]
 * @see voronoi-wikipedia
 * @see cel-shading-wikipedia
 */
export function leafCrown(r, rng, cx, cy, rx, ry, leaf, o = {}) {
  const W = r.w,
    H = r.h,
    clumps = [],
    n = o.clumps || Math.max(4, Math.round((rx * ry) / 7));
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2),
      d = Math.sqrt(rng.next()) * (o.spread || 0.62),
      cr = rng.range(0.34, 0.52) * Math.min(rx, ry) + 0.8;
    clumps.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, cr]);
  }
  clumps.push([cx, cy, Math.min(rx, ry) * 0.6]);
  const mark = 0xff000001,
    x0 = Math.floor(cx - rx - 4),
    x1 = Math.ceil(cx + rx + 4),
    y0 = Math.floor(cy - ry - 4),
    y1 = Math.ceil(cy + ry + 4),
    inside = [];
  for (const c of clumps) fillEllipse(r, c[0], c[1], c[2], c[2], mark);
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) if (r.px[y * W + x] === mark) inside.push(x, y);
  for (let i = 0; i < inside.length; i += 2) {
    const x = inside[i],
      y = inside[i + 1];
    let best = 1e9,
      bj = 0;
    for (let j = 0; j < clumps.length; j++) {
      const c = clumps[j],
        d = Math.hypot(x - c[0], y - c[1]) / c[2];
      if (d < best) {
        best = d;
        bj = j;
      }
    }
    const c = clumps[bj],
      whole = (-(x - cx) / rx) * 0.55 - ((y - cy) / ry) * 0.85;
    const local = 1 - Math.hypot(x - (c[0] - c[2] * 0.32), y - (c[1] - c[2] * 0.42)) / (c[2] * 1.05);
    const t = whole * 0.55 + (local - 0.42) * 1.25 + ((x * 7 + y * 13) % 5 === 0 ? 0.1 : 0);
    r.px[y * W + x] = t > 0.72 ? leaf[3] : t > 0.18 ? leaf[2] : t > -0.42 ? leaf[1] : leaf[0];
  }
  if (o.bloom)
    for (let i = 0; i < inside.length; i += 2) {
      const x = inside[i],
        y = inside[i + 1];
      if ((x * 31 + y * 17 + (o.seed || 0)) % (o.bloomEvery || 9) === 0 && r.px[y * W + x] !== leaf[0]) r.px[y * W + x] = o.bloom;
    }
  return clumps;
}

/**
 * A trunk drawn into a buffer: a column from its top down to its foot, leaning at the top and upright at the foot,
 * one pixel wider near the foot, its left column the bark's light colour and the rest the dark.
 * @param {{w: number, h: number, px: Uint32Array}} r the buffer
 * @param {number} x its middle at the foot
 * @param {number} yTop
 * @param {number} yBase
 * @param {number} w its width
 * @param {number[]} bark [dark, light] packed colours
 * @param {number} [lean] how far its top leans, in pixels
 * @see pixel-art-wikipedia
 */
export function barkTrunk(r, x, yTop, yBase, w, bark, lean = 0) {
  for (let y = Math.round(yTop); y <= yBase; y++) {
    const u = (y - yTop) / Math.max(1, yBase - yTop),
      xx = Math.round(x + lean * (1 - u)),
      ww = w + (u > 0.8 ? 1 : 0);
    for (let k = 0; k < ww; k++) {
      const px = (xx - Math.floor(ww / 2) + k) | 0,
        py = y | 0;
      if (px >= 0 && py >= 0 && px < r.w && py < r.h) r.px[py * r.w + px] = k === 0 && ww > 1 ? bark[1] : bark[0];
    }
  }
}
