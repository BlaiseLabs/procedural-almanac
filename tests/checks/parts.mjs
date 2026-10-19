// The checks of src/parts.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, canvas, pixel, pixels } from '../helpers.mjs';

const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const BODY = [
  { s: 'body', z: 3, tone: 'body', ells: [[0, 6, 6, 3.5, 0]], soft: true },
  { s: 'cap', z: 1, tone: 'leg', x1: -3, y1: 4, x2: -3.5, y2: 0, r1: 1, r2: 0.7 },
  { s: 'ell', z: 4, tone: 'body', x: 6, y: 9, rx: 2.4, ry: 2, rot: 0 },
  {
    s: 'line',
    z: 2,
    tone: 'leg',
    pts: [
      [-6, 7],
      [-8, 9],
    ],
    w: 0.6,
  },
  { s: 'eye', z: 5, x: 7, y: 9.5, r: 0.6 },
];
const draw = (dir, flat = false, line = [20, 10, 30]) => {
  const g = canvas(160, 120, '#ffffff'),
    T = { body: A.tones([170, 120, 80]), leg: A.tones([120, 90, 60]) };
  g.translate(80, 100);
  A.drawParts(g, BODY, 6, { dir, toneOf: (t) => T[t], line, flat, shadow: 14 });
  return g;
};

export const CHECKS = [
  {
    entry: 'tones',
    says: 'dark is darker and bluer than the colour, light is lighter and warmer, and line is the darkest',
    run() {
      const c = [170, 120, 80],
        t = A.tones(c);
      assert.equal(t.base, c);
      assert.ok(lum(t.dark) < lum(c) && t.dark[2] / lum(t.dark) > c[2] / lum(c), 'dark: darker and bluer');
      assert.ok(lum(t.light) > lum(c) && t.light[0] - t.light[2] > 0, 'light: lighter and warm');
      assert.ok(lum(t.line) < lum(t.dark));
    },
  },
  {
    entry: 'drawParts',
    says: 'facing left is facing right mirrored, pixel for pixel',
    run() {
      const r = draw(1),
        l = draw(-1),
        R = r.getImageData(0, 0, 160, 120).data,
        L = l.getImageData(0, 0, 160, 120).data;
      let differ = 0;
      for (let y = 0; y < 120; y++)
        for (let x = 0; x < 160; x++) {
          const i = (y * 160 + x) * 4,
            j = (y * 160 + (159 - x)) * 4;
          if (Math.abs(R[i] - L[j]) > 2 || Math.abs(R[i + 2] - L[j + 2]) > 2) differ++;
        }
      assert.ok(differ < 160 * 120 * 0.01, `${differ} pixels differ`); // (anti-aliased edges fall a pixel apart)
    },
  },
  {
    entry: 'drawParts',
    says: 'one outline goes round the figure in the line colour, and the figure is shaded lighter toward the upper left',
    run() {
      const g = draw(1, false, [255, 0, 255]),
        // across the body at its middle height: magenta outline at the left edge, then the shading
        y = 100 - 6 * 6;
      let firstX = -1;
      for (let x = 0; x < 160; x++) {
        const [r, gg, b] = pixel(g, x, y);
        if (r > 200 && gg < 60 && b > 200) {
          firstX = x;
          break;
        }
      }
      assert.ok(firstX > 0 && firstX < 80 - 30, `the outline at ${firstX}`);
      assert.ok(lum(pixel(g, 80 - 12, y - 8)) > lum(pixel(g, 80 + 20, y + 10)), 'lighter up and to the left');
    },
  },
  {
    entry: 'drawParts',
    says: 'flat art fills each part in its base tone',
    run() {
      const g = draw(1, true);
      assert.deepEqual(pixel(g, 80, 100 - 36).slice(0, 3), [170, 120, 80]);
    },
  },
  {
    entry: 'drawParts',
    says: 'nearer parts cover farther ones: drawn in the order of z, whatever order they are given in',
    run() {
      const T = { a: A.tones([200, 30, 30]), b: A.tones([30, 30, 200]) },
        parts = [
          { s: 'ell', z: 2, tone: 'a', x: 0, y: 5, rx: 4, ry: 4, rot: 0 },
          { s: 'ell', z: 1, tone: 'b', x: 1, y: 5, rx: 4, ry: 4, rot: 0 },
        ],
        draw2 = (list) => {
          const g = canvas(100, 100, '#fff');
          g.translate(50, 80);
          A.drawParts(g, list, 5, { dir: 1, toneOf: (t) => T[t], line: [0, 0, 0], flat: true });
          return g;
        };
      const g = draw2(parts);
      assert.ok(pixel(g, 52, 80 - 25)[0] > 150, 'the red (nearer) one on top where they overlap');
      assert.equal(pixels(g, 100, 100), pixels(draw2(parts.slice().reverse()), 100, 100));
    },
  },
  {
    entry: 'tracePart',
    says: 'a traced body is its ellipses together, and a traced part grown by a pixel covers the part and a ring round it',
    run() {
      const body = {
          s: 'body',
          ells: [
            [0, 6, 6, 3.5, 0],
            [5, 9, 2.5, 2, 0.3],
          ],
        },
        a = canvas(120, 100, '#fff'),
        b = canvas(120, 100, '#fff');
      for (const g of [a, b]) {
        g.translate(60, 90);
        g.fillStyle = '#000';
      }
      a.beginPath();
      A.tracePart(a, body, 5);
      a.fill();
      b.beginPath();
      for (const [x, y, rx, ry, rot] of body.ells) {
        b.moveTo(x * 5 + rx * 5, -y * 5);
        b.ellipse(x * 5, -y * 5, rx * 5, ry * 5, -rot, 0, Math.PI * 2);
      }
      b.fill();
      assert.equal(pixels(a, 120, 100), pixels(b, 120, 100));
      const ell = { s: 'ell', x: 0, y: 8, rx: 4, ry: 3, rot: 0 },
        fillAt = (grow) => {
          const g = canvas(120, 100, '#fff');
          g.translate(60, 90);
          g.fillStyle = '#000';
          g.beginPath();
          A.tracePart(g, ell, 5, grow);
          g.fill();
          return g;
        };
      // the ellipse's right edge is at x = 80 (radius 20 from 60); grown by a pixel, at 81: column 80 is the ring
      assert.ok(lum(pixel(fillAt(0), 80, 50)) > 200 && lum(pixel(fillAt(1), 80, 50)) < 60, 'the ring beyond the edge');
    },
  },
  {
    entry: 'partOutline',
    says: 'traced, its commands give the very pixels tracePart gives, for every kind of part',
    run() {
      for (const part of BODY) {
        if (part.s === 'eye' || part.s === 'line') continue;
        const a = canvas(160, 120, '#fff'),
          b = canvas(160, 120, '#fff');
        for (const g of [a, b]) {
          g.translate(80, 100);
          g.fillStyle = '#000';
          g.beginPath();
        }
        A.tracePart(a, part, 6, 0.5);
        A.drawList(b, [{ path: A.partOutline(part, 6, 0.5), fill: '#000' }]);
        a.fill();
        assert.equal(pixels(a, 160, 120), pixels(b, 160, 120), part.s);
      }
    },
  },
];
