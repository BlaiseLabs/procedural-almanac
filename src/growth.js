// Growth: things that branch (trees, coral, antlers of crystal) and things that sway from a fixed foot (kelp, vines,
// reeds, banners). Both give geometry: where each part goes, in the order to draw them; drawing them is the caller's.
import { clamp } from './numbers.js';

/**
 * A branching thing (a tree, a coral, a crystal antler): a trunk that forks, each branch shorter and thinner than the
 * one it grows from, to a number of levels, with the tips where leaves, polyps or lights go.
 * @param {number} x where the trunk stands
 * @param {number} y
 * @param {{levels?: number, forks?: number, spread?: number, decay?: number, length?: number, width?: number,
 *   lean?: number, curl?: number}} plan levels: how many times it forks, 1..7 (4); forks: branches from each (2);
 *   spread: how far they splay, in radians either side (0.5); decay: each level's length and width as a share of the
 *   last (0.72); length and width: the trunk's (14, 2.4); lean: a bias to one side; curl: how much each branch bends
 * @param {number} k pixels per unit
 * @param {{range: function}} random a SeededRandom (drawn from in the order the branches are made)
 * @returns {{segments: {x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, width: number,
 *   level: number}[], tips: number[][]}} each branch as a curve from (x0, y0) to (x1, y1) bent toward (cx, cy), trunk
 *   first and each branch before its own branches (the order to draw them); level counts down to 1 at the tips
 * @see fractal-canopy-wikipedia
 * @see abop-1990
 */
export function branchingTree(x, y, plan, k, random) {
  const levels = clamp(plan.levels || 4, 1, 7),
    spread = plan.spread === undefined ? 0.5 : plan.spread,
    decay = plan.decay || 0.72,
    segments = [],
    tips = [];
  const branch = (x0, y0, a, len, w, lvl) => {
    const x1 = x0 + Math.sin(a) * len,
      y1 = y0 - Math.cos(a) * len;
    segments.push({
      x0,
      y0,
      cx: x0 + Math.sin(a + (plan.curl || 0)) * len * 0.5,
      cy: y0 - Math.cos(a + (plan.curl || 0)) * len * 0.5,
      x1,
      y1,
      width: w,
      level: lvl,
    });
    if (lvl <= 1) {
      tips.push([x1, y1]);
      return;
    }
    const n = plan.forks || 2;
    for (let j = 0; j < n; j++) {
      // the forks fanned evenly across the spread, each turned a little at random
      const da = (j / Math.max(1, n - 1) - 0.5) * 2 * spread + random.range(-0.18, 0.18);
      branch(x1, y1, a + da + (plan.lean || 0) * 0.2, len * decay * random.range(0.85, 1.1), w * decay, lvl - 1);
    }
  };
  branch(
    x,
    y,
    random.range(-0.08, 0.08) + (plan.lean || 0) * 0.3,
    (plan.length || 14) * k,
    (plan.width || 2.4) * k,
    levels,
  );
  return { segments, tips };
}

/**
 * A chain that sways from a fixed foot (kelp, a vine, a reed, a banner): links of equal length, each turned a little
 * further than the one below by a wave that runs up the chain, so the foot stays still and the tip swings most.
 * @param {number} x where its foot is fixed
 * @param {number} y
 * @param {{segments?: number, length?: number, sway?: number, speed?: number, lean?: number}} chain segments: links,
 *   3..24 (10); length: its whole length (40); sway: how far the tip swings, in radians (0.5); speed: of the wave
 *   (0.9); lean: a bias to one side
 * @param {number} k pixels per unit
 * @param {number} t the time, in seconds
 * @param {number} i which chain this is (neighbours sway out of step)
 * @returns {number[][]} the points from the foot to the tip, [x, y] each
 * @see forward-kinematics-wikipedia
 */
export function swayingChain(x, y, chain, k, t, i) {
  const n = clamp(chain.segments || 10, 3, 24),
    seg = ((chain.length || 40) * k) / n,
    sway = chain.sway === undefined ? 0.5 : chain.sway;
  let px = x,
    py = y,
    a = 0;
  const pts = [[px, py]];
  for (let j = 1; j <= n; j++) {
    a = Math.sin(t * (chain.speed || 0.9) + i * 1.3 + j * 0.35) * sway * (j / n) + (chain.lean || 0) * 0.3;
    px += Math.sin(a) * seg;
    py -= Math.cos(a) * seg;
    pts.push([px, py]);
  }
  return pts;
}
