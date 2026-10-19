// The checks of src/raster.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

const buf = (w, h) => ({ w, h, px: new Uint32Array(w * h) });
const count = (r, c) => r.px.reduce((n, p) => n + (p === c ? 1 : 0), 0);

export const CHECKS = [
  {
    entry: 'ellipseRows',
    says: 'every row it gives lies inside the ellipse and stops within a pixel of its edge',
    run() {
      for (const [cx, cy, rx, ry] of [[10, 10, 5, 5], [7.3, 4.6, 6.2, 3.1]]) {
        let rows = 0;
        A.ellipseRows(cx, cy, rx, ry, (y, xa, xb) => {
          rows++;
          const t = ((y - cy) / ry) ** 2;
          for (const x of [xa, xb]) assert.ok(((x - cx) / rx) ** 2 + t <= 1 + 1e-9);
          for (const x of [xa - 2, xb + 2]) assert.ok(((x - cx) / rx) ** 2 + t > 1);
        });
        assert.equal(rows, Math.floor(cy + ry) - Math.ceil(cy - ry) + 1);
      }
    },
  },
  {
    entry: 'ellipseRows',
    says: 'an ellipse under half a pixel across is the one pixel at its middle',
    run() {
      const rows = [];
      A.ellipseRows(3.4, 7.6, 0.3, 4, (y, xa, xb) => rows.push([y, xa, xb]));
      assert.deepEqual(rows, [[8, 3, 3]]);
    },
  },
  {
    entry: 'fillEllipse',
    says: 'it sets exactly the pixels its rows give, and none outside the buffer',
    run() {
      const r = buf(8, 8);
      A.fillEllipse(r, 0, 0, 3, 3, 7);
      let want = 0;
      A.ellipseRows(0, 0, 3, 3, (y, xa, xb) => {
        if (y >= 0) want += Math.max(0, xb - Math.max(0, xa) + 1);
      });
      assert.equal(count(r, 7), want);
    },
  },
  {
    entry: 'capsuleSteps',
    says: 'its discs start at one end, finish at the other, change radius evenly and are never more than a pixel apart',
    run() {
      const d = [];
      A.capsuleSteps(0, 0, 1, 9, 12, 4, (x, y, r) => d.push([x, y, r]));
      assert.deepEqual(d[0], [0, 0, 1]);
      assert.deepEqual(d[d.length - 1], [9, 12, 4]);
      for (let i = 1; i < d.length; i++) assert.ok(Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]) <= 1);
      assert.ok(Math.abs(d[d.length >> 1][2] - 2.5) < 0.1);
    },
  },
  {
    entry: 'lineCells',
    says: 'it runs from end to end in cells that touch, one cell for each step along the longer axis',
    run() {
      for (const [xa, ya, xb, yb] of [[0, 0, 7, 3], [5, 9, -2, 1], [3, 3, 3, -4]]) {
        const c = [];
        A.lineCells(xa, ya, xb, yb, (x, y) => c.push([x, y]));
        assert.deepEqual(c[0], [xa, ya]);
        assert.deepEqual(c[c.length - 1], [xb, yb]);
        assert.equal(c.length, Math.max(Math.abs(xb - xa), Math.abs(yb - ya)) + 1);
        for (let i = 1; i < c.length; i++) assert.ok(Math.abs(c[i][0] - c[i - 1][0]) <= 1 && Math.abs(c[i][1] - c[i - 1][1]) <= 1);
      }
    },
  },
  {
    entry: 'polygonRows',
    says: 'a square fills its own rows and columns, and a concave shape leaves its notch empty',
    run() {
      const sq = [];
      A.polygonRows([[2, 2], [6, 2], [6, 6], [2, 6]], 20, (y, xa, xb) => sq.push([y, xa, xb]));
      assert.deepEqual(sq, [[2, 2, 6], [3, 2, 6], [4, 2, 6], [5, 2, 6]]);
      const notch = [];
      A.polygonRows([[0, 0], [10, 0], [10, 10], [5, 3], [0, 10]], 20, (y, xa, xb) => y === 8 && notch.push([xa, xb]));
      assert.equal(notch.length, 2);
      assert.ok(notch[0][1] < 5 && notch[1][0] > 5);
    },
  },
  {
    entry: 'ditherEllipse',
    says: 'it sets about the share asked of the pixels under it, spread across them, and leaves the rest as they were',
    run() {
      const r = buf(40, 40);
      r.px.fill(1);
      A.ditherEllipse(r, 20, 20, 16, 16, 9, 0.25);
      let under = 0;
      A.ellipseRows(20, 20, 16, 16, (y, xa, xb) => (under += xb - xa + 1));
      const set = count(r, 9);
      assert.ok(Math.abs(set / under - 0.25) < 0.03);
      assert.equal(count(r, 1), 40 * 40 - set);
    },
  },
  {
    entry: 'shadeEllipse',
    says: 'the pixels under it get darker, a little bluer than redder, and those outside stay as they were',
    run() {
      const r = buf(10, 10),
        c = A.packRgb(200, 200, 200);
      r.px.fill(c);
      A.shadeEllipse(r, 5, 5, 2, 2, 0.7);
      const s = r.px[5 * 10 + 5];
      assert.ok((s & 255) < 200 && ((s >>> 16) & 255) < 200);
      assert.ok(((s >>> 16) & 255) > (s & 255));
      assert.equal(r.px[0], c);
    },
  },
  {
    entry: 'blitSprite',
    says: 'its anchor lands on the point, its empty pixels let what is under show, and flipped it is mirrored about its anchor',
    run() {
      const s = { w: 3, h: 1, px: new Uint32Array([5, 0, 6]), ax: 0, ay: 0 };
      const r = buf(8, 1);
      r.px.fill(1);
      A.blitSprite(r, s, 3, 0);
      assert.deepEqual([...r.px], [1, 1, 1, 5, 1, 6, 1, 1]);
      const f = buf(8, 1);
      A.blitSprite(f, s, 5, 0, true);
      assert.deepEqual([...f.px], [0, 0, 0, 6, 0, 5, 0, 0]);
    },
  },
  {
    entry: 'blitSway',
    says: 'each row moves by the sway at its height above the anchor, and with no sway it stamps as a plain stamp does',
    run() {
      const s = { w: 1, h: 3, px: new Uint32Array([7, 7, 7]), ax: 0, ay: 2 };
      const r = buf(6, 3);
      A.blitSway(r, s, 2, 2, (up) => up);
      assert.equal(r.px[2 * 6 + 2], 7);
      assert.equal(r.px[1 * 6 + 3], 7);
      assert.equal(r.px[0 * 6 + 4], 7);
      const a = buf(6, 3),
        b = buf(6, 3);
      A.blitSway(a, s, 2, 2, () => 0);
      A.blitSprite(b, s, 2, 2);
      assert.deepEqual([...a.px], [...b.px]);
    },
  },
  {
    entry: 'outlinePass',
    says: 'every empty pixel touching a drawn one on a side becomes the line, diagonal neighbours do not, and drawn pixels stay',
    run() {
      const r = buf(7, 7);
      r.px[3 * 7 + 3] = 5;
      A.outlinePass(r, 9);
      assert.equal(count(r, 9), 4);
      assert.equal(r.px[3 * 7 + 3], 5);
      assert.equal(r.px[2 * 7 + 2], 0);
    },
  },
  {
    entry: 'cutSprite',
    says: 'the cut keeps the box pixel for pixel, and its anchor is the same point of the picture',
    run() {
      const r = buf(5, 5);
      r.px.forEach((_, i) => (r.px[i] = i + 1));
      const s = A.cutSprite(r, 1, 2, 3, 4, 2, 4);
      assert.equal(s.w, 3);
      assert.equal(s.h, 3);
      assert.equal(s.px[0], r.px[2 * 5 + 1]);
      assert.equal(s.px[s.ay * s.w + s.ax], r.px[4 * 5 + 2]);
    },
  },
  {
    entry: 'drawnBounds',
    says: 'it is the smallest box holding every drawn pixel, and null for an empty buffer',
    run() {
      const r = buf(10, 10);
      assert.equal(A.drawnBounds(r), null);
      r.px[2 * 10 + 7] = 1;
      r.px[6 * 10 + 3] = 1;
      assert.deepEqual(A.drawnBounds(r), [3, 2, 7, 6]);
    },
  },
];
