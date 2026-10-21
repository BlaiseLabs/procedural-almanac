// One seed, one island: the scene behind examples/island, drawn with procedural-almanac and nothing else. island(seed)
// grows the world from its seed and gives back frame(f), each frame a buffer of packed pixels (an ImageData's 32-bit
// words): the same scene in a browser (index.html) and in Node (island.mjs, which films it). A seed becomes noise and
// the noise an island; its terraces rise, the sea comes in, the land is painted, a river finds its way down, a forest
// grows, villages and roads appear, then people, deer, birds and fish; the day turns to night, a storm passes, and at
// dawn the island goes back to noise. Each stage's caption names the techniques it shows, and at dawn the film counts
// them.
//
// The parts, in the order they are made:
//   sprites.js   the palette, and the small pictures drawn from it
//   world.js     the land, the river, villages, fields, roads, and where the trees and the lighthouse stand
//   life.js      what moves, a step at a time
//   draw.js      one frame by day: the land back to front, then everything standing on it
//   overlay.js   clouds, fog, the light of the hour, rain, captions, the close-up and the fade
//
// Every part is a function that takes the settings below (k) and the parts made before it, and returns what the later
// parts need. Nothing is shared any other way, so each file can be read on its own.
import * as almanac from '../../src/index.js';
import { makePalette, makeSprites } from './sprites.js';
import { buildWorld } from './world.js';
import { makeLife } from './life.js';
import { makeDrawing } from './draw.js';
import { makeOverlay } from './overlay.js';

/**
 * Grows the island for a seed and returns a player for its film.
 *
 * How it works: the seed phrase becomes a number (seedOf), and every random choice in the film is drawn from that
 * number, so the same phrase always gives the same island. The parts are made once, in order. After that, frame(f)
 * moves the island's life on to frame f and paints that frame.
 *
 * @param {string|number} [phrase] the seed, as words or a number (heron-bay-8)
 * @returns {{W: number, H: number, FPS: number, DUR: number, frames: number, opening: number, T: object,
 *   phrase: string, seed: number, used: Set<string>, frame: function(number): Uint32Array, report: function():
 *   string[], A: object}} frame(f): the picture at frame f (seeking back starts the world's life over); used: the
 *   techniques called so far
 */
export function island(phrase = 'heron-bay-8') {
  // Every technique the film calls is counted on its way through, so the end card can say how many it used. A is a copy
  // of the almanac in which each function first writes its own name into `used`, then does its work. Classes (their
  // names start with a capital, like SeededRandom) are counted when one is made.
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
  const { clamp, lerp, seedOf, frontStrength } = A;

  const W = 384, // the picture's width and height, in its own pixels (the GIF and the page show it larger)
    H = 216,
    GH = H + 32, // the world's rows: a few more than the picture's, since high land is lifted up into view
    FPS = 20, // frames a second
    LIFT = 4, // how many pixels a terrace stands above the one below it
    LEVELS = 7, // how many terraces the land can have, the beach being the lowest
    N = 200, // islandHeight works on a square of N tiles; the picture covers part of it at Z tiles a pixel
    Z = 0.5,
    ROUGH = 0.6, // how strong the noise's finer detail is (its gain from one octave to the next)
    LAND = 0.44; // the share of the picture that is land; the sea's level is set to give this
  const PHRASE = String(phrase).trim() || 'heron-bay-8',
    SEED = seedOf(PHRASE);

  // ---------------------------------------------------------------------------------------------------- the timeline
  // The film's stages in order, with how many seconds each lasts.
  const STAGES = [
    ['seed', 1.4], // the seed's noise appears, one octave at a time
    ['island', 0.9], // the noise is pressed down at the edges into an island
    ['rise', 1.2], // the terraces rise out of it
    ['sea', 1.0], // the sea floods in
    ['paint', 1.1], // the land is coloured, outward from the summit
    ['river', 1.0], // the river runs down from its source
    ['forest', 1.4], // trees grow
    ['village', 1.2], // houses and fields appear
    ['roads', 1.0], // roads are drawn between them
    ['life', 2.8], // people, animals, boats and birds
    ['dusk', 1.4],
    ['night', 1.8],
    ['storm', 1.6],
    ['dawn', 1.6],
    ['fade', 0.8], // the island dissolves back into the seed's noise, so the film loops
  ];
  // T[stage] = [start, end] in seconds, the stages laid end to end. DUR is the whole film's length.
  const T = {};
  let DUR = 0;
  for (const [k, d] of STAGES) T[k] = [DUR, (DUR += d)];
  // How far through a stage the time t is: 0 at its start, 1 at its end (and held at 0 before, 1 after).
  const span = (k, t) => clamp((t - T[k][0]) / (T[k][1] - T[k][0]));
  // The caption each stage shows. Words in backticks are the almanac's function names, drawn in gold; report() checks
  // that every one of them was really called.
  const CAPTIONS = {
    seed: [`\`seedOf\`('${PHRASE}') = ${SEED}`, '`fractalNoise`, one octave at a time'],
    island: ['`islandHeight`: lower toward the edge'],
    rise: ['`terraceLevel` · `wallShade` · `faceShade`', '`dampedSpring`'],
    sea: ['`chamferDistance` · `waterTime` · `waterPixel`'],
    paint: ['`hueShiftTone` · `ditheredBorder` · `latticeRandom`', '`gradeColour`'],
    river: ['`windingRiver` · `untilSettled`'],
    forest: [
      '`leafCrown` · `barkTrunk` · `outlinePass` · `blitSway`',
      '`swayingChain` · `branchingTree` · `stampCache`',
    ],
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
  // The time of day the film is at, as hourLight counts it (0.25 is noon, 0.5 dusk, 0.75 midnight, 1 the next dawn).
  // Each pair is [second of the film, time of day]: a morning while the island is built, then dusk, night and dawn.
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
  /**
   * The time of day at second t of the film.
   *
   * How it works: finds the two entries of DAY that t falls between and goes the same share of the way from one time
   * of day to the next. The result is taken round 1, so 1.02 (just after dawn) becomes 0.02.
   */
  function timeOfDay(t) {
    let k = 0;
    while (k < DAY.length - 2 && t > DAY[k + 1][0]) k++;
    return lerp(DAY[k][1], DAY[k + 1][1], clamp((t - DAY[k][0]) / (DAY[k + 1][0] - DAY[k][0]))) % 1;
  }

  // ---------------------------------------------------------------------------------------------------- the parts
  // The settings every part may read.
  // prettier-ignore
  const k = { A, used, W, H, GH, FPS, LIFT, LEVELS, N, Z, ROUGH, LAND, PHRASE, SEED, STAGES, T, DUR, span, CAPTIONS,
    timeOfDay };
  const look = makePalette(k),
    world = buildWorld(k, look),
    pics = makeSprites(k, look),
    life = makeLife(k, look, world),
    draw = makeDrawing(k, look, world, pics, life),
    over = makeOverlay(k, look, world, pics, life, draw);

  // ---------------------------------------------------------------------------------------------------- one frame
  /**
   * Paints the picture at second t and returns its pixels.
   *
   * How it works: the first two stages are only the seed's heights, drawn as greys. From then on a frame is painted in
   * layers, each over the last: the land, the things standing on it, clouds and fog, the light of the hour (which also
   * lights the lamps and windows), rain, and finally the captions. The storm's strength (0 to 1) makes the wind blow
   * harder, the clouds thicker and the rain heavier.
   */
  function render(t) {
    const fr = Math.round(t * FPS);
    if (t < T.rise[0]) {
      draw.paintHeights(t);
      return over.finish(t);
    }
    const tod = timeOfDay(t),
      // frontStrength is written for a front lasting tens of seconds: the storm's 1.6 seconds are stretched to 30
      storm = t >= T.storm[0] && t < T.dawn[0] ? frontStrength(span('storm', t) * 30, 30) : 0,
      wind = 1 + storm * 2.5;
    draw.paintLand(t);
    if (t >= T.forest[0]) draw.paintThings(t, fr, wind);
    over.skies(t, tod, storm);
    over.light(t, fr, tod, storm);
    over.rain(t, storm);
    return over.finish(t);
  }

  const sim = life.sim;
  /**
   * Moves the island's life on, one frame's step at a time, until it has reached frame f.
   *
   * How it works: sim.f is the last frame life was stepped to. Life can only move forward, a twentieth of a second at a
   * time, since each step starts from where the last one left everything.
   */
  function advance(f) {
    while (sim.f < f) {
      sim.f++;
      life.step(sim.f / FPS, 1 / FPS);
    }
  }
  /**
   * A short account of the island, as lines of text: how many houses, trees and so on it has, which of the almanac's
   * techniques the film has called so far, and any technique a caption names that was never called (which would make
   * that caption untrue).
   */
  function report() {
    const named = new Set(
      Object.values(CAPTIONS)
        .flat()
        .join(' ')
        .match(/`([A-Za-z]+)`/g) // every name written in backticks
        .map((s) => s.slice(1, -1)),
    );
    const missing = [...named].filter((k) => !used.has(k)),
      lines = [];
    lines.push(
      `${world.HOUSES.length} houses, ${world.TREES.length} trees, ${world.PALMS.length} palms, ${world.REEDS.length} reeds, ${world.LAMPS.length} lamps, ${world.ROADS.length} roads, lighthouse at ${world.LIGHT ? world.LIGHT.x + ',' + world.LIGHT.y : 'none'}`,
    );
    lines.push(`${used.size} techniques of ${Object.keys(almanac).length} used: ${[...used].sort().join(', ')}`);
    if (missing.length) lines.push(`named in a caption but never used: ${missing.join(', ')}`);
    return lines;
  }

  /**
   * The picture at frame f.
   *
   * How it works: life is moved on to frame f and the frame is painted. To go back in time (the page's timeline lets a
   * viewer drag backward), life is wiped and starts again from its first frame; that takes a fraction of a second.
   */
  function frame(f) {
    if (f < sim.f) {
      for (const k of Object.keys(sim)) delete sim[k];
      sim.f = -1;
    }
    advance(f);
    return render(f / FPS);
  }
  return {
    W,
    H,
    FPS,
    DUR,
    T,
    frames: Math.round(DUR * FPS),
    opening: T.life[0], // where the page and the GIF start: the island whole, by day
    phrase: PHRASE,
    seed: SEED,
    used,
    frame,
    report,
    A,
  };
}
