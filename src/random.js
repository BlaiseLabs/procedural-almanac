// Seeded randomness: the same seed always gives the same numbers, so anything made from them can be made again from
// its seed alone, and never needs storing.

/**
 * One 32-bit integer, well mixed: inputs that differ by one bit give outputs that differ in about half their bits.
 * @param {number} n an integer (its low 32 bits are used)
 * @returns {number} an unsigned 32-bit integer
 * @example hash32(1) // 3028713910, and always that
 * @see hash-function-wikipedia
 * @see jenkins-integer-hashing
 */
export function hash32(n) {
  let a = n | 0;
  a = (a + 0x7ed55d16 + (a << 12)) | 0;
  a = (a ^ 0xc761c23c ^ (a >>> 19)) | 0;
  a = (a + 0x165667b1 + (a << 5)) | 0;
  a = ((a + 0xd3a2646c) ^ (a << 9)) | 0;
  a = (a + 0xfd7046c5 + (a << 3)) | 0;
  a = (a ^ 0xb55a4f09 ^ (a >>> 16)) | 0;
  return a >>> 0;
}

/**
 * A string as a 32-bit number, by FNV-1a: each character is mixed in with an exclusive or, then a multiplication by
 * the FNV prime. Characters are taken as UTF-16 code units, which are the RFC's bytes for text up to U+00FF.
 * @param {string} s
 * @returns {number} an unsigned 32-bit integer
 * @example fnv1a('foobar') // 0xbf9cf968, the RFC's own test value
 * @see fnv-rfc9923
 * @see fnv-wikipedia
 */
export function fnv1a(s) {
  let h = 2166136261; // the 32-bit offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619); // the 32-bit FNV prime
  }
  return h >>> 0;
}

/**
 * A string as a well-mixed 32-bit number: FNV-1a, then hash32 over its result, so that strings one character apart
 * (seed names like "a1" and "a2") give numbers about half their bits apart, not about a third as FNV-1a alone does.
 * @param {string} s
 * @returns {number} an unsigned 32-bit integer
 * @see fnv-wikipedia
 * @see fnv-rfc9923
 * @see jenkins-integer-hashing
 */
export function hashString(s) {
  return hash32(fnv1a(s));
}

/**
 * A number in [0, 1) for an index and a seed: the same pair always gives the same number, neighbouring indices give
 * unrelated ones. For things placed by their number (the 7th star, the 12th building) without a generator to carry.
 * @param {number} i an index (a whole number)
 * @param {number} seed
 * @returns {number} 0 <= result < 1
 * @example indexRandom(7, 42) // the same number every time
 * @see jenkins-integer-hashing
 */
export const indexRandom = (i, seed) => hash32((i * 374761393) ^ hash32(seed)) / 4294967296;

/**
 * A generator of numbers in [0, 1) from a seed (a number or a string): the same seed gives the same sequence. Its
 * numbers come from mulberry32, a small generator with a 32-bit state; it is fast and good enough for pictures and
 * games, not for anything secret.
 * @example const random = new SeededRandom('heron'); random.range(2, 5) // the same number on every run
 * @see mulberry32
 * @see prng-wikipedia
 */
export class SeededRandom {
  /** @param {number|string} seed */
  constructor(seed) {
    this.s = hash32((typeof seed === 'string' ? hashString(seed) : seed) ^ 0x9e3779b9) || 1;
  }
  /** the next number, in [0, 1) */
  next() {
    this.s = (this.s + 0x6d2b79f5) | 0; // (kept to 32 bits, so it never loses precision however long it runs)
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** a number in [a, b) */
  range(a, b) {
    return a + (b - a) * this.next();
  }
  /** a whole number from a to b, both included */
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  /** true with probability p */
  chance(p) {
    return this.next() < p;
  }
  /** -1 or 1, each as likely */
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  /** one item of a list, each as likely */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
}

/**
 * One well-mixed 32-bit number for a point of a grid (whole x and y) and a seed: what latticeRandom divides into
 * [0, 1). Where a whole number is wanted (to pick from a list, to read bits), it saves the division and its rounding.
 * @param {number} x a whole number
 * @param {number} y a whole number
 * @param {number} [seed]
 * @returns {number} 0 <= result < 2^32
 * @see value-noise-wikipedia
 * @see jenkins-integer-hashing
 */
export const latticeHash = (x, y, seed = 0) => hash32((x * 374761393) ^ hash32((y * 668265263) ^ (seed * 1274126177)));

/**
 * A linear congruential generator: the oldest kind of seeded random numbers, each the last times a constant plus a
 * constant, kept to 32 bits (the constants are Numerical Recipes'). Poor for anything that matters, but tiny, and its
 * numbers are the same in every language: a fixed table of random values can be made from a seed with it.
 * @param {number} seed
 * @returns {function(): number} each call the next number, 0 <= n < 1
 * @see lcg-wikipedia
 */
export function linearCongruential(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
