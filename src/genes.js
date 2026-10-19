// Genes: an individual drawn from the ranges of its kind, so a few lines of data give endless distinct individuals.

/**
 * An individual's genes, drawn from its kind's ranges. A pair of numbers [low, high] gives a number between them; a
 * list of anything else gives one of its items; { chance: p } gives true with probability p; anything else is kept
 * as it is. It draws once for each gene that is not kept, in the order the genes are listed, from the generator it is
 * given, so the caller can go on drawing from the same generator (markings, say) and get the same results every time.
 * @param {Object<string, *>} genes the kind: each gene's range, list, chance or value
 * @param {{range: function, pick: function, chance: function}} random a seeded generator (SeededRandom)
 * @returns {Object<string, *>} the individual: each gene's value
 * @example genomeFrom({ legs: [5, 7], coat: ['plain', 'spotted'], belly: { chance: 0.7 }, gait: 'trot' },
 *   new SeededRandom('cow 3')) // { legs: 6.2..., coat: 'spotted', belly: true, gait: 'trot' }
 */
export function genomeFrom(genes, random) {
  const g = {};
  for (const [name, gene] of Object.entries(genes)) {
    if (Array.isArray(gene) && typeof gene[0] === 'number') g[name] = random.range(gene[0], gene[1]);
    else if (Array.isArray(gene)) g[name] = random.pick(gene);
    else if (gene && typeof gene === 'object' && 'chance' in gene) g[name] = random.chance(gene.chance);
    else g[name] = gene;
  }
  return g;
}

/**
 * A child's genes from two parents of one kind. Each number is mixed from its parents' (a point between them, picked
 * at random: intermediate recombination); each choice and each chance is one parent's or the other's, as a coin falls
 * (discrete recombination); then, rarely, a gene mutates: a number moves by up to the mutation's share of its range, a
 * choice is picked afresh from its list, a chance flips. Nothing leaves its kind: numbers stay in their range, choices
 * in their list. A gene one parent lacks is the other's; one both lack is drawn as genomeFrom would. Fixed values are
 * kept. It draws from the generator it is given, so the same parents and seed always give the same child.
 * @param {Object<string, *>} a one parent's genes
 * @param {Object<string, *>} b the other's
 * @param {Object<string, *>} genes their kind (as genomeFrom takes it): each gene's range, list, chance or value
 * @param {{next: function, range: function, pick: function, chance: function}} random a seeded generator (SeededRandom)
 * @param {number} [mutation] how often a gene mutates (0..1), and how far a number can move, as a share of its range
 * @returns {Object<string, *>} the child: each gene's value
 * @example crossGenomes({ leg: 6, coat: 'plain' }, { leg: 8, coat: 'spotted' }, { leg: [5, 9], coat: ['plain', 'spotted'] },
 *   new SeededRandom('calf 1')) // { leg: 6..8, coat: 'plain' or 'spotted' }
 * @see crossover-evolutionary-wikipedia
 * @see mutation-evolutionary-wikipedia
 */
export function crossGenomes(a, b, genes, random, mutation = 0.05) {
  const g = {};
  for (const [name, gene] of Object.entries(genes)) {
    const x = a[name] === undefined ? b[name] : a[name],
      y = b[name] === undefined ? a[name] : b[name];
    if (Array.isArray(gene) && typeof gene[0] === 'number') {
      const [lo, hi] = gene;
      let v = x === undefined ? random.range(lo, hi) : x + (y - x) * random.next();
      if (random.chance(mutation)) v += random.range(-1, 1) * mutation * (hi - lo);
      g[name] = Math.min(hi, Math.max(lo, v));
    } else if (Array.isArray(gene)) {
      let v = x === undefined ? random.pick(gene) : random.chance(0.5) ? x : y;
      if (random.chance(mutation) || !gene.includes(v)) v = random.pick(gene);
      g[name] = v;
    } else if (gene && typeof gene === 'object' && 'chance' in gene) {
      let v = x === undefined ? random.chance(gene.chance) : random.chance(0.5) ? x : y;
      if (random.chance(mutation)) v = !v;
      g[name] = !!v;
    } else g[name] = gene;
  }
  return g;
}
