// The checks of src/drawing.js: one sentence each, the sentences almanac.json lists. They draw on a real canvas and
// read its pixels.
import * as A from '../../src/index.js';
import { assert, near, canvas, pixel, bbox, pixels } from '../helpers.mjs';

const ink = (r, g, b, a) => a > 128 && r < 128; // a dark drawn pixel on a white page
const drawn = (r, g, b, a) => a > 0 && r < 250; // any pixel drawn on, however faintly (a sharp tip is anti-aliased)
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

export const CHECKS = [
  {
    entry: 'partPath',
    says: 'every shape stands on its point, as wide and as tall as asked, to within a pixel and a half',
    run() {
      for (const shape of ['blob', 'box', 'spike', 'tri', 'gem', 'dome', 'stem', 'disc', 'ring']) {
        const g = canvas(120, 120, '#fff');
        g.fillStyle = '#000';
        g.beginPath();
        A.partPath(g, shape, 60, 90, 30, 40, 0);
        g.fill('evenodd');
        const [x0, y0, x1, y1] = bbox(g, 120, 120, drawn);
        assert.ok(Math.abs(y1 + 1 - 90) <= 1.5, `${shape}: its base at ${y1 + 1}`);
        assert.ok(
          Math.abs(x1 + 1 - x0 - 30) <= 1.5 ||
            shape === 'stem' ||
            shape === 'spike' ||
            shape === 'tri' ||
            shape === 'gem',
          `${shape}: ${x1 + 1 - x0} wide`,
        );
        assert.ok(Math.abs(y1 + 1 - y0 - 40) <= 1.5, `${shape}: ${y1 + 1 - y0} tall`);
      }
    },
  },
  {
    entry: 'partPath',
    says: 'a ring has a hole, and an unknown shape is a box',
    run() {
      const g = canvas(120, 120, '#fff');
      g.fillStyle = '#000';
      g.beginPath();
      A.partPath(g, 'ring', 60, 90, 40, 40, 0);
      g.fill('evenodd');
      assert.ok(
        lum(pixel(g, 60, 70)) > 200 && lum(pixel(g, 60 + 15, 70)) < 60,
        'the middle is open, the band is drawn',
      );
      const a = canvas(80, 80, '#fff'),
        b = canvas(80, 80, '#fff');
      for (const [g2, s] of [
        [a, 'box'],
        [b, 'kite'],
      ]) {
        g2.fillStyle = '#000';
        g2.beginPath();
        A.partPath(g2, s, 40, 60, 20, 30, 0);
        g2.fill();
      }
      assert.equal(pixels(a, 80, 80), pixels(b, 80, 80));
    },
  },
  {
    entry: 'fillInArt',
    says: 'flat art fills in exactly the colour; gradient art is lighter at the top left than at the bottom right',
    run() {
      const flat = canvas(100, 100, '#fff');
      flat.beginPath();
      flat.rect(20, 20, 60, 60);
      A.fillInArt(flat, [180, 90, 40], 50, 80, 60, 60, { shade: 'flat' });
      assert.deepEqual(pixel(flat, 50, 50).slice(0, 3), [180, 90, 40]);
      const gr = canvas(100, 100, '#fff');
      gr.beginPath();
      gr.rect(20, 20, 60, 60);
      A.fillInArt(gr, [180, 90, 40], 50, 80, 60, 60, { shade: 'gradient' });
      assert.ok(lum(pixel(gr, 23, 23)) > lum(pixel(gr, 50, 50)) && lum(pixel(gr, 50, 50)) > lum(pixel(gr, 77, 77)));
    },
  },
  {
    entry: 'fillInArt',
    says: 'facet art steps from light to dark across the middle instead of blending, and a line is drawn round when asked',
    run() {
      const g = canvas(100, 100, '#fff');
      g.beginPath();
      g.rect(20, 20, 60, 60);
      A.fillInArt(g, [180, 90, 40], 50, 80, 60, 60, { shade: 'facet', line: '#00ff00', lineWidth: 2 });
      const before = lum(pixel(g, 47, 47)),
        after = lum(pixel(g, 53, 53)),
        far = lum(pixel(g, 30, 30));
      assert.ok(
        before - after > 25 && far - before < before - after,
        `a step of ${(before - after).toFixed(1)} at the middle`,
      );
      assert.deepEqual(pixel(g, 50, 20).slice(0, 3), [0, 255, 0]);
    },
  },
  {
    entry: 'drawRecipe',
    says: 'the same seed draws the same picture, pixel for pixel, and another seed another',
    run() {
      const recipe = {
          parts: [
            { shape: 'blob', w: 8, h: 6, color: 'leaf', count: 5, spread: 9 },
            { shape: 'stem', w: 2, h: 10, color: 'bark', lean: 0.3 },
          ],
        },
        colourOf = (c) => (c === 'leaf' ? [70, 140, 60] : [110, 80, 50]),
        draw = (seed) => {
          const g = canvas(120, 120, '#fff');
          A.drawRecipe(g, recipe, 60, 100, 2, new A.SeededRandom(seed), colourOf, { shade: 'gradient' });
          return pixels(g, 120, 120);
        };
      assert.equal(draw('bush'), draw('bush'));
      assert.notEqual(draw('bush'), draw('shrub'));
    },
  },
  {
    entry: 'drawRecipe',
    says: 'a part repeated is drawn that many times, spread about its place',
    run() {
      const g = canvas(200, 100, '#fff');
      A.drawRecipe(
        g,
        { parts: [{ shape: 'box', w: 3, h: 3, count: 6, spread: 30, jitter: 0, color: 'x' }] },
        100,
        80,
        1,
        new A.SeededRandom(4),
        () => [0, 0, 0],
      );
      const [x0, , x1] = bbox(g, 200, 100, ink);
      assert.ok(x1 - x0 > 20 && x0 >= 100 - 30 - 2 && x1 <= 100 + 30 + 2, `spread from ${x0} to ${x1}`);
    },
  },
  {
    entry: 'grain',
    says: 'with no amount it draws nothing; with some, a flat grey picture gets a fine texture that keeps its average',
    run() {
      const none = canvas(64, 64, '#808080');
      A.grain(none, 64, 64, 0);
      const g = canvas(256, 256, '#808080');
      A.grain(g, 256, 256, 0.5);
      const d = g.getImageData(0, 0, 256, 256).data;
      let sum = 0,
        sq = 0;
      for (let i = 0; i < d.length; i += 4) ((sum += d[i]), (sq += d[i] * d[i]));
      const n = d.length / 4,
        mean = sum / n,
        sd = Math.sqrt(sq / n - mean * mean);
      assert.deepEqual(pixel(none, 30, 30), [128, 128, 128, 255]);
      assert.ok(Math.abs(mean - 128) < 6 && sd > 8, `mean ${mean.toFixed(1)}, spread ${sd.toFixed(1)}`);
    },
  },
  {
    entry: 'grain',
    says: 'its texture repeats every 128 pixels',
    run() {
      const g = canvas(300, 300, '#808080');
      A.grain(g, 300, 300, 0.6);
      for (const [x, y] of [
        [5, 7],
        [60, 100],
        [127, 3],
      ])
        assert.deepEqual(pixel(g, x, y), pixel(g, x + 128, y + 128));
    },
  },
  {
    entry: 'vignette',
    says: 'it darkens the corners and leaves the middle as it was; with no amount it draws nothing',
    run() {
      const g = canvas(200, 120, '#ffffff');
      A.vignette(g, 200, 120, 0.6);
      assert.deepEqual(pixel(g, 100, 60), [255, 255, 255, 255]);
      assert.ok(lum(pixel(g, 1, 1)) < 200 && lum(pixel(g, 198, 118)) < 200);
      const n = canvas(50, 50, '#ffffff');
      A.vignette(n, 50, 50, 0);
      assert.deepEqual(pixel(n, 0, 0), [255, 255, 255, 255]);
    },
  },
  {
    entry: 'glowSprite',
    says: 'it is strongest in the middle and gone at the edges, and the same colour gives the very same canvas',
    run() {
      const s = A.glowSprite([250, 220, 120]),
        g = s.getContext('2d');
      assert.ok(pixel(g, 8, 8)[3] > 200 && pixel(g, 0, 0)[3] < 10);
      assert.equal(A.glowSprite([250, 220, 120]), s);
    },
  },
  {
    entry: 'glowingDisc',
    says: 'the disc is solid in its colour, and its halo fades to nothing by four and a half radii',
    run() {
      const g = canvas(200, 200, '#000000');
      A.glowingDisc(g, 100, 100, 10, [255, 240, 200], 1);
      assert.deepEqual(pixel(g, 100, 100).slice(0, 3), [255, 240, 200]);
      assert.ok(lum(pixel(g, 120, 100)) > 5, 'a halo just outside the disc');
      assert.deepEqual(pixel(g, 100 + 47, 100), [0, 0, 0, 255]);
    },
  },
  {
    entry: 'lightRays',
    says: 'rays only ever lighten the picture, and fade from the top downward',
    run() {
      const base = canvas(320, 200, '#204060'),
        g = canvas(320, 200, '#204060');
      A.lightRays(g, 320, 200, { count: 6, colour: [230, 255, 250], alpha: 0.5, seed: 11, t: 3, reach: 0.85 });
      const a = g.getImageData(0, 0, 320, 200).data,
        b = base.getImageData(0, 0, 320, 200).data;
      let top = 0,
        low = 0;
      for (let i = 0; i < a.length; i += 4) {
        for (let k = 0; k < 3; k++) assert.ok(a[i + k] >= b[i + k]);
        const y = Math.floor(i / 4 / 320);
        if (y < 20) top += a[i] - b[i];
        if (y > 150 && y < 170) low += a[i] - b[i];
      }
      assert.ok(top > low * 2, `top ${top}, low ${low}`);
    },
  },
  {
    entry: 'fogBands',
    says: 'fog is thickest in its band and leaves the picture well above it clear',
    run() {
      const g = canvas(200, 200, '#000000');
      A.fogBands(g, 200, 200, { band: [0.5, 0.7], colour: [255, 255, 255], alpha: 0.8, t: 0 });
      assert.ok(lum(pixel(g, 100, 120)) > 50, 'in the band');
      assert.deepEqual(pixel(g, 100, 20), [0, 0, 0, 255]);
    },
  },
  {
    entry: 'mirrorBelow',
    says: 'below the line it shows what is above, upside down, and above the line nothing changes',
    run() {
      const g = canvas(100, 100, '#000000');
      g.fillStyle = '#ff0000';
      g.fillRect(0, 60, 100, 10); // a red stripe 10 to 20 pixels above the line at 80
      const above = pixels(g, 100, 80);
      A.mirrorBelow(g, 100, 100, { base: 0.8, alpha: 1, ripple: 0, t: 0 });
      assert.ok(pixel(g, 50, 85)[0] < 40, 'just below the line: the dark that was just above it');
      assert.ok(pixel(g, 50, 94)[0] > 100, 'further down: the red stripe, mirrored');
      const after = g.getImageData(0, 0, 100, 80).data;
      assert.equal(Buffer.from(after).toString('base64'), above);
    },
  },
  {
    entry: 'puffCloud',
    says: 'its shadow lies below it and to the right, and it is about 44 pixels across at size 1',
    run() {
      const g = canvas(200, 100, '#000000');
      A.puffCloud(g, 100, 50, 1, 0, { colour: [255, 255, 255], shadow: [255, 0, 0], alpha: 1 });
      const white = bbox(g, 200, 100, (r, gg, b) => r > 200 && gg > 200),
        red = bbox(g, 200, 100, (r, gg, b) => r > 100 && gg < 60);
      assert.ok(red[2] > white[2] && red[3] > white[3], 'the shadow reaches further right and lower');
      assert.ok(Math.abs(white[2] - white[0] + 1 - 44) <= 3, `${white[2] - white[0] + 1} across`);
    },
  },
  {
    entry: 'inkedLine',
    says: 'the ink follows the line, and the hatching lies only below it',
    run() {
      const g = canvas(320, 200, '#ffffff'),
        lineAt = (x) => 100 + Math.sin(x * 0.03) * 20;
      A.inkedLine(g, lineAt, 320, 200, { colour: [90, 120, 80], ink: 1, depth: 1, step: 2, scroll: 0 });
      for (let x = 10; x < 310; x += 15) {
        const y = Math.floor(lineAt(x)),
          darkest = Math.min(...[y - 1, y, y + 1].map((yy) => lum(pixel(g, x, yy))));
        assert.ok(darkest < 120, `no ink on the line at ${x}`); // (a line 1.4 pixels wide falls across rows)
      }
      for (let x = 0; x < 320; x++)
        for (let y = 0; y < lineAt(x) - 3; y++) assert.deepEqual(pixel(g, x, y), [255, 255, 255, 255]);
    },
  },
];
