// The checks of src/particles.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

const ONE = { x: 100, y: 50, z: 0.8, p: 1.3, s: 0.25 };

export const CHECKS = [
  {
    entry: 'particleField',
    says: 'every particle starts inside the field, at a depth from 0.4 to 1, with a phase and a number of its own',
    run() {
      for (const q of A.particleField(5000, 320, 200, new A.SeededRandom('field'))) {
        assert.ok(q.x >= 0 && q.x < 320 && q.y >= 0 && q.y < 200 && q.z >= 0.4 && q.z < 1);
        assert.ok(q.p >= 0 && q.p < 2 * Math.PI && q.s >= 0 && q.s < 1);
      }
    },
  },
  {
    entry: 'particleField',
    says: 'the same seed gives the same field',
    run() {
      assert.deepEqual(
        A.particleField(50, 320, 200, new A.SeededRandom(9)),
        A.particleField(50, 320, 200, new A.SeededRandom(9)),
      );
    },
  },
  {
    entry: 'fall',
    says: 'with no wind, sway or camera it falls straight down at its speed times its depth',
    run() {
      const q = A.fall(ONE, 0.5, { speed: 260 });
      assert.equal(q.x, ONE.x);
      assert.ok(near(q.y, 50 + 260 * 0.8 * 0.5));
    },
  },
  {
    entry: 'fall',
    says: 'wind blows it sideways and the camera carries it back, the near more than the far',
    run() {
      const near1 = A.fall({ ...ONE, z: 1 }, 1, { speed: 20, wind: 10, camera: 4 }),
        far = A.fall({ ...ONE, z: 0.5 }, 1, { speed: 20, wind: 10, camera: 4 });
      assert.ok(near(near1.x - ONE.x, 6) && near(far.x - ONE.x, 3));
    },
  },
  {
    entry: 'fall',
    says: 'its phase turns at its own pace, 1 + s a second',
    run() {
      assert.ok(near(A.fall(ONE, 2, { speed: 1 }).p, 1.3 + 2 * 1.25));
    },
  },
  {
    entry: 'rise',
    says: 'it rises at its speed plus its share of the spread, and wobbles no further than amount / rate either side (a thousandth over, for stepping)',
    run() {
      let q = { ...ONE },
        lo = q.x,
        hi = q.x;
      for (let i = 0; i < 1000; i++) {
        const r = A.rise(q, 0.01, { speed: 14, spread: 16, sway: [2, 6] });
        assert.ok(near(q.y - r.y, (14 + 0.25 * 16) * 0.01));
        q = r;
        lo = Math.min(lo, q.x);
        hi = Math.max(hi, q.x);
      }
      assert.ok(hi - lo <= ((2 * 6) / (2 * 1.25)) * 1.001, `wobbled over ${hi - lo}`); // (exact for smooth motion; stepping overshoots a little)
    },
  },
  {
    entry: 'hover',
    says: "with no camera it hangs where it is: over a minute it stays within its wander's reach",
    run() {
      let q = { ...ONE };
      const o = { x: [0.5, 3], y: [0.4, 2] };
      for (let i = 0; i < 6000; i++) {
        q = A.hover(q, 0.01, o);
        assert.ok(
          Math.abs(q.x - ONE.x) <= (2 * 3) / (0.5 * 1.25) + 1e-9 &&
            Math.abs(q.y - ONE.y) <= (2 * 2) / (0.4 * 1.25) + 1e-9,
        );
      }
    },
  },
  {
    entry: 'hover',
    says: 'the camera carries it back, by its depth if asked',
    run() {
      const o = { x: [0.5, 0], y: [0.4, 0], camera: 10 };
      assert.ok(near(A.hover(ONE, 1, o).x, 90));
      assert.ok(near(A.hover(ONE, 1, { ...o, byDepth: true }).x, 92));
    },
  },
  {
    entry: 'wrapAround',
    says: 'a particle past the margin on one side comes back past the margin on the other, and one inside is left alone',
    run() {
      assert.deepEqual(A.wrapAround({ x: -31, y: 50 }, 320, 200), { x: 349, y: 50 });
      assert.deepEqual(A.wrapAround({ x: 351, y: 231 }, 320, 200), { x: -29, y: -29 });
      assert.deepEqual(A.wrapAround({ x: -29, y: 229 }, 320, 200), { x: -29, y: 229 });
    },
  },
];
