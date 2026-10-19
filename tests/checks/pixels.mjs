// The checks of src/pixels.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

const parts = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];

export const CHECKS = [
  {
    entry: 'packRgb',
    says: "written into a Uint32Array over an ImageData's bytes, it gives those bytes red, green, blue and an opaque alpha",
    run() {
      const bytes = new Uint8ClampedArray(4 * 3),
        words = new Uint32Array(bytes.buffer);
      words[0] = A.packRgb(200, 100, 50);
      words[1] = A.packRgb(0, 255, 0);
      words[2] = A.packRgb(1, 2, 3);
      // (on a little-endian machine, as every machine this runs on is)
      assert.deepEqual([...bytes], [200, 100, 50, 255, 0, 255, 0, 255, 1, 2, 3, 255]);
    },
  },
  {
    entry: 'packRgb',
    says: 'parts with a fraction or outside 0..255 are cut to their low byte, as the bytes would be',
    run() {
      assert.deepEqual(parts(A.packRgb(12.9, 300, -1)), [12, 300 & 255, 255, 255]);
    },
  },
  {
    entry: 'mixPacked',
    says: 'at 0 it is the first colour, at 1 the second, and halfway each part is halfway (cut to a whole number)',
    run() {
      const a = A.packRgb(10, 200, 31),
        b = A.packRgb(250, 0, 100);
      assert.equal(A.mixPacked(a, b, 0), a);
      assert.equal(A.mixPacked(a, b, 1), b);
      assert.deepEqual(parts(A.mixPacked(a, b, 0.5)), [130, 100, 65, 255]);
    },
  },
  {
    entry: 'packedHsl',
    says: 'the six pure hues and white, grey and black come out as they should',
    run() {
      const want = [
        [0, [255, 0, 0]],
        [60, [255, 255, 0]],
        [120, [0, 255, 0]],
        [180, [0, 255, 255]],
        [240, [0, 0, 255]],
        [300, [255, 0, 255]],
      ];
      for (const [h, rgb] of want) assert.deepEqual(parts(A.packedHsl(h, 1, 0.5)).slice(0, 3), rgb);
      assert.deepEqual(parts(A.packedHsl(0, 0, 1)).slice(0, 3), [255, 255, 255]);
      assert.deepEqual(parts(A.packedHsl(123, 0, 0.5)).slice(0, 3), [127, 127, 127]);
      assert.deepEqual(parts(A.packedHsl(77, 0.7, 0)).slice(0, 3), [0, 0, 0]);
      assert.equal(A.packedHsl(-60, 1, 0.5), A.packedHsl(300, 1, 0.5));
    },
  },
  {
    entry: 'packedHsl',
    says: "packedToHsl gives back the hue, saturation and lightness it was made from, to within a byte's rounding",
    run() {
      for (let i = 0; i < 2000; i++) {
        const h = (i * 37) % 360,
          s = 0.2 + ((i * 7) % 70) / 100,
          l = 0.2 + ((i * 11) % 60) / 100;
        const [h2, s2, l2] = A.packedToHsl(A.packedHsl(h, s, l)),
          dh = Math.abs(((h2 - h + 540) % 360) - 180);
        assert.ok(dh < 3 && Math.abs(s2 - s) < 0.04 && Math.abs(l2 - l) < 0.01, `${[h, s, l]} -> ${[h2, s2, l2]}`);
      }
    },
  },
  {
    entry: 'packedToHsl',
    says: 'a grey has no saturation, and the six pure hues are 0, 60, 120, 180, 240 and 300 degrees (or the same less 360)',
    run() {
      assert.equal(A.packedToHsl(A.packRgb(90, 90, 90))[1], 0);
      const hues = [
        [255, 0, 0],
        [255, 255, 0],
        [0, 255, 0],
        [0, 255, 255],
        [0, 0, 255],
        [255, 0, 255],
      ].map((c) => (A.packedToHsl(A.packRgb(...c))[0] + 360) % 360);
      assert.deepEqual(hues, [0, 60, 120, 180, 240, 300]);
    },
  },
  {
    entry: 'hueShiftTone',
    says: 'darker steps are darker and turn toward blue-violet; lighter steps are lighter and turn toward warm yellow',
    run() {
      const c = A.packRgb(90, 160, 80),
        [h, , l] = A.packedToHsl(c);
      const [hd, , ld] = A.packedToHsl(A.hueShiftTone(c, -2)),
        [hl, , ll] = A.packedToHsl(A.hueShiftTone(c, 2));
      const toward = (from, to, target) =>
        Math.abs(((target - to + 540) % 360) - 180) < Math.abs(((target - from + 540) % 360) - 180);
      assert.ok(ld < l && toward(h, hd, 250), 'darker, toward blue-violet');
      assert.ok(ll > l && toward(h, hl, 52), 'lighter, toward warm yellow');
    },
  },
  {
    entry: 'hueShiftTone',
    says: "zero steps gives the colour back, to within a byte's rounding, except that it is never quite black or quite white",
    run() {
      for (let i = 0; i < 500; i++) {
        const c = A.packRgb((i * 53) % 256, (i * 97) % 256, (i * 31) % 256),
          a = parts(c),
          b = parts(A.hueShiftTone(c, 0)),
          l = A.packedToHsl(c)[2];
        if (l >= 0.02 && l <= 0.97) for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) <= 1, `${a} -> ${b}`);
      }
      assert.deepEqual(parts(A.hueShiftTone(A.packRgb(0, 0, 0), 0)).slice(0, 3), [5, 5, 5]); // (lightness 0.02 at least)
      assert.deepEqual(parts(A.hueShiftTone(A.packRgb(255, 255, 255), 0)).slice(0, 3), [247, 247, 247]); // (0.97 at most)
    },
  },
  {
    entry: 'bayerThreshold',
    says: 'its sixteen thresholds are the sixteen steps (n + 0.5) / 16, each once in every 4 x 4 square',
    run() {
      for (const [ox, oy] of [
        [0, 0],
        [5, 9],
        [-3, -7],
      ]) {
        const seen = [];
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.push(A.bayerThreshold(ox + x, oy + y) * 16 - 0.5);
        assert.deepEqual(
          seen.sort((a, b) => a - b),
          [...Array(16).keys()],
        );
      }
    },
  },
  {
    entry: 'bayerThreshold',
    says: 'a share t set against it lights about t of the pixels in any 4 x 4 square, spread out rather than clumped',
    run() {
      for (const t of [0.25, 0.5, 0.75]) {
        let lit = 0,
          touching = 0;
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++)
            if (t > A.bayerThreshold(x, y)) {
              lit++;
              if (t > A.bayerThreshold(x + 1, y)) touching++;
            }
        assert.equal(lit, t * 16);
        if (t <= 0.5) assert.equal(touching, 0, `at ${t} no two lit pixels side by side`);
      }
    },
  },
  {
    entry: 'ditheredBorder',
    says: 'with no share of the other, never; with a whole share, always',
    run() {
      for (let i = 0; i < 1000; i++) {
        const x = i % 31,
          y = (i * 7) % 29,
          n = (i * 0.618) % 1;
        assert.equal(A.ditheredBorder(0, x, y, n), false);
        assert.equal(A.ditheredBorder(1, x, y, n), true);
      }
    },
  },
  {
    entry: 'ditheredBorder',
    says: 'the share of pixels that go to the other rises with f across a band',
    run() {
      const share = (f) => {
        let k = 0;
        for (let y = 0; y < 64; y++)
          for (let x = 0; x < 64; x++) if (A.ditheredBorder(f, x, y, A.latticeRandom(x, y, 3))) k++;
        return k / 4096;
      };
      const s = [0.05, 0.15, 0.25, 0.35, 0.45].map(share);
      for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1], s.join(', '));
    },
  },
  {
    entry: 'scalePacked',
    says: 'each of red, green and blue is multiplied and held at 255, cut to a whole number, and alpha is opaque',
    run() {
      assert.deepEqual(parts(A.scalePacked(A.packRgb(100, 200, 50), 0.5)), [50, 100, 25, 255]);
      assert.deepEqual(parts(A.scalePacked(A.packRgb(100, 200, 50), 1.5)), [150, 255, 75, 255]);
    },
  },
];
