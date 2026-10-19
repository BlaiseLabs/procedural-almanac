// The checks of src/land.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'hillLine',
    says: 'the land stays between the base and the base less the height',
    run() {
      for (const hill of [
        { seed: 3 },
        { seed: 9, sharp: 0.8, base: 0.6, height: 0.3 },
        { seed: 4, rough: 0.7, freq: 5 },
      ])
        for (let x = 0; x < 2000; x += 0.7) {
          const y = A.hillLine(x, hill, 320, 200),
            base = 200 * (hill.base ?? 0.7),
            top = base - 200 * (hill.height ?? 0.15);
          assert.ok(y <= base + 1e-9 && y >= top - 1e-9, `y ${y} at ${x}`);
        }
    },
  },
  {
    entry: 'hillLine',
    says: 'flat hills are a level line, and terraced hills have only so many heights',
    run() {
      for (let x = 0; x < 500; x += 3) assert.equal(A.hillLine(x, { flat: true, base: 0.82 }, 320, 200), 200 * 0.82);
      const heights = new Set();
      for (let x = 0; x < 3000; x += 1) heights.add(A.hillLine(x, { seed: 6, terrace: 4 }, 320, 200).toFixed(6));
      assert.ok(heights.size <= 5, `${heights.size} heights`);
    },
  },
  {
    entry: 'hillLine',
    says: 'the line is unbroken: a hundredth of a pixel along, it moves by less than a twentieth',
    run() {
      for (let x = 0; x < 3000; x += 0.37) {
        const h = { seed: 2, sharp: 0.5 };
        assert.ok(Math.abs(A.hillLine(x + 0.01, h, 320, 200) - A.hillLine(x, h, 320, 200)) < 0.05, `a jump at ${x}`);
      }
    },
  },
  {
    entry: 'islandHeight',
    says: 'it stays within 0 to 1, and the same tile and seed give the same height',
    run() {
      for (let x = 0; x < 24; x++)
        for (let y = 0; y < 24; y++) {
          const v = A.islandHeight(x, y, 24, 77);
          assert.ok(v >= 0 && v <= 1);
          assert.equal(v, A.islandHeight(x, y, 24, 77));
        }
    },
  },
  {
    entry: 'islandHeight',
    says: 'the edge of the map is sea and the middle is land: over 50 seeds the border averages under a tenth, the centre over a half',
    run() {
      let edge = 0,
        nEdge = 0,
        mid = 0,
        nMid = 0;
      for (let seed = 1; seed <= 50; seed++)
        for (let x = 0; x < 20; x++)
          for (let y = 0; y < 20; y++) {
            const v = A.islandHeight(x, y, 20, seed * 7919);
            if (x === 0 || y === 0 || x === 19 || y === 19) ((edge += v), nEdge++);
            if (x >= 8 && x <= 11 && y >= 8 && y <= 11) ((mid += v), nMid++);
          }
      assert.ok(
        edge / nEdge < 0.1 && mid / nMid > 0.5,
        `border ${(edge / nEdge).toFixed(3)}, centre ${(mid / nMid).toFixed(3)}`,
      );
    },
  },

  {
    entry: 'levelCut',
    says: 'about the share of fractal noise it is asked for lies below it',
    run() {
      const heights = [];
      for (let y = 0; y < 300; y++) for (let x = 0; x < 300; x++) heights.push(A.fractalNoise(x / 40, y / 40, 3));
      for (const share of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const c = A.levelCut(share),
          below = heights.filter((h) => h < c).length / heights.length;
        assert.ok(Math.abs(below - share) < 0.08, `asked ${share}, got ${below.toFixed(3)}`);
      }
    },
  },
  {
    entry: 'levelCut',
    says: 'a bigger share gives a higher cut, and a half gives the middle, 0.5',
    run() {
      assert.equal(A.levelCut(0.5), 0.5);
      for (let i = 0; i < 100; i++) assert.ok(A.levelCut((i + 1) / 100) > A.levelCut(i / 100));
    },
  },
  {
    entry: 'heightWater',
    says: 'below the cut it is water, deeper the lower it lies; above it is land, and just above it is the shore',
    run() {
      const cut = 0.45,
        deep = A.heightWater(0.3, cut),
        shallow = A.heightWater(0.44, cut),
        shore = A.heightWater(0.46, cut),
        land = A.heightWater(0.6, cut);
      assert.ok(deep.depth > shallow.depth && shallow.depth > 0);
      assert.ok(shore.depth === 0 && shore.shore);
      assert.ok(land.depth === 0 && !land.shore);
    },
  },
  {
    entry: 'wanderingHeading',
    says: 'it never turns by more than the set amount in a step',
    run() {
      let a = 0;
      for (let s = 0; s < 20000; s += 4) {
        const b = A.wanderingHeading(a, s, 7);
        assert.ok(Math.abs(b - a) <= 0.06 + 1e-12);
        a = b;
      }
    },
  },
  {
    entry: 'wanderingHeading',
    says: 'the same seed walks the same path, another seed another',
    run() {
      const walk = (seed) => {
        let a = 0;
        const out = [];
        for (let s = 0; s < 4000; s += 4) out.push((a = A.wanderingHeading(a, s, seed)));
        return out;
      };
      assert.deepEqual(walk(3), walk(3));
      assert.notDeepEqual(walk(3), walk(4));
    },
  },
  {
    entry: 'chamferDistance',
    says: 'along a straight run the distance grows by 3 a cell, and along a diagonal by 4',
    run() {
      const w = 9,
        mask = new Uint8Array(w * w).fill(1);
      mask[0] = 0;
      const D = A.chamferDistance(mask, w, w);
      for (let k = 0; k < w; k++) {
        assert.equal(D[k], 3 * k);
        assert.equal(D[k * w + k], 4 * k);
      }
    },
  },
  {
    entry: 'chamferDistance',
    says: 'cells marked zero stay 0, and every other cell is no further than its neighbour plus a step',
    run() {
      const w = 24,
        h = 17,
        mask = new Uint8Array(w * h).map((_, i) => (A.latticeRandom(i % w, Math.floor(i / w), 5) < 0.08 ? 0 : 1)),
        D = A.chamferDistance(mask, w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (!mask[i]) assert.equal(D[i], 0);
          if (x > 0) assert.ok(D[i] <= D[i - 1] + 3);
          if (y > 0) assert.ok(D[i] <= D[i - w] + 3);
          if (x > 0 && y > 0) assert.ok(D[i] <= D[i - w - 1] + 4);
        }
    },
  },
  {
    entry: 'wobbledRing',
    says: 'far inside it is negative and far outside positive, and the edge stays within the wobble of the circle',
    run() {
      assert.ok(A.wobbledRing(0, 0, 0, 0, 200, 3) < 0);
      assert.ok(A.wobbledRing(400, 0, 0, 0, 200, 3) > 0);
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const x = Math.cos(a) * 200,
          y = Math.sin(a) * 200,
          d = A.wobbledRing(x, y, 0, 0, 200, 3);
        assert.ok(Math.abs(d) <= 0.17 * 200 + 5 + 1e-9, `${d} at ${a}`);
      }
    },
  },
  {
    entry: 'mountainRise',
    says: 'it is 0 well inside the edge and rises past it, never above 1',
    run() {
      assert.equal(A.mountainRise(-20, 3, 4, 7), 0);
      let last = 0;
      for (let past = -6; past <= 120; past += 2) {
        const v = A.mountainRise(past, 10, 10, 7);
        assert.ok(v >= last - 1e-12 && v <= 1, `${v} at ${past}`);
        last = v;
      }
      assert.ok(last > 0.5);
    },
  },
  {
    entry: 'windingRiver',
    says: 'more of a land is river the higher its level',
    run() {
      const share = (level) => {
        let n = 0;
        for (let y = 0; y < 3000; y += 25) for (let x = 0; x < 3000; x += 25) if (A.windingRiver(x, y, 11, level).depth > 0) n++;
        return n;
      };
      const s = [0.2, 0.5, 0.8].map(share);
      assert.ok(s[0] < s[1] && s[1] < s[2], `${s}`);
    },
  },
  {
    entry: 'plotGrid',
    says: "every point is within half a plot of its plot's edge, and at angle 0 the plots are squares lined up with the picture",
    run() {
      for (let k = 0; k < 2000; k++) {
        const x = (k * 37.3) % 900,
          y = (k * 91.7) % 700,
          p = A.plotGrid(x, y, 44, 0.35);
        assert.ok(p.edge >= 0 && p.edge <= 22, `${p.edge}`);
      }
      const q = A.plotGrid(50, 10, 44, 0);
      assert.deepEqual([q.iu, q.iv, q.edge], [1, 0, 6]);
    },
  },
];
