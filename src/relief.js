// Relief for pixel art seen with depth: terraces from a height field, the pattern of the walls between them and of
// leaves, the shape of a sprite's crown and trunk, a normal map made from a sprite's silhouette (a crown lit as a
// ball, a lump as a dome, a trunk round), and a crown made of clumps placed through the sprite's own shape.

/**
 * How many terraces stand at a point: its height above the water's cut in steps, from none to the most there are.
 * @param {number} above the land's height above its water's cut (in the field's units)
 * @param {number} step how much higher for one terrace more
 * @param {number} levels the most terraces
 * @returns {number} 0..levels - 1
 * @see heightmap-wikipedia
 * @see quantization-wikipedia
 */
export const terraceLevel = (above, step, levels) => Math.max(0, Math.min(levels - 1, Math.floor(above / step)));

// a hash of two integers into 0..1, three decimals
const grain = (x, y) => ((Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0) % 1000) / 1000;

/**
 * A wall's lightness at a texel of a 16-pixel tile, by its stuff: the top row lit (the edge the light catches), then
 * stone in courses of blocks with mortar, earth in bands with grit, snow lying in drifts, sand with grains.
 * @param {'stone'|'earth'|'snow'|'sand'} kind
 * @param {number} x 0..15
 * @param {number} y 0..15
 * @returns {number} lightness, about 0.5..1.1 (clamp to 1 for a texture)
 * @see masonry-wikipedia
 */
export function wallShade(kind, x, y) {
  if (y === 0) return 1.0;
  if (kind === 'stone') {
    const course = Math.floor((y - 1) / 5),
      off = course & 1 ? 4 : 0,
      mortar = (y - 1) % 5 === 4 || (x + off) % 8 === 7;
    return mortar ? 0.55 : 0.84 + (grain(Math.floor((x + off) / 8), course) - 0.5) * 0.12 - ((y - 1) % 5) * 0.015;
  }
  if (kind === 'earth') return (Math.floor((y - 1) / 3) & 1 ? 0.8 : 0.72) - (grain(x, y) < 0.12 ? 0.12 : 0) + (y === 1 ? 0.1 : 0);
  if (kind === 'snow') return y < 3 ? 0.98 : 0.86 - (grain(x >> 1, y >> 2) < 0.3 ? 0.05 : 0);
  return 0.9 - (grain(x, y) < 0.18 ? 0.12 : 0) - (y > 10 ? 0.05 : 0);
}

/**
 * Leaves' lightness at a texel: light ones in small heaps, a few dark gaps between, the rest a little uneven.
 * @param {number} x
 * @param {number} y
 * @returns {number} lightness, 0.7..1.12
 * @see normal-mapping-wikipedia
 */
export function leafShade(x, y) {
  const heap = grain(x >> 1, y >> 1);
  return heap > 0.72 ? 1.12 : heap < 0.16 ? 0.7 : 0.94 + (grain(x, y) - 0.5) * 0.08;
}

// a sprite's opaque span on a row: [first, last] x, or [-1, -1]
function spanOf(s, y) {
  let a = -1,
    b = -1;
  for (let x = 0; x < s.w; x++)
    if (y >= 0 && y < s.h && s.px[y * s.w + x] >>> 24 > 0) {
      if (a < 0) a = x;
      b = x;
    }
  return [a, b];
}

/**
 * A tree sprite's crown: its rows above the trunk (the trunk being the narrow part, under five pixels wide, going up
 * from the foot), each row's opaque span.
 * @param {{w: number, h: number, px: Uint32Array, ay: number}} s a sprite (pixels as 32-bit colours, alpha highest)
 * @returns {{top: number, trunkTop: number, rows: {y: number, a: number, b: number}[]}}
 * @see sprite-wikipedia
 */
export function crownRows(s) {
  const H = s.h;
  let top = 0;
  while (top < H && spanOf(s, top)[0] < 0) top++;
  let trunkTop = Math.min(H - 1, s.ay);
  while (trunkTop > top && spanOf(s, trunkTop)[0] >= 0 && spanOf(s, trunkTop)[1] - spanOf(s, trunkTop)[0] < 5) trunkTop--;
  const rows = [];
  for (let y = top; y <= trunkTop; y++) {
    const [a, b] = spanOf(s, y);
    if (a >= 0) rows.push({ y, a, b });
  }
  return { top, trunkTop, rows };
}

/**
 * A normal map made from a sprite's own silhouette: a crown as a ball lit from the upper left and dark beneath, its
 * clumps raised where the sprite drew light and sunk where dark; a trunk round across its width; a lump as a dome on
 * the ground; anything else as a card turned a little up. Encoded as RGBA bytes, its rows running down (green is
 * down).
 * @param {{w: number, h: number, px: Uint32Array, ay: number}} s a sprite
 * @param {'crown'|'lump'|'card'} kind
 * @returns {Uint8Array} w * h * 4
 * @see normal-mapping-wikipedia
 */
export function silhouetteNormals(s, kind) {
  const W = s.w,
    H = s.h,
    px = s.px,
    out = new Uint8Array(W * H * 4),
    on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[y * W + x] >>> 24 > 0,
    lum = (x, y) => {
      if (!on(x, y)) return 0;
      const c = px[y * W + x];
      return ((c & 255) * 0.3 + ((c >>> 8) & 255) * 0.55 + ((c >>> 16) & 255) * 0.15) / 255;
    };
  const span = (y) => spanOf(s, y);
  // the crown's rows and the trunk's: going up from the foot, the trunk is the narrow part
  let top = 0;
  while (top < H && span(top)[0] < 0) top++;
  let trunkTop = Math.min(H - 1, s.ay);
  if (kind === 'crown') while (trunkTop > top && span(trunkTop)[0] >= 0 && span(trunkTop)[1] - span(trunkTop)[0] < 5) trunkTop--;
  else trunkTop = Math.min(H - 1, s.ay);
  let x0 = W,
    x1 = -1;
  for (let y = top; y <= trunkTop; y++) {
    const [a, b] = span(y);
    if (a >= 0) {
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, b);
    }
  }
  const cx = (x0 + x1 + 1) / 2,
    rx = Math.max(1, (x1 - x0 + 1) / 2),
    cy = kind === 'lump' ? trunkTop + 1 : (top + trunkTop + 1) / 2,
    ry = Math.max(1, kind === 'lump' ? trunkTop + 1 - top : (trunkTop + 1 - top) / 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let nx = 0,
        ny = 0.3,
        nz = 1;
      if (on(x, y) && kind !== 'card') {
        if (y > trunkTop && kind === 'crown') {
          // the trunk: round across its width
          const [a, b] = span(y),
            u = b > a ? (x + 0.5 - (a + b + 1) / 2) / ((b - a + 1) / 2) : 0;
          nx = u * 0.9;
          ny = 0.1;
          nz = Math.sqrt(Math.max(0.1, 1 - u * u));
        } else {
          const u = (x + 0.5 - cx) / rx,
            v = (cy - (y + 0.5)) / ry,
            d = 1 - u * u * 0.85 - v * v * 0.85;
          nx = u * 0.85;
          ny = v * 0.85 + 0.12;
          nz = Math.sqrt(Math.max(0.12, d));
          // the clumps the sprite drew: light is raised, dark is sunk
          const k = 1.6;
          nx -= (lum(x + 1, y) - lum(x - 1, y)) * k;
          ny += (lum(x, y - 1) - lum(x, y + 1)) * k;
        }
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      out[i] = Math.round((nx / l) * 127.5 + 127.5);
      out[i + 1] = Math.round((-ny / l) * 127.5 + 127.5); // (rows run down: green is down)
      out[i + 2] = Math.round((nz / l) * 127.5 + 127.5);
      out[i + 3] = 255;
    }
  return out;
}

/**
 * A tree's crown as clumps: small balls of leaves placed through the crown's own shape (each sprite row's span turned
 * round the trunk and flattened front to back, so a broadleaf comes out a ball and a conifer a cone), each coloured
 * from the sprite's pixel it covers seen through an oblique view (in linear light), plus a dark heart so a gap shows
 * deep leaves; the same every time for a sprite.
 * @param {{w: number, h: number, px: Uint32Array, ax: number, ay: number}} s a sprite
 * @param {{trunkTop: number, rows: {y: number, a: number, b: number}[]}} crown crownRows(s)
 * @param {number} m the view's shear (obliqueShear's m)
 * @returns {{x: number, y: number, z: number, r: number, col: number[]}[]} from the sprite's foot: x across, y up,
 *   z back
 * @see fractal-canopy-wikipedia
 */
export function crownClumps(s, crown, m) {
  const C = crown,
    W = s.w,
    out = [];
  if (!C.rows.length) return out;
  let seed = (s.w * 73856093) ^ (s.h * 19349663) ^ s.px[(s.h >> 1) * s.w + (s.w >> 1)];
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const area = C.rows.reduce((t, r) => t + r.b - r.a + 1, 0),
    n = Math.max(8, Math.min(34, Math.round(area / 11))),
    maxHw = Math.max(...C.rows.map((r) => (r.b - r.a + 1) / 2)),
    size = Math.max(2.2, Math.min(4.6, maxHw * 0.42));
  const colourAt = (x, y, z) => {
    // the sprite's pixel where this point falls on the screen (rows top first), or the nearest crown pixel
    let c0 = Math.round(s.ax + x + m * z),
      r0 = Math.round(s.ay - (y - z));
    for (let k = 0; k < 4; k++) {
      for (const [dx, dy] of [
        [0, 0],
        [k, 0],
        [-k, 0],
        [0, k],
        [0, -k],
      ]) {
        const c = c0 + dx,
          r = r0 + dy;
        if (c >= 0 && r >= 0 && c < W && r <= C.trunkTop && r < s.h) {
          const v = s.px[r * W + c];
          if (v >>> 24) return v;
        }
      }
    }
    const mid = C.rows[C.rows.length >> 1];
    return s.px[mid.y * W + ((mid.a + mid.b) >> 1)];
  };
  const lin = (v) => Math.pow(v / 255, 2.2);
  for (let i = 0; i < n; i++) {
    // a row (wider rows more often), a way round, a way out (most near the skin)
    let u = rnd() * area,
      row = C.rows[C.rows.length - 1];
    for (const r of C.rows) {
      u -= r.b - r.a + 1;
      if (u <= 0) {
        row = r;
        break;
      }
    }
    const hw = (row.b - row.a + 1) / 2,
      cx = (row.a + row.b + 1) / 2 - s.ax,
      th = rnd() * Math.PI * 2,
      rho = Math.max(0, hw - size * 0.8) * (0.55 + 0.45 * Math.sqrt(rnd())),
      x = cx + Math.cos(th) * rho,
      z = Math.sin(th) * rho * 0.5,
      y = (s.ay + 1 - row.y) * 0.9 - size * 0.2 + z * 0.5; // (a near clump lower, a far one higher: so the crown, seen from here, keeps the sprite's height)
    const c = colourAt(x, y, z);
    out.push({ x, y, z, r: size * (0.75 + 0.45 * rnd()), col: [lin(c & 255), lin((c >>> 8) & 255), lin((c >>> 16) & 255)] });
  }
  // the dark heart, so a gap shows deep leaves and never the ground behind
  const mid = C.rows[C.rows.length >> 1],
    hc = s.ay + 1 - mid.y,
    cc = s.px[mid.y * W + ((mid.a + mid.b) >> 1)];
  out.push({
    x: (mid.a + mid.b + 1) / 2 - s.ax,
    y: hc,
    z: 0,
    r: Math.max(2, maxHw * 0.6),
    col: [0, 8, 16].map((sh) => lin(((cc >>> sh) & 255) * 0.62)),
  });
  return out;
}
