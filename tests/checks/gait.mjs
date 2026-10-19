// The checks of src/gait.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, PI, near } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'footStep',
    says: 'the foot is on the ground for half the step and in the air for the other half',
    run() {
      const n = 10000;
      let down = 0;
      for (let i = 0; i < n; i++) if (A.footStep(((i + 0.5) / n) * 2 * PI, 3, 1).y === 0) down++;
      assert.ok(Math.abs(down / n - 0.5) < 0.001, `planted ${((100 * down) / n).toFixed(2)}% of the step`);
    },
  },

  {
    entry: 'footStep',
    says: 'it swings forward while lifted and moves back while planted, never further than the stride',
    run() {
      const n = 720,
        stride = 3;
      for (let i = 0; i < n; i++) {
        const p = (i / n) * 2 * PI,
          a = A.footStep(p, stride, 1),
          b = A.footStep(p + 1e-6, stride, 1);
        assert.ok(Math.abs(a.x) <= stride + 1e-12);
        if (a.y > 1e-3) assert.ok(b.x > a.x, `moving forward while lifted at ${p}`);
        if (a.y === 0 && b.y === 0) assert.ok(b.x <= a.x, `moving back while planted at ${p}`);
      }
    },
  },

  {
    entry: 'footStep',
    says: 'it is highest, at the lift, in the middle of its swing',
    run() {
      const top = A.footStep(0, 3, 2);
      assert.ok(near(top.y, 2) && near(top.x, 0));
      for (let i = 1; i < 100; i++) assert.ok(A.footStep((i / 100) * 2 * PI, 3, 2).y < 2);
    },
  },

  {
    entry: 'strideRate',
    says: 'walking at the rate, a planted foot ends its stance where it was put down',
    run() {
      for (const stride of [0.5, 2, 3.3, 9]) {
        const rate = A.strideRate(stride),
          // the stance runs from phase π/2 (foot put down, in front) to 3π/2 (lifted, behind)
          at = (p) => (p - PI / 2) / rate + A.footStep(p, stride, 1).x; // the body's travel plus the foot's place under it
        assert.ok(near(at(PI / 2), at((3 * PI) / 2), 1e-9), `stride ${stride}: ${at(PI / 2)} then ${at((3 * PI) / 2)}`);
      }
    },
  },

  {
    entry: 'strideRate',
    says: 'in between, it slides by at most 0.211 of its stride',
    run() {
      for (const stride of [0.5, 3.3, 9]) {
        const rate = A.strideRate(stride),
          at = (p) => (p - PI / 2) / rate + A.footStep(p, stride, 1).x,
          start = at(PI / 2);
        let most = 0;
        for (let i = 0; i <= 1000; i++) most = Math.max(most, Math.abs(at(PI / 2 + (i / 1000) * PI) - start));
        // the exact peak: where the sine's slope matches the body's pace, sin u = 2/π, the slide is cos u + 2u/π - 1
        const u = Math.asin(2 / PI),
          peak = Math.cos(u) + (2 * u) / PI - 1; // 0.2105...
        assert.ok(
          peak < 0.211 && near(most / stride, peak, 1e-5),
          `stride ${stride}: it slides ${(most / stride).toFixed(4)} of it, the peak is ${peak.toFixed(4)}`,
        );
      }
    },
  },

  {
    entry: 'gaitTiming',
    says: 'a trot moves diagonal legs together',
    run() {
      const [fore, hind] = A.gaitTiming('trot');
      assert.equal(fore.near, hind.far);
      assert.equal(fore.far, hind.near);
      assert.ok(near(Math.abs(fore.near - fore.far), PI));
    },
  },

  {
    entry: 'gaitTiming',
    says: 'a walk puts each of the four legs a quarter step from another',
    run() {
      const [fore, hind] = A.gaitTiming('walk'),
        all = [fore.near, fore.far, hind.near, hind.far].sort((a, b) => a - b);
      for (let i = 1; i < 4; i++) assert.ok(near(all[i] - all[i - 1], PI / 2));
    },
  },

  {
    entry: 'gaitTiming',
    says: 'a bound moves the fore legs nearly together and the hind legs nearly together, half a step apart',
    run() {
      const [fore, hind] = A.gaitTiming('bound');
      assert.ok(Math.abs(fore.far - fore.near) < 0.5 && Math.abs(hind.far - hind.near) < 0.5);
      assert.ok(near(hind.near - fore.near, PI));
    },
  },

  {
    entry: 'gaitTiming',
    says: 'a tripod moves three legs at a time: alternate legs on one side with the middle leg of the other',
    run() {
      const t = A.gaitTiming('tripod', 3),
        legs = t.flatMap((p, i) => [
          { leg: `${i} near`, phase: p.near },
          { leg: `${i} far`, phase: p.far },
        ]);
      const together = (phase) =>
        legs
          .filter((l) => near(l.phase, phase))
          .map((l) => l.leg)
          .sort();
      assert.deepEqual(together(t[0].far), ['0 far', '1 near', '2 far']);
      assert.deepEqual(together(t[0].near), ['0 near', '1 far', '2 near']);
    },
  },

  {
    entry: 'gaitTiming',
    says: 'a wave starts each pair a quarter step before the pair in front of it, so the step travels from back to front',
    run() {
      const w = A.gaitTiming('wave', 4);
      for (let i = 1; i < 4; i++) {
        assert.ok(near(w[i].near - w[i - 1].near, PI / 2));
        assert.ok(near(w[i].far - w[i - 1].far, PI / 2));
      }
    },
  },

  {
    entry: 'gaitTiming',
    says: 'unknown gaits and wrong numbers of legs are refused with a message saying what is allowed',
    run() {
      assert.throws(() => A.gaitTiming('gallop'), /not a gait \(one of: walk, trot, bound, stride, tripod, wave\)/);
      assert.throws(() => A.gaitTiming('trot', 3), /a trot has 2 pairs of legs, not 3/);
      assert.throws(() => A.gaitTiming('wave', 0), /at least 1/);
    },
  },

  {
    entry: 'gaitTiming',
    says: 'it gives a new table each time, so changing one changes no other',
    run() {
      const a = A.gaitTiming('trot');
      a[0].near = 99;
      assert.equal(A.gaitTiming('trot')[0].near, 0);
    },
  },
];
