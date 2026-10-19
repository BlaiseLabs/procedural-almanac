// The checks of src/projection.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

const VIEW = { size: 20, angle: 0, scale: 10, lift: 3.5, cx: 160, cy: 110 };

export const CHECKS = [
  {
    entry: 'parallax',
    says: 'a layer at the horizon never moves, the nearest moves with the camera, and one half way moves half as far',
    run() {
      assert.equal(A.parallax(500, 0), 0);
      assert.equal(A.parallax(500, 1), 500);
      assert.equal(A.parallax(500, 0.5), 250);
    },
  },
  {
    entry: 'turnedProjection',
    says: 'unturned, a tile is the scale wide and half the scale deep, and each level lifts a point by the lift',
    run() {
      const [x0, y0] = A.turnedProjection(5, 5, 0, VIEW),
        [x1] = A.turnedProjection(6, 5, 0, VIEW),
        [, y1] = A.turnedProjection(5, 6, 0, VIEW),
        [, yz] = A.turnedProjection(5, 5, 2, VIEW);
      assert.ok(near(x1 - x0, 10) && near(y1 - y0, 5) && near(y0 - yz, 7));
    },
  },
  {
    entry: 'turnedProjection',
    says: "the grid's centre lands where it is told at every angle, and a quarter turn puts each corner where the next one was",
    run() {
      for (let a = 0; a < 7; a += 0.5)
        assert.deepEqual(A.turnedProjection(10, 10, 0, { ...VIEW, angle: a }), [160, 110]);
      const q = { ...VIEW, angle: Math.PI / 2 },
        corners = [
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
        ];
      for (let i = 0; i < 4; i++) {
        const a = A.turnedProjection(...corners[i], 0, q),
          b = A.turnedProjection(...corners[(i + 1) % 4], 0, VIEW);
        assert.ok(near(a[0], b[0], 1e-9) && near(a[1], b[1], 1e-9), `corner ${i}`);
      }
    },
  },
  {
    entry: 'turnedDepth',
    says: 'it orders points as the screen does: the greater depth is the lower point on the screen, nearer the viewer',
    run() {
      const r = new A.SeededRandom('depth');
      for (let i = 0; i < 2000; i++) {
        const angle = r.range(0, 6.3),
          p = [r.range(0, 20), r.range(0, 20)],
          q = [r.range(0, 20), r.range(0, 20)],
          v = { ...VIEW, angle };
        const byDepth = Math.sign(A.turnedDepth(...p, 20, angle) - A.turnedDepth(...q, 20, angle)),
          byScreen = Math.sign(A.turnedProjection(...p, 0, v)[1] - A.turnedProjection(...q, 0, v)[1]);
        assert.equal(byDepth, byScreen);
      }
    },
  },
  {
    entry: 'faceShade',
    says: 'a wall facing the light gets -0.18, one facing away -0.40, and one side-on to it half way between',
    run() {
      assert.ok(near(A.faceShade([1, 0], [1, 0]), -0.18));
      assert.ok(near(A.faceShade([-1, 0], [1, 0]), -0.4));
      assert.ok(near(A.faceShade([0, 1], [1, 0]), -0.29));
    },
  },
  {
    entry: 'obliqueShear',
    says: 'raising a point moves it straight up the screen, and moving it back moves it up and across by m',
    run() {
      const m = 0.5,
        M = A.obliqueShear(m, 1, 1, 400),
        at = (x, y, z) => {
          const v = [x, -z, y - 400, 1]; // view space: x_v = x, y_v = -z, z_v = y - camH
          return [0, 1].map((r) => v.reduce((t, c, i) => t + M[r * 4 + i] * c, 0));
        };
      const p = at(10, 0, 20),
        up = at(10, 3, 20),
        back = at(10, 0, 19);
      assert.ok(near(up[0], p[0]) && near(up[1] - p[1], 3));
      assert.ok(near(back[0] - p[0], -m) && near(back[1] - p[1], 1));
    },
  },
  {
    entry: 'obliqueToScreen',
    says: 'a point raised by h shows h higher, and one moved back shows higher and to the side',
    run() {
      const [x0, y0] = A.obliqueToScreen(10, 20, 0, 0, 0, 0.5),
        [x1, y1] = A.obliqueToScreen(10, 20, 4, 0, 0, 0.5),
        [x2, y2] = A.obliqueToScreen(10, 18, 0, 0, 0, 0.5);
      assert.ok(near(x1, x0) && near(y0 - y1, 4));
      assert.ok(near(x2 - x0, -1) && near(y0 - y2, 2));
    },
  },
  {
    entry: 'obliqueToGround',
    says: 'it undoes obliqueToScreen, on flat ground and on a raised step',
    run() {
      const step = (x, y) => (x > 50 ? 6 : 0);
      for (const [x, y] of [
        [10, 20],
        [80, 30],
        [-5, 7],
      ]) {
        const [X, Y] = A.obliqueToScreen(x, y, step(x, y), 3, 4, 0.5),
          [gx, gy] = A.obliqueToGround(X, Y, 3, 4, 0.5, step);
        assert.ok(near(gx, x) && near(gy, y));
      }
    },
  },
];
