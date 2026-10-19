// The checks of src/bodies.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const buf = (w, h, rows) => {
  const p = new Uint32Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => (p[y * w + x] = c === '.' ? 0 : c.charCodeAt(0))));
  return p;
};

export const CHECKS = [
  {
    entry: 'followJoint',
    says: 'the point lands at its set distance from the point before it',
    run() {
      for (let i = 0; i < 200; i++) {
        const [x, y] = A.followJoint(i, -i, i + 5 * Math.cos(i), -i + 5 * Math.sin(i), 3, i * 0.7, 0.5);
        assert.ok(near(Math.hypot(x - i, y + i), 3, 1e-9));
      }
    },
  },
  {
    entry: 'followJoint',
    says: 'it never turns more than its bend from the way the chain runs',
    run() {
      for (let i = 0; i < 200; i++) {
        const back = i * 0.31,
          [x, y] = A.followJoint(0, 0, Math.cos(i), Math.sin(i), 2, back, 0.4);
        assert.ok(Math.abs(A.angleDiff(back, Math.atan2(y, x))) <= 0.4 + 1e-9);
      }
    },
  },
  {
    entry: 'dampedSpring',
    says: 'a damped spring let go settles at its rest',
    run() {
      let x = 5,
        v = 0;
      for (let i = 0; i < 2000; i++) [x, v] = A.dampedSpring(x, v, 1, 90, 11, 1 / 60);
      assert.ok(near(x, 1, 1e-6) && near(v, 0, 1e-6));
    },
  },
  {
    entry: 'footSwing',
    says: 'the foot leaves where it lifted, lands where it lands, and is highest half way',
    run() {
      assert.deepEqual(A.footSwing(1, 2, 5, 6, 0, 3), [1, 2, 0]);
      const end = A.footSwing(1, 2, 5, 6, 1, 3);
      assert.ok(near(end[0], 5) && near(end[1], 6) && near(end[2], 0, 1e-9));
      const mid = A.footSwing(1, 2, 5, 6, 0.5, 3);
      assert.ok(near(mid[0], 3) && near(mid[2], 3));
    },
  },
  {
    entry: 'footReady',
    says: 'a foot left half a stride behind steps, but waits while the other group is stepping unless left almost a stride',
    run() {
      assert.equal(A.footReady(2.1, 4, 10, 1, [0, 0], 0), true);
      assert.equal(A.footReady(1.9, 4, 10, 1, [0, 0], 0), false);
      assert.equal(A.footReady(2.1, 4, 10, 1, [0, 1], 0), false);
      assert.equal(A.footReady(3.9, 4, 10, 1, [0, 1], 0), true);
    },
  },
  {
    entry: 'floatHeight',
    says: 'afloat, the head rides above the water and the middle and the tail below it, a bird above it all along',
    run() {
      assert.ok(A.floatHeight(0, 2, 2, 1, 5, false, 0, 1) > 0);
      assert.ok(A.floatHeight(3, 2, 2, 1, 5, false, 0, 1) < 0);
      assert.ok(A.floatHeight(6, 2, 2, 1, 5, false, 0, 1) < 0);
      for (let i = 0; i < 7; i++) assert.ok(A.floatHeight(i, 2, 2, 1, 5, true, 0, 1) > 0);
    },
  },
  {
    entry: 'waterlineCut',
    says: 'the cut is the half chord of the part at that height, and nothing where the surface misses it',
    run() {
      assert.ok(near(A.waterlineCut(5, 3), 4));
      assert.ok(near(A.waterlineCut(5, 0), 5));
      assert.equal(A.waterlineCut(5, 6), 0);
    },
  },
  {
    entry: 'depthUnderCut',
    says: 'the surface lies lowest in the middle of the cut and rises to its ends',
    run() {
      const mid = A.depthUnderCut(9.5, 12, 10, 10, 4),
        end = A.depthUnderCut(13, 12, 10, 10, 4);
      assert.ok(mid < end);
    },
  },
  {
    entry: 'despeckle',
    says: 'a lone speck among one colour takes that colour, and blocks are left as they are',
    run() {
      const w = 5,
        p = buf(w, 5, ['aaaaa', 'aaaaa', 'aabaa', 'aaaaa', 'aaaaa']);
      A.despeckle(p, w, 5, w, 5);
      assert.ok(p.every((c) => c === 'a'.charCodeAt(0)));
      const q = buf(w, 5, ['aaaaa', 'abbaa', 'abbaa', 'aaaaa', 'aaaaa']),
        before = q.slice();
      A.despeckle(q, w, 5, w, 5);
      assert.deepEqual([...q], [...before]);
    },
  },
  {
    entry: 'staggeredScales',
    says: 'scales fall on every other row, one in three, staggered, and only on the two colours given',
    run() {
      const w = 12,
        h = 4,
        a = 1,
        aLo = 2,
        p = new Uint32Array(w * h).fill(a);
      p[1] = 9;
      A.staggeredScales(p, w, w, h, 0, 0, a, aLo, 5, 6);
      for (let y = 0; y < h; y++) {
        const dark = [...p.subarray(y * w, y * w + w)].filter((c) => c === aLo).length;
        assert.equal(dark, y & 1 ? 0 : 4);
      }
      assert.equal(p[1], 9);
    },
  },
  {
    entry: 'topEdgeShine',
    says: 'only top-edge pixels of the left part lighten',
    run() {
      const w = 10,
        h = 4,
        p = new Uint32Array(w * h);
      for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) p[y * w + x] = 0xff406080;
      A.topEdgeShine(p, w, w, h);
      for (let y = 2; y < h; y++) for (let x = 0; x < w; x++) assert.equal(p[y * w + x], 0xff406080);
      assert.notEqual(p[1 * w + 2], 0xff406080);
      assert.equal(p[1 * w + 9], 0xff406080);
    },
  },
  {
    entry: 'furTufts',
    says: 'the outline lifts a pixel in every third column, never on the face',
    run() {
      const w = 12,
        h = 4,
        line = 7,
        p = new Uint32Array(w * h);
      for (let x = 0; x < w; x++) {
        p[1 * w + x] = line;
        p[2 * w + x] = 3;
      }
      A.furTufts(p, w, w, h, 0, line, 1, 1);
      const lifted = [];
      for (let x = 0; x < w; x++) if (p[x] === line) lifted.push(x);
      assert.ok(lifted.every((x) => x % 3 === 0 && (x - 1) * (x - 1) >= 2.2));
      assert.ok(lifted.length >= 2);
    },
  },
  {
    entry: 'rimDetail',
    says: 'at level 1 it changes nothing; from level 2 the top edge lightens and the underside darkens',
    run() {
      const w = 6,
        h = 6,
        c = 0xff406080,
        p = new Uint32Array(w * h);
      for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) p[y * w + x] = c;
      const q = p.slice();
      A.rimDetail(q, w, w, h, 0, 0, 1, { speckle: 1 });
      assert.deepEqual([...q], [...p]);
      A.rimDetail(p, w, w, h, 0, 0, 2, { speckle: 1 });
      assert.equal(p[1 * w + 2], A.hueShiftTone(c, 1.1));
      assert.equal(p[4 * w + 2], A.hueShiftTone(c, -0.75));
    },
  },
  {
    entry: 'smoothCurve',
    says: 'it passes through the values it is given, eased between them',
    run() {
      const v = A.smoothCurve(5, [
        [0, 1],
        [0.5, 3],
        [1, 2],
      ]);
      assert.ok(near(v[0], 1) && near(v[2], 3) && near(v[4], 2));
      assert.ok(v[1] > 1 && v[1] < 3 && v[3] > 2 && v[3] < 3);
    },
  },
  {
    entry: 'bodySpots',
    says: 'every spot is on a part in its range, and the same seed gives the same spots',
    run() {
      const s = A.bodySpots(new A.SeededRandom('spots'), 2, 5, 40);
      assert.ok(s.every((p) => p.at >= 2 && p.at <= 5 && (p.c === 0 || p.c === 1)));
      assert.deepEqual(s, A.bodySpots(new A.SeededRandom('spots'), 2, 5, 40));
    },
  },
  {
    entry: 'bodyPattern',
    says: 'it is always one of the kinds it is allowed',
    run() {
      for (let i = 0; i < 200; i++)
        assert.ok(['bands', 'tip'].includes(A.bodyPattern(new A.SeededRandom(i), 8, ['bands', 'tip']).kind));
    },
  },
  {
    entry: 'coatColours',
    says: 'the back stays near the hue asked for, and the belly is paler than the back',
    run() {
      for (let i = 0; i < 200; i++) {
        const c = A.coatColours(new A.SeededRandom(i), { hue: [120, 10] }),
          [h] = A.packedToHsl(c.back);
        assert.ok(Math.abs(A.angleDiff((h * Math.PI) / 180, (120 * Math.PI) / 180)) <= (12 * Math.PI) / 180);
        assert.ok(A.packedToHsl(c.belly)[2] > A.packedToHsl(c.back)[2]);
      }
    },
  },
  {
    entry: 'resampleList',
    says: 'it keeps the ends and reads the values between in a straight line',
    run() {
      assert.deepEqual(A.resampleList([0, 10, 20], 5), [0, 5, 10, 15, 20]);
      assert.deepEqual(A.resampleList([7], 3), [7, 7, 7]);
    },
  },
  {
    entry: 'blendRecords',
    says: 'numbers mix, other values switch at half way, and a part only one side has shrinks away',
    run() {
      const m = A.blendRecords({ len: 4, kind: 'leg', sub: { r: 2 } }, { len: 8, kind: 'fin', sub: { r: 4 } }, 0.25);
      assert.deepEqual(m, { len: 5, kind: 'leg', sub: { r: 2.5 } });
      assert.equal(A.blendRecords({ len: 4 }, undefined, 0.95), undefined);
      assert.deepEqual(A.blendRecords({ len: 4, kind: 'x' }, undefined, 0.5), { len: 2, kind: 'x' });
    },
  },
];
