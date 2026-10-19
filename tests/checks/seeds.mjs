// The checks of src/seeds.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

const FIRST = ['amber', 'ash', 'cedar'],
  SECOND = ['bay', 'brook', 'cove', 'vale'];

export const CHECKS = [
  {
    entry: 'seedOf',
    says: 'a whole number is itself (at least 1), and nothing is 1',
    run() {
      assert.equal(A.seedOf(42), 42);
      assert.equal(A.seedOf(' 917 '), 917);
      assert.equal(A.seedOf(0), 1);
      for (const v of [undefined, null, '', '   ']) assert.equal(A.seedOf(v), 1);
    },
  },
  {
    entry: 'seedOf',
    says: 'words give a number from 1 to 99,999, the same whatever their case or the spaces at their ends',
    run() {
      assert.equal(A.seedOf('Amber-Vale-7'), A.seedOf('  amber-vale-7 '));
      const r = new A.SeededRandom('seeds');
      for (let i = 0; i < 5000; i++) {
        const v = A.seedOf(`word${r.int(0, 1e9)}x`);
        assert.ok(Number.isInteger(v) && v >= 1 && v <= 99999);
      }
    },
  },
  {
    entry: 'seedWords',
    says: 'it gives a word from each list and a number from 1 to 99, joined by hyphens',
    run() {
      const r = new A.SeededRandom('words');
      for (let i = 0; i < 3000; i++) {
        const [a, b, n] = A.seedWords(FIRST, SECOND, () => r.next()).split('-');
        assert.ok(FIRST.includes(a) && SECOND.includes(b) && +n >= 1 && +n <= 99 && String(+n) === n);
      }
    },
  },
  {
    entry: 'seedWords',
    says: 'the same random numbers give the same words',
    run() {
      const words = (seed) => {
        const r = new A.SeededRandom(seed);
        return A.seedWords(FIRST, SECOND, () => r.next());
      };
      assert.equal(words(5), words(5));
    },
  },
];
