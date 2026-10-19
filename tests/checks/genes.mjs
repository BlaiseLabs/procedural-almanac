// The checks of src/genes.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'genomeFrom',
    says: 'the same seed always gives the same individual',
    run() {
      const kind = { len: [12, 16], coat: ['plain', 'spotted', 'striped'], belly: { chance: 0.7 }, gait: 'trot' };
      assert.deepEqual(
        A.genomeFrom(kind, new A.SeededRandom('cow 3')),
        A.genomeFrom(kind, new A.SeededRandom('cow 3')),
      );
    },
  },

  {
    entry: 'genomeFrom',
    says: 'every number is inside its range, every choice is from its list, every chance is true or false, and fixed values are kept',
    run() {
      const kind = { len: [12, 16], coat: ['plain', 'spotted'], belly: { chance: 0.7 }, gait: 'trot', legs: 4 };
      for (let i = 0; i < 2000; i++) {
        const g = A.genomeFrom(kind, new A.SeededRandom(i));
        assert.ok(g.len >= 12 && g.len < 16);
        assert.ok(kind.coat.includes(g.coat));
        assert.equal(typeof g.belly, 'boolean');
        assert.equal(g.gait, 'trot');
        assert.equal(g.legs, 4);
      }
    },
  },

  {
    entry: 'genomeFrom',
    says: 'different seeds give different individuals',
    run() {
      const kind = { len: [12, 16], depth: [5, 7], coat: ['plain', 'spotted'] },
        seen = new Set();
      for (let i = 0; i < 100; i++) seen.add(JSON.stringify(A.genomeFrom(kind, new A.SeededRandom(i))));
      assert.equal(seen.size, 100);
    },
  },

  {
    entry: 'genomeFrom',
    says: 'it draws once for each gene that is not fixed, in order, so the caller can go on drawing from the same generator',
    run() {
      const kind = { a: [0, 1], fixed: 'x', b: ['p', 'q'], c: { chance: 0.5 } }, // three genes that draw, one fixed
        r = new A.SeededRandom('order'),
        s = new A.SeededRandom('order');
      A.genomeFrom(kind, r);
      for (let i = 0; i < 3; i++) s.next();
      assert.equal(r.next(), s.next());
    },
  },
  {
    entry: 'crossGenomes',
    says: 'the same parents and the same seed always give the same child',
    run() {
      const kind = { len: [12, 16], coat: ['plain', 'spotted', 'striped'], belly: { chance: 0.7 }, gait: 'trot' },
        a = A.genomeFrom(kind, new A.SeededRandom('mother')),
        b = A.genomeFrom(kind, new A.SeededRandom('father'));
      assert.deepEqual(
        A.crossGenomes(a, b, kind, new A.SeededRandom('calf 1'), 0.2),
        A.crossGenomes(a, b, kind, new A.SeededRandom('calf 1'), 0.2),
      );
    },
  },

  {
    entry: 'crossGenomes',
    says: 'with no mutation, every number lies between its parents and every other gene is one of theirs',
    run() {
      const kind = {
        len: [12, 16],
        depth: [5, 7],
        coat: ['plain', 'spotted', 'striped'],
        belly: { chance: 0.5 },
        gait: 'trot',
      };
      for (let i = 0; i < 500; i++) {
        const a = A.genomeFrom(kind, new A.SeededRandom(`a${i}`)),
          b = A.genomeFrom(kind, new A.SeededRandom(`b${i}`)),
          c = A.crossGenomes(a, b, kind, new A.SeededRandom(i), 0);
        for (const k of ['len', 'depth'])
          assert.ok(c[k] >= Math.min(a[k], b[k]) - 1e-12 && c[k] <= Math.max(a[k], b[k]) + 1e-12);
        assert.ok([a.coat, b.coat].includes(c.coat));
        assert.ok([a.belly, b.belly].includes(c.belly));
        assert.equal(c.gait, 'trot');
      }
    },
  },

  {
    entry: 'crossGenomes',
    says: 'with mutation, every gene stays inside its kind: numbers in their range, choices from their list',
    run() {
      const kind = { len: [12, 16], coat: ['plain', 'spotted'], belly: { chance: 0.5 } },
        a = { len: 12, coat: 'plain', belly: false },
        b = { len: 16, coat: 'spotted', belly: true };
      let moved = 0;
      for (let i = 0; i < 2000; i++) {
        const c = A.crossGenomes(a, a, kind, new A.SeededRandom(i), 0.5);
        assert.ok(c.len >= 12 && c.len <= 16);
        assert.ok(kind.coat.includes(c.coat));
        assert.equal(typeof c.belly, 'boolean');
        if (c.len !== 12 || c.coat !== 'plain' || c.belly !== false) moved++;
        const d = A.crossGenomes(a, b, kind, new A.SeededRandom(i), 0.5);
        assert.ok(d.len >= 12 && d.len <= 16);
      }
      assert.ok(moved > 500); // (half the genes may mutate: many children differ from parents who are alike)
    },
  },

  {
    entry: 'crossGenomes',
    says: 'two parents alike give a child just like them when nothing mutates',
    run() {
      const kind = { len: [12, 16], coat: ['plain', 'spotted'], belly: { chance: 0.5 }, gait: 'trot' },
        a = A.genomeFrom(kind, new A.SeededRandom('twin'));
      for (let i = 0; i < 50; i++) assert.deepEqual(A.crossGenomes(a, { ...a }, kind, new A.SeededRandom(i), 0), a);
    },
  },

  {
    entry: 'crossGenomes',
    says: 'children of one pair differ from one another, each a new mix of the two',
    run() {
      const kind = { len: [12, 16], depth: [5, 7], coat: ['plain', 'spotted', 'striped'] },
        a = { len: 12.5, depth: 5.2, coat: 'plain' },
        b = { len: 15.5, depth: 6.8, coat: 'striped' },
        seen = new Set();
      for (let i = 0; i < 100; i++) seen.add(JSON.stringify(A.crossGenomes(a, b, kind, new A.SeededRandom(i), 0)));
      assert.equal(seen.size, 100);
    },
  },
];
