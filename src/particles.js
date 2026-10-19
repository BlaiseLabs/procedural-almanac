// Particles: many small things (rain, snow, petals, bubbles, embers, dust, fireflies) made at random over a field and
// moved each moment by one simple law. A particle is { x, y, z: its depth (0.4 far .. 1 near), p: its phase (an angle),
// s: its own number in 0..1 (how it differs from the others) }. Each law gives a new particle; what it is given is left
// as it was.

/**
 * A field of particles strewn at random: each somewhere in the field, at a depth between 0.4 and 1, at a phase of its
 * own and with a number of its own.
 * @param {number} count how many
 * @param {number} width the field's width
 * @param {number} height its height
 * @param {{range: function, next: function}} random a SeededRandom (drawn from five times a particle)
 * @returns {{x: number, y: number, z: number, p: number, s: number}[]}
 * @see particle-system-wikipedia
 * @see reeves-1983
 */
export function particleField(count, width, height, random) {
  const list = [];
  for (let i = 0; i < count; i++)
    list.push({
      x: random.range(0, width),
      y: random.range(0, height),
      z: random.range(0.4, 1),
      p: random.range(0, Math.PI * 2),
      s: random.next(),
    });
  return list;
}

const age = (q, dt) => ({ ...q, p: q.p + dt * (1 + q.s) }); // each particle's phase turns at its own pace

/**
 * Falling, a moment later (rain, snow, petals, leaves): down at its speed, sideways with the wind, swaying and
 * bobbing if asked, near particles moving more than far ones, and drifting back as the camera moves on.
 * @param {{x: number, y: number, z: number, p: number, s: number}} q
 * @param {number} dt seconds
 * @param {{speed: number, wind?: number, camera?: number, sway?: number[], bob?: number[]}} o speed: how fast it falls;
 *   wind: how fast it is blown sideways; camera: how fast the view moves on; sway and bob: [rate, amount] of a side to
 *   side and an up and down flutter
 * @returns {{x: number, y: number, z: number, p: number, s: number}}
 */
export function fall(q, dt, o) {
  const r = age(q, dt),
    sway = o.sway || [1, 0],
    bob = o.bob || [1, 0];
  r.x += ((o.wind || 0) + Math.sin(r.p * sway[0]) * sway[1] - (o.camera || 0)) * dt * r.z;
  r.y += (o.speed + Math.cos(r.p * bob[0]) * bob[1]) * r.z * dt;
  return r;
}

/**
 * Rising, a moment later (bubbles, embers): up at its speed, each a little faster or slower by its own number,
 * wobbling sideways, and drifting with the wind.
 * @param {{x: number, y: number, z: number, p: number, s: number}} q
 * @param {number} dt seconds
 * @param {{speed: number, spread?: number, wind?: number, sway?: number[]}} o speed: the slowest rise; spread: how much
 *   faster the fastest is; wind: sideways drift; sway: [rate, amount] of the wobble
 * @returns {{x: number, y: number, z: number, p: number, s: number}}
 */
export function rise(q, dt, o) {
  const r = age(q, dt),
    sway = o.sway || [1, 0];
  r.x += ((o.wind || 0) + Math.sin(r.p * sway[0]) * sway[1]) * dt;
  r.y -= (o.speed + r.s * (o.spread || 0)) * dt;
  return r;
}

/**
 * Hanging in the air, a moment later (dust, plankton, fireflies): wandering in small loops round where it is, and
 * drifting back as the camera moves on (by its depth, if asked).
 * @param {{x: number, y: number, z: number, p: number, s: number}} q
 * @param {number} dt seconds
 * @param {{x: number[], y: number[], camera?: number, byDepth?: boolean}} o x and y: [rate, amount] of the wander
 *   along each; camera: how fast the view moves on; byDepth: near particles drift back more than far ones
 * @returns {{x: number, y: number, z: number, p: number, s: number}}
 */
export function hover(q, dt, o) {
  const r = age(q, dt),
    cam = o.byDepth ? (o.camera || 0) * r.z : o.camera || 0;
  r.x += (Math.sin(r.p * o.x[0]) * o.x[1] - cam) * dt;
  r.y += Math.cos(r.p * o.y[0]) * o.y[1] * dt;
  return r;
}

/**
 * A particle that has left the field comes back on the far side: past the margin on the left it reappears on the
 * right, past the bottom at the top, and so on, so a field of particles never thins out.
 * @param {{x: number, y: number}} q
 * @param {number} width
 * @param {number} height
 * @param {number} [margin] how far outside it may go first (30)
 * @returns {{x: number, y: number}} a new particle
 * @see wraparound-wikipedia
 */
export function wrapAround(q, width, height, margin = 30) {
  const r = { ...q };
  if (r.x < -margin) r.x += width + margin * 2;
  else if (r.x > width + margin) r.x -= width + margin * 2;
  if (r.y < -margin) r.y += height + margin * 2;
  else if (r.y > height + margin) r.y -= height + margin * 2;
  return r;
}
