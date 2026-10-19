// The checks of src/light.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near } from '../helpers.mjs';

const SKY = {
  night: ['#0a1030', '#203060'],
  dawn: ['#e08060', '#f0c090'],
  day: ['#4080d0', '#a0d0f0'],
  dusk: ['#a04070', '#f09050'],
};

export const CHECKS = [
  {
    entry: 'dayCycle',
    says: "at noon it is full light and the sky is the day's; at midnight full dark and the night's",
    run() {
      const noon = A.dayCycle(SKY, 0.5),
        midnight = A.dayCycle(SKY, 0);
      assert.equal(noon.light, 1);
      assert.equal(midnight.light, 0);
      assert.deepEqual([noon.top, noon.horizon], SKY.day.map(A.hexToRgb));
      assert.deepEqual([midnight.top, midnight.horizon], SKY.night.map(A.hexToRgb));
    },
  },
  {
    entry: 'dayCycle',
    says: 'the colours and the light change smoothly all day: no jump anywhere',
    run() {
      let worst = 0;
      for (let i = 0; i < 10000; i++) {
        const a = A.dayCycle(SKY, i / 10000),
          b = A.dayCycle(SKY, (i + 1) / 10000);
        for (let k = 0; k < 3; k++)
          worst = Math.max(worst, Math.abs(a.top[k] - b.top[k]), Math.abs(a.horizon[k] - b.horizon[k]));
        assert.ok(Math.abs(a.light - b.light) < 0.002);
      }
      assert.ok(worst < 1, `the sky jumps by ${worst.toFixed(2)} of 255 in a ten-thousandth of a day`);
    },
  },
  {
    entry: 'dayCycle',
    says: 'the light is full from about 7:40 to 16:20 and none from about 18:50 to 5:10',
    run() {
      const at = (h, m) => A.dayCycle(SKY, (h + m / 60) / 24).light;
      assert.ok(at(7, 35) < 1 && at(7, 45) === 1 && at(16, 15) === 1 && at(16, 25) < 1, 'full');
      assert.ok(at(18, 45) > 0 && at(18, 55) === 0 && at(5, 5) === 0 && at(5, 15) > 0, 'none');
    },
  },
  {
    entry: 'dayCycle',
    says: 'the sun is highest at noon and below the horizon at midnight, and the moon the other way round',
    run() {
      assert.ok(near(A.dayCycle(SKY, 0.5).sun.y, 1) && A.dayCycle(SKY, 0).sun.y < 0);
      assert.ok(near(A.dayCycle(SKY, 0).moon.y, 1) && A.dayCycle(SKY, 0.5).moon.y < 0);
    },
  },
  {
    entry: 'aerialPerspective',
    says: 'near and in full daylight, a colour is itself',
    run() {
      const day = A.dayCycle(SKY, 0.5);
      assert.deepEqual(A.aerialPerspective([120, 80, 40], day, 1), [120, 80, 40]);
    },
  },
  {
    entry: 'aerialPerspective',
    says: "the further away, the nearer it is to the horizon's colour, but never all the way",
    run() {
      const day = A.dayCycle(SKY, 0.5),
        c = [120, 80, 40],
        dist = (x) => Math.hypot(...x.map((v, i) => v - day.horizon[i]));
      let last = Infinity;
      for (let d = 1; d >= 0; d -= 0.1) {
        const o = A.aerialPerspective(c, day, d, 1);
        assert.ok(dist(o) <= last + 1e-9);
        last = dist(o);
      }
      assert.ok(last > 0, 'even at the horizon, some of the colour is left');
    },
  },
  {
    entry: 'aerialPerspective',
    says: 'after dark a colour is dimmed',
    run() {
      const night = A.dayCycle(SKY, 0),
        c = [200, 160, 120],
        o = A.aerialPerspective(c, night, 1);
      assert.ok(A.luma(o) < A.luma(c) * 0.6, `dimmed to ${(A.luma(o) / A.luma(c)).toFixed(2)} of its brightness`);
    },
  },
  {
    entry: 'twinkle',
    says: 'it swings between 1 and 1 - 2 depth, round 1 - depth',
    run() {
      let lo = 1,
        hi = 0;
      for (let i = 0; i < 10000; i++) {
        const v = A.twinkle(i * 0.01, 0.3, 0.4);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      assert.ok(near(lo, 0.2, 1e-3) && near(hi, 1, 1e-3), `between ${lo} and ${hi}`);
    },
  },
  {
    entry: 'hourLight',
    says: 'noon is plain day and midnight is full night',
    run() {
      const noon = A.hourLight(0.25),
        midnight = A.hourLight(0.75);
      assert.ok(noon.plain && noon.night === 0 && noon.dusk === 0, JSON.stringify(noon));
      assert.ok(!midnight.plain && midnight.night === 1, JSON.stringify(midnight));
    },
  },
  {
    entry: 'hourTables',
    says: 'at full night a mid grey keeps more of its blue than its green, and more of its green than its red',
    run() {
      const [R, G, B] = A.hourTables(1, 0, false);
      assert.ok(B[128] > G[128] && G[128] > R[128], `${R[128]} ${G[128]} ${B[128]}`);
      for (let v = 0; v < 256; v++) assert.ok(R[v] <= v + 3 && G[v] <= v + 5, `brighter at ${v}`);
    },
  },
  {
    entry: 'gradeFrame',
    says: 'a lamp keeps the colours near it closer to the ungraded ones than those far from it',
    run() {
      const w = 60,
        h = 40,
        grey = A.packRgb(150, 150, 150),
        px = new Uint32Array(w * h).fill(grey),
        T = A.hourTables(1, 0, false);
      A.gradeFrame(px, w, h, T, { night: 1, lights: [{ x: 10, y: 20, r: 24, k: 1 }] });
      const lit = px[20 * w + 10] & 255,
        far = px[20 * w + 55] & 255;
      assert.ok(lit > far, `near ${lit}, far ${far}`);
      assert.equal(far, T[0][150]);
    },
  },
];
