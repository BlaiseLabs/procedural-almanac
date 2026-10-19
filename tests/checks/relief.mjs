// The checks of src/relief.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

// a sprite from rows: '.' clear, a letter a colour (L light, D dark, T trunk), alpha highest
const COL = { L: 0xff60d080, D: 0xff205030, T: 0xff304060 };
const sprite = (rows) => {
  const w = rows[0].length,
    h = rows.length,
    px = new Uint32Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => (px[y * w + x] = COL[c] || 0)));
  return { w, h, px, ax: w >> 1, ay: h - 1 };
};
const LOLLY = sprite(['..LLLLLL..', '.LLDLLLLL.', 'LLLLLLDLLL', 'LLLDLLLLLL', '.LLLLLLLL.', '..LLLLLL..', '....TT....', '....TT....', '....TT....']);

export const CHECKS = [
  {
    entry: 'terraceLevel',
    says: 'it counts whole steps above the water and never goes below none or above the most',
    run() {
      assert.equal(A.terraceLevel(-0.3, 0.065, 4), 0);
      assert.equal(A.terraceLevel(0.064, 0.065, 4), 0);
      assert.equal(A.terraceLevel(0.14, 0.065, 4), 2);
      assert.equal(A.terraceLevel(5, 0.065, 4), 3);
    },
  },
  {
    entry: 'wallShade',
    says: "each stuff's top row is the lit edge, and stone's mortar runs in courses of five with joints every eight, staggered",
    run() {
      for (const k of ['stone', 'earth', 'snow', 'sand']) for (let x = 0; x < 16; x++) assert.equal(A.wallShade(k, x, 0), 1);
      for (let x = 0; x < 16; x++) assert.equal(A.wallShade('stone', x, 5), 0.55); // a course's fifth row
      assert.equal(A.wallShade('stone', 7, 2), 0.55); // a joint in the first course
      assert.equal(A.wallShade('stone', 3, 7), 0.55); // the next course's, four along
      assert.ok(A.wallShade('stone', 7, 7) > 0.6);
    },
  },
  {
    entry: 'leafShade',
    says: 'its values are heaps of light, gaps of dark and a narrow middle, nothing else',
    run() {
      let heaps = 0,
        gaps = 0;
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++) {
          const v = A.leafShade(x, y);
          if (v === 1.12) heaps++;
          else if (v === 0.7) gaps++;
          else assert.ok(v > 0.899 && v < 0.981);
        }
      assert.ok(heaps > 0 && gaps > 0);
    },
  },
  {
    entry: 'crownRows',
    says: "a lollipop sprite's crown is its round top and its trunk the narrow stick",
    run() {
      const C = A.crownRows(LOLLY);
      assert.equal(C.top, 0);
      assert.equal(C.trunkTop, 5);
      assert.equal(C.rows.length, 6);
      assert.deepEqual(C.rows[2], { y: 2, a: 0, b: 9 });
    },
  },
  {
    entry: 'silhouetteNormals',
    says: 'a crown faces up and left at its upper left and down and right at its lower right; a card faces the eye everywhere',
    run() {
      const N = A.silhouetteNormals(LOLLY, 'crown'),
        at = (x, y) => [0, 1, 2].map((c) => (N[(y * LOLLY.w + x) * 4 + c] - 127.5) / 127.5);
      const ul = at(1, 2), // (away from the dark clumps, which bend a normal on purpose)
        lr = at(7, 4);
      assert.ok(ul[0] < 0 && ul[1] < 0); // left, and up (green counts down)
      assert.ok(lr[0] > 0 && lr[1] > 0);
      const card = A.silhouetteNormals(LOLLY, 'card');
      for (let i = 0; i < card.length; i += 4) assert.deepEqual([...card.slice(i, i + 4)], [card[0], card[1], card[2], 255]);
    },
  },
  {
    entry: 'crownClumps',
    says: "the same sprite gives the same clumps, all within the crown's width, and a dark heart last",
    run() {
      const C = A.crownRows(LOLLY),
        a = A.crownClumps(LOLLY, C, 0.5),
        b = A.crownClumps(LOLLY, C, 0.5);
      assert.deepEqual(a, b);
      assert.ok(a.length >= 9);
      for (const c of a.slice(0, -1)) assert.ok(Math.abs(c.x) <= 5.5 && c.r > 0);
      const heart = a[a.length - 1];
      assert.ok(heart.col.every((v, i) => v <= Math.max(...a[0].col) + 1e-9) && heart.z === 0);
    },
  },
];
