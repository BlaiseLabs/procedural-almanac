// Drawing on a canvas: simple shapes in an art style, and what lies over a whole picture (light rays, fog, a mirror
// of wet ground, grain, a vignette) or in it (a glowing sun, a cloud, an inked line of hills). Each draws on the 2D
// context it is given and changes nothing else.
import { clamp, wrap } from './numbers.js';
import { rgba, mixColour, shade } from './colour.js';
import { indexRandom } from './random.js';
import { makeCanvas } from './canvas.js';

const TAU = Math.PI * 2;

/**
 * The outline of a simple shape, added to the path being built (fill or stroke it after): blob (an ellipse), box, spike
 * and tri (triangles), gem (a diamond), dome (a half ellipse), stem (a tapering post), disc (a flat ellipse), ring (an
 * ellipse with a hole). It stands on (x, y): its base there, w wide and h tall, leaning by lean.
 * @param {object} g a canvas 2D context
 * @param {'blob'|'box'|'spike'|'tri'|'gem'|'dome'|'stem'|'disc'|'ring'} shape (anything else: a box)
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} lean how far the top leans, as a share of the height
 */
export function partPath(g, shape, x, y, w, h, lean) {
  switch (shape) {
    case 'blob':
      g.ellipse(x + lean * h * 0.3, y - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'box':
      g.rect(x - w / 2, y - h, w, h);
      break;
    case 'spike':
      g.moveTo(x - w / 2, y);
      g.lineTo(x + w / 2, y);
      g.lineTo(x + lean * h, y - h);
      g.closePath();
      break;
    case 'tri':
      g.moveTo(x - w / 2, y);
      g.lineTo(x + w / 2, y);
      g.lineTo(x + lean * h * 0.5, y - h);
      g.closePath();
      break;
    case 'gem':
      g.moveTo(x, y - h);
      g.lineTo(x + w / 2, y - h / 2);
      g.lineTo(x, y);
      g.lineTo(x - w / 2, y - h / 2);
      g.closePath();
      break;
    case 'dome':
      g.ellipse(x, y, w / 2, h, 0, Math.PI, Math.PI * 2);
      g.closePath();
      break;
    case 'stem': {
      const x2 = x + lean * h;
      g.moveTo(x - w / 2, y);
      g.lineTo(x + w / 2, y);
      g.lineTo(x2 + w * 0.35, y - h);
      g.lineTo(x2 - w * 0.35, y - h);
      g.closePath();
      break;
    }
    case 'disc':
      g.ellipse(x, y - h / 2, w / 2, Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
      break;
    case 'ring':
      g.ellipse(x, y - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      g.ellipse(x, y - h / 2, w * 0.3, h * 0.3, 0, 0, Math.PI * 2, true);
      break;
    default:
      g.rect(x - w / 2, y - h, w, h);
  }
}

/**
 * Fills the path just built in an art style: flat (one colour), gradient (lit from the upper left, darker to the lower
 * right), facet (the same, split hard down the middle, like a cut stone or low-poly), or glow (lit from within, with a
 * halo); with a soft paper shadow under it and an outline round it, if the style asks.
 * @param {object} g a canvas 2D context, with a path built
 * @param {number[]} c the colour, [r, g, b]
 * @param {number} x the shape's base, middle (for where the gradient runs)
 * @param {number} y
 * @param {number} w its width
 * @param {number} h its height
 * @param {{shade?: 'flat'|'gradient'|'facet'|'glow', shadow?: number, line?: string, lineWidth?: number}} [art] shadow:
 *   how dark a paper shadow (0..1, none if not given); line: an outline colour (CSS), or 'none'
 * @see cel-shading-wikipedia
 */
export function fillInArt(g, c, x, y, w, h, art = {}) {
  const mode = art.shade || 'flat';
  if (art.shadow) {
    g.save();
    g.shadowColor = `rgba(0,0,0,${art.shadow})`;
    g.shadowBlur = Math.max(2, (w + h) * 0.12);
    g.shadowOffsetY = Math.max(1, h * 0.04);
  }
  if (mode === 'gradient' || mode === 'facet') {
    const gr = g.createLinearGradient(x - w / 2, y - h, x + w / 2, y);
    gr.addColorStop(0, rgba(shade(c, mode === 'facet' ? 0.25 : 0.35)));
    gr.addColorStop(mode === 'facet' ? 0.5 : 0.55, rgba(c));
    gr.addColorStop(mode === 'facet' ? 0.5001 : 1, rgba(shade(c, -0.35))); // (a facet: the colour steps, it does not blend)
    if (mode === 'facet') gr.addColorStop(1, rgba(shade(c, -0.4)));
    g.fillStyle = gr;
  } else g.fillStyle = rgba(c);
  if (mode === 'glow') {
    g.save();
    g.shadowColor = rgba(shade(c, 0.3), 0.9);
    g.shadowBlur = Math.max(4, (w + h) * 0.45);
  }
  g.fill('evenodd');
  if (mode === 'glow') g.restore();
  if (art.shadow) g.restore();
  if (art.line && art.line !== 'none') {
    g.lineWidth = art.lineWidth || 1;
    g.strokeStyle = art.line;
    g.stroke();
  }
}

/**
 * Draws a recipe: a few simple shapes (partPath), each in its colour and the art's style, some of them repeated and
 * scattered (a clump of grass, a cluster of rocks), every repeat a little different in size and lean.
 * @param {object} g a canvas 2D context
 * @param {{parts: {shape: string, x?: number, y?: number, w?: number, h?: number, color?: string, count?: number,
 *   spread?: number, jitter?: number, lean?: number}[]}} recipe each part: where it stands (x across, y up), its size,
 *   its colour (whatever colourOf reads), how many (1..10), how far apart, how much they vary (0..0.6, 0.12), its lean
 * @param {number} x where the recipe stands
 * @param {number} y
 * @param {number} k pixels per unit
 * @param {{range: function, chance: function}} random a SeededRandom (drawn from for each repeat)
 * @param {function(*): number[]} colourOf a part's colour, as [r, g, b]
 * @param {object} [art] the style (fillInArt)
 */
export function drawRecipe(g, recipe, x, y, k, random, colourOf, art = {}) {
  for (const p of recipe.parts || []) {
    const n = Math.max(1, Math.min(10, p.count | 0 || 1)),
      jit = clamp(+p.jitter || 0.12, 0, 0.6),
      base = colourOf(p.color);
    for (let i = 0; i < n; i++) {
      const sp = +p.spread || 0,
        ox = n > 1 || sp ? random.range(-sp, sp) : 0,
        oy = n > 1 && sp ? random.range(0, sp * 0.3) : 0;
      const w = Math.max(0.5, (+p.w || 4) * random.range(1 - jit, 1 + jit)) * k,
        h = Math.max(0.5, (+p.h || 4) * random.range(1 - jit, 1 + jit)) * k;
      const lean = (+p.lean || 0) * random.range(0.6, 1.2) * (n > 1 && random.chance(0.5) ? -1 : 1);
      const px = x + ((+p.x || 0) + ox) * k,
        py = y - ((+p.y || 0) + oy) * k;
      g.beginPath();
      partPath(g, p.shape, px, py, w, h, lean);
      fillInArt(g, base, px, py, w, h, art);
    }
  }
}

// grain: a fixed texture of fine noise, made once per size
const grains = new Map();

/**
 * Grain over a whole picture (paper, film): a fixed texture of fine noise laid over everything, by a blend mode.
 * @param {object} g a canvas 2D context
 * @param {number} w the picture's width
 * @param {number} h its height
 * @param {number} amount 0..1 (0: nothing drawn)
 * @param {string} [mode] the blend ('overlay')
 * @see film-grain-wikipedia
 * @see hash-function-wikipedia
 */
export function grain(g, w, h, amount, mode = 'overlay') {
  if (!amount) return;
  const key = w + 'x' + h;
  let pat = grains.get(key);
  if (!pat) {
    const c = makeCanvas(128, 128),
      cg = c.getContext('2d'),
      im = cg.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) {
      // each pixel's grey from multiplicative hashing of its index [hash-function-wikipedia]
      const v = 128 + ((Math.imul(i * 2654435761, 1) >>> 24) - 128) * 0.9;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    cg.putImageData(im, 0, 0);
    pat = c;
    grains.set(key, pat);
  }
  g.save();
  g.globalAlpha = clamp(amount, 0, 1);
  g.globalCompositeOperation = mode;
  g.fillStyle = g.createPattern(pat, 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}

/**
 * A vignette: the picture darkened toward its edges and corners, its middle left clear.
 * @param {object} g a canvas 2D context
 * @param {number} w the picture's width
 * @param {number} h its height
 * @param {number} amount how dark the corners go, 0..1 (0: nothing drawn)
 * @see vignetting-wikipedia
 */
export function vignette(g, w, h, amount) {
  if (!amount) return;
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${amount})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

// a soft glow drawn once per colour and stamped (a canvas shadow blur on every mote cost 35 ms a frame on a phone)
const glows = new Map();

/**
 * A small soft glow in a colour, drawn once and kept: stamp it (drawImage), scaled, wherever something glows (a
 * firefly, a lamp, a window at night). Much cheaper than a blur on every one.
 * @param {number[]} c [r, g, b]
 * @returns {object} a 16 by 16 canvas: the colour at the middle, fading to nothing at the edge
 * @see sprite-wikipedia
 */
export function glowSprite(c) {
  const key = c.join(',');
  let s = glows.get(key);
  if (!s) {
    s = makeCanvas(16, 16);
    const g = s.getContext('2d'),
      gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    gr.addColorStop(0, rgba(c, 1));
    gr.addColorStop(0.35, rgba(c, 0.55));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 16, 16);
    glows.set(key, s);
  }
  return s;
}

/**
 * A glowing disc (the sun, the moon, a lamp): a soft halo four and a half times its size, and the disc itself.
 * @param {object} g a canvas 2D context
 * @param {number} x its middle
 * @param {number} y
 * @param {number} r its radius
 * @param {number[]} c its colour, [r, g, b]
 * @param {number} glow how strong the halo is (1: the sun's; 0.85: the moon's)
 */
export function glowingDisc(g, x, y, r, c, glow) {
  const gr = g.createRadialGradient(x, y, r * 0.5, x, y, r * 4.5);
  gr.addColorStop(0, rgba(c, 0.45 * glow));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r * 4.5, 0, TAU);
  g.fill();
  g.fillStyle = rgba(c);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/**
 * Light rays from above (sunbeams through cloud, light through water): slanting shafts, brightest at the top and
 * fading downward, added onto the picture (they lighten, never darken), each drifting slowly.
 * @param {object} g a canvas 2D context
 * @param {number} w the picture's width
 * @param {number} h its height
 * @param {{count: number, colour: number[], alpha: number, seed: number, t: number, reach: number}} o count: how
 *   many shafts; alpha: how bright at the top; t: the time (for the drift); reach: how far down, as a share of h
 * @see crepuscular-rays-wikipedia
 */
export function lightRays(g, w, h, o) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < o.count; i++) {
    const x = w * (indexRandom(i, o.seed) * 1.2 - 0.1) + Math.sin(o.t * 0.25 + i * 1.9) * w * 0.04,
      rw = w * (0.03 + indexRandom(i, o.seed + 1) * 0.06),
      lean = w * 0.18;
    const gr = g.createLinearGradient(0, 0, 0, h * o.reach);
    gr.addColorStop(0, rgba(o.colour, o.alpha));
    gr.addColorStop(1, rgba(o.colour, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + rw, 0);
    g.lineTo(x + rw + lean, h * o.reach);
    g.lineTo(x + lean - rw, h * o.reach);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/**
 * Fog lying in a band of the picture: three soft layers, each thickest in its middle and fading above and below,
 * rising and falling very slightly.
 * @param {object} g a canvas 2D context
 * @param {number} w the picture's width
 * @param {number} h its height
 * @param {{band: number[], colour: number[], alpha: number, t: number}} o band: [top, bottom] as shares of h; alpha:
 *   how thick; t: the time
 */
export function fogBands(g, w, h, o) {
  for (let k = 0; k < 3; k++) {
    const y = h * (o.band[0] + (o.band[1] - o.band[0]) * (k / 2)) + Math.sin(o.t * 0.2 + k) * h * 0.01,
      hh = h * (o.band[1] - o.band[0]) * 0.6;
    const gr = g.createLinearGradient(0, y - hh, 0, y + hh);
    gr.addColorStop(0, rgba(o.colour, 0));
    gr.addColorStop(0.5, rgba(o.colour, o.alpha * 0.6));
    gr.addColorStop(1, rgba(o.colour, 0));
    g.fillStyle = gr;
    g.fillRect(0, y - hh, w, hh * 2);
  }
}

/**
 * A mirror of what is already drawn above a line, laid below it (a wet street, a still lake): copied strip by strip,
 * upside down, each strip fainter the further down and shifted by a ripple that grows toward the bottom.
 * @param {object} g a canvas 2D context, on the canvas being drawn
 * @param {number} w the picture's width
 * @param {number} h its height
 * @param {{base: number, alpha: number, ripple: number, t: number}} o base: the mirror's line, as a share of h;
 *   alpha: how strong the reflection is; ripple: how far the strips shift; t: the time
 * @see reflection-wikipedia
 */
export function mirrorBelow(g, w, h, o) {
  const y0 = Math.round(h * o.base),
    hgt = h - y0,
    strip = Math.max(1, Math.round(h / 100)),
    src = g.canvas;
  if (!src) return;
  for (let y = 0; y < hgt; y += strip) {
    const sy = y0 - y - strip,
      wob = Math.sin(o.t * 2 + y * 0.35) * o.ripple * (y / hgt + 0.2);
    if (sy < 0) break;
    g.save();
    g.globalAlpha = o.alpha * (1 - (y / hgt) * 0.7);
    g.drawImage(src, 0, sy, w, strip, wob, y0 + y, w, strip);
    g.restore();
  }
}

/**
 * A cloud of six round puffs along a gentle arch, with a soft shadow below and to the right of it.
 * @param {object} g a canvas 2D context
 * @param {number} x its middle
 * @param {number} y
 * @param {number} s its size (1: about 40 pixels across)
 * @param {number} i which cloud this is (each has its own puffs)
 * @param {{colour: number[], shadow: number[], alpha: number}} o
 */
export function puffCloud(g, x, y, s, i, o) {
  for (const [ox0, oy0, col, a] of [
    [1.5 * s, 2 * s, o.shadow, o.alpha * 0.6],
    [0, 0, o.colour, o.alpha],
  ])
    for (let j = 0; j < 6; j++) {
      const ox = (j - 2.5) * 6 * s,
        oy = -Math.sin((j / 5) * Math.PI) * 4 * s,
        r = (5 + Math.sin(j * 1.7 + i) * 2) * s;
      g.fillStyle = rgba(col, a);
      g.beginPath();
      g.arc(x + ox + ox0, y + oy + oy0, r, 0, TAU);
      g.fill();
    }
}

/**
 * A line of land inked, in a comic's way: the line drawn in a dark ink, and a light hatching under it, slanting
 * strokes that start just below the line and travel with the land as it scrolls.
 * @param {object} g a canvas 2D context
 * @param {function(number): number} lineAt the land's y at a screen x
 * @param {number} w the picture's width
 * @param {number} h its height
 * @param {{colour: number[], ink: number, depth: number, step: number, scroll: number}} o colour: the land's (the ink
 *   is a near-black of it); ink: how strong, 0..1; depth: 0 far .. 1 near (near lines are darker and thicker); step:
 *   pixels between the line's points; scroll: how far the land has scrolled (the hatching moves with it)
 * @see hatching-wikipedia
 */
export function inkedLine(g, lineAt, w, h, o) {
  const ink = rgba(mixColour(o.colour, [18, 14, 26], 0.8), Math.min(1, o.ink) * (0.55 + 0.45 * o.depth)),
    lw = Math.max(0.8, (h / 200) * (0.6 + 0.8 * o.depth)),
    step = o.step;
  g.save();
  g.strokeStyle = ink;
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.beginPath();
  for (let sx = -step; sx <= w + step; sx += step) {
    const y = lineAt(sx);
    sx === -step ? g.moveTo(sx, y) : g.lineTo(sx, y);
  }
  g.stroke();
  g.beginPath();
  g.moveTo(-2, h + 2);
  for (let sx = -step; sx <= w + step; sx += step) g.lineTo(sx, lineAt(sx));
  g.lineTo(w + 2, h + 2);
  g.closePath();
  g.clip();
  const gap = Math.max(4, 7 * (w / 320)),
    off = wrap(o.scroll, gap);
  g.globalAlpha = 0.16 * Math.min(1, o.ink);
  g.lineWidth = Math.max(0.6, lw * 0.6);
  g.beginPath();
  for (let x = -off - h; x < w + h; x += gap) {
    const y0 = lineAt(x) + gap * 1.5;
    g.moveTo(x, y0);
    g.lineTo(x + gap * 2.2, y0 + gap * 2.2);
  }
  g.stroke();
  g.restore();
}
