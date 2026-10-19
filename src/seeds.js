// Seeds you can read: a seed as words (amber-vale-7) that are easy to say, remember and share, and the number they
// stand for.
import { hashString } from './random.js';

/**
 * The seed a value stands for: a whole number is itself (at least 1); words are hashed, case and spaces at the ends
 * aside, to a number from 1 to 99,999; nothing is 1. So a seed shared as words grows the same world.
 * @param {*} value a number, words, or nothing
 * @returns {number} 1 or more
 * @example seedOf('Amber-Vale-7') // the same as seedOf('amber-vale-7')
 * @see fnv-rfc9923
 */
export function seedOf(value) {
  const s = String(value === undefined || value === null ? '' : value).trim();
  if (/^\d+$/.test(s)) return Math.max(1, +s);
  return s ? (hashString(s.toLowerCase()) % 99999) + 1 : 1;
}

/**
 * A new seed as words: a word from the first list, one from the second, and a number from 1 to 99, joined by hyphens
 * (amber-vale-7). With 32 words in each list that is 101,376 seeds, every one easy to say.
 * @param {string[]} first the first words (adjectives: amber, ash, cedar...)
 * @param {string[]} second the second words (nouns: bay, brook, cove...)
 * @param {function(): number} [random] numbers in [0, 1) (Math.random)
 * @returns {string}
 */
export function seedWords(first, second, random = Math.random) {
  const pick = (a) => a[Math.floor(random() * a.length)];
  return `${pick(first)}-${pick(second)}-${1 + Math.floor(random() * 99)}`;
}
