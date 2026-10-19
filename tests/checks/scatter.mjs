// The checks of src/scatter.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'scatterAlong',
    says: 'about the share asked for of the slots are kept: 70% of 10,000, give or take 1.5%',
    run() {
      const kept = A.scatterAlong(0, 400000, 40, 11).length;
      assert.ok(Math.abs(kept / 10001 - 0.7) < 0.015, `${((100 * kept) / 10001).toFixed(2)}% kept`);
    },
  },
  {
    entry: 'scatterAlong',
    says: 'each thing stays in its own slot, nudged by at most 40% of a slot either way',
    run() {
      for (const s of A.scatterAlong(-5000, 5000, 25, 3, { chance: 1 }))
        assert.ok(Math.abs(s.x / 25 - s.i) <= 0.4 + 1e-12);
    },
  },
  {
    entry: 'scatterAlong',
    says: 'the same slot is the same thing whatever stretch it is asked for in',
    run() {
      const a = A.scatterAlong(0, 2000, 40, 8, { variants: 3, size: [0.5, 2] }),
        b = A.scatterAlong(800, 3000, 40, 8, { variants: 3, size: [0.5, 2] }),
        byI = new Map(a.map((s) => [s.i, s]));
      let shared = 0;
      for (const s of b)
        if (byI.has(s.i)) {
          assert.deepEqual(s, byI.get(s.i));
          shared++;
        }
      assert.ok(shared > 10);
    },
  },
  {
    entry: 'scatterAlong',
    says: 'sizes stay in their range and variants are whole numbers below the count',
    run() {
      for (const s of A.scatterAlong(0, 50000, 30, 5, { variants: 3, size: [0.5, 2] })) {
        assert.ok(s.size >= 0.5 && s.size < 2);
        assert.ok(Number.isInteger(s.variant) && s.variant >= 0 && s.variant < 3);
      }
    },
  },
  {
    entry: 'windowLit',
    says: 'about the share asked for of the windows are lit: 40% of 20,000, give or take 1.5%',
    run() {
      let on = 0;
      for (let b = 0; b < 100; b++)
        for (let r = 0; r < 20; r++) for (let c = 0; c < 10; c++) if (A.windowLit(b, r, c, 9, 100, 0.4)) on++;
      assert.ok(Math.abs(on / 20000 - 0.4) < 0.015, `${((100 * on) / 20000).toFixed(2)}% lit`);
    },
  },
  {
    entry: 'windowLit',
    says: "a building's pattern holds for 25 seconds and then changes, and buildings change at different moments",
    run() {
      const pattern = (b, t) =>
        Array.from({ length: 60 }, (_, k) => +A.windowLit(b, k % 6, Math.floor(k / 6), 2, t, 0.5)).join('');
      const changes = (b) => {
        const at = [];
        for (let t = 0; t < 200; t += 0.25) if (pattern(b, t) !== pattern(b, t + 0.25)) at.push(t + 0.25);
        return at;
      };
      for (const b of [0, 1, 2]) {
        const at = changes(b);
        for (let k = 1; k < at.length; k++)
          assert.ok(near(at[k] - at[k - 1], 25, 0.26), `building ${b} changed after ${at[k] - at[k - 1]} s`);
        assert.ok(at.length >= 6);
      }
      assert.notEqual(changes(0)[0], changes(1)[0]);
    },
  },
  {
    entry: 'blink',
    says: 'it is on for 1/2 - asin(threshold)/π of each cycle',
    run() {
      for (const th of [0.6, 0, -0.85]) {
        let on = 0;
        const n = 100000;
        for (let i = 0; i < n; i++) if (A.blink(i / n, 2 * Math.PI, 0.4, th)) on++;
        assert.ok(near(on / n, 0.5 - Math.asin(th) / Math.PI, 2e-4), `threshold ${th}: on ${on / n}`);
      }
    },
  },
];
