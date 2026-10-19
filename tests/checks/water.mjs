// The checks of src/water.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

const P = {
  LV: [0, 1, 2, 3, 4, 5, 6],
  FOAM: 'foam',
  FOAM2: 'foam2',
  GLINT: 'glint',
  GLINT2: 'glint2',
  WEED: 'weed',
  WEED2: 'weed2',
  SAND: ['sand0', 'sand1', 'sand2'],
};
const ALL = new Set([...P.LV, P.FOAM, P.FOAM2, P.GLINT, P.GLINT2, P.WEED, P.WEED2, ...P.SAND]);
const wob = (y, t) => Math.round(Math.sin(y * 0.35 + t * 2.2));

export const CHECKS = [
  {
    entry: 'waterTime',
    says: 'its offsets are whole numbers that grow with time, each at its own rate',
    run() {
      const a = A.waterTime(10, 150),
        b = A.waterTime(20, 300);
      for (const k of ['sw', 'sv', 'r1', 'r2', 'r2v', 'glz']) {
        assert.ok(Number.isInteger(a[k]) && Number.isInteger(b[k]));
        assert.ok(b[k] > a[k], k);
      }
      assert.deepEqual([b.sw - a.sw, b.sv - a.sv, b.r1 - a.r1], [60, 20, 150]);
    },
  },
  {
    entry: 'waterPixel',
    says: "it gives only the palette's colours",
    run() {
      for (let i = 0; i < 20000; i++) {
        const t = (i % 100) * 0.37,
          T = A.waterTime(t, Math.floor(t * 15)),
          x = (i * 13) % 500,
          y = (i * 7) % 300;
        assert.ok(ALL.has(A.waterPixel(x, y, i % 70, i % 3 === 0, i % 3, T, wob(y, t), P)));
      }
    },
  },
  {
    entry: 'waterPixel',
    says: "by a beach it is foam at the edge and sand in the shallows; out in open water it is the water's own steps",
    run() {
      const T = A.waterTime(4, 60);
      let foam = 0,
        sand = 0,
        open = 0;
      for (let x = 0; x < 400; x++) {
        if (String(A.waterPixel(x, 50, 0.5, true, 0, T, 0, P)).startsWith('foam')) foam++;
        if (String(A.waterPixel(x, 50, 9, true, 0, T, 0, P)).startsWith('sand')) sand++;
        if (typeof A.waterPixel(x, 50, 2, false, 0, T, 0, P) === 'number') open++;
      }
      assert.equal(foam, 400);
      assert.ok(sand > 300, `${sand} of 400 sand`);
      assert.ok(open > 360, `${open} of 400 water steps`);
    },
  },
  {
    entry: 'waterPixel',
    says: 'deep water far from the shore is darker on the whole than water near it',
    run() {
      const T = A.waterTime(7, 105),
        mean = (d) => {
          let s = 0,
            n = 0;
          for (let y = 0; y < 60; y++)
            for (let x = 0; x < 60; x++) {
              const c = A.waterPixel(x, y, d, false, 0, T, 0, P);
              if (typeof c === 'number') {
                s += c;
                n++;
              }
            }
          return s / n;
        };
      assert.ok(mean(60) > mean(10) + 1, `${mean(60)} against ${mean(10)}`);
    },
  },
  {
    entry: 'waterPixel',
    says: 'the same pixel at the same moment is the same colour; as time goes on it changes',
    run() {
      const at = (t) => {
        const T = A.waterTime(t, Math.floor(t * 15));
        return Array.from({ length: 400 }, (_, i) =>
          A.waterPixel(i % 40, Math.floor(i / 40), 30, false, 0, T, wob(Math.floor(i / 40), t), P),
        );
      };
      assert.deepEqual(at(3.3), at(3.3));
      assert.notDeepEqual(at(3.3), at(5.3));
    },
  },
];
