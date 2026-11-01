// Roofs seen from above in pixel art: where a gable or hip roof's ridge, slopes and eaves fall, how a slope shades
// from ridge to eave, and the texture of its covering (tiles in staggered rows, tiles in mortar, thatch in ragged
// layers, boards with nails, lacquered boards), each a pixel's shade given as a word the caller colours.

/**
 * A roof seen from above, its foot (the south eave's middle) at (cx, by): the eaves' rectangle, the ridge's row (a
 * little above the middle, since it is raised: three tenths of the way back from the north eave) and, for a hip
 * roof, how far its ends slope in.
 * @param {'gable'|'hip'|'flat'} kind
 * @param {number} w the walls' width
 * @param {number} d the walls' depth (front to back)
 * @param {number} eave how far the roof reaches past the walls
 * @param {number} cx
 * @param {number} by
 * @returns {{x0: number, x1: number, yN: number, yS: number, yR: number, inset: number, W: number, D: number}}
 * @see hip-roof-wikipedia
 * @see gable-roof-wikipedia
 * @see eaves-wikipedia
 */
export function roofPlan(kind, w, d, eave, cx, by) {
  const W = w + eave * 2,
    D = d + eave * 2,
    x0 = Math.round(cx - W / 2),
    x1 = x0 + W - 1,
    yS = by,
    yN = by - D + 1,
    yR = yN + Math.round(D * 0.3),
    inset = kind === 'hip' ? Math.round(D * 0.42) : 0;
  return { x0, x1, yN, yS, yR, inset, W, D };
}

/**
 * How the south slope (the one toward the eye) shades at a row: dark along its eave (the last fifth), lit just under
 * the ridge (its first sixth), else as it is.
 * @param {number} y
 * @param {number} yR the ridge's row
 * @param {number} yS the eave's row
 * @returns {'eave'|'ridge'|null}
 * @see eaves-wikipedia
 */
export function slopeShade(y, yR, yS) {
  const u = (y - yR) / Math.max(1, yS - yR);
  return u > 0.8 ? 'eave' : u < 0.16 ? 'ridge' : null;
}

/**
 * A roof covering's texture at a pixel, its rows parallel to the eave (counted from the slope's corner x0, y0):
 *   tile and redtile  rows four pixels deep, each row's tiles six wide and staggered by three; a seam under each row
 *                     and at each tile's joint (in mortar, for redtile), a lit edge beside the joint, a shaded third row
 *   thatch            layers five deep, each with a ragged dark lower edge, light straws and dark gaps by a hash
 *   plank             boards six wide (a dark seam, a lit edge), a nail now and then
 *   vermilion         lacquered boards four wide, a shaded line every seven rows
 * @param {'tile'|'redtile'|'thatch'|'plank'|'vermilion'} style
 * @param {number} x
 * @param {number} y
 * @param {number} x0
 * @param {number} y0
 * @returns {'seam'|'mortar'|'lit'|'shaded'|'edge'|'deep'|'glow'|'dim'|null} null: the roof's own colour
 * @see roof-tiles-wikipedia
 * @see thatching-wikipedia
 */
export function roofTexel(style, x, y, x0, y0) {
  if (style === 'tile' || style === 'redtile') {
    const mortar = style === 'redtile',
      r = (y - y0) % 4,
      row = Math.floor((y - y0) / 4),
      j = (x - x0 + (row % 2) * 3) % 6;
    if (r === 3) return mortar ? 'mortar' : 'seam';
    if (j === 0) return mortar ? 'mortar' : 'seam';
    if (j === 1 && r < 2) return 'lit';
    if (r === 2 && !mortar) return 'shaded';
    return null;
  }
  if (style === 'thatch') {
    const r = (y - y0) % 5,
      n = (x * 7 + y * 13 + ((x * y) % 7)) % 11;
    if (r === 4 && (x * 3 + y) % 4 !== 0) return 'edge'; // (each layer's ragged lower edge)
    if (r === 0 && n < 4) return 'lit';
    if (n === 5 || n === 9) return 'deep';
    return n < 2 ? 'glow' : null;
  }
  if (style === 'plank') {
    const k = (x - x0) % 6;
    if (k === 5) return 'edge';
    if (k === 0) return 'lit';
    if (k === 2 && (y - y0) % 9 === 4) return 'deep'; // (a nail)
    return null;
  }
  if (style === 'vermilion') return (x - x0) % 4 === 3 ? 'edge' : (y - y0) % 7 === 6 ? 'dim' : null;
  return null;
}
