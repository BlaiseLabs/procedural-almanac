// Parts: a figure drawn as a list of simple parts (ellipses, tapered limbs, polygons, strokes, eyes), each soft-shaded
// in three tones and the whole outlined once, the way a hand-drawn sprite is. Parts are plain records in figure space
// (x forward, y up from the ground), with a z (far parts first) and a tone (a name the caller's colours know).
import { rgba, mixColour, shade } from './colour.js';

const TAU = Math.PI * 2;
const COOL = [46, 42, 92],
  WARM = [255, 236, 190];

/**
 * A colour's tones for soft shading: dark (its shadow, leaning toward blue-violet), base, light (its lit side, leaning
 * toward warm cream) and line (a deep outline colour).
 * @param {number[]} c [r, g, b]
 * @returns {{dark: number[], base: number[], light: number[], line: number[]}}
 * @see color-temperature-wikipedia
 */
export function tones(c) {
  return {
    dark: mixColour(shade(c, -0.32), COOL, 0.14),
    base: c,
    light: mixColour(shade(c, 0.2), WARM, 0.14),
    line: mixColour(shade(c, -0.68), [24, 14, 34], 0.35),
  };
}

/**
 * A figure part's outline as path commands (data, the canvas's own: moveTo, lineTo, arc, ellipse, closePath): an
 * ellipse, a tapered limb, a polygon, or a body (its ellipses together), grown by a number of pixels if asked. What
 * drawParts fills, what tracePart traces, and what a display list can clip to.
 * @param {{s: 'ell'|'cap'|'poly'|'body'}} part as drawParts takes it
 * @param {number} k pixels per unit
 * @param {number} [grow] pixels to grow it by (shrink, below 0)
 * @returns {Array[]} [[command, ...numbers], ...]
 * @see display-list-wikipedia
 */
export function partOutline(part, k, grow = 0) {
  const p = part;
  if (p.s === 'body')
    return p.ells.flatMap(([x, y, rx, ry, rot]) => {
      const a = Math.max(0.3, rx * k + grow),
        b = Math.max(0.3, ry * k + grow);
      return [
        ['moveTo', x * k + a, -y * k],
        ['ellipse', x * k, -y * k, a, b, -(rot || 0), 0, TAU],
      ];
    });
  if (p.s === 'ell')
    return [
      ['ellipse', p.x * k, -p.y * k, Math.max(0.3, p.rx * k + grow), Math.max(0.3, p.ry * k + grow), -p.rot, 0, TAU],
    ];
  if (p.s === 'cap') {
    // a tapered limb: a circle at each end and the straight sides that join them (a browser throws on a negative radius)
    const x1 = p.x1 * k,
      y1 = -p.y1 * k,
      x2 = p.x2 * k,
      y2 = -p.y2 * k,
      r1 = Math.max(0.3, p.r1 * k + grow),
      r2 = Math.max(0.3, p.r2 * k + grow),
      a = Math.atan2(y2 - y1, x2 - x1);
    return [
      ['arc', x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2],
      ['arc', x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2],
      ['closePath'],
    ];
  }
  if (p.s === 'poly') return [...p.pts.map(([x, y], i) => [i ? 'lineTo' : 'moveTo', x * k, -y * k]), ['closePath']];
  return [];
}
const trace = (g, commands) => {
  for (const [c, ...args] of commands) g[c](...args);
};
const path = (g, p, k, grow = 0) => trace(g, partOutline(p, k, grow));
const body = path;
function stroke(g, p, k, w) {
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  const P = p.pts.map(([x, y]) => [x * k, -y * k]);
  g.moveTo(...P[0]);
  if (p.curve && P.length === 4) g.bezierCurveTo(...P[1], ...P[2], ...P[3]);
  else for (const q of P.slice(1)) g.lineTo(...q);
  g.stroke();
}

/**
 * A figure part's outline, added to the path being built: an ellipse, a tapered limb, a polygon, or a body (its
 * ellipses together), grown by a number of pixels if asked. For drawing over a part (spots, stripes, a belly) clipped
 * to it, as drawParts' markings do.
 * @param {object} g a canvas 2D context
 * @param {{s: 'ell'|'cap'|'poly'|'body'}} part as drawParts takes it
 * @param {number} k pixels per unit
 * @param {number} [grow] pixels to grow it by (shrink, below 0)
 */
export function tracePart(g, part, k, grow = 0) {
  trace(g, partOutline(part, k, grow));
}

/**
 * A figure of parts drawn at the context's origin (its ground point), facing right or left: a soft shadow on the
 * ground, one outline round everything (each part grown by the outline's width, in the line colour), then each part far
 * to near, soft-shaded: its dark tone, its base tone over the side toward the light (the same shape moved up and to the
 * left), a light tone highlight on large parts, then any markings the caller draws, and a soft shine if the part asks.
 * Eyes are dark with a catchlight. In flat art each part is one tone.
 * @param {object} g a canvas 2D context, its origin on the figure's ground point
 * @param {{s: 'ell'|'cap'|'poly'|'line'|'body'|'eye', z: number, tone?: string}[]} parts ell: x, y, rx, ry, rot;
 *   cap (a tapered limb): x1, y1, x2, y2, r1, r2; poly: pts; line: pts, w, curve (four points: a curve); body: ells
 *   (a list of [x, y, rx, ry, rot], drawn as one shape), soft; eye: x, y, r, stalk
 * @param {number} k pixels per unit
 * @param {{dir: number, toneOf: function(string): object, line: number[], flat?: boolean, shadow?: number,
 *   markings?: function(object, object, number): void}} o dir: 1 facing right, -1 left; toneOf: a part's tone name to
 *   its tones (tones()); line: the outline colour; shadow: the width of the ground shadow (none if not given);
 *   markings(g, part, k): drawn over each part after its shading (spots, stripes, a belly)
 * @see cel-shading-wikipedia
 */
export function drawParts(g, parts, k, o) {
  const ow = Math.max(0.9, k * 0.55),
    sorted = parts.slice().sort((a, b) => a.z - b.z);
  g.save();
  g.scale(o.dir, 1);
  if (o.shadow !== undefined) {
    g.fillStyle = 'rgba(10,8,20,0.22)';
    g.beginPath();
    g.ellipse(0, 0.2 * k, Math.max(2, o.shadow * 0.32 * k), Math.max(1, 0.9 * k), 0, 0, TAU);
    g.fill();
  }
  // one outline round everything: each part grown by the outline's width, in the line colour
  g.fillStyle = rgba(o.line);
  g.strokeStyle = rgba(o.line);
  for (const p of sorted) {
    if (p.s === 'eye') {
      if (p.stalk) {
        g.beginPath();
        g.arc(p.x * k, -p.y * k, p.r * k + ow, 0, TAU);
        g.fill();
      }
      continue;
    }
    if (p.s === 'line') {
      stroke(g, p, k, p.w * k + ow * 2);
      continue;
    }
    g.beginPath();
    p.s === 'body' ? body(g, p, k, ow) : path(g, p, k, ow);
    g.fill();
    if (p.s === 'poly') {
      g.lineWidth = ow * 2;
      g.lineJoin = 'round';
      g.stroke();
    }
  }
  // the parts, far to near, each in its tones
  for (const p of sorted) {
    if (p.s === 'eye') {
      g.fillStyle = rgba([20, 16, 26]);
      g.beginPath();
      g.arc(p.x * k, -p.y * k, p.r * k, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,250,235,0.9)';
      g.beginPath();
      g.arc((p.x - p.r * 0.3) * k, -(p.y + p.r * 0.35) * k, Math.max(0.35, p.r * 0.38 * k), 0, TAU);
      g.fill();
      continue;
    }
    const t = o.toneOf(p.tone);
    if (p.s === 'line') {
      g.strokeStyle = rgba(t.base);
      stroke(g, p, k, p.w * k);
      continue;
    }
    g.beginPath();
    p.s === 'body' ? body(g, p, k) : path(g, p, k);
    if (o.flat) {
      g.fillStyle = rgba(t.base);
      g.fill();
      if (o.markings) o.markings(g, p, k);
      continue;
    }
    g.fillStyle = rgba(t.dark);
    g.fill();
    g.save();
    g.clip();
    // the lit side: the same shape moved toward the light, in the base tone; a highlight above it on large parts
    const big =
      p.s === 'body'
        ? Math.max(...p.ells.map((e) => Math.max(e[2], e[3])))
        : p.s === 'ell'
          ? Math.max(p.rx, p.ry)
          : p.s === 'cap'
            ? Math.max(p.r1, p.r2)
            : 2;
    const sh = big * 0.32 * k;
    g.translate(-sh * 0.45, -sh * 0.55);
    g.beginPath();
    p.s === 'body' ? body(g, p, k) : path(g, p, k);
    g.fillStyle = rgba(t.base);
    g.fill();
    if (big > 1.4) {
      g.translate(-sh * 0.35, -sh * 0.45);
      g.beginPath();
      p.s === 'body' ? body(g, p, k, -big * 0.38 * k) : path(g, p, k, -big * 0.42 * k);
      g.fillStyle = rgba(t.light, 0.85);
      g.fill();
    }
    g.restore();
    if (o.markings) o.markings(g, p, k);
    if (p.soft) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      const e = p.ells[0];
      g.beginPath();
      g.ellipse((e[0] - e[2] * 0.35) * k, -(e[1] + e[3] * 0.45) * k, e[2] * 0.22 * k, e[3] * 0.14 * k, -0.4, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}
