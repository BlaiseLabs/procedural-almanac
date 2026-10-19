// The checks of src/noise.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

const tenths = (values) => {
  const t = new Array(10).fill(0);
  for (const v of values) t[Math.floor(v * 10)]++;
  return t.map((c) => c / values.length);
};

export const CHECKS = [
  {
    entry: 'latticeRandom',
    says: 'the same grid point and seed give the same number, in [0, 1)',
    run() {
      for (let x = -20; x < 20; x++)
        for (let y = -20; y < 20; y++) {
          const v = A.latticeRandom(x, y, 7);
          assert.ok(v >= 0 && v < 1);
          assert.equal(v, A.latticeRandom(x, y, 7));
        }
    },
  },
  {
    entry: 'latticeRandom',
    says: 'over a 100 by 100 grid, each tenth of [0, 1) gets 10% of the points, give or take 0.6%',
    run() {
      const v = [];
      for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) v.push(A.latticeRandom(x, y, 3));
      for (const [i, s] of tenths(v).entries())
        assert.ok(Math.abs(s - 0.1) <= 0.006, `tenth ${i}: ${(100 * s).toFixed(2)}%`);
    },
  },
  {
    entry: 'valueNoise',
    says: "at a grid point it is that point's lattice number",
    run() {
      for (let x = -5; x < 5; x++)
        for (let y = -5; y < 5; y++) assert.ok(near(A.valueNoise(x, y, 9), A.latticeRandom(x, y, 9)));
    },
  },
  {
    entry: 'valueNoise',
    says: 'it stays within 0 to 1, and a small step moves it only a little',
    run() {
      const r = new A.SeededRandom('smooth');
      for (let i = 0; i < 20000; i++) {
        const x = r.range(-50, 50),
          y = r.range(-50, 50),
          v = A.valueNoise(x, y, 4);
        assert.ok(v >= 0 && v <= 1);
        assert.ok(Math.abs(A.valueNoise(x + 1e-3, y, 4) - v) < 3e-3, `a jump at ${x}, ${y}`);
      }
    },
  },
  {
    entry: 'fractalNoise',
    says: 'with one octave it is value noise',
    run() {
      for (let i = 0; i < 200; i++)
        assert.equal(A.fractalNoise(i * 0.37, i * 0.11, 5, 1), A.valueNoise(i * 0.37, i * 0.11, 5));
    },
  },
  {
    entry: 'fractalNoise',
    says: 'it stays within 0 to 1, and more octaves add finer detail',
    run() {
      const rough = (oct) => {
        let s = 0;
        for (let i = 0; i < 4000; i++) {
          const x = i * 0.013,
            v = A.fractalNoise(x, 0.5, 2, oct);
          assert.ok(v >= 0 && v <= 1);
          s += Math.abs(A.fractalNoise(x + 0.01, 0.5, 2, oct) - v);
        }
        return s;
      };
      const one = rough(1),
        six = rough(6);
      assert.ok(six > one * 1.5, `six octaves wiggle ${(six / one).toFixed(2)} times as much as one`);
    },
  },
  {
    entry: 'ridgedNoise',
    says: 'with one octave it is value noise folded at its middle, highest where the noise is a half',
    run() {
      for (let i = 0; i < 200; i++) {
        const v = A.valueNoise(i * 0.29, 1.5, 8);
        assert.ok(near(A.ridgedNoise(i * 0.29, 1.5, 8, 1), 1 - Math.abs(v * 2 - 1)));
      }
    },
  },
  {
    entry: 'ridgedNoise',
    says: 'it stays within 0 to 1',
    run() {
      for (let i = 0; i < 10000; i++) {
        const v = A.ridgedNoise(i * 0.071, i * 0.033, 1);
        assert.ok(v >= 0 && v <= 1);
      }
    },
  },
  {
    entry: 'noiseLine',
    says: 'it is value noise read along one line of the plane, a line for each seed',
    run() {
      for (const seed of [0, 1, 17])
        for (let i = 0; i < 100; i++)
          assert.equal(A.noiseLine(i * 0.3, seed), A.valueNoise(i * 0.3, seed * 0.731 + 7.3, seed));
    },
  },

  {
    entry: 'noiseTile',
    says: 'its edges meet: the step across the seam is no bigger than a step inside it',
    run() {
      const size = 64,
        t = A.noiseTile(size, 8, (x, y) => A.latticeRandom(x, y, 5));
      let inside = 0,
        seam = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size - 1; x++) inside = Math.max(inside, Math.abs(t[y * size + x + 1] - t[y * size + x]));
        seam = Math.max(seam, Math.abs(t[y * size] - t[y * size + size - 1]));
      }
      for (let x = 0; x < size; x++) seam = Math.max(seam, Math.abs(t[x] - t[(size - 1) * size + x]));
      assert.ok(seam <= inside + 1e-12, `seam ${seam}, inside ${inside}`);
    },
  },
  {
    entry: 'noiseTile',
    says: "at the grid's points it is the lattice's own values, and between them it stays within them",
    run() {
      const size = 32,
        cells = 4,
        f = size / cells,
        lat = (x, y) => A.latticeRandom(x, y, 9),
        t = A.noiseTile(size, cells, lat);
      for (let gy = 0; gy < cells; gy++)
        for (let gx = 0; gx < cells; gx++) assert.equal(t[gy * f * size + gx * f], lat(gx, gy));
      let lo = 1,
        hi = 0;
      for (let y = 0; y < cells; y++)
        for (let x = 0; x < cells; x++) {
          lo = Math.min(lo, lat(x, y));
          hi = Math.max(hi, lat(x, y));
        }
      for (const v of t) assert.ok(v >= lo - 1e-12 && v <= hi + 1e-12);
    },
  },
];
