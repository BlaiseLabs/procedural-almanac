// The checks of src/colour.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'hexToRgb',
    says: 'it reads six-digit and three-digit colours, with or without the #',
    run() {
      assert.deepEqual(A.hexToRgb('#ff8000'), [255, 128, 0]);
      assert.deepEqual(A.hexToRgb('#f80'), [255, 136, 0]);
      assert.deepEqual(A.hexToRgb('1a2b3c'), [26, 43, 60]);
    },
  },
  {
    entry: 'hexToRgb',
    says: 'nothing reads as middle grey',
    run() {
      for (const v of [undefined, null, '']) assert.deepEqual(A.hexToRgb(v), [128, 128, 128]);
    },
  },
  {
    entry: 'rgbToHex',
    says: 'it writes six lower-case digits, rounding each channel and keeping it in 0 to 255',
    run() {
      assert.equal(A.rgbToHex([255, 127.6, -3]), '#ff8000');
      assert.equal(A.rgbToHex([300, 0.4, 15]), '#ff000f');
    },
  },
  {
    entry: 'rgbToHex',
    says: 'it gives back every colour hexToRgb read',
    run() {
      for (let i = 0; i < 4096; i++) {
        const hex = '#' + [i >> 8, (i >> 4) & 15, i & 15].map((v) => (v * 17).toString(16).padStart(2, '0')).join('');
        assert.equal(A.rgbToHex(A.hexToRgb(hex)), hex);
      }
    },
  },
  {
    entry: 'rgba',
    says: 'it writes rgba() with whole-number channels and the opacity as given',
    run() {
      assert.equal(A.rgba([255, 128.9, 0], 0.5), 'rgba(255,128,0,0.5)');
      assert.equal(A.rgba([1, 2, 3]), 'rgba(1,2,3,1)');
    },
  },
  {
    entry: 'mixColour',
    says: 't = 0 gives the first colour and t = 1 the second, channel by channel in between',
    run() {
      const a = [200, 100, 0],
        b = [0, 100, 200];
      assert.deepEqual(A.mixColour(a, b, 0), a);
      assert.deepEqual(A.mixColour(a, b, 1), b);
      assert.deepEqual(A.mixColour(a, b, 0.25), [150, 100, 50]);
    },
  },
  {
    entry: 'shade',
    says: 'below 0 it moves toward black, above 0 toward white, by that share of the way',
    run() {
      assert.deepEqual(A.shade([200, 100, 50], -0.5), [100, 50, 25]);
      assert.deepEqual(A.shade([200, 100, 50], 0.5), [227.5, 177.5, 152.5]);
      assert.deepEqual(A.shade([200, 100, 50], -1), [0, 0, 0]);
      assert.deepEqual(A.shade([200, 100, 50], 1), [255, 255, 255]);
    },
  },
  {
    entry: 'luma',
    says: 'white is 1 and black 0, and pure green looks brighter than pure red, which looks brighter than pure blue',
    run() {
      assert.ok(near(A.luma([255, 255, 255]), 1) && A.luma([0, 0, 0]) === 0);
      const [r, g, b] = [A.luma([255, 0, 0]), A.luma([0, 255, 0]), A.luma([0, 0, 255])];
      assert.ok(g > r && r > b);
    },
  },
  {
    entry: 'luma',
    says: "its weights are BT.601's: 0.299 red, 0.587 green, 0.114 blue",
    run() {
      assert.ok(
        near(A.luma([255, 0, 0]), 0.299) && near(A.luma([0, 255, 0]), 0.587) && near(A.luma([0, 0, 255]), 0.114),
      );
    },
  },
  {
    entry: 'rgbToHsl',
    says: 'pure red, green and blue are at hues 0, 120 and 240, fully saturated, at lightness a half; greys have no saturation',
    run() {
      assert.deepEqual(A.rgbToHsl([255, 0, 0]), [0, 1, 0.5]);
      assert.deepEqual(A.rgbToHsl([0, 255, 0]), [120, 1, 0.5]);
      assert.deepEqual(A.rgbToHsl([0, 0, 255]), [240, 1, 0.5]);
      for (const v of [0, 64, 200, 255]) assert.equal(A.rgbToHsl([v, v, v])[1], 0);
    },
  },
  {
    entry: 'hslToRgb',
    says: 'it gives back what rgbToHsl was given: every colour of a 17-step grid, to within a millionth',
    run() {
      for (let r = 0; r <= 255; r += 15)
        for (let g = 0; g <= 255; g += 15)
          for (let b = 0; b <= 255; b += 15) {
            const back = A.hslToRgb(A.rgbToHsl([r, g, b]));
            assert.ok(
              near(back[0], r, 1e-6) && near(back[1], g, 1e-6) && near(back[2], b, 1e-6),
              `${[r, g, b]} came back as ${back}`,
            );
          }
    },
  },
  {
    entry: 'hueToward',
    says: 'it moves a hue the short way round the wheel, by the share asked',
    run() {
      assert.equal(A.hueToward(30, 60, 0.5), 45);
      assert.equal(A.hueToward(350, 10, 0.5), 0);
      assert.equal(A.hueToward(10, 350, 0.5), 0);
    },
  },
  {
    entry: 'hueToward',
    says: 'a hue more than 100 degrees away moves only a quarter as far',
    run() {
      assert.equal(A.hueToward(30, 210, 1), 345);
      assert.equal(A.hueToward(0, 150, 0.4), 15);
    },
  },
  {
    entry: 'gradeColour',
    says: 'an empty grade gives the colour back',
    run() {
      for (const c of ['#4a8a3a', '#d06030', '#203040', '#ffffff', '#000000']) assert.equal(A.gradeColour(c, {}), c);
    },
  },
  {
    entry: 'gradeColour',
    says: 'warmth adds red and takes away blue',
    run() {
      const [r0, , b0] = A.hexToRgb('#6080a0'),
        [r, , b] = A.hexToRgb(A.gradeColour('#6080a0', { warm: 0.4 }));
      assert.ok(r > r0 && b < b0);
    },
  },
  {
    entry: 'gradeColour',
    says: 'a hue range moves only the colours whose hue is in it',
    run() {
      const autumn = { hues: [60, 170], hue: 35, mix: 0.6, sat: 1, light: 0 };
      assert.notEqual(A.gradeColour('#4a8a3a', {}, autumn), '#4a8a3a', 'a green moves');
      for (const c of ['#d06030', '#3050c0', '#808080']) assert.equal(A.gradeColour(c, {}, autumn), c, `${c} stays`);
    },
  },
  {
    entry: 'gradeColour',
    says: 'contrast stretches lightness away from the middle',
    run() {
      const l = (c) => A.rgbToHsl(A.hexToRgb(c))[2];
      assert.ok(l(A.gradeColour('#303030', { contrast: 1.5 })) < l('#303030'));
      assert.ok(l(A.gradeColour('#c0c0c0', { contrast: 1.5 })) > l('#c0c0c0'));
    },
  },
];
