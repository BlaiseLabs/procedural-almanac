// The checks of src/motion.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, near, deepFreeze } from '../helpers.mjs';

const BIRDS = { cohesion: 0.6, alignment: 1.2, separation: { within: 8, push: 14 }, speed: [8, 30] };
const flock = (n, seed) => {
  const r = new A.SeededRandom(seed);
  return Array.from({ length: n }, (_, i) => ({
    x: r.range(100, 160),
    y: r.range(40, 64),
    vx: 12,
    vy: r.range(-3, 3),
    speed: r.range(0.75, 1.25),
    seed: i,
  }));
};
const run = (list, steps, o, dt = 1 / 30) => {
  for (let i = 0; i < steps; i++) list = A.flockStep(list, dt, typeof o === 'function' ? o(i * dt) : o);
  return list;
};

export const CHECKS = [
  {
    entry: 'flockStep',
    says: 'the flock holds together: after a minute every bird is within 40 of the centre',
    run() {
      const end = run(flock(14, 'together'), 1800, (t) => ({
          ...BIRDS,
          wander: { t, rate: [0.7, 0.9], amount: [6, 4] },
        })),
        cx = end.reduce((s, a) => s + a.x, 0) / end.length,
        cy = end.reduce((s, a) => s + a.y, 0) / end.length;
      for (const a of end)
        assert.ok(
          Math.hypot(a.x - cx, a.y - cy) < 40,
          `a bird ${Math.hypot(a.x - cx, a.y - cy).toFixed(1)} from the centre`,
        );
    },
  },
  {
    entry: 'flockStep',
    says: 'birds keep their distance: after a minute no two are closer than a sixth of the separation distance',
    run() {
      const end = run(flock(14, 'apart'), 1800, BIRDS);
      for (const a of end)
        for (const b of end)
          if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 8 / 6, 'two birds nearly on top of each other');
    },
  },
  {
    entry: 'flockStep',
    says: "every speed stays between the least and the most, times each one's own",
    run() {
      for (const a of run(flock(14, 'speeds'), 300, BIRDS)) {
        const sp = Math.hypot(a.vx, a.vy);
        assert.ok(sp <= 30 * a.speed + 1e-9 && sp >= 8 * a.speed * 0.99, `speed ${sp} for ${a.speed}`);
      }
    },
  },
  {
    entry: 'flockStep',
    says: 'a flock flees a hunter: in a second its centre moves away from it',
    run() {
      const start = flock(14, 'flee'),
        centre = (l) => [l.reduce((s, a) => s + a.x, 0) / l.length, l.reduce((s, a) => s + a.y, 0) / l.length],
        [x0, y0] = centre(start),
        hunter = { x: x0 - 20, y: y0, push: 220 },
        [x1, y1] = centre(run(start, 30, { ...BIRDS, flee: hunter }));
      assert.ok(Math.hypot(x1 - hunter.x, y1 - hunter.y) > Math.hypot(x0 - hunter.x, y0 - hunter.y) + 5);
    },
  },
  {
    entry: 'flockStep',
    says: 'a band brings a flock back to its heights',
    run() {
      const low = flock(10, 'band').map((a) => ({ ...a, y: a.y + 120 })),
        end = run(low, 900, { ...BIRDS, band: { from: 40, to: 70, pull: 3 } }),
        cy = end.reduce((s, a) => s + a.y, 0) / end.length;
      assert.ok(cy >= 35 && cy <= 75, `the flock is at ${cy.toFixed(1)}`);
    },
  },
  {
    entry: 'flockStep',
    says: 'it changes nothing it is given, and gives every one its heading and its tilt',
    run() {
      const start = deepFreeze(flock(8, 'frozen')),
        end = A.flockStep(start, 1 / 30, BIRDS);
      for (const a of end) assert.ok((a.dir === 1 || a.dir === -1) && a.tilt >= -0.5 && a.tilt <= 0.5);
      assert.deepEqual(end, A.flockStep(flock(8, 'frozen'), 1 / 30, BIRDS));
    },
  },
  {
    entry: 'gridWalk',
    says: 'a walker only ever steps to a neighbouring tile it may step to',
    run() {
      const allowed = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && (x + y) % 3 !== 0,
        r = new A.SeededRandom('walk');
      let w = { x: 1.5, y: 1.5, tx: 1.5, ty: 1.5, wait: 0 },
        tile = [1, 1];
      for (let i = 0; i < 20000; i++) {
        w = A.gridWalk(w, 0.05, {
          speed: 0.55,
          canStep: (fx, fy, x, y) => allowed(x, y),
          random: r,
          pause: { chance: 0.25, from: 0.5, to: 3 },
        });
        const now = [Math.floor(w.x), Math.floor(w.y)];
        if (now[0] !== tile[0] || now[1] !== tile[1]) {
          assert.equal(Math.abs(now[0] - tile[0]) + Math.abs(now[1] - tile[1]), 1, 'a step to a neighbour');
          assert.ok(allowed(...now), `stepped onto ${now}`);
          tile = now;
        }
      }
    },
  },
  {
    entry: 'gridWalk',
    says: 'it walks at its speed and arrives within a twentieth of a tile of the middle it set out for',
    run() {
      let w = { x: 2.5, y: 2.5, tx: 3.5, ty: 2.5, wait: 0 },
        t = 0;
      const o = { speed: 0.5, canStep: () => false, random: new A.SeededRandom(1) };
      for (;;) {
        const next = A.gridWalk(w, 0.1, o);
        if (!next.moving) break;
        w = next;
        t += 0.1;
      }
      assert.ok(Math.abs(w.x - 3.5) < 0.05 && w.y === 2.5, `stopped at ${w.x}`);
      assert.ok(near(t, (1 - 0.05) / 0.5, 0.1 + 1e-9), `walked for ${t} s`);
    },
  },
  {
    entry: 'gridWalk',
    says: 'on arriving it pauses about as often as asked: a quarter of 4,000 arrivals, give or take 2%',
    run() {
      const r = new A.SeededRandom('pause');
      let paused = 0;
      for (let i = 0; i < 4000; i++) {
        const w = A.gridWalk({ x: 1.5, y: 1.5, tx: 1.5, ty: 1.5, wait: 0 }, 0.1, {
          speed: 1,
          canStep: () => true,
          random: r,
          pause: { chance: 0.25, from: 0.5, to: 3 },
        });
        if (w.wait > 0) {
          paused++;
          assert.ok(w.wait >= 0.5 && w.wait < 3);
        }
      }
      assert.ok(Math.abs(paused / 4000 - 0.25) < 0.02, `${paused} of 4000 paused`);
    },
  },
  {
    entry: 'pulseRise',
    says: 'it rises in pulses and never sinks, and its sway stays within amount / rate either side (a thousandth over, for stepping)',
    run() {
      let a = { x: 0, y: 0, phase: 0, speed: 1, seed: 0.4 },
        t = 0,
        lo = 0,
        hi = 0,
        still = 0;
      for (let i = 0; i < 6000; i++) {
        t += 0.01;
        const b = A.pulseRise(a, 0.01, t);
        assert.ok(b.y <= a.y);
        if (b.y === a.y) still++;
        a = b;
        lo = Math.min(lo, a.x);
        hi = Math.max(hi, a.x);
      }
      assert.ok(still > 2000, 'it coasts between pulses');
      assert.ok(hi - lo <= ((2 * 3) / 0.3) * 1.001, `swayed over ${hi - lo}`); // (exact for smooth motion; stepping overshoots a little)
    },
  },
  {
    entry: 'fleeVector',
    says: 'a threat in reach pushes directly away from it, and one out of reach does nothing',
    run() {
      const v = A.fleeVector(0, 0, [{ x: 5, y: 0, r: 10 }]);
      assert.ok(v.x < 0 && v.y === 0 && v.fear === 1.2, JSON.stringify(v));
      const hard = A.fleeVector(0, 0, [{ x: 0, y: -3, r: 10, hard: true }]);
      assert.ok(hard.y > 0 && hard.fear === 2.2, JSON.stringify(hard));
      assert.deepEqual(A.fleeVector(0, 0, [{ x: 50, y: 0, r: 10 }]), { x: 0, y: 0, fear: 0 });
    },
  },
  {
    entry: 'formationSlot',
    says: 'a vee puts followers alternately to each side, each pair further back',
    run() {
      const s = [1, 2, 3, 4].map((k) => A.formationSlot('vee', 0, 0, 0, k));
      assert.ok(s[0].y * s[1].y < 0 && s[2].y * s[3].y < 0, 'not alternating sides');
      assert.ok(s[0].x === s[1].x && s[2].x === s[3].x && s[2].x < s[0].x, 'pairs not further back');
    },
  },
];
