// One seed, one island: a short film made with procedural-almanac and nothing else. A seed becomes noise and the noise
// an island; its terraces rise, the sea comes in, the land is painted, a river finds its way down, a forest grows,
// villages and roads appear, then people, deer, birds and fish; the day turns to night, a storm passes, and at dawn the
// island goes back to noise. Every picture is drawn by code, a pixel at a time, from the almanac's techniques: there are
// no image files. Each stage's caption names the techniques it shows, and at dawn the film counts them.
//
//   node examples/island/island.mjs                        island.gif and island.mp4 beside this file (needs ffmpeg)
//   node examples/island/island.mjs --still 11 frame.png   one frame, at 11 seconds
//   node examples/island/island.mjs --sheet sheet.png      a frame every second, on one sheet
//   --seed <words>  another island (heron-bay-8)          --scale <n>  the GIF's screen pixels per pixel (2)
//   --start <s>     the second the film opens on (it loops; by default the whole island, by day)
import * as almanac from '../../src/index.js';
import { textRows } from './font.mjs';
import { deflateSync } from 'node:zlib';
import { writeFileSync, openSync, readSync, writeSync, closeSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// every technique the film calls is counted on its way through, so the end can say how many it used
const used = new Set();
const A = {};
for (const [name, f] of Object.entries(almanac))
  A[name] =
    typeof f !== 'function'
      ? f
      : /^[A-Z]/.test(name)
        ? class extends f {
            constructor(...a) {
              super(...a);
              used.add(name);
            }
          }
        : (...a) => {
            used.add(name);
            return f(...a);
          };
// prettier-ignore
const {
  clamp, lerp, smoothstep, indexRandom, SeededRandom, latticeHash, latticeRandom, fractalNoise, noiseLine, packRgb,
  mixPacked, hueShiftTone, bayerThreshold, ditheredBorder, scalePacked, waterTime, waterPixel, hexToRgb,
  gradeColour, hourLight, hourTables, gradeFrame, twinkle, islandHeight, terraceLevel, windingRiver,
  chamferDistance, scatterAlong, windowLit, blink, faceShade, obliqueToScreen, flockStep, fleeVector, formationSlot,
  particleField, fall, rise, hover, wrapAround, pulseRise, branchingTree, swayingChain, stampCache, footStep,
  strideRate, gaitTiming, genomeFrom, crossGenomes, seedOf, fillEllipse, capsuleSteps, lineCells, ditherEllipse,
  shadeEllipse, blitSprite, blitSway, outlinePass, cutSprite, drawnBounds, spriteFromRows, layTemplate, packSheet,
  leafCrown, barkTrunk, followJoint, dampedSpring, floatHeight, smoothCurve, bodySpots, coatColours, cloudShadows,
  fogBanks, frontStrength, lightningFlash, gridAStar, nearestFreeCell, floodFill, untilSettled, roofPlan,
  slopeShade, roofTexel, wallShade, wanderingHeading, plotGrid, gridWalk,
} = A;

const argv = process.argv.slice(2),
  opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const W = 384, // the picture, in its own pixels
  H = 216,
  GH = H + 32, // the world's rows: a few more than the picture's, since high land is lifted into view
  FPS = 20,
  LIFT = 4, // pixels a terrace stands above the one below
  LEVELS = 7,
  N = 200, // islandHeight's tiles across, and the picture's tiles per pixel
  Z = 0.5,
  ROUGH = 0.6,
  LAND = 0.44; // how much of the picture is land
const PHRASE = opt('--seed', 'heron-bay-8'),
  SEED = seedOf(PHRASE);

// ---------------------------------------------------------------------------------------------------- the timeline
const STAGES = [
  ['seed', 1.4],
  ['island', 0.9],
  ['rise', 1.2],
  ['sea', 1.0],
  ['paint', 1.1],
  ['river', 1.0],
  ['forest', 1.4],
  ['village', 1.2],
  ['roads', 1.0],
  ['life', 2.8],
  ['dusk', 1.4],
  ['night', 1.8],
  ['storm', 1.6],
  ['dawn', 1.6],
  ['fade', 0.8],
];
const T = {};
let DUR = 0;
for (const [k, d] of STAGES) T[k] = [DUR, (DUR += d)];
const span = (k, t) => clamp((t - T[k][0]) / (T[k][1] - T[k][0]));
const CAPTIONS = {
  seed: [`\`seedOf\`('${PHRASE}') = ${SEED}`, '`fractalNoise`, one octave at a time'],
  island: ['`islandHeight`: lower toward the edge'],
  rise: ['`terraceLevel` · `wallShade` · `faceShade`', '`dampedSpring`'],
  sea: ['`chamferDistance` · `waterTime` · `waterPixel`'],
  paint: ['`hueShiftTone` · `ditheredBorder` · `latticeRandom`', '`gradeColour`'],
  river: ['`windingRiver` · `untilSettled`'],
  forest: ['`leafCrown` · `barkTrunk` · `outlinePass` · `blitSway`', '`swayingChain` · `branchingTree` · `stampCache`'],
  village: ['`roofPlan` · `roofTexel` · `slopeShade` · `plotGrid`'],
  roads: ['`floodFill` · `nearestFreeCell` · `gridAStar`', '`scatterAlong` · `lineCells`'],
  life: [
    '`genomeFrom` · `crossGenomes` · `coatColours` · `gaitTiming`',
    '`flockStep` · `fleeVector` · `formationSlot` · `followJoint`',
  ],
  dusk: ['`hourLight` · `hourTables` · `gradeFrame` · `windowLit`'],
  night: ['`pulseRise` · `rise` · `hover` · `twinkle` · `blink`'],
  storm: ['`frontStrength` · `fall` · `wrapAround` · `lightningFlash`'],
  dawn: ['`fogBanks` · `cloudShadows`'],
  fade: ['`bayerThreshold`, and again'],
};
// the time of day for hourLight (0.25 noon, 0.75 midnight): a morning through the building, then dusk, night, dawn
const DAY = [
  [0, 0.15],
  [T.life[0], 0.3],
  [T.dusk[0], 0.42],
  [T.night[0], 0.57],
  [T.storm[0], 0.7],
  [T.dawn[0], 0.84],
  [T.fade[0], 1.02],
  [DUR, 1.06],
];
function timeOfDay(t) {
  let k = 0;
  while (k < DAY.length - 2 && t > DAY[k + 1][0]) k++;
  return lerp(DAY[k][1], DAY[k + 1][1], clamp((t - DAY[k][0]) / (DAY[k + 1][0] - DAY[k][0]))) % 1;
}

// ---------------------------------------------------------------------------------------------------- colours
const LOOK = { sat: 1.08, warm: 0.05, contrast: 1.04 }; // the whole palette passes through one grade, as a film's does
const hex = (s) => packRgb(...hexToRgb(gradeColour(s, LOOK)));
const RAMPS = new Map();
// a colour's ramp, two steps darker to two lighter, each step turning in hue as a pixel artist's does
const tone = (c, k) => {
  let r = RAMPS.get(c);
  if (!r) RAMPS.set(c, (r = [-1.7, -0.85, 0, 0.75, 1.5].map((s) => (s ? hueShiftTone(c, s) : c))));
  return r[k + 2];
};
const C = {
  sand: hex('#ead9a2'),
  wetSand: hex('#d3bd86'),
  lush: hex('#74c25a'),
  dry: hex('#a7c463'),
  wood1: hex('#58a44c'),
  wood2: hex('#468f48'),
  heath: hex('#86a05c'),
  moor: hex('#a08f6a'),
  rock: hex('#a39c8e'),
  snow: hex('#e9ece6'),
  earth: hex('#a8774f'),
  stone: hex('#8f8c87'),
  dirt: hex('#cfac72'),
  plank: hex('#a9763f'),
  bank: hex('#9c7c4e'),
  wheat: hex('#e2c25c'),
  greens: hex('#6aab4b'),
  cabbage: hex('#93c979'),
  fallow: hex('#a87b53'),
  paddy: hex('#93d3cf'),
  sprout: hex('#5fb35a'),
  flowers: ['#fff4e0', '#ffd75a', '#ff9fb8', '#c9a9ff'].map(hex),
  bark: [hex('#5b3b26'), hex('#87593a')],
  inkTree: hex('#1e2b22'),
  ink: hex('#24191b'),
  plaster: hex('#ece0c6'),
  timber: hex('#c9996a'),
  door: hex('#5d3b25'),
  glass: hex('#33496c'),
  lit: hex('#ffd98a'),
  lamp: hex('#fff0b0'),
  pole: hex('#3b2f2c'),
  fire: [hex('#fff3b0'), hex('#ffb347'), hex('#f0632e')],
  smoke: hex('#d9d6d2'),
  rain: hex('#a9c2e2'),
  star: hex('#e6eeff'),
  firefly: hex('#e9ff8f'),
  lantern: hex('#ffb04a'),
  text: hex('#f6eed8'),
  accent: hex('#ffd36e'),
  textInk: hex('#1a1824'),
  mark: hex('#c8c0b0'),
  fog: hex('#ebe8f2'),
  gull: hex('#fbfbf6'),
  gullShade: hex('#b9c0c8'),
  sail: hex('#f8f3e6'),
  hull: hex('#8a5432'),
  beacon: hex('#fff6c8'),
  tower: hex('#f2efe8'),
  towerRed: hex('#c8473c'),
  tip: hex('#ffc2e0'),
  tipBright: hex('#fff4fb'),
};
const P = {
  LV: ['#74cfdc', '#5ec0d7', '#4caecf', '#3e9bc5', '#3489ba', '#2c78ad', '#25679f'].map(hex),
  FOAM: hex('#f6fdff'),
  FOAM2: hex('#c4ecf2'),
  GLINT: hex('#ffffff'),
  GLINT2: hex('#dff8ff'),
  WEED: hex('#2f7db0'),
  WEED2: hex('#3487b6'),
  SAND: ['#e2d3a0', '#bfd0a6', '#8cc2b4'].map(hex),
};
const PR = {
  ...P,
  LV: ['#9ee6dc', '#86d9d6', '#6fcad0', '#5cb8c8', '#4ea6bf', '#4494b4', '#3b83a8'].map(hex),
  WEED: hex('#4a9a8a'),
  WEED2: hex('#58a890'),
};
const GREYS = ['#16182a', '#2a2b3c', '#40404e', '#575562', '#706c76', '#8b8690', '#a7a1a8', '#c7c1c1', '#ebe5d6'].map(
  hex,
);
const greyOf = (v, x, y) => GREYS[clamp(Math.floor(v * 8 + bayerThreshold(x, y)), 0, 8)];
const CLAY = ['#7e7a74', '#8f8a82', '#a09a90', '#b0a99e', '#bfb8ac', '#cdc6ba', '#dbd5ca'].map(hex);
// markers: pixels a sprite draws that light up after dark (alpha 0xFE, so they never pass for a colour)
const MARK = { win: 1, lamp: 2, tip: 3, beacon: 4, fire: 5 };
const marker = (type, id = 0) => (0xfe000000 | (type << 16) | id) >>> 0;
const MARK_DAY = [0, C.glass, C.pole, hex('#f3a9c8'), C.beacon, C.fire[1]];

// ---------------------------------------------------------------------------------------------------- the land
const n = W * GH,
  at = (x, y) => y * W + x;
const E = new Float32Array(n),
  LEV = new Int8Array(n),
  MO = new Float32Array(n),
  FO = new Float32Array(n),
  GR = new Float32Array(n),
  OCT = [0, 1, 2, 3].map(() => new Float32Array(n));
for (let y = 0; y < GH; y++)
  for (let x = 0; x < W; x++) {
    const i = at(x, y),
      tx = (x - W / 2) * Z + N / 2,
      ty = (y - H / 2) * Z + N / 2;
    E[i] = islandHeight(tx, ty, N, SEED, { long: true, rough: ROUGH });
    // the noise islandHeight starts from, with one octave, two, three and four (as islandHeight lifts it)
    for (let k = 0; k < 4; k++)
      OCT[k][i] = clamp(fractalNoise(tx / (N * 0.28), ty / (N * 0.28), SEED % 9973, k + 1, ROUGH) * 1.25 - 0.1);
    MO[i] = fractalNoise(x / 70, y / 70, SEED + 3, 3);
    FO[i] = fractalNoise(x / 38, y / 38, SEED + 5, 3);
    GR[i] = latticeRandom(x, y, SEED);
  }
const sorted = E.slice(0, W * H).sort(),
  CUT = sorted[Math.floor(sorted.length * (1 - LAND))];
// a terrace's height, so that the summit (the top terrace) is the highest thirtieth of the land
const landE = sorted.filter((e) => e >= CUT),
  STEP = (landE[Math.floor(landE.length * 0.97)] - CUT) / (LEVELS - 1);
for (let i = 0; i < n; i++) LEV[i] = E[i] < CUT ? -1 : terraceLevel(E[i] - CUT, STEP, LEVELS);
// specks of land too small to stand on (a few pixels of sand) go back under the sea
const PATCH = new Int32Array(n).fill(-1); // which piece of land a pixel is on
{
  let patches = 0;
  for (let i = 0; i < n; i++) {
    if (LEV[i] < 0 || PATCH[i] >= 0) continue;
    const patch = floodFill(
      i,
      (j) => j,
      (j) => [j - 1, j + 1, j - W, j + W].filter((k) => k >= 0 && k < n && LEV[k] >= 0 && Math.abs((k % W) - (j % W)) <= 1),
    );
    for (const j of patch) PATCH[j] = patches;
    patches++;
    if (patch.size < 40) for (const j of patch) (LEV[j] = -1), (E[j] = CUT - 0.002), (PATCH[j] = -1);
  }
}
const lev = (x, y) => (x < 0 || y < 0 || x >= W || y >= GH ? -1 : LEV[at(x, y)]);
const mask = (f) => Uint8Array.from({ length: n }, (_, i) => (f(i) ? 1 : 0));
// distances in thirds of a pixel: the sea from the land, the land from the sea, anything from a beach
const D_SEA = chamferDistance(
    mask((i) => LEV[i] < 0),
    W,
    GH,
  ),
  D_LAND = chamferDistance(
    mask((i) => LEV[i] >= 0),
    W,
    GH,
  ),
  D_BEACH = chamferDistance(
    mask((i) => LEV[i] !== 0),
    W,
    GH,
  );
let peak = 0;
for (let i = 0; i < W * H; i++) if (E[i] > E[peak]) peak = i;
const PEAK = [peak % W, (peak / W) | 0];

// the river: where windingRiver runs over land, from its highest point down, a ring of pixels at a time
const RIV = new Uint8Array(n),
  RIV_T = new Float32Array(n).fill(1e9);
{
  const cand = mask((i) => LEV[i] >= 0 && windingRiver(i % W, (i / W) | 0, SEED, 0.06).depth > 0);
  let src = -1;
  for (let i = 0; i < n; i++) if (cand[i] && (src < 0 || E[i] > E[src])) src = i;
  const ord = new Int16Array(n).fill(-1);
  let front = src >= 0 ? [src] : [],
    pass = 0;
  if (src >= 0) ord[src] = 0;
  untilSettled(() => {
    pass++;
    const next = [];
    for (const i of front)
      for (const j of [i - 1, i + 1, i - W, i + W])
        if (j >= 0 && j < n && cand[j] && ord[j] < 0) {
          ord[j] = pass;
          next.push(j);
        }
    front = next;
    return next.length > 0;
  });
  for (let i = 0; i < n; i++)
    if (ord[i] >= 0) {
      RIV[i] = 1;
      RIV_T[i] = T.river[0] + (ord[i] / pass) * 0.85 * (T.river[1] - T.river[0]);
    }
}
const D_RIV = chamferDistance(RIV, W, GH), // in the river: how far from its bank
  D_TO_RIV = chamferDistance(
    mask((i) => !RIV[i]),
    W,
    GH,
  ); // out of it: how far from its water

// the main island: the piece of land the peak is on (the islets are not)
const onMain = (x, y) => PATCH[at(clamp(x, 0, W - 1), clamp(y, 0, GH - 1))] === PATCH[peak];

// ---------------------------------------------------------------------------------------------------- villages
const RES = new Uint8Array(n); // what is already there: 1 house, 2 square, 3 field, 4 road
const rng = new SeededRandom(SEED);
function flatness(x, y, r) {
  const L = lev(x, y);
  let same = 0,
    all = 0;
  for (let dy = -r; dy <= r; dy += 2)
    for (let dx = -r; dx <= r; dx += 2) {
      if (dx * dx + dy * dy > r * r) continue;
      all++;
      if (lev(x + dx, y + dy) === L && !RIV[at(clamp(x + dx, 0, W - 1), clamp(y + dy, 0, GH - 1))]) same++;
    }
  return same / all;
}
const sites = [];
for (let y = 24; y < H - 24; y += 4)
  for (let x = 24; x < W - 24; x += 4) {
    const i = at(x, y),
      L = LEV[i];
    if (L < 1 || L > 3 || !onMain(x, y) || D_TO_RIV[i] < 30) continue;
    const f = flatness(x, y, 15);
    if (f > 0.9) sites.push({ x, y, L, f, i });
  }
const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const harbourSite = sites.filter((s) => s.L === 1).sort((a, b) => D_BEACH[a.i] - D_BEACH[b.i])[0] || sites[0];
const hillSite =
  sites
    .filter((s) => s.L >= 2 && near(s, harbourSite) > 110)
    .sort((a, b) => Math.abs(D_TO_RIV[a.i] - 75) - Math.abs(D_TO_RIV[b.i] - 75))[0] ||
  sites.sort((a, b) => near(b, harbourSite) - near(a, harbourSite))[0];
const VILLAGES = [
  { ...harbourSite, name: 'harbour', styles: ['thatch', 'plank'], roofs: ['#caa35c', '#8d6b4b'], count: 8 },
  { ...hillSite, name: 'hill', styles: ['redtile', 'tile'], roofs: ['#bb5840', '#5c719c'], count: 8 },
];
const HOUSES = [];
VILLAGES.forEach((v, vi) => {
  for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) RES[at(v.x + dx, v.y + dy)] = 2; // the square
  const r = new SeededRandom(SEED + 101 * (vi + 1));
  for (let tries = 0, made = 0; tries < 1500 && made < v.count; tries++) {
    const a = r.range(0, Math.PI * 2),
      rad = r.range(8, 22 + tries / 60),
      w = r.int(8, 12),
      d = r.int(5, 7);
    const x0 = Math.round(v.x + Math.cos(a) * rad * 1.3 - w / 2),
      y0 = Math.round(v.y + Math.sin(a) * rad * 0.8 - d / 2),
      L = lev(x0, y0);
    let ok = L >= 1;
    for (let y = y0 - 2; ok && y <= y0 + d + 1; y++)
      for (let x = x0 - 2; ok && x <= x0 + w + 1; x++) {
        const i = at(clamp(x, 0, W - 1), clamp(y, 0, GH - 1));
        if (lev(x, y) !== L || RIV[i] || RES[i] || D_LAND[i] < 12 || D_TO_RIV[i] < 9) ok = false;
      }
    if (!ok) continue;
    for (let y = y0 - 1; y <= y0 + d; y++) for (let x = x0 - 1; x <= x0 + w; x++) RES[at(x, y)] = 1;
    const k = r.int(0, 1);
    HOUSES.push({
      id: HOUSES.length,
      v: vi,
      x0,
      y0,
      w,
      d,
      L,
      hw: r.int(4, 6),
      kind: r.pick(['gable', 'hip']),
      style: v.styles[k],
      roof: hex(v.roofs[k]),
      wall: r.chance(0.6) ? C.plaster : C.timber,
      door: r.int(1, w - 3),
      chimney: r.chance(0.45),
      born: T.village[0] + made * 0.11 + vi * 0.05,
    });
    made++;
  }
});

// fields round each village, in plots laid at an angle (plotGrid): crops, fallow and paddies, banks between
const FIELD = new Uint32Array(n),
  FIELD_T = new Float32Array(n).fill(1e9);
const CROPS = [C.wheat, C.greens, C.cabbage, C.paddy, C.fallow, 0, C.wheat, 0];
VILLAGES.forEach((v, vi) => {
  const ang = 0.35 + vi * 0.5,
    cs = Math.cos(ang),
    sn = Math.sin(ang);
  for (let y = v.y - 44; y <= v.y + 44; y++)
    for (let x = v.x - 60; x <= v.x + 60; x++) {
      if (x < 0 || y < 0 || x >= W || y >= GH) continue;
      const i = at(x, y),
        d = Math.hypot((x - v.x) * 0.8, y - v.y);
      if (d < 15 || d > 30 + 12 * FO[i] || LEV[i] !== v.L || RIV[i] || RES[i] || D_TO_RIV[i] < 6 || D_LAND[i] < 15)
        continue;
      const p = plotGrid(x - v.x, y - v.y, 7, ang),
        crop = CROPS[latticeHash(p.iu, p.iv, SEED) & 7];
      if (!crop) continue;
      const u = (x - v.x) * cs + (y - v.y) * sn;
      let c;
      if (p.edge < 0.9) c = C.bank;
      else if (crop === C.paddy) c = (x + 2 * y) % 4 === 0 ? C.sprout : crop;
      else c = Math.floor(u) & 1 ? tone(crop, -1) : crop;
      FIELD[i] = c;
      FIELD_T[i] = T.village[0] + 0.35 + (d / 40) * 0.6;
      RES[i] = 3;
    }
});

// ---------------------------------------------------------------------------------------------------- roads
// a grid of three-pixel cells: open where it is land and no house, and where the terraces round it differ by one at most
// (so a road climbs one terrace at a time, and winds to find where it can)
const PC = 3;
function cellFree(cx, cy) {
  const x = cx * PC + 1,
    y = cy * PC + 1;
  if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return false;
  const i = at(x, y);
  if (LEV[i] < 0 || RES[i] === 1) return false;
  let lo = 9,
    hi = -9;
  for (let dy = -3; dy <= 3; dy += 3)
    for (let dx = -3; dx <= 3; dx += 3) {
      const L = lev(x + dx, y + dy);
      lo = Math.min(lo, L);
      hi = Math.max(hi, L);
    }
  return hi - lo <= 1;
}
const toCell = (x, y) => nearestFreeCell(Math.round((x - 1) / PC), Math.round((y - 1) / PC), cellFree, 20);
// a landing on the beach below the harbour
let pier = null;
for (let r = 4; r < 90 && !pier; r += 2)
  for (let a = 0; a < 64 && !pier; a++) {
    const x = Math.round(harbourSite.x + Math.cos((a / 64) * Math.PI * 2) * r),
      y = Math.round(harbourSite.y + Math.sin((a / 64) * Math.PI * 2) * r);
    if (lev(x, y) === 0 && D_LAND[at(x, y)] <= 6 && D_LAND[at(x, y)] >= 3) pier = { x, y };
  }
// and a jetty from it out over the water: planks (roofTexel's boards) toward where the sea deepens fastest
const PIER = new Uint32Array(n);
let pierEnd = null;
if (pier) {
  let best = -1,
    dir = [0, 1];
  for (let a = 0; a < 16; a++) {
    const dx = Math.cos((a / 16) * Math.PI * 2),
      dy = Math.sin((a / 16) * Math.PI * 2),
      x = Math.round(pier.x + dx * 14),
      y = Math.round(pier.y + dy * 14);
    if (x >= 0 && y >= 0 && x < W && y < H && LEV[at(x, y)] < 0 && D_SEA[at(x, y)] > best)
      ((best = D_SEA[at(x, y)]), (dir = [dx, dy]));
  }
  const x0 = pier.x,
    y0 = pier.y;
  for (let k = 0; k <= 16; k++) {
    const x = Math.round(pier.x + dir[0] * k),
      y = Math.round(pier.y + dir[1] * k);
    for (const [ox, oy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const i = at(x + ox, y + oy);
      if (LEV[i] >= 0) continue;
      const tex = roofTexel('plank', x + ox, y + oy, x0, y0);
      PIER[i] = tex === 'edge' || tex === 'deep' ? tone(C.plank, -1) : tex === 'lit' ? tone(C.plank, 1) : C.plank;
    }
    pierEnd = { x, y, dir };
  }
}
const ROUTES = [
  [VILLAGES[0], VILLAGES[1]],
  [VILLAGES[1], { x: PEAK[0], y: PEAK[1] + 6 }],
  ...(pier ? [[VILLAGES[0], pier]] : []),
];
const PATH = new Uint32Array(n),
  PATH_T = new Float32Array(n).fill(1e9),
  ROADS = []; // each road as the pixels along it, in order
ROUTES.forEach(([a, b], ri) => {
  const ca = toCell(a.x, a.y),
    cb = toCell(b.x, b.y),
    cells = ca && cb && gridAStar(ca, cb, { free: cellFree, budget: 60000 });
  if (!cells) return;
  const pts = cells.map(([cx, cy], k) => [
    cx * PC + 1 + Math.round((noiseLine(k * 0.3, SEED + ri) - 0.5) * 2.4),
    cy * PC + 1 + Math.round((noiseLine(k * 0.3 + 50, SEED + ri) - 0.5) * 2.4),
  ]);
  const line = [];
  for (let k = 1; k < pts.length; k++)
    lineCells(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], (x, y) => {
      const last = line[line.length - 1];
      if (!last || last[0] !== x || last[1] !== y) line.push([x, y]);
    });
  line.forEach(([x, y], k) => {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
    ]) {
      const i = at(x + dx, y + dy);
      if (LEV[i] < 0) continue;
      PATH[i] = GR[i] < 0.2 ? tone(C.dirt, -1) : GR[i] > 0.85 ? tone(C.dirt, 1) : C.dirt;
      PATH_T[i] = Math.min(PATH_T[i], T.roads[0] + ri * 0.12 + (k / line.length) * 0.75);
    }
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) if (!RES[at(x + dx, y + dy)]) RES[at(x + dx, y + dy)] = 4;
  });
  ROADS.push(line);
});
// lanterns along the roads, every so often (scatterAlong), a step to the side
const LAMPS = [];
ROADS.forEach((line, ri) => {
  for (const s of scatterAlong(6, line.length - 6, 26, SEED + ri, { chance: 0.85 })) {
    const k = clamp(Math.round(s.x), 1, line.length - 2),
      [x, y] = line[k],
      dx = line[k + 1][0] - line[k - 1][0],
      dy = line[k + 1][1] - line[k - 1][1],
      side = s.variant & 1 ? 1 : -1,
      l = Math.hypot(dx, dy) || 1,
      lx = Math.round(x - (dy / l) * 3 * side),
      ly = Math.round(y + (dx / l) * 3 * side);
    if (lev(lx, ly) >= 0 && !RIV[at(lx, ly)]) LAMPS.push({ x: lx, y: ly, born: PATH_T[at(x, y)] });
  }
});

// ---------------------------------------------------------------------------------------------------- the forest
const TREES = [];
const LEAVES = {
  meadow: ['#2f6b35', '#4d9a43', '#78c25a', '#a8df7c'],
  wood: ['#24532f', '#3b7d3c', '#5aa148', '#86c767'],
  pine: ['#1d4433', '#2e6444', '#468556', '#6aa874'],
  blossom: ['#7a4a6a', '#c9739c', '#f0a3c3', '#ffd6e6'],
};
for (const k of Object.keys(LEAVES)) LEAVES[k] = LEAVES[k].map(hex);
for (let gy = 0; gy < GH / 6; gy++)
  for (let gx = 0; gx < W / 6; gx++) {
    const id = gy * 97 + gx,
      x = Math.round(gx * 6 + indexRandom(id, SEED + 1) * 5),
      y = Math.round(gy * 6 + indexRandom(id, SEED + 2) * 5);
    if (x < 2 || x >= W - 2 || y < 4 || y >= GH - 1) continue;
    const i = at(x, y),
      L = LEV[i],
      f = FO[i];
    if (L < 1 || RES[i] || D_TO_RIV[i] < 7 || D_LAND[i] < 9 || lev(x, y + 1) !== L) continue;
    const p =
      L <= 2 ? (f > 0.56 ? 0.75 : 0.06) : L <= 4 ? (f > 0.44 ? 0.88 : 0.22) : L === 5 ? (f > 0.45 ? 0.55 : 0.1) : 0.12;
    if (indexRandom(id, SEED + 3) > p) continue;
    const blossom = L <= 2 && indexRandom(id, SEED + 4) < 0.18,
      cone = L >= 5 || (L >= 3 && indexRandom(id, SEED + 5) < 0.4);
    TREES.push({
      id: TREES.length,
      x,
      y,
      L,
      kind: cone ? 'cone' : 'round',
      seed: SEED * 7 + id,
      leaf: blossom ? LEAVES.blossom : cone ? LEAVES.pine : L <= 2 ? LEAVES.meadow : LEAVES.wood,
      size: 0.72 + indexRandom(id, SEED + 6) * 0.45,
      lean: Math.round((indexRandom(id, SEED + 7) - 0.5) * 2),
      phase: indexRandom(id, SEED + 8) * 6.28,
      order: 1 - f + indexRandom(id, SEED + 9) * 0.25,
    });
  }
{
  const byOrder = [...TREES].sort((a, b) => a.order - b.order);
  byOrder.forEach((tr, k) => (tr.born = T.forest[0] + (k / byOrder.length) * 1.0));
}
// palms on the beaches, reeds along the river, and one great tree on the summit
const PALMS = [];
for (let gy = 0; gy < GH / 9; gy++)
  for (let gx = 0; gx < W / 9; gx++) {
    const id = gy * 61 + gx,
      x = Math.round(gx * 9 + indexRandom(id, SEED + 11) * 8),
      y = Math.round(gy * 9 + indexRandom(id, SEED + 12) * 8),
      i = at(clamp(x, 0, W - 1), clamp(y, 0, GH - 1));
    if (lev(x, y) !== 0 || D_LAND[i] < 5 || RES[i] || indexRandom(id, SEED + 13) > 0.45 || PALMS.length > 11) continue;
    PALMS.push({
      x,
      y,
      lean: indexRandom(id, SEED + 14) < 0.5 ? -3 : 3,
      born: T.forest[0] + 0.3 + indexRandom(id, SEED + 15) * 0.8,
      id,
    });
  }
const REEDS = [];
for (let i = 0; i < W * H; i++) {
  if (
    !RIV[i] &&
    LEV[i] >= 1 &&
    D_TO_RIV[i] >= 3 &&
    D_TO_RIV[i] <= 5 &&
    !RES[i] &&
    latticeHash(i % W, (i / W) | 0, SEED) % 13 === 0
  )
    REEDS.push({ x: i % W, y: (i / W) | 0, id: REEDS.length, born: RIV_T[i] || T.river[1] });
}
for (const r of REEDS) r.born = T.forest[0] + 0.2 + indexRandom(r.id, SEED + 16) * 0.8;
const SUMMIT = { x: PEAK[0], y: PEAK[1], born: T.forest[0] + 0.9 };

// a lighthouse on the highest islet (or, without one, on the headland furthest from the summit)
let LIGHT = null;
for (let i = 0; i < W * H; i++) {
  const x = i % W,
    y = (i / W) | 0;
  if (LEV[i] < 0 || D_LAND[i] < 7 || onMain(x, y) || y < 12 || x < 6 || x > W - 6) continue;
  if (!LIGHT || E[i] > E[at(LIGHT.x, LIGHT.y)]) LIGHT = { x, y };
}
if (!LIGHT) {
  let best = -1;
  for (let i = 0; i < W * H; i++)
    if (LEV[i] >= 0 && D_LAND[i] < 18 && D_LAND[i] > 9 && !RES[i] && (i / W) | 0 > 14 && i % W > 8 && i % W < W - 8) {
      const d = Math.hypot((i % W) - PEAK[0], ((i / W) | 0) - PEAK[1]);
      if (d > best) ((best = d), (LIGHT = { x: i % W, y: (i / W) | 0 }));
    }
}

// ---------------------------------------------------------------------------------------------------- sprites
const SPRING = []; // a pop that overshoots and settles: a damped spring's way from 0 to 1, sampled each frame
{
  let x = 0,
    v = 0;
  for (let f = 0; f < FPS * 3; f++) {
    SPRING.push(x);
    for (let s = 0; s < 3; s++) [x, v] = dampedSpring(x, v, 1, 150, 12, 1 / (FPS * 3));
  }
}
const springAt = (age) => (age <= 0 ? 0 : SPRING[Math.min(SPRING.length - 1, Math.floor(age * FPS))]);
const cache = stampCache(6000);
const buffer = (w, h) => ({ w, h, px: new Uint32Array(w * h) });
const trim = (r, ax, ay) => {
  const b = drawnBounds(r);
  return b ? cutSprite(r, b[0], b[1], b[2], b[3], ax, ay) : null;
};

function buildTree(tr, k) {
  const r = buffer(34, 44),
    ax = 17,
    ay = 41,
    rnd = new SeededRandom(tr.seed),
    s = tr.size * k;
  if (s < 0.2) {
    r.px[at0(r, ax, ay)] = tr.leaf[2];
    r.px[at0(r, ax, ay - 1)] = tr.leaf[3];
  } else if (tr.kind === 'round') {
    const rx = 2.4 + 4 * s,
      ry = rx * 0.84,
      th = Math.max(1, Math.round(1 + 3.2 * s)),
      cy = ay - th - ry * 0.8;
    barkTrunk(r, ax, cy + ry * 0.3, ay, s > 0.55 ? 2 : 1, C.bark, tr.lean);
    leafCrown(
      r,
      rnd,
      ax + tr.lean,
      cy,
      rx,
      ry,
      tr.leaf,
      tr.leaf === LEAVES.blossom ? { bloom: hex('#fff0f6'), bloomEvery: 7, seed: tr.seed } : {},
    );
  } else {
    const th = Math.max(1, Math.round(1 + 2 * s));
    barkTrunk(r, ax, ay - th - 6 * s, ay, 1, C.bark, 0);
    for (let j = 0; j < 3; j++) {
      const rx = (3.6 - j * 1.05) * (0.45 + s * 0.62);
      leafCrown(r, rnd, ax, ay - th - rx * 0.55 - j * 4 * (0.45 + s * 0.55), rx, rx * 0.72, tr.leaf, { clumps: 4 });
    }
  }
  outlinePass(r, C.inkTree);
  const sp = trim(r, ax, ay);
  sp.trunk = 2 + Math.round(3 * s);
  return sp;
}
function at0(r, x, y) {
  return y * r.w + x;
}
// a palm: a leaning trunk and fronds that sway from its crown (swayingChain), each a line of leaves
function drawPalm(layer, p, sx, sy, t, k, wind) {
  const r = buffer(30, 30),
    ax = 15,
    ay = 27,
    h = Math.round(13 * k);
  if (h < 2) return;
  barkTrunk(r, ax, ay - h, ay, 1, [hex('#7a5a3a'), hex('#a8845a')], p.lean * k);
  const cx = ax + Math.round(p.lean * k),
    cy = ay - h;
  for (let f = 0; f < 6; f++) {
    const ang = -2.6 + f * 1.05,
      pts = swayingChain(
        cx,
        cy,
        { segments: 4, length: 7 * k, sway: 0.25 + 0.2 * wind, speed: 2.2, lean: ang },
        1,
        t,
        f + p.id,
      );
    for (let j = 1; j < pts.length; j++)
      lineCells(pts[j - 1][0], pts[j - 1][1] + j * 0.6, pts[j][0], pts[j][1] + j * 0.9, (x, y) => {
        if (x >= 0 && y >= 0 && x < r.w && y < r.h)
          r.px[y * r.w + x] = j < 2 ? LEAVES.meadow[3] : j < 4 ? LEAVES.meadow[2] : LEAVES.meadow[1];
      });
  }
  r.px[cy * r.w + cx] = hex('#6b4a2a');
  outlinePass(r, C.inkTree);
  blitSprite(layer, { ...r, ax, ay }, sx, sy);
}
// the summit's great tree: a branching trunk (branchingTree), blossom at its tips that glows after dark
const SUMMIT_TREE = (() => {
  const r = buffer(60, 56),
    ax = 30,
    ay = 53,
    rnd = new SeededRandom(SEED + 77);
  const tree = branchingTree(
    ax,
    ay,
    { levels: 5, forks: 2, spread: 0.62, decay: 0.74, length: 11, width: 3.4 },
    1,
    rnd,
  );
  for (const s of tree.segments)
    capsuleSteps(s.x0, s.y0, s.width / 2, s.x1, s.y1, (s.width * 0.74) / 2, (x, y, rr) =>
      fillEllipse(r, x, y, rr, rr, s.level > 3 ? C.bark[0] : C.bark[1]),
    );
  tree.tips.forEach(([x, y], k) => {
    leafCrown(r, rnd, x, y, 3.4, 2.8, LEAVES.blossom, { clumps: 3, bloom: hex('#fff0f6'), bloomEvery: 6, seed: k });
    r.px[Math.round(y) * r.w + Math.round(x)] = marker(MARK.tip, k);
  });
  outlinePass(r, C.inkTree);
  const sp = trim(r, ax, ay);
  sp.tips = tree.tips.map(([x, y]) => [x - ax, y - ay]);
  return sp;
})();

// a house: its roof seen from above (roofPlan, its covering by roofTexel, its near slope by slopeShade), and its front
// wall below, with a door and windows that light after dark
function buildHouse(h, hw) {
  const w = h.w,
    d = h.d,
    r = buffer(w + 6, d + hw + 6),
    ax = (w >> 1) + 3,
    ay = d + hw + 3,
    by = ay - hw; // the roof's south eave (the wall's top)
  const plan = roofPlan(h.kind, w, d, 1, ax, by),
    { x0, x1, yN, yS, yR, inset } = plan;
  const TEX = { seam: -1, mortar: 1, lit: 1, shaded: -1, edge: -1, deep: -2, glow: 1, dim: -1 };
  for (let y = yN; y <= yS; y++)
    for (let x = x0; x <= x1; x++) {
      let facet = y < yR ? 'n' : 's';
      if (h.kind === 'hip') {
        const dw = (x - x0) / Math.max(1, inset),
          de = (x1 - x) / Math.max(1, inset),
          dn = (y - yN) / Math.max(1, yR - yN),
          ds = (yS - y) / Math.max(1, yS - yR),
          m = Math.min(dw, de, dn, ds);
        facet = m === dw ? 'w' : m === de ? 'e' : m === dn ? 'n' : 's';
      }
      let k = facet === 'n' ? 1 : facet === 'w' ? 0 : facet === 'e' ? -1 : 0;
      const tex = roofTexel(h.style, x, y, x0, facet === 'n' ? yN : yR);
      if (tex) k += TEX[tex];
      if (facet === 's') {
        const sh = slopeShade(y, yR, yS);
        if (sh === 'eave') k -= 1;
        else if (sh === 'ridge') k += 1;
      }
      if (y === yR && facet !== 'e') k = 2;
      r.px[y * r.w + x] = tone(h.roof, clamp(k, -2, 2));
    }
  if (h.chimney)
    for (let y = yN + 1; y <= yN + 3; y++)
      for (let x = x1 - 4; x <= x1 - 3; x++) r.px[y * r.w + x] = y === yN + 1 ? tone(C.stone, 1) : C.stone;
  for (let y = by + 1; y <= ay; y++)
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      const u = x - x0 - 1,
        row = y - by - 1;
      let c = row === 0 ? tone(h.wall, -2) : u === 0 || u === w - 1 ? tone(h.wall, -1) : h.wall;
      const pane = (u === 1 || u === 2 || u === w - 3 || u === w - 2) && (u < h.door - 1 || u > h.door + 2);
      if (u >= h.door && u <= h.door + 1 && row >= hw - 3) c = row === hw - 3 ? tone(C.door, -1) : C.door;
      else if (hw >= 4 && row >= 1 && row <= Math.min(2, hw - 3) && pane) c = marker(MARK.win, h.id);
      r.px[y * r.w + x] = c;
    }
  outlinePass(r, C.ink);
  return { ...r, ax, ay, roofTop: yN - ay, chimney: [x1 - 3.5 - ax, yN + 1 - ay] };
}
// a villager: legs that step (footStep, in a two-legged gait), a shirt and trousers from a coat, a head, perhaps a hat
const PEOPLE_GENES = {
  skin: ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3a'],
  hair: ['#2b1d14', '#5a3a22', '#c9a26a', '#d8d2c8', '#1e1a1a'],
  hat: { chance: 0.35 },
  speed: [7, 11],
  stride: [0.9, 1.3],
};
function buildPerson(p, lA, lB) {
  const r = buffer(9, 12),
    ax = 4,
    ay = 10,
    g = p.g;
  const legs = [
    [3, lA],
    [5, lB],
  ];
  for (const [x, l] of legs) for (let y = 8; y <= 9 - l; y++) r.px[y * r.w + x] = g.trousers;
  for (let y = 5; y <= 7; y++) for (let x = 3; x <= 5; x++) r.px[y * r.w + x] = x === 5 ? tone(g.shirt, -1) : g.shirt;
  r.px[6 * r.w + 2] = tone(g.shirt, -1);
  r.px[6 * r.w + 6] = tone(g.shirt, -1);
  for (let y = 2; y <= 4; y++) for (let x = 3; x <= 5; x++) r.px[y * r.w + x] = y === 2 ? g.hairC : g.skinC;
  if (g.hat) {
    for (let x = 2; x <= 6; x++) r.px[2 * r.w + x] = hex('#e0c068');
    r.px[1 * r.w + 4] = hex('#c9a24a');
    r.px[1 * r.w + 3] = hex('#e0c068');
    r.px[1 * r.w + 5] = hex('#e0c068');
  }
  outlinePass(r, C.ink);
  return { ...r, ax, ay };
}
// a deer seen from above and in front: a body and head of ellipses, four legs in a walking gait, a coat from its genes
const DEER_KIND = { size: [0.85, 1.1], antlers: { chance: 0.4 }, hue: [24, 36], gait: 'walk', fawn: false };
function buildDeer(d, phase, grazing) {
  const r = buffer(17, 13),
    ax = 8,
    ay = 10,
    g = d.g,
    s = g.size * (g.fawn ? 0.72 : 1);
  const timing = gaitTiming(g.gait);
  [
    [5.5, timing[1]],
    [10.5, timing[0]],
  ].forEach(([hx, pair]) =>
    [pair.far, pair.near].forEach((off, side) => {
      const st = footStep(phase + off, 0.9, 1),
        x = Math.round(hx + st.x * s + side - 0.5);
      for (let y = 7; y <= 9 - (st.y > 0.5 ? 1 : 0); y++)
        r.px[y * r.w + x] = side ? g.coat.back : tone(g.coat.back, -1);
    }),
  );
  fillEllipse(r, 8, 5.5, 3.6 * s, 1.9 * s, g.coat.back);
  fillEllipse(r, 8, 6.5, 2.6 * s, 0.7, g.coat.belly);
  const hy = grazing ? 7 : 3.4;
  fillEllipse(r, 8 + 4.1 * s, hy, 1.5, 1.3, tone(g.coat.back, 1));
  r.px[Math.round(hy - 1.6) * r.w + Math.round(8 + 3.6 * s)] = g.coat.back;
  if (g.antlers && !grazing) {
    r.px[Math.round(hy - 2.4) * r.w + Math.round(8 + 3.4 * s)] = hex('#d8c09a');
    r.px[Math.round(hy - 3.2) * r.w + Math.round(8 + 3 * s)] = hex('#d8c09a');
  }
  r.px[4 * r.w + Math.round(8 - 3.8 * s)] = g.coat.belly;
  for (const sp of g.spots) r.px[Math.round(5 + sp.dy) * r.w + Math.round(8 + (sp.at - 2) * 1.3)] = hex('#f4ead8');
  outlinePass(r, C.ink);
  return { ...r, ax, ay };
}
const GULL = [
  spriteFromRows(['#...#', '.#.#.', '..#..'], () => C.gull, { outline: false }),
  spriteFromRows(['.....', '##.##', '..#..'], () => C.gull, { outline: false }),
];
const BOAT = (() => {
  const grid = Array.from({ length: 8 }, () => [...'.........']);
  layTemplate(grid, ['....m....', '...sm....', '..ssm....', '.sssm....', 'sssssm...'], 0); // the sail and the mast
  layTemplate(grid, ['.hhhhhhh.', '..hhhhh..'], 5); // the hull, laid under them
  const pal = { m: hex('#6b4a2a'), s: C.sail, h: C.hull };
  return spriteFromRows(
    grid.map((r) => r.join('')),
    (ch) => pal[ch],
    { ink: C.ink },
  );
})();
const TOWER = spriteFromRows(
  ['.bbb.', '.rrr.', '.www.', '.rrr.', '.www.', '.rrr.', 'sssss'],
  (ch) => (ch === 'b' ? marker(MARK.beacon) : ch === 'r' ? C.towerRed : ch === 'w' ? C.tower : C.stone),
  { ink: C.ink },
);
const HEN = [
  spriteFromRows(
    ['.r.', 'wwo', 'ww.'],
    (ch) => (ch === 'r' ? hex('#d8402e') : ch === 'o' ? hex('#e8a03a') : hex('#f7f2e6')),
    { ink: C.ink },
  ),
  spriteFromRows(['...', 'ww.', 'wwo'], (ch) => (ch === 'o' ? hex('#e8a03a') : hex('#f7f2e6')), { ink: C.ink }),
];
const POST = spriteFromRows(['l', 'p', 'p', 'p'], (ch) => (ch === 'l' ? marker(MARK.lamp) : C.pole), { ink: C.ink });

// ---------------------------------------------------------------------------------------------------- life
const sim = { f: -1 };
function startLife() {
  const r = new SeededRandom(SEED + 5);
  sim.people = [];
  ROADS.forEach((line, ri) => {
    for (let k = 0; k < (ri === 0 ? 4 : 2); k++) {
      const g = genomeFrom(PEOPLE_GENES, r),
        coat = coatColours(r, { hue: [r.range(0, 360), 40] }, { s: [0.35, 0.65], l: [0.4, 0.58] });
      g.shirt = coat.back;
      g.trousers = tone(coat.accent, -1);
      g.skinC = hex(g.skin);
      g.hairC = hex(g.hair);
      sim.people.push({
        id: sim.people.length,
        line,
        s: r.range(0, line.length - 1),
        dir: r.sign(),
        g,
        phase: 0,
        wait: 0,
        born: T.life[0] + k * 0.25 + ri * 0.1,
      });
    }
  });
  // a herd: grown from its kind's ranges, and a fawn crossed from two of them
  const meadow = deerMeadow(),
    herd = [];
  for (let k = 0; k < 4; k++) {
    const g = genomeFrom(DEER_KIND, r);
    g.coat = coatColours(r, { hue: [g.hue, 8] }, { s: [0.35, 0.5], l: [0.4, 0.5] });
    g.spots = [];
    herd.push(g);
  }
  const fawn = crossGenomes(herd[0], herd[1], DEER_KIND, r, 0.1);
  fawn.fawn = true;
  fawn.antlers = false;
  fawn.coat = coatColours(r, { hue: [fawn.hue, 8] }, { s: [0.4, 0.5], l: [0.45, 0.52] });
  fawn.spots = bodySpots(r, 1, 3, 4);
  herd.push(fawn);
  sim.deer = herd.map((g, k) => ({
    x: meadow.x + r.range(-10, 10),
    y: meadow.y + r.range(-6, 6),
    vx: r.range(-1, 1),
    vy: r.range(-1, 1),
    g,
    phase: 0,
    seed: k,
    fear: 0,
  }));
  sim.meadow = meadow;
  // fish in the bay, and a whale in the deep they keep away from
  const bay = seaPoint(harbourSite, 36, 70),
    deep = seaPoint({ x: W / 2, y: H / 2 }, 75, 999);
  sim.fish = Array.from({ length: 16 }, (_, k) => ({
    x: bay.x + r.range(-8, 8),
    y: bay.y + r.range(-5, 5),
    vx: r.range(-6, 6),
    vy: r.range(-4, 4),
    seed: k,
    speed: r.range(0.9, 1.1),
  }));
  sim.bay = bay;
  sim.whale = { deep, spine: Array.from({ length: 10 }, (_, k) => [deep.x - k * 3, deep.y]) };
  sim.birds = Array.from({ length: 7 }, (_, k) => ({ x: -40 - k * 6, y: 44, vx: 0, vy: 0 }));
  sim.butterflies = Array.from({ length: 6 }, (_, k) => ({
    x: meadow.x + r.range(-30, 30),
    y: meadow.y + r.range(-20, 20),
    a: r.range(0, 6.28),
    s: r.range(0, 500),
    seed: SEED + k,
  }));
  sim.boat = {
    centre: pierEnd
      ? { x: pierEnd.x + pierEnd.dir[0] * 16, y: pierEnd.y + pierEnd.dir[1] * 9 }
      : seaPoint(harbourSite, 45, 80),
  };
  // villagers milling about each square, and hens about the harbour's: walkers on a grid (gridWalk)
  sim.milling = [];
  VILLAGES.forEach((v, vi) => {
    const L = lev(v.x, v.y);
    for (let k = 0; k < 7; k++) {
      const g = genomeFrom(PEOPLE_GENES, r),
        coat = coatColours(r, { hue: [r.range(0, 360), 40] }, { s: [0.35, 0.65], l: [0.4, 0.58] });
      Object.assign(g, { shirt: coat.back, trousers: tone(coat.accent, -1), skinC: hex(g.skin), hairC: hex(g.hair) });
      const tx = Math.floor((v.x + r.range(-6, 6)) / 2),
        ty = Math.floor((v.y + r.range(-4, 4)) / 2);
      sim.milling.push({
        id: 100 + sim.milling.length,
        x: tx + 0.5,
        y: ty + 0.5,
        tx: tx + 0.5,
        ty: ty + 0.5,
        wait: r.range(0, 1),
        g,
        phase: 0,
        dir: 1,
        v,
        L,
        tile: 2,
        speed: 2.4,
        born: T.life[0] + k * 0.08,
      });
    }
  });
  for (let k = 0; k < 6; k++) {
    const v = VILLAGES[0],
      tx = Math.floor(v.x + r.range(-8, 8)),
      ty = Math.floor(v.y + r.range(-5, 5));
    sim.milling.push({
      id: 200 + k,
      hen: true,
      x: tx + 0.5,
      y: ty + 0.5,
      tx: tx + 0.5,
      ty: ty + 0.5,
      wait: 0,
      v,
      L: lev(v.x, v.y),
      tile: 1,
      speed: 5,
      born: T.life[0],
      dir: 1,
    });
  }
  sim.walkRandom = new SeededRandom(SEED + 31);
  sim.smoke = [];
  sim.embers = [];
  sim.rain = particleField(260, W, H, r);
  sim.flies = particleField(160, W, H, r).filter(
    (q) => lev(Math.round(q.x), Math.round(q.y)) >= 1 && !RES[at(Math.round(q.x), Math.round(q.y))],
  );
  const sq = VILLAGES[0];
  sim.lanterns = Array.from({ length: 22 }, (_, k) => {
    const v = VILLAGES[k % 2];
    return {
      x: v.x + r.range(-10, 10),
      y: v.y - 6 - v.L * LIFT,
      phase: r.range(0, 6),
      seed: k,
      speed: r.range(0.75, 1.25),
      born: T.night[0] - 0.3 + k * 0.09,
    };
  });
}
function deerMeadow() {
  let best = null;
  for (let y = 20; y < H - 20; y += 6)
    for (let x = 20; x < W - 20; x += 6) {
      if (lev(x, y) < 1 || lev(x, y) > 2 || RES[at(x, y)]) continue;
      let free = 0;
      for (let dy = -14; dy <= 14; dy += 4)
        for (let dx = -20; dx <= 20; dx += 4)
          if (lev(x + dx, y + dy) === lev(x, y) && !RES[at(x + dx, y + dy)] && !RIV[at(x + dx, y + dy)]) free++;
      const score = free - Math.abs(near({ x, y }, hillSite) - 60) * 0.2;
      if (!best || score > best.score) best = { x, y, score, L: lev(x, y) };
    }
  return best;
}
function seaPoint(from, dmin, dmax) {
  let best = null;
  for (let y = 8; y < H - 8; y += 3)
    for (let x = 8; x < W - 8; x += 3) {
      const d = D_SEA[at(x, y)];
      if (LEV[at(x, y)] >= 0 || d < dmin || d > dmax) continue;
      const s = near({ x, y }, from);
      if (!best || s < best.s) best = { x, y, s };
    }
  return best || { x: 20, y: H - 20 };
}
const inSea = (x, y, d = 9) =>
  x >= 2 &&
  y >= 2 &&
  x < W - 2 &&
  y < H - 2 &&
  LEV[at(Math.round(x), Math.round(y))] < 0 &&
  D_SEA[at(Math.round(x), Math.round(y))] >= d;
const onGround = (x, y, L) =>
  lev(Math.round(x), Math.round(y)) === L &&
  !RIV[at(Math.round(x), Math.round(y))] &&
  RES[at(Math.round(x), Math.round(y))] !== 1;

// the world a moment later
function step(t, dt) {
  if (t < T.life[0] - 0.05) return;
  if (!sim.people) startLife();
  for (const p of sim.people) {
    if (t < p.born) continue;
    if (p.wait > 0) p.wait -= dt;
    else {
      p.s += p.dir * p.g.speed * dt;
      p.phase += p.g.speed * dt * strideRate(p.g.stride);
      if (p.s <= 0 || p.s >= p.line.length - 1) {
        p.s = clamp(p.s, 0, p.line.length - 1);
        p.dir = -p.dir;
        p.wait = 0.6;
      }
    }
  }
  // the herd keeps together and wanders; when someone comes near, it runs from them
  const threats = sim.people.filter((p) => t >= p.born).map((p) => ({ ...pos(p), r: 26, hard: false }));
  const moved = flockStep(sim.deer, dt, {
    cohesion: 0.12,
    alignment: 0.25,
    separation: { within: 7, push: 8 },
    speed: [0, 6],
    wander: { t, rate: [0.31, 0.43], amount: [2.5, 2] },
  });
  sim.deer = moved.map((d, k) => {
    const old = sim.deer[k],
      fl = fleeVector(d.x, d.y, threats);
    let fear = Math.max(old.fear - dt, fl.fear);
    if (fl.fear) {
      d.vx += fl.x * 30 * dt;
      d.vy += fl.y * 30 * dt;
    }
    const sp = Math.hypot(d.vx, d.vy),
      max = fear > 0 ? 16 : 6;
    if (sp > max) ((d.vx *= max / sp), (d.vy *= max / sp));
    if (!onGround(d.x, d.y, sim.meadow.L) || near(d, sim.meadow) > 34) {
      d.x = old.x;
      d.y = old.y;
      d.vx = (sim.meadow.x - old.x) * 0.3;
      d.vy = (sim.meadow.y - old.y) * 0.3;
    }
    return { ...d, fear, phase: old.phase + Math.hypot(d.x - old.x, d.y - old.y) * strideRate(0.9), g: old.g };
  });
  // the whale's head swims a slow loop; its spine follows, each joint bending no more than a spine bends
  const wh = sim.whale,
    a = t * 0.35,
    head = [wh.deep.x + Math.cos(a) * 34, wh.deep.y + Math.sin(a * 1.3) * 9];
  wh.spine[0] = head;
  for (let k = 1; k < wh.spine.length; k++) {
    const [lx, ly] = wh.spine[k - 1],
      back =
        k > 1
          ? Math.atan2(wh.spine[k - 1][1] - wh.spine[k - 2][1], wh.spine[k - 1][0] - wh.spine[k - 2][0]) + Math.PI
          : Math.atan2(wh.spine[k][1] - ly, wh.spine[k][0] - lx);
    wh.spine[k] = followJoint(lx, ly, wh.spine[k][0], wh.spine[k][1], 3.2, back, 0.35);
  }
  for (let k = 0; k < sim.milling.length; k++) {
    const m = sim.milling[k];
    if (t < m.born) continue;
    const s = m.tile,
      reach = m.hen ? 16 : 22,
      next = gridWalk(m, dt, {
        speed: m.speed,
        random: sim.walkRandom,
        pause: m.hen ? { chance: 0.6, from: 0.2, to: 0.9 } : { chance: 0.35, from: 0.4, to: 1.6 },
        canStep: (fx, fy, x, y) => {
          const px = Math.round((x + 0.5) * s),
            py = Math.round((y + 0.5) * s),
            i = at(clamp(px, 0, W - 1), clamp(py, 0, GH - 1));
          return lev(px, py) === m.L && RES[i] !== 1 && !RIV[i] && Math.hypot(px - m.v.x, (py - m.v.y) * 1.4) < reach;
        },
      });
    next.phase = (m.phase || 0) + (next.moving ? m.speed * s * dt * strideRate(1.1) : 0);
    next.dir = next.dir || m.dir;
    sim.milling[k] = next;
  }
  const fishPrev = sim.fish;
  sim.fish = flockStep(sim.fish, dt, {
    cohesion: 0.5,
    alignment: 0.6,
    separation: { within: 4, push: 12 },
    speed: [7, 16],
    wander: { t, rate: [0.5, 0.7], amount: [6, 6] },
    ...(near({ x: head[0], y: head[1] }, sim.bay) < 60 ? { flee: { x: head[0], y: head[1], push: 22 } } : {}),
  }).map((f, k) => {
    if (inSea(f.x, f.y)) return f;
    const o = fishPrev[k];
    return { ...f, x: o.x, y: o.y, vx: (sim.bay.x - o.x) * 0.5, vy: (sim.bay.y - o.y) * 0.5 };
  });
  // gulls in a V: the leader crosses the sky, each other one steers to its place in the V on a spring
  const u = clamp((t - T.life[0]) / (T.dusk[1] - T.life[0])),
    lx = lerp(-30, W + 60, u),
    ly = 46 + Math.sin(u * 5) * 10,
    la = Math.atan2(Math.cos(u * 5) * 10 * 5, W + 90);
  sim.birds = sim.birds.map((b, k) => {
    const slot = k ? formationSlot('vee', lx, ly, la, k - 1) : { x: lx, y: ly };
    const [x, vx] = dampedSpring(b.x, b.vx, slot.x, 30, 8, dt),
      [y, vy] = dampedSpring(b.y, b.vy, slot.y, 30, 8, dt);
    return { x, y, vx, vy };
  });
  for (const b of sim.butterflies) {
    b.a = wanderingHeading(b.a, (b.s += 9 * dt), b.seed, 0, 0.25);
    const nx = b.x + Math.cos(b.a) * 9 * dt,
      ny = b.y + Math.sin(b.a) * 9 * dt;
    if (lev(Math.round(nx), Math.round(ny)) >= 1) ((b.x = nx), (b.y = ny));
    else b.a += Math.PI;
  }
  // chimney smoke and the fire's embers rise; rain falls through the storm; fireflies hang about
  for (const h of HOUSES)
    if (h.chimney && t > h.born + 0.5 && indexRandom(sim.f * 31 + h.id, SEED) < 0.3)
      sim.smoke.push({
        x: h.x0 + h.w - 3,
        y: h.y0 - h.hw - 1,
        z: 1,
        p: 0,
        s: indexRandom(h.id + sim.f, 9),
        L: h.L,
        age: 0,
      });
  sim.smoke = sim.smoke
    .map((q) => ({ ...rise(q, dt, { speed: 5, spread: 3, wind: 4, sway: [2, 2] }), L: q.L, age: q.age + dt }))
    .filter((q) => q.age < 2.6);
  if (t > T.dusk[0])
    for (let k = 0; k < 2; k++)
      sim.embers.push({
        x: hillSite.x + indexRandom(sim.f * 7 + k, 3) * 4 - 2,
        y: hillSite.y - 3,
        z: 1,
        p: 0,
        s: indexRandom(sim.f * 3 + k, 5),
        age: 0,
      });
  sim.embers = sim.embers
    .map((q) => ({ ...rise(q, dt, { speed: 9, spread: 8, wind: 2, sway: [3, 3] }), age: q.age + dt }))
    .filter((q) => q.age < 1.4);
  sim.rain = sim.rain.map((q) => wrapAround(fall(q, dt, { speed: 230, wind: -60 }), W, H, 8));
  sim.flies = sim.flies.map((q) => hover(q, dt, { x: [0.9, 5], y: [1.3, 4] }));
  sim.lanterns = sim.lanterns.map((l) =>
    t > l.born ? pulseRise(l, dt, t, { rate: 3, push: 42, sway: [0.6, 7] }) : l,
  );
}
function pos(p) {
  const k = clamp(Math.round(p.s), 0, p.line.length - 1);
  return { x: p.line[k][0], y: p.line[k][1] - 1 };
}

// ---------------------------------------------------------------------------------------------------- one frame
const FRAME = new Uint32Array(W * H),
  ZB = new Int16Array(W * H),
  WM = new Uint8Array(W * H), // what shows there: 1 sea, 2 river
  EM = new Uint8Array(W * H), // a marker that lights up after dark, and whose it is
  EMID = new Uint16Array(W * H);
const OUT = { w: W, h: H, px: FRAME },
  LAYER = buffer(W, H),
  LIFTS = new Int16Array(LEVELS + 1);
const LIGHTDIR = [-0.45, 0.89]; // where the light comes from: the upper left, a little toward us
const WALL_K = 1 + faceShade([0, 1], LIGHTDIR); // every wall faces south, toward us
const WALLS = {};
for (const [kind, base] of [
  ['earth', C.earth],
  ['stone', C.stone],
  ['snow', hex('#cfd8e1')],
  ['sand', hex('#c6a876')],
])
  WALLS[kind] = Array.from({ length: 256 }, (_, k) =>
    scalePacked(base, Math.min(1.08, wallShade(kind, k & 15, k >> 4)) * WALL_K),
  );
const wallKind = (L) => (L <= 3 ? 'earth' : L <= 5 ? 'stone' : 'snow');
let gradeScratch, cloudScratch, fogScratch;
const tables = new Map();

// a sprite stamped through the depth of the land: drawn on a layer, then kept where nothing nearer is in front of it
function stamp(z, sp, sx, sy, draw) {
  draw(LAYER);
  const x0 = Math.max(0, Math.round(sx) - sp.ax - 3),
    x1 = Math.min(W - 1, Math.round(sx) - sp.ax + sp.w + 3),
    y0 = Math.max(0, Math.round(sy) - sp.ay - 1),
    y1 = Math.min(H - 1, Math.round(sy) - sp.ay + sp.h + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
      const c = LAYER.px[i];
      if (!c) continue;
      LAYER.px[i] = 0;
      if (ZB[i] > z) continue;
      ZB[i] = z;
      if (c >>> 24 === 0xfe) {
        EM[i] = (c >>> 16) & 255;
        EMID[i] = c & 0xffff;
        FRAME[i] = MARK_DAY[EM[i]];
      } else {
        FRAME[i] = c;
        EM[i] = 0;
      }
    }
}
const ground = (x, y) => obliqueToScreen(x, y, LIFTS[Math.max(0, lev(Math.round(x), Math.round(y)))], 0, 0, 0);

function render(t) {
  const fr = Math.round(t * FPS);
  if (t < T.rise[0]) {
    // the seed's noise, an octave at a time, then shaped into an island: heights as greys
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++) {
        let v;
        if (t < T.seed[1]) {
          const u = Math.min(3, span('seed', t) * 3.6),
            k = Math.floor(u);
          v = OCT[Math.min(3, k + (bayerThreshold(x, y) < u - k ? 1 : 0))][i];
        } else v = lerp(OCT[3][i], E[i], smoothstep(0, 1, span('island', t)));
        FRAME[i] = greyOf(v, x, y);
        // and, as the island takes shape, its contours: where the terrace it will be changes
        if (
          t >= T.island[0] &&
          E[i] >= CUT &&
          x < W - 1 &&
          LEV[i] !== LEV[i + 1 + W] &&
          bayerThreshold(x, y) < span('island', t) * 1.4
        )
          FRAME[i] = tone(FRAME[i], -2);
      }
    return finish(t, fr, null);
  }
  const tod = timeOfDay(t),
    storm = t >= T.storm[0] && t < T.dawn[0] ? frontStrength(span('storm', t) * 30, 30) : 0,
    wind = 1 + storm * 2.5;
  for (let L = 0; L <= LEVELS; L++) LIFTS[L] = Math.round(L * LIFT * springAt(t - T.rise[0] - L * 0.1));
  const clayMix = span('rise', t) * 3, // the greys give way to clay over the first third of the rise
    wl = t < T.sea[0] ? -1 : t < T.sea[1] ? lerp(sorted[0], CUT, smoothstep(0, 1, span('sea', t))) : CUT,
    flooding = t >= T.sea[0] && t < T.sea[1],
    dSea = flooding
      ? chamferDistance(
          mask((i) => E[i] < wl),
          W,
          GH,
        )
      : D_SEA,
    paintR = span('paint', t) * 330,
    WT = waterTime(t, Math.floor(t * 15)),
    lit = t >= T.paint[0];
  ZB.fill(-1);
  EM.fill(0);
  WM.fill(0);
  FRAME.fill(0);
  // the land, painted from the back to the front: each pixel's top lifted by its terrace, and the wall under it where
  // the ground in front is lower; water lies at the sea's level and in the river
  for (let y = 0; y < GH; y++) {
    const wob = Math.round(Math.sin(y * 0.35 + t * 2.2));
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        sea = E[i] < wl,
        L = sea ? 0 : Math.max(0, LEV[i]),
        lift = LIFTS[L],
        sy = y - lift;
      if (sy >= H) continue;
      const river = !sea && RIV[i] && t >= RIV_T[i],
        road = PATH[i] && t >= PATH_T[i];
      let c,
        w = 0;
      if (sea && PIER[i] && t >= T.roads[1]) c = PIER[i];
      else if (sea) {
        const behind =
          y > 0 && LIFTS[Math.max(0, LEV[i - W])] > 0 && E[i - W] >= wl
            ? 2
            : y > 1 && LIFTS[Math.max(0, LEV[i - 2 * W])] > 0 && E[i - 2 * W] >= wl
              ? 1
              : 0;
        c = waterPixel(x, y, dSea[i] / 3, D_BEACH[i] <= dSea[i] + 4, behind, WT, wob, P);
        w = 1;
      } else if (river && road)
        c = (x + y) % 3 ? tone(C.plank, (x & 3) === 0 ? -1 : 0) : tone(C.plank, 1); // a bridge
      else if (river) {
        c = waterPixel(x, y, D_RIV[i] / 3 + 1, false, 0, WT, wob, PR);
        w = 2;
      } else c = groundAt(i, x, y, t, L, clayMix, paintR, road);
      if (sy >= 0) {
        FRAME[sy * W + x] = c;
        ZB[sy * W + x] = y;
        WM[sy * W + x] = w;
      }
      if (y + 1 >= GH || !lift) continue;
      const j = i + W,
        lf = LIFTS[E[j] < wl ? 0 : Math.max(0, LEV[j])],
        bottom = Math.min(H, y + 1 - lf);
      for (let r = Math.max(0, sy + 1); r < bottom; r++) {
        const yy = r - sy - 1,
          k = r * W + x;
        let wc;
        if (river)
          wc = [P.FOAM, PR.LV[0], P.FOAM2, PR.LV[1], P.FOAM, PR.LV[2], P.FOAM2, PR.LV[0]][
            (yy - Math.floor(t * 26) + x * 5) & 7
          ];
        else if (road && lit)
          wc = yy & 1 ? tone(C.stone, -1) : tone(C.stone, 1); // steps cut in the wall
        else if (!lit || !painted(i, x, y, paintR)) wc = tone(CLAY[L], yy ? -2 : -1);
        else wc = yy === 0 ? tone(TOPC[i], -1) : WALLS[wallKind(L)][((yy & 15) << 4) | (x & 15)];
        FRAME[k] = wc;
        ZB[k] = y;
        WM[k] = 0;
      }
    }
  }
  if (t >= T.forest[0]) drawLife(t, fr, wind);
  if (t >= T.forest[0])
    cloudScratch = cloudShadows(FRAME, W, H, {
      x: t * 9,
      y: t * 3,
      seed: SEED,
      cover: 0.3 + storm * 0.75,
      strong: tod < 0.4 || tod > 0.95 || storm > 0.3,
      scratch: cloudScratch,
    });
  if (t >= T.dawn[0] && t < T.fade[1]) {
    const dn = span('dawn', t);
    fogScratch = fogBanks(FRAME, W, H, {
      x: t * 10,
      y: t * 2,
      density: 0.82 - dn * 0.45,
      colour: C.fog,
      seed: SEED + 9,
      scratch: fogScratch,
    });
  }
  // the hour's light, with the lamps, windows and fires holding the dark off round themselves
  const hl = hourLight(tod, 1, storm * 0.8),
    lights = t >= T.dusk[0] ? lightsAt(t, fr, hl.night) : [];
  if (!hl.plain) {
    if (!tables.has(hl.key)) tables.set(hl.key, hourTables(hl.night, hl.dusk, hl.morning, 1, storm * 0.8));
    gradeScratch = gradeFrame(FRAME, W, H, tables.get(hl.key), { night: hl.night, lights, scratch: gradeScratch });
  }
  glow(t, fr, hl.night);
  if (storm > 0.02) {
    for (const q of sim.rain)
      if (q.s < storm)
        lineCells(q.x, q.y, q.x - 1, q.y + 3, (x, y) => {
          if (x >= 0 && y >= 0 && x < W && y < H) FRAME[y * W + x] = mixPacked(FRAME[y * W + x], C.rain, 0.55);
        });
    const st = t - T.storm[0];
    for (const strike of [0.62, 1.05])
      if (st >= strike && st < strike + 0.34) lightningFlash(FRAME, 0.34 - (st - strike));
  }
  return finish(t, fr, tod);
}

// a land pixel's colour: clay until the paint reaches it, then its own; fields and roads once they are made
const TOPC = new Uint32Array(n),
  TOPC_AO = new Uint32Array(n),
  CLAYC = new Uint32Array(n);
{
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < W; x++) {
      const i = at(x, y),
        L = LEV[i],
        m = MO[i],
        g = GR[i];
      let base;
      if (L <= 0) base = ditheredBorder((9 - D_LAND[i] / 3) / 6, x, y, g) ? C.wetSand : C.sand;
      else if (L <= 2) base = ditheredBorder((0.47 - m) * 5, x, y, g) ? C.dry : C.lush;
      else if (L <= 4) base = ditheredBorder((m - 0.55) * 4, x, y, g) ? C.wood2 : C.wood1;
      else if (L === 5) base = ditheredBorder((0.45 - m) * 4, x, y, g) ? C.moor : C.heath;
      else base = ditheredBorder((fractalNoise(x / 14, y / 14, SEED + 21, 2) - 0.62) * 4, x, y, g) ? C.rock : C.moor;
      let c = g < 0.1 ? tone(base, -1) : g > 0.93 ? tone(base, 1) : base;
      if (L >= 1 && L <= 4 && (x * 7 + y * 3) % 11 === 0 && m > 0.38) c = tone(base, -1); // tufts
      if (L >= 1 && L <= 2 && g > 0.986) c = C.flowers[latticeHash(x, y, 4) & 3];
      if (L < 0) c = base;
      TOPC[i] = c;
      const back = lev(x, y - 1) > L; // the foot of a wall: in its shade
      TOPC_AO[i] = back ? tone(c, -1) : c;
      CLAYC[i] = L < 0 ? tone(CLAY[0], -1 - (E[i] < CUT - 0.08 ? 1 : 0)) : back ? tone(CLAY[L], -1) : CLAY[L];
    }
}
const PEAKD = (x, y) => Math.hypot(x - PEAK[0], (y - PEAK[1]) * 1.3);
function painted(i, x, y, R) {
  return ditheredBorder((R - PEAKD(x, y)) / 18, x, y, GR[i]);
}
function groundAt(i, x, y, t, L, clayMix, paintR, road) {
  if (t < T.paint[0] || !painted(i, x, y, paintR)) {
    if (clayMix < 1 && bayerThreshold(x, y) > clayMix) return greyOf(E[i], x, y);
    return CLAYC[i];
  }
  if (road) return lev(x, y - 1) > L ? tone(PATH[i], -1) : PATH[i];
  if (FIELD[i] && ditheredBorder((t - FIELD_T[i]) * 3, x, y, GR[i]))
    return lev(x, y - 1) > L ? tone(FIELD[i], -1) : FIELD[i];
  return TOPC_AO[i];
}

// what stands on the land and moves over it, back to front
function drawLife(t, fr, wind) {
  const items = [];
  // shadows first, on the ground: the light is from the upper left, so they fall to the lower right
  for (const tr of TREES) {
    const k = springAt(t - tr.born);
    if (k <= 0) continue;
    const [sx, sy] = ground(tr.x, tr.y);
    shadeEllipse(OUT, sx + 2, sy, (2.5 + 3.6 * tr.size) * k, (1.2 + 1.2 * tr.size) * k, 0.78);
    const sp = treeSprite(tr, k);
    items.push([
      tr.y,
      sp,
      sx,
      sy,
      (l) =>
        blitSway(l, sp, sx, sy, (hh) =>
          hh > sp.trunk ? Math.sin(t * 2.3 + tr.phase + tr.x * 0.04) * (hh - sp.trunk) * 0.05 * wind : 0,
        ),
    ]);
  }
  for (const p of PALMS) {
    const k = springAt(t - p.born);
    if (k <= 0) continue;
    const [sx, sy] = ground(p.x, p.y);
    items.push([
      p.y,
      { ax: 15, ay: 27, w: 30, h: 30 },
      sx,
      sy,
      (l) => drawPalm(l, p, sx, sy, t, Math.min(1.1, k), wind),
    ]);
  }
  for (const rd of REEDS) {
    if (t < rd.born) continue;
    const [sx, sy] = ground(rd.x, rd.y),
      pts = swayingChain(sx, sy, { segments: 3, length: 5, sway: 0.35 * wind, speed: 2.6 }, 1, t, rd.id);
    items.push([
      rd.y,
      { ax: 4, ay: 7, w: 9, h: 8 },
      sx,
      sy,
      (l) => {
        for (let j = 1; j < pts.length; j++)
          lineCells(
            pts[j - 1][0],
            pts[j - 1][1],
            pts[j][0],
            pts[j][1],
            (x, y) =>
              x >= 0 && y >= 0 && x < W && y < H && (l.px[y * W + x] = j === 3 ? hex('#c9b46a') : LEAVES.meadow[j]),
          );
      },
    ]);
  }
  {
    const k = springAt(t - SUMMIT.born);
    if (k > 0.05) {
      const [sx, sy] = ground(SUMMIT.x, SUMMIT.y),
        sp = SUMMIT_TREE;
      shadeEllipse(OUT, sx + 4, sy, 12 * k, 3 * k, 0.75);
      items.push([
        SUMMIT.y,
        sp,
        sx,
        sy + Math.round((1 - Math.min(1, k)) * 30),
        (l) =>
          blitSway(l, sp, sx, sy + Math.round((1 - Math.min(1, k)) * 30), (hh) =>
            hh > 8 ? Math.sin(t * 1.4) * (hh - 8) * 0.03 * wind : 0,
          ),
      ]);
    }
  }
  for (const h of HOUSES) {
    const k = springAt(t - h.born);
    if (k <= 0) continue;
    const hw = Math.max(0, Math.round(h.hw * k)),
      sp = cache.get(`house:${h.id}:${hw}`, () => buildHouse(h, hw)),
      [sx, sy] = ground(h.x0 + (h.w >> 1), h.y0 + h.d - 1);
    shadeEllipse(OUT, sx + 3, sy + 1, h.w * 0.65, 2.2, 0.72);
    items.push([h.y0 + h.d - 1, sp, sx, sy, (l) => blitSprite(l, sp, sx, sy)]);
    h.screen = [sx, sy, sp];
  }
  for (const lp of LAMPS)
    if (t >= lp.born + 0.1) {
      const [sx, sy] = ground(lp.x, lp.y);
      items.push([lp.y, POST, sx, sy, (l) => blitSprite(l, POST, sx, sy)]);
      lp.screen = [sx, sy - 4];
    }
  if (LIGHT && t >= T.village[0] + 0.6) {
    const [sx, sy] = ground(LIGHT.x, LIGHT.y);
    items.push([LIGHT.y, TOWER, sx, sy, (l) => blitSprite(l, TOWER, sx, sy)]);
    LIGHT.screen = [sx, sy - 7];
  }
  if (sim.people) {
    for (const p of sim.people) {
      if (t < p.born) continue;
      const q = pos(p),
        moving = p.wait <= 0,
        sA = footStep(p.phase, 1, 1),
        sB = footStep(p.phase + gaitTiming('stride')[0].far, 1, 1),
        lA = moving && sA.y > 0.4 ? 1 : 0,
        lB = moving && sB.y > 0.4 ? 1 : 0,
        sp = cache.get(`p:${p.id}:${lA}${lB}`, () => buildPerson(p, lA, lB)),
        [sx, sy] = ground(q.x, q.y);
      items.push([q.y, sp, sx, sy, (l) => blitSprite(l, sp, sx, sy, p.dir < 0)]);
    }
    for (const m of sim.milling) {
      if (t < m.born || (m.hen && t > T.night[0])) continue;
      const x = m.x * m.tile,
        y = m.y * m.tile,
        [sx, sy] = ground(x, y);
      let sp;
      if (m.hen) sp = HEN[m.moving ? 0 : Math.floor(t * 3 + m.id) & 1];
      else {
        const sA = footStep(m.phase, 1, 1),
          sB = footStep(m.phase + gaitTiming('stride')[0].far, 1, 1),
          lA = m.moving && sA.y > 0.4 ? 1 : 0,
          lB = m.moving && sB.y > 0.4 ? 1 : 0;
        sp = cache.get(`p:${m.id}:${lA}${lB}`, () => buildPerson(m, lA, lB));
      }
      items.push([Math.round(y), sp, sx, sy, (l) => blitSprite(l, sp, sx, sy, m.dir < 0)]);
    }
    const night = t > T.night[0];
    for (const d of sim.deer) {
      const sp_ = Math.hypot(d.vx, d.vy),
        grazing = sp_ < 1.6 && !night,
        ph = Math.round(((d.phase % 6.283) / 6.283) * 8) % 8,
        sp = cache.get(`d:${d.seed}:${ph}:${grazing ? 1 : 0}`, () => buildDeer(d, (ph / 8) * 6.283, grazing)),
        [sx, sy] = ground(d.x, d.y);
      items.push([Math.round(d.y), sp, sx, sy, (l) => blitSprite(l, sp, sx, sy, d.vx < 0)]);
    }
  }
  items.sort((a, b) => a[0] - b[0]);
  for (const [z, sp, sx, sy, draw] of items) stamp(z, sp, sx, sy, draw);
  if (!sim.people) return;
  // under the water: the fish, and the whale's shadow they swim from
  const darken = (x, y, k) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H && WM[y * W + x] === 1) FRAME[y * W + x] = scalePacked(FRAME[y * W + x], k);
  };
  const wh = sim.whale,
    radii = smoothCurve(wh.spine.length, [
      [0, 2.6],
      [0.3, 3.4],
      [0.8, 1.3],
      [1, 0.8],
    ]);
  const shape = buffer(W, H);
  wh.spine.forEach(([x, y], k) => fillEllipse(shape, x, y, radii[k] * 1.25, radii[k], 1));
  const tail = wh.spine[wh.spine.length - 1];
  fillEllipse(shape, tail[0], tail[1] - 2, 1.2, 2.4, 1);
  fillEllipse(shape, tail[0], tail[1] + 2, 1.2, 2.4, 1);
  for (let i = 0; i < W * H; i++) if (shape.px[i] && WM[i] === 1) FRAME[i] = scalePacked(FRAME[i], 0.66);
  for (const f of sim.fish) {
    const l = Math.hypot(f.vx, f.vy) || 1;
    for (let k = 0; k < 3; k++) darken(f.x - (f.vx / l) * k, f.y - (f.vy / l) * k, k ? 0.62 : 0.5);
  }
  // the boat, rocking on the swell (floatHeight, a bird's way of sitting on the water), and its wake
  const bt = sim.boat.centre,
    ba = t * 0.22,
    bx = bt.x + Math.cos(ba) * 22,
    by = bt.y + Math.sin(ba) * 7,
    bob = Math.round(floatHeight(0, 2, 2, 1, 5, true, t, 1) * 2 - 5);
  if (inSea(bx, by, 6)) {
    for (let k = 2; k < 12; k++) {
      const wx = Math.round(bx + Math.sin(ba) * k * 1.6),
        wy = Math.round(by - Math.cos(ba) * k * 0.5 + 1);
      if (wx >= 0 && wy >= 0 && wx < W && wy < H && WM[wy * W + wx] === 1 && (k + fr) % 3)
        FRAME[wy * W + wx] = k < 6 ? P.FOAM : P.FOAM2;
    }
    blitSprite(OUT, BOAT, bx, by + bob, Math.sin(ba) > 0);
  }
  // smoke (see-through puffs, in an ordered dither), butterflies, and gulls with their shadows on the ground
  for (const q of sim.smoke) {
    const [sx, sy] = obliqueToScreen(q.x, q.y, LIFTS[q.L], 0, 0, 0),
      a = 0.75 * (1 - q.age / 2.6);
    ditherEllipse(OUT, sx, sy, 1.2 + q.age * 1.3, 1 + q.age, C.smoke, a);
  }
  if (t < T.dusk[1])
    for (const b of sim.butterflies) {
      const [sx, sy] = ground(b.x, b.y),
        x = Math.round(sx),
        y = Math.round(sy - 4 - Math.abs(Math.sin(t * 3 + b.seed)) * 2);
      if (x > 0 && y > 0 && x < W - 1 && y < H) {
        FRAME[y * W + x] = C.flowers[b.seed & 3];
        if ((fr + b.seed) & 1) FRAME[y * W + x + 1] = C.flowers[b.seed & 3];
      }
    }
  if (t < T.night[0] + 0.4)
    sim.birds.forEach((b, k) => {
      shadeEllipse(OUT, b.x + 14, b.y + 30, 2, 1, 0.7);
      blitSprite(OUT, GULL[(fr + k) % 6 < 3 ? 0 : 1], b.x, b.y);
    });
}
const treeSprite = (tr, k) =>
  cache.get(`t:${tr.id}:${Math.round(k * 12)}`, () => buildTree(tr, Math.round(k * 12) / 12));

// the lights after dark, in screen pixels: windows, lanterns, the fire, the beacon, the glowing tree, fireflies
function lightsAt(t, fr, night) {
  const L = [];
  if (night < 0.12) return L;
  const share = clamp((night - 0.15) * 2.5) * 0.9;
  for (const h of HOUSES)
    if (h.screen && windowLit(h.id, 0, 0, SEED, t, share))
      L.push({ x: h.screen[0], y: h.screen[1] - 2, r: 13 + h.w * 0.4, k: 0.9 });
  for (const lp of LAMPS) if (lp.screen) L.push({ x: lp.screen[0], y: lp.screen[1] + 3, r: 15, k: 0.85 });
  const [fx, fy] = ground(hillSite.x, hillSite.y);
  L.push({ x: fx, y: fy - 1, r: 20 + indexRandom(fr, 7) * 4, k: 1 });
  if (LIGHT && LIGHT.screen && blink(t, 5, 0, 0.3)) L.push({ x: LIGHT.screen[0], y: LIGHT.screen[1], r: 34, k: 1 });
  const [tx, ty] = ground(SUMMIT.x, SUMMIT.y);
  for (const [x, y] of SUMMIT_TREE.tips.filter((_, k) => k % 2 === 0)) L.push({ x: tx + x, y: ty + y, r: 10, k: 0.75 });
  for (const q of sim.flies) if (twinkle(t, q.p * 3, 0.5) > 0.6) L.push({ x: q.x, y: q.y, r: 5, k: 0.6 });
  for (const l of sim.lanterns) if (t > l.born && l.y > 4) L.push({ x: l.x, y: l.y, r: 11, k: 0.85 });
  return L;
}
// what glows: drawn after the light is graded, so it is never dimmed
function glow(t, fr, night) {
  const on = night > 0.18;
  const share = clamp((night - 0.15) * 2.5) * 0.9;
  for (let i = 0; i < W * H; i++) {
    const m = EM[i];
    if (!m || !on) continue;
    if (m === MARK.win) {
      if (windowLit(EMID[i], 0, 0, SEED, t, share)) FRAME[i] = C.lit;
    } else if (m === MARK.lamp) FRAME[i] = C.lamp;
    else if (m === MARK.tip) {
      const c = twinkle(t, EMID[i] * 1.7) > 0.8 ? C.tipBright : C.tip;
      for (const d of [0, 1, W, W + 1]) if (i + d < W * H) FRAME[i + d] = c;
    } else if (m === MARK.beacon && blink(t, 5, 0, 0.3)) FRAME[i] = C.beacon;
  }
  if (!sim.people || t < T.dusk[0]) return;
  // the fire in the hill village's square, and its embers
  const [fx, fy] = ground(hillSite.x, hillSite.y);
  for (let k = 0; k < 7; k++) {
    const x = Math.round(fx - 1 + (k % 3)),
      y = Math.round(fy) - 1 - Math.floor(k / 3) - (indexRandom(fr * 7 + k, 11) < 0.5 ? 1 : 0);
    if (x >= 0 && y >= 0 && x < W && y < H) FRAME[y * W + x] = C.fire[k < 3 ? 2 : k < 6 ? 1 : 0];
  }
  for (const q of sim.embers) {
    const x = Math.round(q.x),
      y = Math.round(obliqueToScreen(q.x, q.y, LIFTS[hillSite.L], 0, 0, 0)[1]);
    if (x >= 0 && y >= 0 && x < W && y < H && q.age < 1.2) FRAME[y * W + x] = q.age < 0.5 ? C.fire[0] : C.fire[1];
  }
  if (!on) return;
  // stars in the sea, each twinkling at its own phase; fireflies; lanterns let go from the harbour, rising in pulses
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (WM[i] !== 1 || latticeHash(x, y, SEED) % 487) continue;
      const k = twinkle(t, (latticeHash(x, y, 3) % 628) / 100, 0.6);
      if (k > 0.55) FRAME[i] = mixPacked(FRAME[i], C.star, (k - 0.4) * night);
    }
  for (const q of sim.flies) {
    const x = Math.round(q.x),
      y = Math.round(q.y);
    if (x >= 0 && y >= 0 && x < W && y < H && twinkle(t, q.p * 3, 0.5) > 0.6) FRAME[y * W + x] = C.firefly;
  }
  for (const l of sim.lanterns) {
    if (t <= l.born || l.y < 2) continue;
    const x = Math.round(l.x),
      y = Math.round(l.y);
    for (const [dx, dy, c] of [
      [0, 0, C.lamp],
      [1, 0, C.lit],
      [0, 1, C.lantern],
      [1, 1, C.lantern],
      [0, 2, tone(C.lantern, -1)],
      [1, 2, tone(C.lantern, -1)],
    ])
      if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) FRAME[(y + dy) * W + x + dx] = c;
  }
}

// the captions, the mark in the corner, the card at the end, and the way back to noise
const CAP = new Map();
function caption(lines, chars) {
  const key = lines.join('|') + ':' + chars;
  return CAP.get(key) || (CAP.set(key, makeCaption(lines, chars)), CAP.get(key));
}
function makeCaption(lines, chars, big = false) {
  let left = chars;
  const rows = [];
  for (const line of lines) {
    const shown = line.slice(0, Math.max(0, left));
    left -= line.length;
    rows.push(...textRows(shown, { big }), ...(big ? ['.', '.', '.', '.'] : ['.', '.']));
  }
  const width = Math.max(1, ...rows.map((r) => r.length));
  return spriteFromRows(
    rows.map((r) => r.padEnd(width, '.')),
    (ch) => (ch === '+' ? C.accent : C.text),
    { ink: C.textInk, ax: 0, ay: 0 },
  );
}
const MARK_SPRITE = spriteFromRows(textRows('procedural-almanac'), () => C.mark, { ink: C.textInk, ax: 0, ay: 0 });
// the close look: the picture cut to half its size round a point and doubled (whole pixels only), panning from the
// harbour up to the summit while the island comes to life
const ZOOM = [T.life[0] + 0.25, T.life[1]],
  SRC = new Uint32Array(W * H);
function closeLook(t) {
  const u = smoothstep(0, 1, clamp((t - ZOOM[0] - 0.5) / (ZOOM[1] - ZOOM[0] - 0.7))),
    a = { x: VILLAGES[0].x, y: VILLAGES[0].y - VILLAGES[0].L * LIFT },
    b = { x: SUMMIT.x, y: SUMMIT.y - LEV[at(SUMMIT.x, SUMMIT.y)] * LIFT + 10 },
    cx = clamp(Math.round(lerp(a.x, b.x, u) - W / 4), 0, W / 2),
    cy = clamp(Math.round(lerp(a.y, b.y, u) - H / 4), 0, H / 2);
  SRC.set(FRAME);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) FRAME[i] = SRC[(cy + (y >> 1)) * W + cx + (x >> 1)];
}
function finish(t, fr, tod) {
  if (t >= ZOOM[0] && t < ZOOM[1]) closeLook(t);
  if (t >= T.fade[0]) {
    const u = span('fade', t);
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++)
        if (bayerThreshold(x, y) * 0.55 + GR[i] * 0.45 < u * 1.06) FRAME[i] = greyOf(OCT[0][i], x, y);
  }
  blitSprite(OUT, MARK_SPRITE, 4, 3);
  for (const [k] of STAGES) {
    if (t < T[k][0] || t >= T[k][1] || !CAPTIONS[k]) continue;
    const lines = CAPTIONS[k],
      chars = Math.floor((t - T[k][0]) * 150),
      fadeOut = k === 'fade' && t > T.fade[1] - 0.3;
    if (fadeOut) continue;
    const sp = caption(lines, chars);
    blitSprite(OUT, sp, 4, H - 4 - sp.h);
  }
  if (t >= T.dawn[0] + 0.3 && t < T.fade[0] + 0.25) {
    const card = CAP.get('end') || (CAP.set('end', makeCaption(['one seed, one island'], 99, true)), CAP.get('end'));
    const sub = caption([`${used.size} techniques · no image files`, '`procedural-almanac`'], 99);
    blitSprite(OUT, card, (W - card.w) >> 1, 70);
    blitSprite(OUT, sub, (W - sub.w) >> 1, 96);
  }
  return FRAME;
}

// ---------------------------------------------------------------------------------------------------- output
function advance(f) {
  while (sim.f < f) {
    sim.f++;
    step(sim.f / FPS, 1 / FPS);
  }
}
function png(path, w, h, px) {
  const crcT = Array.from({ length: 256 }, (_, k) => {
    let c = k;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type), data]),
      out = Buffer.alloc(td.length + 8);
    out.writeUInt32BE(data.length, 0);
    td.copy(out, 4);
    out.writeUInt32BE(crc(td), td.length + 4);
    return out;
  };
  const raw = Buffer.alloc((w * 4 + 1) * h),
    bytes = Buffer.from(px.buffer, px.byteOffset, px.byteLength);
  for (let y = 0; y < h; y++) bytes.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
const scaleUp = (px, w, h, s) => {
  const out = new Uint32Array(w * s * h * s);
  for (let y = 0; y < h * s; y++)
    for (let x = 0; x < w * s; x++) out[y * w * s + x] = px[((y / s) | 0) * w + ((x / s) | 0)];
  return out;
};
function report() {
  const named = new Set(
    Object.values(CAPTIONS)
      .flat()
      .join(' ')
      .match(/`([A-Za-z]+)`/g)
      .map((s) => s.slice(1, -1)),
  );
  const missing = [...named].filter((k) => !used.has(k));
  console.error(
    `${HOUSES.length} houses, ${TREES.length} trees, ${PALMS.length} palms, ${REEDS.length} reeds, ${LAMPS.length} lamps, ${ROADS.length} roads, lighthouse at ${LIGHT ? LIGHT.x + "," + LIGHT.y : "none"}`,
  );
  console.error(`${used.size} techniques of ${Object.keys(almanac).length} used: ${[...used].sort().join(', ')}`);
  if (missing.length) console.error(`named in a caption but never used: ${missing.join(', ')}`);
}

const frames = Math.round(DUR * FPS);
if (argv.includes('--still')) {
  const t = +opt('--still', 10),
    f = Math.round(t * FPS);
  advance(f);
  render(f / FPS);
  png(argv[argv.indexOf('--still') + 2] || 'frame.png', W * 2, H * 2, scaleUp(FRAME, W, H, 2));
  report();
} else if (argv.includes('--sheet')) {
  const shots = [],
    times = opt('--at', '')
      ? opt('--at')
          .split(',')
          .map((s) => Math.round(+s * FPS))
      : null;
  for (let f = 0; f < frames; f++) {
    advance(f);
    if (times ? times.includes(f) : f % FPS === FPS / 2) shots.push(render(f / FPS).slice());
  }
  const sheet = packSheet(shots, W, H, +opt('--across', 4));
  png(opt('--sheet', 'sheet.png'), sheet.w, sheet.h, sheet.data);
  report();
} else {
  // the frames go to a file first, then ffmpeg reads it three times: for the GIF's palette, the GIF, and the MP4, so
  // nothing has to hold the whole film in memory
  const scale = +opt('--scale', 2),
    here = new URL('.', import.meta.url).pathname,
    gif = opt('--gif', here + 'island.gif'),
    mp4 = opt('--mp4', here + 'island.mp4'),
    dir = mkdtempSync(join(tmpdir(), 'island-')),
    raw = join(dir, 'frames.rgba'),
    pal = join(dir, 'palette.png'),
    fd = openSync(raw, 'w');
  for (let f = 0; f < frames; f++) {
    advance(f);
    writeSync(fd, new Uint8Array(render(f / FPS).buffer));
    if (f % FPS === 0) process.stderr.write(`\r${f / FPS} s of ${DUR.toFixed(1)}`);
  }
  closeSync(fd);
  // the film loops, so it may start anywhere: by default where the island is first whole, in daylight (the first
  // frame is what a feed shows before it plays), going round through the night and back to the seed
  const start = Math.round(+opt('--start', T.life[0]) * FPS) % frames,
    looped = join(dir, 'looped.rgba'),
    size = W * H * 4,
    chunk = Buffer.alloc(size * FPS),
    from = openSync(raw, 'r'),
    to = openSync(looped, 'w');
  for (const [a, b] of [[start, frames], [0, start]])
    for (let f = a; f < b; f += FPS) {
      const k = Math.min(FPS, b - f),
        got = readSync(from, chunk, 0, k * size, f * size);
      writeSync(to, chunk, 0, got);
    }
  closeSync(from);
  closeSync(to);
  const input = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', looped];
  const ffmpeg = (...a) => {
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
    if (r.status) throw new Error('ffmpeg failed: ' + a.join(' '));
  };
  ffmpeg(...input, '-vf', 'palettegen=max_colors=256:stats_mode=full', pal);
  ffmpeg(
    ...input,
    '-i',
    pal,
    '-filter_complex',
    `[0:v]scale=iw*${scale}:ih*${scale}:flags=neighbor[s];[s][1:v]paletteuse=dither=none:diff_mode=rectangle`,
    '-loop',
    '0',
    gif,
  );
  ffmpeg(
    ...input,
    '-vf',
    'scale=iw*4:ih*4:flags=neighbor',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '14',
    '-preset',
    'slow',
    mp4,
  );
  rmSync(dir, { recursive: true });
  process.stderr.write(`\n${gif}\n${mp4}\n`);
  report();
}
