// The checks of src/paths.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

// a grid from rows: '#' blocked, anything else open, nothing beyond the rows
const grid = (rows) => (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] !== '#';
const WALL = grid(['.....', '.###.', '.#...', '.#.#.', '.....']);

export const CHECKS = [
  {
    entry: 'gridAStar',
    says: 'on an open grid it walks straight and then diagonal, as short as the octile distance',
    run() {
      const p = A.gridAStar([0, 0], [6, 3], { free: () => true });
      assert.equal(p.length, 7); // max(6, 3) + 1 cells
      assert.deepEqual(p[0], [0, 0]);
      assert.deepEqual(p[p.length - 1], [6, 3]);
      for (let i = 1; i < p.length; i++) assert.ok(Math.abs(p[i][0] - p[i - 1][0]) <= 1 && Math.abs(p[i][1] - p[i - 1][1]) <= 1);
    },
  },
  {
    entry: 'gridAStar',
    says: 'it goes round a wall, never through it or past its corner, and gives up past its budget',
    run() {
      const p = A.gridAStar([2, 2], [0, 0], { free: WALL });
      assert.ok(p && p.every(([x, y]) => WALL(x, y)));
      for (let i = 1; i < p.length; i++) {
        const [x0, y0] = p[i - 1],
          [x1, y1] = p[i];
        if (x0 !== x1 && y0 !== y1) assert.ok(WALL(x1, y0) && WALL(x0, y1));
      }
      assert.equal(A.gridAStar([2, 2], [0, 0], { free: WALL, budget: 2 }), null);
    },
  },
  {
    entry: 'nearestFreeCell',
    says: 'it answers the cell itself when open, else an open cell on the nearest ring',
    run() {
      assert.deepEqual(A.nearestFreeCell(0, 0, WALL), [0, 0]);
      const c = A.nearestFreeCell(2, 1, WALL);
      assert.ok(WALL(c[0], c[1]) && Math.max(Math.abs(c[0] - 2), Math.abs(c[1] - 1)) === 1);
      assert.equal(A.nearestFreeCell(50, 50, WALL, 3), null);
    },
  },
  {
    entry: 'segmentClear',
    says: 'a line across open ground is clear and one through a blocked cell is not',
    run() {
      const at = (x, y) => WALL(Math.floor(x), Math.floor(y));
      assert.equal(A.segmentClear(0.5, 0.5, 4.5, 0.5, 0.5, at), true);
      assert.equal(A.segmentClear(0.5, 2.5, 4.5, 2.5, 0.5, at), false);
    },
  },
  {
    entry: 'straightenPath',
    says: 'on open ground the way is one straight step to its end; round a corner it keeps the corner',
    run() {
      const pts = [0, 1, 2, 3].map((i) => ({ x: i, y: i }));
      assert.deepEqual(A.straightenPath({ x: 0, y: 0 }, pts, () => true), [{ x: 3, y: 3 }]);
      const L = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
        clear = (x0, y0, x1, y1) => x0 === x1 || y0 === y1; // only straight lines along the grid see through
      assert.deepEqual(A.straightenPath({ x: 0, y: 0 }, L, clear), [{ x: 2, y: 0 }, { x: 2, y: 2 }]);
    },
  },
  {
    entry: 'floodFill',
    says: 'it finds every cell of an open region and none beyond a wall',
    run() {
      const rows = ['..#..', '..#..', '..#..'],
        free = grid(rows),
        next = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => free(a, b));
      const got = A.floodFill([0, 0], ([x, y]) => x + ',' + y, next);
      assert.equal(got.size, 6);
      assert.ok(!got.has('3,0') && !got.has('4,2'));
    },
  },
  {
    entry: 'untilSettled',
    says: 'what can be got through a chain of needs is all found, and what needs something never got is not',
    run() {
      const rules = [['c', 'b'], ['b', 'a'], ['a', null], ['z', 'y']], // [gives, needs]
        have = new Set();
      const passes = A.untilSettled(() => {
        let grew = false;
        for (const [g, need] of rules) if ((!need || have.has(need)) && !have.has(g)) have.add(g) && (grew = true);
        return grew;
      });
      assert.deepEqual([...have].sort(), ['a', 'b', 'c']);
      assert.ok(passes >= 2);
    },
  },
];
