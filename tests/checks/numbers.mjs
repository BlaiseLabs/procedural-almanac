// The checks of src/numbers.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'clamp',
    says: 'it keeps a number inside its range, and leaves one already inside as it is',
    run() {
      assert.equal(A.clamp(-3, 0, 10), 0);
      assert.equal(A.clamp(13, 0, 10), 10);
      for (const v of [0, 2.5, 10]) assert.equal(A.clamp(v, 0, 10), v);
    },
  },
  {
    entry: 'clamp',
    says: 'with no range given, the range is 0 to 1',
    run() {
      assert.deepEqual([A.clamp(-0.2), A.clamp(0.4), A.clamp(1.7)], [0, 0.4, 1]);
    },
  },
  {
    entry: 'lerp',
    says: 't = 0 gives a, t = 1 gives b, and t = 0.5 the point half way',
    run() {
      assert.equal(A.lerp(10, 20, 0), 10);
      assert.equal(A.lerp(10, 20, 1), 20);
      assert.equal(A.lerp(10, 20, 0.5), 15);
    },
  },
  {
    entry: 'lerp',
    says: 'beyond 0 and 1 it goes on past the ends in the same straight line',
    run() {
      assert.equal(A.lerp(10, 20, 1.5), 25);
      assert.equal(A.lerp(10, 20, -1), 0);
    },
  },
  {
    entry: 'smoothstep',
    says: 'it is 0 at or before the first edge, 1 at or beyond the second, and a half in the middle',
    run() {
      assert.deepEqual(
        [
          A.smoothstep(2, 6, 1),
          A.smoothstep(2, 6, 2),
          A.smoothstep(2, 6, 4),
          A.smoothstep(2, 6, 6),
          A.smoothstep(2, 6, 9),
        ],
        [0, 0, 0.5, 1, 1],
      );
    },
  },
  {
    entry: 'smoothstep',
    says: 'it starts and ends level, and never goes down on the way',
    run() {
      const d = 1e-6,
        slope = (v) => (A.smoothstep(0, 1, v + d) - A.smoothstep(0, 1, v)) / d;
      assert.ok(Math.abs(slope(0)) < 1e-4 && Math.abs(slope(1 - d)) < 1e-4, `slopes ${slope(0)} and ${slope(1 - d)}`);
      for (let i = 1; i <= 1000; i++) assert.ok(A.smoothstep(0, 1, i / 1000) >= A.smoothstep(0, 1, (i - 1) / 1000));
    },
  },
  {
    entry: 'wrap',
    says: 'the result is always 0 or more and less than the span, and differs from the number by whole spans',
    run() {
      const r = new A.SeededRandom('wrap');
      for (let i = 0; i < 5000; i++) {
        const v = r.range(-1e4, 1e4),
          span = r.range(0.5, 300),
          w = A.wrap(v, span);
        assert.ok(w >= 0 && w < span, `wrap(${v}, ${span}) = ${w}`);
        const k = (v - w) / span;
        assert.ok(near(k, Math.round(k), 1e-6), `${v} and ${w} are ${k} spans apart`);
      }
    },
  },

  {
    entry: 'angleDiff',
    says: 'it is always between -pi and pi, and adding it to the first angle reaches the second, give or take whole turns',
    run() {
      for (let i = 0; i < 5000; i++) {
        const a = Math.sin(i * 1.3) * 40,
          b = Math.cos(i * 0.7) * 40,
          d = A.angleDiff(a, b);
        assert.ok(d >= -Math.PI && d <= Math.PI);
        const turns = (a + d - b) / (2 * Math.PI);
        assert.ok(near(turns, Math.round(turns), 1e-9));
      }
    },
  },
  {
    entry: 'angleDiff',
    says: 'a turn just past half a circle is given the other way round',
    run() {
      assert.ok(near(A.angleDiff(0, Math.PI + 0.1), -(Math.PI - 0.1), 1e-12));
      assert.ok(near(A.angleDiff(0.1, 2 * Math.PI - 0.1), -0.2, 1e-12));
    },
  },
];
