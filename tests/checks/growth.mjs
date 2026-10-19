// The checks of src/growth.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

const tree = (plan, seed = 'tree') => A.branchingTree(100, 200, plan, 1.5, new A.SeededRandom(seed));

export const CHECKS = [
  {
    entry: 'branchingTree',
    says: 'a tree of L levels and F forks has (F^L - 1) / (F - 1) branches and F^(L - 1) tips',
    run() {
      for (const [L, F] of [
        [1, 2],
        [4, 2],
        [5, 3],
        [3, 4],
      ]) {
        const t = tree({ levels: L, forks: F });
        assert.equal(t.segments.length, (F ** L - 1) / (F - 1));
        assert.equal(t.tips.length, F ** (L - 1));
      }
    },
  },
  {
    entry: 'branchingTree',
    says: 'every branch grows from the end of the one before it, and the tips are the ends of the last level',
    run() {
      const { segments, tips } = tree({ levels: 5, forks: 2 }),
        ends = new Set(segments.map((s) => `${s.x1},${s.y1}`));
      assert.deepEqual([segments[0].x0, segments[0].y0], [100, 200]);
      for (const s of segments.slice(1)) assert.ok(ends.has(`${s.x0},${s.y0}`), 'a branch from nowhere');
      assert.deepEqual(
        tips,
        segments.filter((s) => s.level === 1).map((s) => [s.x1, s.y1]),
      );
    },
  },
  {
    entry: 'branchingTree',
    says: 'each level is thinner by the decay, and shorter by the decay give or take 15%',
    run() {
      const { segments } = tree({ levels: 6, forks: 2, decay: 0.7 }),
        len = (s) => Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      for (const s of segments.slice(1)) {
        const parent = segments.find((p) => p.x1 === s.x0 && p.y1 === s.y0);
        assert.ok(near(s.width, parent.width * 0.7, 1e-9));
        const r = len(s) / len(parent);
        assert.ok(r >= 0.7 * 0.85 - 1e-9 && r <= 0.7 * 1.1 + 1e-9, `a branch ${r.toFixed(3)} of its parent`);
      }
    },
  },
  {
    entry: 'branchingTree',
    says: 'the same seed gives the same tree, and another seed another',
    run() {
      assert.deepEqual(tree({ levels: 4 }, 'a'), tree({ levels: 4 }, 'a'));
      assert.notDeepEqual(tree({ levels: 4 }, 'a'), tree({ levels: 4 }, 'b'));
    },
  },
  {
    entry: 'swayingChain',
    says: 'it has as many links as segments, all the same length, starting at its foot',
    run() {
      const pts = A.swayingChain(50, 180, { segments: 12, length: 60 }, 2, 3.7, 4);
      assert.equal(pts.length, 13);
      assert.deepEqual(pts[0], [50, 180]);
      for (let j = 1; j < pts.length; j++)
        assert.ok(near(Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]), 10, 1e-9));
    },
  },
  {
    entry: 'swayingChain',
    says: 'with no sway and no lean it stands straight up',
    run() {
      for (const [x, y] of A.swayingChain(50, 180, { segments: 8, length: 40, sway: 0 }, 1, 9, 2))
        assert.ok(near(x, 50, 1e-12) && y <= 180);
    },
  },
  {
    entry: 'swayingChain',
    says: 'each link leans at most sway times its share of the way up, so the foot is steady and the tip swings most',
    run() {
      for (let t = 0; t < 20; t += 0.13) {
        const pts = A.swayingChain(0, 0, { segments: 10, length: 50, sway: 0.6 }, 1, t, 3);
        for (let j = 1; j < pts.length; j++) {
          const a = Math.atan2(pts[j][0] - pts[j - 1][0], pts[j - 1][1] - pts[j][1]);
          assert.ok(Math.abs(a) <= 0.6 * (j / 10) + 1e-9, `link ${j} leans ${a}`);
        }
      }
    },
  },
];
