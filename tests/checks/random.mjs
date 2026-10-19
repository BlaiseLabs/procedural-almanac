// The checks of src/random.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert, bits, jenkinsC, mulberry32C } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'hash32',
    says: 'it gives the same values as the published C function, over 10,000 inputs',
    run() {
      for (let i = 0; i < 10000; i++) {
        const n = i < 5000 ? i : (i * 2654435761) | 0;
        assert.equal(A.hash32(n), jenkinsC(n), `hash32(${n})`);
      }
    },
  },

  {
    entry: 'hash32',
    says: 'changing one input bit changes about half of the output bits (full avalanche)',
    run() {
      let flipped = 0,
        n = 0;
      for (let i = 0; i < 2000; i++)
        for (let b = 0; b < 32; b++) {
          flipped += bits((A.hash32(i) ^ A.hash32(i ^ (1 << b))) >>> 0);
          n++;
        }
      const mean = flipped / n;
      assert.ok(mean > 15.5 && mean < 16.5, `on average ${mean.toFixed(2)} of 32 bits change`);
    },
  },

  {
    entry: 'fnv1a',
    says: "it gives the RFC's own test values for its four test strings",
    run() {
      // RFC 9923, the FNV32 test: the strings "", "a", "foobar", "Hello!\x01\xFF\xED" and their FNV-1a values
      const want = [
        ['', 0x811c9dc5],
        ['a', 0xe40c292c],
        ['foobar', 0xbf9cf968],
        ['Hello!\x01\xFF\xED', 0xfd9d3881],
      ];
      for (const [s, v] of want) assert.equal(A.fnv1a(s), v, `fnv1a(${JSON.stringify(s)})`);
    },
  },

  {
    entry: 'hashString',
    says: 'it is hash32 of fnv1a',
    run() {
      for (const s of ['', 'heron', 'cow 3', 'amber-vale-7']) assert.equal(A.hashString(s), A.hash32(A.fnv1a(s)));
    },
  },

  {
    entry: 'hashString',
    says: 'seed names one character apart give numbers about half their bits apart, where FNV-1a alone gives fewer than a third',
    run() {
      let mixed = 0,
        alone = 0,
        n = 0;
      for (let i = 0; i < 500; i++)
        for (const c of 'abcdefghij') {
          const a = `seed${i}${c}`,
            b = `seed${i}${String.fromCharCode(c.charCodeAt(0) + 1)}`;
          mixed += bits((A.hashString(a) ^ A.hashString(b)) >>> 0);
          alone += bits((A.fnv1a(a) ^ A.fnv1a(b)) >>> 0);
          n++;
        }
      assert.ok(mixed / n > 15 && mixed / n < 17, `hashString: on average ${(mixed / n).toFixed(2)} of 32 bits change`);
      assert.ok(alone / n < 32 / 3, `FNV-1a alone: on average ${(alone / n).toFixed(2)} of 32 bits change`);
    },
  },

  {
    entry: 'SeededRandom',
    says: "its numbers are mulberry32's: they match the published C function for the same state",
    run() {
      for (const seed of [1, 42, 'heron', 123456789]) {
        const r = new A.SeededRandom(seed),
          c = mulberry32C(r.s);
        for (let i = 0; i < 1000; i++) assert.equal(r.next(), c(), `seed ${seed}, number ${i}`);
      }
    },
  },

  {
    entry: 'SeededRandom',
    says: 'the same seed gives the same sequence, and a string seed gives the same sequence as its hash',
    run() {
      const seq = (seed) => {
        const r = new A.SeededRandom(seed);
        return Array.from({ length: 50 }, () => r.next());
      };
      assert.deepEqual(seq(7), seq(7));
      assert.deepEqual(seq('heron'), seq(A.hashString('heron')));
      assert.notDeepEqual(seq(7), seq(8));
    },
  },

  {
    entry: 'SeededRandom',
    says: 'every number is in [0, 1), and range, int, chance and pick give only what they are asked for',
    run() {
      const r = new A.SeededRandom('bounds'),
        list = ['a', 'b', 'c'];
      for (let i = 0; i < 20000; i++) {
        const x = r.next();
        assert.ok(x >= 0 && x < 1);
        const y = r.range(-3, 5);
        assert.ok(y >= -3 && y < 5);
        const k = r.int(2, 4);
        assert.ok(Number.isInteger(k) && k >= 2 && k <= 4);
        assert.equal(typeof r.chance(0.3), 'boolean');
        assert.ok(list.includes(r.pick(list)));
      }
      assert.equal(r.chance(0), false);
      assert.equal(r.chance(1), true);
    },
  },

  {
    entry: 'SeededRandom',
    says: 'the numbers are spread evenly: over 100,000 draws each tenth of [0, 1) gets 10% of them, give or take 0.3%',
    run() {
      const r = new A.SeededRandom(2026),
        n = 100000,
        tenths = new Array(10).fill(0);
      for (let i = 0; i < n; i++) tenths[Math.floor(r.next() * 10)]++;
      for (const [i, c] of tenths.entries())
        assert.ok(Math.abs(c / n - 0.1) <= 0.003, `tenth ${i} got ${((100 * c) / n).toFixed(2)}%`);
    },
  },

  {
    entry: 'SeededRandom',
    says: 'its state stays a 32-bit integer, so after 6 million draws it still matches the published C function',
    run() {
      const r = new A.SeededRandom('long run');
      for (let i = 0; i < 6e6; i++) r.next();
      assert.ok(Number.isInteger(r.s) && r.s === (r.s | 0), `the state is ${r.s}`);
      const c = mulberry32C(r.s);
      for (let i = 0; i < 1000; i++) assert.equal(r.next(), c(), `number ${i} after 6 million`);
    },
  },
  {
    entry: 'SeededRandom',
    says: 'sign gives -1 or 1, each about half the time',
    run() {
      const r = new A.SeededRandom('sign');
      let up = 0;
      for (let i = 0; i < 20000; i++) {
        const s = r.sign();
        assert.ok(s === 1 || s === -1);
        if (s === 1) up++;
      }
      assert.ok(Math.abs(up / 20000 - 0.5) < 0.01, `${up} of 20000 were 1`);
    },
  },
  {
    entry: 'indexRandom',
    says: 'the same index and seed give the same number, in [0, 1)',
    run() {
      for (let i = -500; i < 500; i++) {
        const v = A.indexRandom(i, 42);
        assert.ok(v >= 0 && v < 1);
        assert.equal(v, A.indexRandom(i, 42));
      }
    },
  },
  {
    entry: 'indexRandom',
    says: 'neighbouring indices give unrelated numbers: over 10,000 of them each tenth of [0, 1) gets 10%, give or take 0.6%',
    run() {
      const t = new Array(10).fill(0);
      for (let i = 0; i < 10000; i++) t[Math.floor(A.indexRandom(i, 5) * 10)]++;
      for (const [k, c] of t.entries()) assert.ok(Math.abs(c / 10000 - 0.1) <= 0.006, `tenth ${k}: ${c / 100}%`);
    },
  },

  {
    entry: 'latticeHash',
    says: "it is latticeRandom's number before the division",
    run() {
      for (let i = 0; i < 5000; i++) {
        const x = (i % 97) - 40,
          y = ((i * 7) % 89) - 30,
          s = i % 13;
        assert.equal(A.latticeHash(x, y, s) / 4294967296, A.latticeRandom(x, y, s));
        assert.ok(
          Number.isInteger(A.latticeHash(x, y, s)) && A.latticeHash(x, y, s) >= 0 && A.latticeHash(x, y, s) < 2 ** 32,
        );
      }
    },
  },
  {
    entry: 'latticeHash',
    says: 'the same point and seed give the same number; neighbouring points give unrelated ones',
    run() {
      assert.equal(A.latticeHash(3, 4, 9), A.latticeHash(3, 4, 9));
      let same = 0;
      for (let x = 0; x < 200; x++) if (A.latticeHash(x, 0, 1) >>> 24 === A.latticeHash(x + 1, 0, 1) >>> 24) same++;
      assert.ok(same < 6, `${same} neighbours share their top byte`); // (about 200 / 256 by chance)
    },
  },
  {
    entry: 'linearCongruential',
    says: "it gives the published recurrence's numbers: seed times 1664525 plus 1013904223, modulo 2^32",
    run() {
      const next = A.linearCongruential(12345);
      let s = 12345n;
      for (let i = 0; i < 1000; i++) {
        s = (s * 1664525n + 1013904223n) % 4294967296n;
        assert.equal(next(), Number(s) / 4294967296);
      }
    },
  },
  {
    entry: 'linearCongruential',
    says: 'the same seed gives the same stream',
    run() {
      const a = A.linearCongruential(7),
        b = A.linearCongruential(7),
        c = A.linearCongruential(8);
      const xs = Array.from({ length: 50 }, a),
        ys = Array.from({ length: 50 }, b),
        zs = Array.from({ length: 50 }, c);
      assert.deepEqual(xs, ys);
      assert.notDeepEqual(xs, zs);
    },
  },
];
