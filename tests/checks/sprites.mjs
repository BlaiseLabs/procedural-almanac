// The checks of src/sprites.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

const grid = (rows) => rows.map((r) => r.split(''));

export const CHECKS = [
  {
    entry: 'outlineSprite',
    says: 'empty pixels touching a drawn one on a side become the line, at the picture edge too, and the input is unchanged',
    run() {
      const px = new Uint32Array([5, 0, 0, 0]),
        out = A.outlineSprite(px, 2, 2, 9);
      assert.deepEqual([...out], [5, 9, 9, 0]);
      assert.deepEqual([...px], [5, 0, 0, 0]);
    },
  },
  {
    entry: 'spriteFromRows',
    says: 'each letter becomes its colour one pixel in from a ring of room, dots and spaces stay empty, and it stands on its middle foot',
    run() {
      const s = A.spriteFromRows(['a.', ' b'], (ch) => (ch === 'a' ? 3 : 4), { outline: false });
      assert.equal(s.w, 4);
      assert.equal(s.h, 4);
      assert.equal(s.px[1 * 4 + 1], 3);
      assert.equal(s.px[2 * 4 + 2], 4);
      assert.equal(s.px[1 * 4 + 2], 0);
      assert.deepEqual([s.ax, s.ay], [2, 2]);
      const o = A.spriteFromRows(['a'], () => 3, { ink: 8 });
      assert.equal(o.px.filter((p) => p === 8).length, 4);
    },
  },
  {
    entry: 'layTemplate',
    says: 'its letters overwrite the grid, its dots leave what is there, mirrored it lands reversed, and keep can hold a letter back',
    run() {
      const g = grid(['xxxx', 'xxxx']);
      A.layTemplate(g, ['a.b.'], 1);
      assert.deepEqual(g[1], ['a', 'x', 'b', 'x']);
      A.layTemplate(g, ['a.b.'], 0, true);
      assert.deepEqual(g[0], ['x', 'b', 'x', 'a']);
      A.layTemplate(g, ['zzzz'], 1, false, (old) => old === 'a');
      assert.deepEqual(g[1], ['a', 'z', 'z', 'z']);
      A.layTemplate(g, ['qqqq', 'qqqq'], 1);
      assert.equal(g.length, 2);
    },
  },
  {
    entry: 'fillBetweenEdges',
    says: 'each row is filled from its first drawn letter to its last, ends in the edge letter and halves in the near and far letters',
    run() {
      const g = grid(['.a....b.', '........']);
      A.fillBetweenEdges(g, 0, 2, 'o', 'L', 'R');
      assert.equal(g[0].join(''), '.oLLRRo.');
      assert.equal(g[1].join(''), '........');
    },
  },
  {
    entry: 'gridPixels',
    says: 'each letter becomes its palette colour row by row, and dots and unknown letters are empty',
    run() {
      const px = A.gridPixels(grid(['ab', '.z']), { a: 5, b: 6 });
      assert.deepEqual([...px], [5, 6, 0, 0]);
    },
  },
  {
    entry: 'packSheet',
    says: 'each frame lands whole in its cell, so many across and then the next row',
    run() {
      const f = (v) => new Uint32Array([v, v, v, v]);
      const s = A.packSheet([f(1), f(2), f(3)], 2, 2, 2);
      assert.deepEqual([s.w, s.h], [4, 4]);
      assert.deepEqual([...s.data.slice(0, 4)], [1, 1, 2, 2]);
      assert.equal(s.data[2 * 4 + 0], 3);
      assert.equal(s.data[2 * 4 + 2], 0);
    },
  },
  {
    entry: 'leafCrown',
    says: 'the same seed draws the same crown, lit more on its upper left than its lower right, in only the four leaf colours',
    run() {
      const make = () => {
        const r = { w: 64, h: 64, px: new Uint32Array(64 * 64) };
        A.leafCrown(r, new A.SeededRandom(7), 32, 32, 10, 9, [1, 2, 3, 4]);
        return r;
      };
      const a = make(),
        b = make();
      assert.deepEqual([...a.px], [...b.px]);
      const used = new Set(a.px);
      used.delete(0);
      for (const c of used) assert.ok([1, 2, 3, 4].includes(c));
      const avg = (x0, y0) => {
        let s = 0,
          n = 0;
        for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) if (a.px[y * 64 + x]) (s += a.px[y * 64 + x]), n++;
        return s / n;
      };
      assert.ok(avg(24, 24) > avg(32, 32));
    },
  },
  {
    entry: 'barkTrunk',
    says: 'it fills its column from top to foot, leaning only at the top, a pixel wider near the foot, its left column the light bark',
    run() {
      const r = { w: 20, h: 20, px: new Uint32Array(400) };
      A.barkTrunk(r, 10, 2, 18, 2, [1, 2], 3);
      const row = (y) => [...r.px.slice(y * 20, y * 20 + 20)].map((p, x) => (p ? x : -1)).filter((x) => x >= 0);
      assert.ok(row(2)[0] > row(18)[0]);
      assert.equal(row(18).length, 3);
      assert.equal(row(10).length, 2);
      assert.equal(r.px[10 * 20 + row(10)[0]], 2);
    },
  },
];
