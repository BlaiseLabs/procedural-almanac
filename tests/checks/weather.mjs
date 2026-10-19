// The checks of src/weather.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

const W = 120,
  H = 90;
const frame = () => {
  const px = new Uint32Array(W * H);
  for (let i = 0; i < px.length; i++) px[i] = A.packRgb(60 + (i % 7) * 20, 120 + (i % 5) * 20, 90 + (i % 3) * 30);
  return px;
};
const ch = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];

export const CHECKS = [
  {
    entry: 'cloudShadows',
    says: 'it only ever darkens: no channel of any pixel goes up, and blue keeps more of its value than red and green',
    run() {
      for (const strong of [true, false]) {
        const a = frame(),
          b = frame();
        A.cloudShadows(b, W, H, { x: 37, y: -12, seed: 9, cover: 0.9, strong });
        let changed = 0;
        for (let i = 0; i < a.length; i++) {
          if (a[i] === b[i]) continue;
          changed++;
          const [r0, g0, b0] = ch(a[i]),
            [r1, g1, b1] = ch(b[i]);
          assert.ok(r1 <= r0 && g1 <= g0 && b1 <= b0, `a channel went up at ${i}`);
          if (b0 > 50 && r0 > 50) assert.ok(b1 / b0 >= r1 / r0 - 0.02, `blue kept less than red at ${i}`);
        }
        assert.ok(changed > 0, 'nothing was shaded');
      }
    },
  },
  {
    entry: 'cloudShadows',
    says: 'more cloud cover darkens more of the frame',
    run() {
      const count = (cover) => {
        const a = frame(),
          b = frame();
        A.cloudShadows(b, W, H, { x: 500, y: 300, seed: 4, cover });
        return a.filter((c, i) => c !== b[i]).length;
      };
      const n = [0.1, 0.5, 0.9].map(count);
      assert.ok(n[0] <= n[1] && n[1] <= n[2] && n[2] > n[0], `${n}`);
    },
  },
  {
    entry: 'fogBanks',
    says: "denser fog changes more of the frame, and every changed pixel moves toward the fog's colour",
    run() {
      const fog = A.packRgb(240, 240, 240),
        count = (density) => {
          const a = frame(),
            b = frame();
          A.fogBanks(b, W, H, { x: 10, y: 20, density, colour: fog });
          let n = 0;
          for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i]) {
              n++;
              const [r0, g0, b0] = ch(a[i]),
                [r1, g1, b1] = ch(b[i]);
              assert.ok(r1 >= r0 - 1 && g1 >= g0 - 1 && b1 >= b0 - 1, `away from the fog at ${i}`);
            }
          return n;
        };
      const n = [0.2, 0.5, 0.9].map(count);
      assert.ok(n[0] <= n[1] && n[1] <= n[2] && n[2] > n[0], `${n}`);
    },
  },
  {
    entry: 'frontStrength',
    says: 'it is 0 when the front comes, 1 through its middle, and 0 again at its end',
    run() {
      assert.equal(A.frontStrength(0, 60), 0);
      assert.equal(A.frontStrength(30, 60), 1);
      assert.equal(A.frontStrength(60, 60), 0);
      for (let t = 0; t <= 60; t += 0.5) assert.ok(A.frontStrength(t, 60) >= 0 && A.frontStrength(t, 60) <= 1);
    },
  },
  {
    entry: 'lightningFlash',
    says: 'it lights the frame, then not, then again, then faintly, as the flash runs out',
    run() {
      const levels = [0.3, 0.22, 0.15, 0.05].map((left) => A.lightningFlash(frame(), left));
      assert.deepEqual(levels, [1, 0, 1, 0.35]);
    },
  },
  {
    entry: 'lightningFlash',
    says: 'a lit pixel only grows brighter, blue the most',
    run() {
      const a = frame(),
        b = frame();
      A.lightningFlash(b, 0.3);
      for (let i = 0; i < a.length; i++) {
        const [r0, g0, b0] = ch(a[i]),
          [r1, g1, b1] = ch(b[i]);
        assert.ok(r1 >= r0 && g1 >= g0 && b1 >= b0, `darker at ${i}`);
        assert.ok((b1 - b0) / (255 - b0 || 1) >= (r1 - r0) / (255 - r0 || 1) - 0.01, `blue lit less than red at ${i}`);
      }
    },
  },
];
