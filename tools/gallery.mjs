// node tools/gallery.mjs: the gallery's pictures (gallery/*.svg), drawn by the almanac's own functions. They are SVG
// (text), so they need no image library, show on GitHub as they are, and tests/run.mjs can tell when one is stale.
import { writeFileSync } from 'node:fs';
import {
  footStep,
  strideRate,
  gaitTiming,
  twoBoneLimb,
  hillLine,
  branchingTree,
  swayingChain,
  SeededRandom,
} from '../src/index.js';

const PI = Math.PI,
  f = (v) => (Math.round(v * 100) / 100).toString(),
  INK = '#2b2633',
  SOFT = '#8a8296',
  PAPER = '#fbf8f2';
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Georgia, serif">\n` +
  `<rect width="${w}" height="${h}" fill="${PAPER}"/>\n${body.join('\n')}\n</svg>\n`;
const text = (x, y, s, o = {}) => {
  const a = { fill: INK, 'font-size': 12, ...o }; // (defaults, then what this text changes: each attribute once)
  return `<text x="${f(x)}" y="${f(y)}" ${Object.entries(a)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')}>${s}</text>`;
};

// ---- gaits.svg: a footfall diagram for each gait (Hildebrand's way of drawing them): one row per leg, one step left
// to right, a bar where the foot is on the ground
function gaits() {
  const W = 640,
    left = 150,
    span = W - left - 20,
    row = 11,
    rows = [];
  const panels = [
    ['walk', 2],
    ['trot', 2],
    ['bound', 2],
    ['stride', 1],
    ['tripod', 3],
    ['wave', 4],
  ];
  let y = 34;
  rows.push(
    text(20, 20, 'Footfall diagrams: one step, left to right; a bar while the foot is down', { 'font-size': '13' }),
  );
  for (const [gait, pairs] of panels) {
    const T = gaitTiming(gait, pairs);
    rows.push(text(20, y + 12, gait, { 'font-weight': 'bold' }));
    T.forEach((pair, i) => {
      for (const side of ['near', 'far']) {
        const name = pairs === 1 ? side : pairs === 2 ? `${i ? 'hind' : 'fore'} ${side}` : `pair ${i + 1} ${side}`;
        rows.push(text(left - 8, y + 9, name, { 'text-anchor': 'end', 'font-size': 10, fill: SOFT }));
        rows.push(
          `<line x1="${left}" y1="${f(y + 5)}" x2="${left + span}" y2="${f(y + 5)}" stroke="${SOFT}" stroke-width="0.5"/>`,
        );
        // planted where footStep puts the foot on the ground; sampled finely, then joined into bars
        const n = 400;
        let start = null;
        for (let k = 0; k <= n; k++) {
          const down = k < n && footStep((k / n) * 2 * PI + pair[side], 1, 1).y === 0;
          if (down && start === null) start = k;
          if (!down && start !== null) {
            rows.push(
              `<rect x="${f(left + (start / n) * span)}" y="${f(y + 1)}" width="${f(((k - start) / n) * span)}" height="8" fill="${INK}"/>`,
            );
            start = null;
          }
        }
        y += row;
      }
    });
    y += 14;
  }
  return svg(W, y, rows);
}

// ---- limb.svg: a two-bone leg following footStep, in place (moments overlaid) and walking at strideRate (planted
// feet stay put)
function limb() {
  const W = 640,
    k = 9, // px per unit
    upper = 6,
    lower = 6,
    stride = 3.5,
    lift = 1.8,
    hipY = 10.6,
    out = [];
  const P = (x, y, ox, oy) => [ox + x * k, oy - y * k];
  const leg = (hx, phase, ox, oy, colour, width) => {
    const s = footStep(phase, stride, lift),
      j = twoBoneLimb({ x: hx, y: hipY }, { x: hx + s.x, y: s.y }, upper, lower, -1);
    const [a, b] = P(hx, hipY, ox, oy),
      [c, d] = P(j.knee.x, j.knee.y, ox, oy),
      [e, g] = P(j.foot.x, j.foot.y, ox, oy);
    return `<polyline points="${f(a)},${f(b)} ${f(c)},${f(d)} ${f(e)},${f(g)}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  // in place: twelve moments of one step, and the path the foot follows
  const ox1 = 110,
    oy1 = 160;
  out.push(text(20, 22, 'In place: one step', { 'font-size': 13 }));
  out.push(`<line x1="40" y1="${oy1}" x2="185" y2="${oy1}" stroke="${SOFT}"/>`);
  const path = [];
  for (let i = 0; i <= 96; i++) {
    const s = footStep((i / 96) * 2 * PI, stride, lift),
      [x, y] = P(s.x, s.y, ox1, oy1);
    path.push(`${f(x)},${f(y)}`);
  }
  out.push(
    `<polyline points="${path.join(' ')}" fill="none" stroke="#c0567a" stroke-width="1.5" stroke-dasharray="3 2"/>`,
  );
  for (let i = 0; i < 12; i++) out.push(leg(0, (i / 12) * 2 * PI, ox1, oy1, i === 0 ? INK : SOFT, i === 0 ? 3 : 1.2));
  // walking: the body moves at strideRate over two steps; dark while the foot is planted, light while it swings, and a
  // dot where the foot is at each moment, so the planted moments stack up in one place
  const ox2 = 250,
    oy2 = 160,
    rate = strideRate(stride);
  out.push(text(250, 22, 'Walking: each planted foot ends where it landed', { 'font-size': 13 }));
  out.push(`<line x1="${ox2 - 20}" y1="${oy2}" x2="${W - 20}" y2="${oy2}" stroke="${SOFT}"/>`);
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const phase = PI / 2 + (i / n) * 4 * PI, // from the moment the foot is put down, two whole steps
      hx = (phase - PI / 2) / rate, // how far the body has walked
      planted = footStep(phase, stride, lift).y === 0;
    out.push(leg(hx, phase, ox2, oy2, planted ? INK : '#c9c2d3', planted ? 1.4 : 1));
    const s = footStep(phase, stride, lift),
      [x, y] = P(hx + s.x, s.y, ox2, oy2);
    out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2.2" fill="${planted ? '#c0567a' : '#c9c2d3'}"/>`);
  }
  return svg(W, 180, out);
}

// ---- land.svg: three lines of hills from one seed (round, sharp, terraced), each drawn by hillLine
function land() {
  const W = 640,
    H = 200,
    out = [text(20, 22, 'hillLine: one seed, three kinds of hill', { 'font-size': 13 })];
  const kinds = [
    ['round', { seed: 7, base: 0.95, height: 0.6 }, '#9fb7a0'],
    ['sharp: 0.5', { seed: 7, base: 0.95, height: 0.6, sharp: 0.5, freq: 3 }, '#6f8f78'],
    ['terrace: 5', { seed: 7, base: 0.95, height: 0.6, terrace: 5 }, '#c8a070'],
  ];
  kinds.forEach(([label, hill, colour], i) => {
    const x0 = 20 + i * 205,
      w = 190,
      pts = [];
    for (let x = 0; x <= w; x += 1) pts.push(`${f(x0 + x)},${f(30 + hillLine(x * 2, hill, 380, H - 40))}`);
    out.push(
      `<polygon points="${f(x0)},${H - 10} ${pts.join(' ')} ${f(x0 + w)},${H - 10}" fill="${colour}" stroke="${INK}" stroke-width="1"/>`,
    );
    out.push(text(x0, H - 14 - 0, label, { 'font-size': 11, fill: INK }));
  });
  return svg(W, H, out);
}

// ---- growth.svg: trees from three plans (branchingTree), and kelp swaying at three moments (swayingChain)
function growth() {
  const W = 640,
    H = 220,
    out = [text(20, 22, 'branchingTree: three plans; swayingChain: one chain at three moments', { 'font-size': 13 })];
  out.push(`<line x1="20" y1="${H - 20}" x2="${W - 20}" y2="${H - 20}" stroke="${SOFT}"/>`);
  const plans = [
    { levels: 6, forks: 2, spread: 0.45, length: 30, width: 4 },
    { levels: 4, forks: 3, spread: 0.7, decay: 0.68, length: 34, width: 5, curl: 0.25 },
    { levels: 7, forks: 2, spread: 0.3, decay: 0.78, length: 26, width: 3.5, lean: 0.6 },
  ];
  plans.forEach((plan, i) => {
    const t = branchingTree(90 + i * 130, H - 20, plan, 1, new SeededRandom(`tree ${i}`));
    for (const s of t.segments)
      out.push(
        `<path d="M${f(s.x0)},${f(s.y0)} Q${f(s.cx)},${f(s.cy)} ${f(s.x1)},${f(s.y1)}" fill="none" stroke="#5a4636" stroke-width="${f(Math.max(0.6, s.width))}" stroke-linecap="round"/>`,
      );
    for (const [x, y] of t.tips) out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="#6a9a4a" opacity="0.8"/>`);
  });
  [0, 1.2, 2.4].forEach((time, k) => {
    for (let i = 0; i < 4; i++) {
      const pts = swayingChain(470 + i * 12 + k * 52, H - 20, { segments: 14, length: 150, sway: 0.7 }, 1, time, i);
      out.push(
        `<polyline points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="none" stroke="${['#3f7f5a', '#4a8a5a', '#5a9a68', '#2f6f4a'][i]}" stroke-width="2" stroke-linecap="round" opacity="${f(0.45 + k * 0.25)}"/>`,
      );
    }
  });
  return svg(W, H, out);
}

export function buildGallery() {
  return {
    'gallery/gaits.svg': gaits(),
    'gallery/limb.svg': limb(),
    'gallery/land.svg': land(),
    'gallery/growth.svg': growth(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../', import.meta.url).pathname;
  for (const [file, content] of Object.entries(buildGallery())) writeFileSync(root + file, content);
  console.log('gallery written');
}
