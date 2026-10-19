// The checks of src/limbs.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, PI, near, deepFreeze } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'twoBoneLimb',
    says: 'when the point is in reach, the tip lands on it',
    run() {
      const r = new A.SeededRandom('reach');
      for (let i = 0; i < 2000; i++) {
        const hip = { x: r.range(-5, 5), y: r.range(-5, 5) },
          upper = r.range(1, 6),
          lower = r.range(1, 6),
          angle = r.range(0, 2 * PI),
          d = r.range(Math.abs(upper - lower) + 0.05, upper + lower - 0.05),
          target = { x: hip.x + Math.cos(angle) * d, y: hip.y + Math.sin(angle) * d };
        const { foot } = A.twoBoneLimb(hip, target, upper, lower, r.pick([1, -1]));
        assert.ok(
          near(foot.x, target.x, 1e-6) && near(foot.y, target.y, 1e-6),
          `foot ${JSON.stringify(foot)} for ${JSON.stringify(target)}`,
        );
      }
    },
  },

  {
    entry: 'twoBoneLimb',
    says: 'the bones keep their lengths',
    run() {
      const r = new A.SeededRandom('lengths');
      for (let i = 0; i < 2000; i++) {
        const hip = { x: 0, y: 0 },
          upper = r.range(1, 6),
          lower = r.range(1, 6),
          target = { x: r.range(-15, 15), y: r.range(-15, 15) };
        const { knee, foot } = A.twoBoneLimb(hip, target, upper, lower, 1);
        assert.ok(near(Math.hypot(knee.x - hip.x, knee.y - hip.y), upper, 1e-9));
        assert.ok(near(Math.hypot(foot.x - knee.x, foot.y - knee.y), lower, 1e-9));
      }
    },
  },

  {
    entry: 'twoBoneLimb',
    says: 'out of reach, the limb reaches toward the point, a hundredth short of straight, its joint still bent the chosen way',
    run() {
      const r = new A.SeededRandom('out of reach');
      for (let i = 0; i < 2000; i++) {
        const hip = { x: r.range(-5, 5), y: r.range(-5, 5) },
          upper = r.range(1, 6),
          lower = r.range(1, 6),
          bend = r.pick([1, -1]),
          angle = r.range(-PI, PI),
          d = r.range(upper + lower + 0.5, 60),
          target = { x: hip.x + Math.cos(angle) * d, y: hip.y + Math.sin(angle) * d },
          { knee, foot } = A.twoBoneLimb(hip, target, upper, lower, bend);
        const off = Math.atan2(foot.y - hip.y, foot.x - hip.x) - angle,
          length = Math.hypot(foot.x - hip.x, foot.y - hip.y);
        const degrees = (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) * 180) / PI;
        assert.ok(degrees < 4 / Math.sqrt(upper + lower), `the tip points ${degrees.toFixed(2)} degrees off the point`);
        assert.ok(
          length <= upper + lower && length > upper + lower - 0.02,
          `the limb is ${length} long of ${upper + lower}`,
        );
        // the joint is on the side bend chose: the turn from the line to the knee has the sign of -bend
        const side = Math.cos(angle) * (knee.y - hip.y) - Math.sin(angle) * (knee.x - hip.x);
        assert.ok(Math.sign(side) === -bend, `the joint is on the ${side > 0 ? 'left' : 'right'} for bend ${bend}`);
      }
    },
  },

  {
    entry: 'twoBoneLimb',
    says: 'bend picks the side of the joint: -1 mirrors 1 across the line from the hip to the point',
    run() {
      const hip = { x: 0, y: 0 },
        target = { x: 5, y: 0 },
        a = A.twoBoneLimb(hip, target, 4, 4, 1).knee,
        b = A.twoBoneLimb(hip, target, 4, 4, -1).knee;
      assert.ok(
        near(a.x, b.x) && near(a.y, -b.y) && Math.abs(a.y) > 1,
        `${JSON.stringify(a)} and ${JSON.stringify(b)}`,
      );
    },
  },

  {
    entry: 'twoBoneLimb',
    says: 'it changes nothing it is given, and the same input gives the same output',
    run() {
      const make = () => [{ x: 1, y: 9 }, { x: 4, y: 0 }, 5, 5, -1];
      const a = A.twoBoneLimb(...deepFreeze(make())),
        b = A.twoBoneLimb(...make());
      assert.deepEqual(a, b);
    },
  },

  {
    entry: 'twoBoneLimb3d',
    says: 'both bones keep their lengths, and a foot out of reach is pulled in to the reach',
    run() {
      for (let i = 0; i < 200; i++) {
        const fx = Math.cos(i) * 9, fy = Math.sin(i) * 9, fz = (i % 5) - 1;
        const [kx, ky, kz, ax, ay, az] = A.twoBoneLimb3d(0, 0, 4, fx, fy, fz, 3, 3.5, 0.3, 0.2, 1, -99);
        assert.ok(near(Math.hypot(kx, ky, kz - 4), 3, 1e-6), 'upper');
        assert.ok(near(Math.hypot(ax - kx, ay - ky, az - kz), 3.5, 1e-6), 'lower');
        assert.ok(Math.hypot(ax, ay, az - 4) <= 6.5 - 0.02 + 1e-9, 'reach');
      }
    },
  },

  {
    entry: 'twoBoneLimb3d',
    says: 'the knee bends toward the pole it is given, and never below the ground',
    run() {
      const up = A.twoBoneLimb3d(0, 0, 4, 4, 0, 0, 3, 3, 0, 0, 1);
      assert.ok(up[2] > 2);
      for (let i = 0; i < 100; i++) assert.ok(A.twoBoneLimb3d(0, 0, 0.5, i % 7, 2, 0, 3, 3, 0, 0, -1)[2] >= 0);
    },
  },
];
