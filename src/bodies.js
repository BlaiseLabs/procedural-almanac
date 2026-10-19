// Bodies: a creature drawn from a few numbers, moved and finished by rules. A spine of points that follows its head,
// feet that stay planted and step when the body has left them, springs that make it bob, the way a body rides on
// water and where the water's surface cuts it, the finishing passes a small sprite of it gets (specks tidied, scales,
// a shine, fur, a lit rim), and the helpers its genome is made and blended with (a smooth curve along its length,
// spots, a pattern, a coat, a list resampled, two records mixed).
import { clamp, lerp, angleDiff } from './numbers.js';
import { hueShiftTone, packedHsl } from './pixels.js';

/**
 * Where a point of a chain goes when the point before it has moved: straight back toward where it was, at its set
 * distance, but turned no more than a set angle from the way the chain runs there. Applied down a chain from its head,
 * this is a spine that follows the head and bends no more than a spine bends.
 * @param {number} lx the point before it (already moved)
 * @param {number} ly
 * @param {number} px the point, where it was
 * @param {number} py
 * @param {number} length its distance from the point before it
 * @param {number} back the way the chain runs at the point before it, pointing back (radians)
 * @param {number} maxBend how far it may turn from that (radians)
 * @returns {number[]} [x, y], its new place
 * @example followJoint(0, 0, -3, 1, 2, Math.PI, 0.5) // a point 2 behind (0, 0), turned at most 0.5 from straight back
 * @see procedural-animation-wikipedia
 */
export function followJoint(lx, ly, px, py, length, back, maxBend) {
  let ang = Math.atan2(py - ly, px - lx);
  ang = back + clamp(angleDiff(back, ang), -maxBend, maxBend);
  return [lx + Math.cos(ang) * length, ly + Math.sin(ang) * length];
}

/**
 * One step of a damped spring: pulled toward its rest by its stiffness, slowed by its damping, the speed updated first
 * and the place from the new speed (semi-implicit Euler, which keeps a spring from gaining energy step by step).
 * @param {number} x where it is
 * @param {number} v how fast it moves
 * @param {number} target where it rests
 * @param {number} stiffness how hard it is pulled back
 * @param {number} damping how much its speed is slowed
 * @param {number} dt seconds
 * @returns {number[]} [x, v], a moment later
 * @example dampedSpring(1, 0, 0, 90, 11, 1 / 60) // moving back toward 0
 * @see harmonic-oscillator-wikipedia
 * @see semi-implicit-euler-wikipedia
 */
export function dampedSpring(x, v, target, stiffness, damping, dt) {
  v += (-stiffness * (x - target) - damping * v) * dt;
  x += v * dt;
  return [x, v];
}

/**
 * Where a foot is during its step: from where it lifted to where it lands, eased so it leaves and lands gently, and
 * raised in an arc that is highest half way.
 * @param {number} sx where it lifted
 * @param {number} sy
 * @param {number} tx where it lands
 * @param {number} ty
 * @param {number} t how far through the step (0..1)
 * @param {number} lift how high it rises
 * @returns {number[]} [x, y, z]
 * @example footSwing(0, 0, 4, 0, 0.5, 2) // [2, 0, 2]
 * @see gait-wikipedia
 * @see smoothstep-wikipedia
 */
export function footSwing(sx, sy, tx, ty, t, lift) {
  const e = t * t * (3 - 2 * t);
  return [lerp(sx, tx, e), lerp(sy, ty, e), lift * Math.sin(Math.PI * t)];
}

/**
 * Whether a planted foot steps now: when the body has left it half a stride behind (or, standing nearly still, a
 * little way, if no foot is stepping), and only while the other group of feet is down, unless it has been left almost
 * a whole stride behind. Feet in two groups (the diagonal pairs) so take turns.
 * @param {number} d how far the foot is from where it would rest now
 * @param {number} stride the stride
 * @param {number} speed how fast the body moves
 * @param {number} unit the body's scale (the small distance a still body fidgets a foot over)
 * @param {number[]} stepping how many feet of each group are stepping: [group 0, group 1]
 * @param {number} group this foot's group (0 or 1)
 * @returns {boolean}
 * @example footReady(3, 4, 10, 1, [0, 0], 0) // true: left more than half a stride behind
 * @see gait-wikipedia
 */
export function footReady(d, stride, speed, unit, stepping, group) {
  const far = d > stride * 0.5 || (speed < 1.5 && d > 1.2 * unit && !stepping[0] && !stepping[1]);
  return far && (!stepping[1 - group] || d > stride * 0.95);
}

/**
 * How high a part of a floating body rides: its head held up out of the water, the parts at the neck a little under,
 * the middle low in it and the tail swept just under the surface (a bird sits on it, high), with a slow swell running
 * down its length.
 * @param {number} i the part (0 is the head)
 * @param {number} partR the part's radius
 * @param {number} headR the head's radius
 * @param {number} neck the last part of the neck
 * @param {number} tailAt the first part of the tail
 * @param {boolean} bird whether it sits on the water (a duck) rather than in it
 * @param {number} t seconds (the swell)
 * @param {number} unit the body's scale
 * @returns {number} its height over the surface (below it, negative)
 * @example floatHeight(0, 2, 2, 1, 5, false, 0, 1) // 1.6: the head held up
 * @see buoyancy-wikipedia
 */
export function floatHeight(i, partR, headR, neck, tailAt, bird, t, unit) {
  const z =
    i === 0
      ? headR * (bird ? 1.4 : 0.8)
      : partR * (i <= neck ? (bird ? 0.55 : -0.1) : i >= tailAt ? (bird ? 0.3 : -0.95) : bird ? 0.25 : -0.72);
  return z + Math.sin(t * 2.4 - i * 0.55) * 0.3 * Math.min(1, unit);
}

/**
 * Half the width of the cut a level surface makes through a round part whose middle is a height above it: the half
 * chord of its circle at that distance from the centre, or nothing if the surface misses it.
 * @param {number} r the part's radius
 * @param {number} e how high its middle stands over the surface
 * @returns {number}
 * @example waterlineCut(5, 3) // 4
 * @see chord-geometry-wikipedia
 */
export const waterlineCut = (r, e) => (Math.abs(e) < r ? Math.sqrt(r * r - e * e) : 0);

/**
 * How far a pixel of a round part is under the water, seen from above and in front: the surface cuts the part along
 * the front of its ring (lower in the middle of the cut, rising to the cut's ends), so a body swimming toward or away
 * from the eye is in the water all along it, not cut by one straight line.
 * @param {number} x the pixel (its corner; its middle is half a pixel on)
 * @param {number} y
 * @param {number} cx the part's middle, across
 * @param {number} wl the surface's row under the part's middle
 * @param {number} cut the cut's half width (waterlineCut)
 * @returns {number} how far under the surface (0 or less: above it)
 * @example depthUnderCut(10, 12, 10.5, 10, 4) // 0.5
 * @see chord-geometry-wikipedia
 */
export function depthUnderCut(x, y, cx, wl, cut) {
  const u = cut > 0 ? (x + 0.5 - cx) / cut : 1;
  return y + 0.5 - (wl + 0.5 * cut * Math.sqrt(Math.max(0, 1 - u * u)));
}

let TIDY = new Uint32Array(512 * 512);
/**
 * A lone pixel whose four neighbours are mostly one other colour takes that colour. Overlapping shapes leave specks of
 * in-between shades, and in pixel art specks read as blur where clean blocks are wanted. Works in place on a buffer of
 * packed colours (0 is empty), reading from a copy so one change does not cascade into the next.
 * @param {Uint32Array} px the buffer
 * @param {number} stride its width
 * @param {number} rows its height
 * @param {number} w the width to tidy, from the left
 * @param {number} h the height to tidy, from the top
 * @see median-filter-wikipedia
 */
export function despeckle(px, stride, rows, w, h) {
  const W = stride,
    p = px;
  w = Math.min(w, W - 1);
  h = Math.min(h, rows - 1);
  if (TIDY.length < w * h) TIDY = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) TIDY.set(p.subarray(y * W, y * W + w), y * w);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const c = TIDY[y * w + x];
      if (!c) continue;
      const a = TIDY[y * w + x - 1],
        b = TIDY[y * w + x + 1],
        u = TIDY[(y - 1) * w + x],
        d = TIDY[(y + 1) * w + x];
      if (!a || !b || !u || !d || c === a || c === b || c === u || c === d) continue;
      const m = a === b || a === u || a === d ? a : b === u || b === d ? b : u === d ? u : 0;
      if (m) p[y * W + x] = m;
    }
}

/**
 * Scales: on every other row, every third pixel of two colours turns to its darker shade, the rows staggered, the
 * pattern anchored to the body (ox, oy) so it does not crawl as the body moves.
 * @param {Uint32Array} px the buffer
 * @param {number} stride its width
 * @param {number} w the width to pattern
 * @param {number} h the height
 * @param {number} ox the body's place, across (the pattern's anchor)
 * @param {number} oy the body's place, down
 * @param {number} a one colour that takes scales
 * @param {number} aLo its darker shade
 * @param {number} b the other
 * @param {number} bLo its darker shade
 * @see hatching-wikipedia
 */
export function staggeredScales(px, stride, w, h, ox, oy, a, aLo, b, bLo) {
  const W = stride,
    p = px;
  for (let v = 0; v < h; v++) {
    const Y = v + oy;
    if (Y & 1) continue;
    for (let u = 0; u < w; u++) {
      const i = v * W + u,
        c = p[i];
      if (c !== a && c !== b) continue;
      if ((u + ox + ((Y >> 1) & 1) * 2 + 300) % 3 === 0) p[i] = c === a ? aLo : bLo;
    }
  }
}

/**
 * A shine along the top edge of the left part of a sprite (a little under half its width): where the top pixel of a
 * column has a pixel under it, it turns a lighter shade, as a shell catches light from the upper left.
 * @param {Uint32Array} px the buffer
 * @param {number} stride its width
 * @param {number} w the sprite's width
 * @param {number} h its height
 * @see cel-shading-wikipedia
 * @see slynyrd-pixelblog-1
 */
export function topEdgeShine(px, stride, w, h) {
  const W = stride,
    p = px;
  let x0 = w,
    x1 = -1;
  for (let u = 0; u < w; u++)
    for (let v = 0; v < h; v++)
      if (p[v * W + u]) {
        x0 = Math.min(x0, u);
        x1 = Math.max(x1, u);
        break;
      }
  const reach = x0 + Math.max(2, Math.round((x1 - x0) * 0.45));
  for (let u = x0 + 1; u <= reach; u++)
    for (let v = 1; v < h; v++) {
      const i = v * W + u;
      if (p[i]) {
        if (!p[i - W] && p[i + W]) p[i] = hueShiftTone(p[i], 1.6);
        break;
      }
    }
}

/**
 * Fur along a sprite's back: in every third column (anchored to the body), where the outline is the top pixel, the
 * outline lifts a pixel, so the back's edge is tufted rather than smooth; not on the face.
 * @param {Uint32Array} px the buffer
 * @param {number} stride its width
 * @param {number} w the sprite's width
 * @param {number} h its height
 * @param {number} ox the body's place, across (the tufts' anchor)
 * @param {number} line the outline's colour
 * @param {number} hx the face's column
 * @param {number} hr the face's radius (no tufts within about 1.5 of it)
 * @see hatching-wikipedia
 */
export function furTufts(px, stride, w, h, ox, line, hx, hr) {
  const W = stride,
    p = px;
  for (let u = 1; u < w - 1; u++) {
    if ((u + ox) % 3) continue;
    if ((u - hx) * (u - hx) < hr * hr * 2.2) continue;
    for (let v = 1; v < h - 1; v++) {
      const i = v * W + u;
      if (!p[i]) continue;
      if (p[i] === line && p[i + W] && p[i + W] !== line && !p[i - W]) {
        p[i - W] = line;
        p[i] = p[i + W];
      }
      break;
    }
  }
}

/**
 * The detail a sprite drawn finer can hold, at levels 2 to 4: a lit rim along its top and a shaded rim along its
 * underside (two pixels deep from level 3), fur strokes down and back and a highlight in every scale (level 3), and,
 * at level 4, all of it denser and speckles. Anchored to the body (ox, oy). Level 1 leaves it as it is.
 * @param {Uint32Array} px the buffer
 * @param {number} stride its width
 * @param {number} w the sprite's width
 * @param {number} h its height
 * @param {number} ox the body's place, across
 * @param {number} oy the body's place, down
 * @param {number} fine the level, 1..4
 * @param {{fur?: boolean, scaly?: boolean, speckle: number}} o fur strokes, scale highlights, and the speckles' colour
 * @see cel-shading-wikipedia
 * @see hatching-wikipedia
 */
export function rimDetail(px, stride, w, h, ox, oy, fine, o) {
  if (fine < 2) return;
  const W = stride,
    p = px,
    src = p.slice(0, Math.min(p.length, (h + 1) * W));
  const body = (u, v) => u >= 0 && v >= 0 && u < w && v < h && src[v * W + u];
  const rim = fine >= 3 ? 2 : 1;
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) {
      const i = v * W + u,
        c = src[i];
      if (!c) continue;
      let k = 0;
      for (let d = 1; d <= rim; d++)
        if (!body(u, v - d)) {
          k = 1.1;
          break;
        }
      if (!k)
        for (let d = 1; d <= rim + 1; d++)
          if (!body(u, v + d)) {
            k = -0.75;
            break;
          }
      const U = u + ox,
        V = v + oy;
      if (!k && fine >= 3 && o.fur) {
        const gx = fine >= 4 ? 3 : 4,
          gy = fine >= 4 ? 2 : 3;
        if (((U % gx) + gx) % gx === 0 && ((V % gy) + gy) % gy === 0) {
          k = -0.9;
          if (body(u - 1, v + 1)) p[(v + 1) * W + u - 1] = hueShiftTone(src[(v + 1) * W + u - 1], -0.9);
        }
      }
      if (!k && fine >= 3 && o.scaly && V & 1 && (U + ((V >> 1) & 1) * 2 + 301) % 3 === 0) k = 0.7;
      if (!k && fine >= 4 && (((U * 7 + V * 13) % 23) + 23) % 23 === 0) {
        p[i] = o.speckle;
        continue;
      }
      if (k) p[i] = hueShiftTone(c, k);
    }
}

/**
 * A value along a body, given at a few places: n values from head to tail, each eased between the two given places it
 * falls between (an S-curve, so the body's outline has no kinks).
 * @param {number} n how many values
 * @param {number[][]} pts [[where 0..1, value], ...], in order
 * @returns {number[]}
 * @example smoothCurve(3, [[0, 1], [1, 3]]) // [1, 2, 3]
 * @see smoothstep-wikipedia
 */
export function smoothCurve(n, pts) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    let k = 0;
    while (k < pts.length - 2 && u > pts[k + 1][0]) k++;
    const [ua, va] = pts[k],
      [ub, vb] = pts[k + 1],
      t = clamp((u - ua) / (ub - ua || 1));
    out[i] = va + (vb - va) * (t * t * (3 - 2 * t));
  }
  return out;
}

/**
 * Spots along a body: each on a part from one to another, off its middle a little, of a size, in the main colour or
 * the second.
 * @param {{int: function, range: function, chance: function}} random a seeded generator (SeededRandom)
 * @param {number} from the first part a spot may be on
 * @param {number} to the last
 * @param {number} count how many
 * @returns {{at: number, dx: number, dy: number, r: number, c: number}[]}
 */
export function bodySpots(random, from, to, count) {
  const out = [];
  for (let k = 0; k < count; k++)
    out.push({
      at: random.int(from, to),
      dx: random.range(-0.55, 0.45),
      dy: random.range(-0.5, 0.2),
      r: random.range(0.5, 0.9),
      c: random.chance(0.3) ? 1 : 0,
    });
  return out;
}

/**
 * A body's pattern, picked from the kinds allowed: none, bands (every second or third part, from a phase), a saddle
 * over the middle of the back, a tail tip, or the back only.
 * @param {{int: function, pick: function}} random a seeded generator (SeededRandom)
 * @param {number} n how many parts the body has
 * @param {string[]} [kinds] the kinds it may be
 * @returns {{kind: string, k?: number, ph?: number, a?: number, b?: number}}
 */
export function bodyPattern(random, n, kinds = ['none', 'bands', 'saddle', 'tip', 'back']) {
  const kind = random.pick(kinds);
  return kind === 'bands'
    ? { kind, k: random.int(2, 3), ph: random.int(0, 2) }
    : kind === 'saddle'
      ? { kind, a: 2, b: Math.max(3, Math.floor(n * 0.45)) }
      : kind === 'tip'
        ? { kind, k: random.int(2, 4) }
        : { kind };
}

/**
 * A coat's three colours: the back near a hue (a land's, if it gives one), a belly paler and less saturated, and an
 * accent turned round the colour wheel from the back, as packed colours.
 * @param {{range: function, pick: function}} random a seeded generator (SeededRandom)
 * @param {{hue?: number[]}} [o] hue: [the hue, how far from it] to stay near
 * @param {{hue?: number[], spread?: number, s?: number[], l?: number[], accent?: number}} [d] the kind's own: its hue,
 *   spread, saturation and lightness ranges, and its accent's turn
 * @returns {{back: number, belly: number, accent: number}}
 * @see hsl-hsv-wikipedia
 * @see tints-and-shades-wikipedia
 */
export function coatColours(random, o = {}, d = {}) {
  const [h0, hs] = o.hue || d.hue || [random.range(0, 360), 0];
  const h = h0 + random.range(-1, 1) * (hs || d.spread || 25);
  const s = random.range(...(d.s || [0.35, 0.6])),
    l = random.range(...(d.l || [0.42, 0.6]));
  const back = packedHsl(h, s, l);
  const accent = packedHsl(
    h + (d.accent !== undefined ? d.accent : random.pick([150, 180, 30, -30, 60, -60, 120])) + random.range(-15, 15),
    clamp(s + random.range(0, 0.25), 0, 0.85),
    clamp(l + random.range(-0.05, 0.18), 0.3, 0.75),
  );
  const belly = packedHsl(h + random.range(10, 35), s * 0.45, clamp(l + 0.26, 0.6, 0.9));
  return { back, belly, accent };
}

/**
 * A list of numbers stretched or squeezed to another length, each new value read between the two old ones it falls
 * between: what lets two bodies of different lengths be mixed part for part.
 * @param {number[]} a the list
 * @param {number} n the length wanted
 * @returns {number[]}
 * @example resampleList([0, 10], 3) // [0, 5, 10]
 * @see lerp-wikipedia
 */
export function resampleList(a, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i / Math.max(1, n - 1)) * (a.length - 1),
      k = Math.min(a.length - 2, Math.floor(u));
    out.push(a.length === 1 ? a[0] : lerp(a[k], a[k + 1], u - k));
  }
  return out;
}

const GROWS = /len|^h$|span|fan|^r$|rx|ry/;
/**
 * Two records mixed at t: numbers between, anything else one side's or the other's (the nearer), records within
 * records the same way. A record only one side has fades in or out: its sizes (the keys that name a length) shrink
 * toward nothing on the way out, and below a twelfth of its size it is gone.
 * @param {object} [a]
 * @param {object} [b]
 * @param {number} t 0 is a, 1 is b
 * @param {RegExp} [grows] which keys are sizes
 * @returns {object|undefined}
 * @example blendRecords({ len: 4, kind: 'leg' }, { len: 8, kind: 'fin' }, 0.25) // { len: 5, kind: 'leg' }
 * @see lerp-wikipedia
 */
export function blendRecords(a, b, t, grows = GROWS) {
  if (!a && !b) return undefined;
  if (!a || !b) {
    const src = a || b,
      k = a ? 1 - t : t,
      out = {};
    for (const key in src) out[key] = typeof src[key] === 'number' && grows.test(key) ? src[key] * k : src[key];
    return k < 0.08 ? undefined : out;
  }
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
    out[key] =
      a[key] === undefined
        ? b[key]
        : b[key] === undefined
          ? a[key]
          : typeof a[key] === 'object' && a[key] && !Array.isArray(a[key])
            ? blendRecords(a[key], b[key], t, grows)
            : typeof a[key] === 'number' && typeof b[key] === 'number'
              ? lerp(a[key], b[key], t)
              : t < 0.5
                ? a[key]
                : b[key];
  return out;
}
