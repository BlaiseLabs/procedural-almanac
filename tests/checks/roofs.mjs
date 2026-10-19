// The checks of src/roofs.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'roofPlan',
    says: 'its ridge lies between its eaves, nearer the north one, and only a hip roof\'s ends slope in',
    run() {
      for (const kind of ['gable', 'hip']) {
        const p = A.roofPlan(kind, 40, 28, 3, 100, 80);
        assert.ok(p.yN < p.yR && p.yR < p.yS);
        assert.ok(p.yR - p.yN < p.yS - p.yR);
        assert.equal(p.x1 - p.x0 + 1, 46);
        assert.equal(p.inset > 0, kind === 'hip');
      }
    },
  },
  {
    entry: 'slopeShade',
    says: 'the rows just under the ridge are lit, the last rows by the eave are dark, and the middle is left as it is',
    run() {
      assert.equal(A.slopeShade(41, 40, 80), 'ridge');
      assert.equal(A.slopeShade(79, 40, 80), 'eave');
      assert.equal(A.slopeShade(60, 40, 80), null);
    },
  },
  {
    entry: 'roofTexel',
    says: 'tiles repeat every six pixels across and four down, their rows staggered by three',
    run() {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 24; x++) {
          assert.equal(A.roofTexel('tile', x + 6, y, 0, 0), A.roofTexel('tile', x, y, 0, 0));
          assert.equal(A.roofTexel('tile', x, y + 8, 0, 0), A.roofTexel('tile', x, y, 0, 0));
          assert.equal(A.roofTexel('tile', x + 3, y + 4, 0, 0), A.roofTexel('tile', x, y, 0, 0));
        }
    },
  },
  {
    entry: 'roofTexel',
    says: 'red tiles show mortar where plain tiles show a dark seam',
    run() {
      let seams = 0;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 24; x++)
          if (A.roofTexel('tile', x, y, 0, 0) === 'seam') {
            seams++;
            assert.equal(A.roofTexel('redtile', x, y, 0, 0), 'mortar');
          }
      assert.ok(seams > 0);
    },
  },
];
