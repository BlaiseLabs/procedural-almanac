// Motion: how things move by themselves. A flock or a school turning together; a walker going from tile to tile; a
// jelly or a lantern rising in pulses. Each takes things as they are and gives them back a moment later, as new
// objects (what it is given is left as it was).
import { clamp } from './numbers.js';

/**
 * A flock (or a school) a moment later: each one steers toward the flock's centre and its average heading, away from
 * any too close, and, if asked, away from a hunter, back into a band of height, gently off course, and back toward a
 * stretch of the view; then its speed is held between a least and a most.
 * @param {{x: number, y: number, vx: number, vy: number, speed?: number, seed?: number}[]} agents speed: each one's
 *   own multiplier of the flock's speeds (1); seed: its own wander phase (0)
 * @param {number} dt seconds
 * @param {{cohesion: number, alignment: number, separation: {within: number, push: number}, speed: number[],
 *   band?: {from: number, to: number, pull: number}, flee?: {x: number, y: number, push: number},
 *   wander?: {t: number, rate: number[], amount: number[]}, keepCentre?: {origin: number, from: number, to: number,
 *   pull: number}}} o cohesion and alignment: how hard each steers to the centre and to the average heading;
 *   separation: how near is too near, and how hard it pushes; speed: [least, most]; band: keep heights between from and
 *   to; flee: a hunter's place, and how hard to run; wander: the time and [x, y] rates and amounts of a slow weave;
 *   keepCentre: keep the flock's centre, measured from origin, between from and to (a school in a tank)
 * @returns {{x: number, y: number, vx: number, vy: number, dir: number, tilt: number}[]} the agents a moment later,
 *   new objects with every field they had, and dir (1 heading right, -1 left) and tilt (their climb, -0.5..0.5)
 * @see boids-wikipedia
 * @see reynolds-1987
 * @see reynolds-1999
 */
export function flockStep(agents, dt, o) {
  const list = agents.map((a) => ({ ...a }));
  if (!list.length) return list;
  let cx = 0,
    cy = 0,
    vx = 0,
    vy = 0;
  for (const a of list) {
    cx += a.x;
    cy += a.y;
    vx += a.vx;
    vy += a.vy;
  }
  cx /= list.length;
  cy /= list.length;
  vx /= list.length;
  vy /= list.length;
  const near2 = o.separation.within * o.separation.within;
  for (const a of list) {
    // cohesion and alignment, toward the flock's centre and its average heading
    let ax = (cx - a.x) * o.cohesion + (vx - a.vx) * o.alignment,
      ay = (cy - a.y) * o.cohesion + (vy - a.vy) * o.alignment;
    // separation: pushed away from each one too near, harder the nearer
    for (const b of list)
      if (b !== a) {
        const dx = a.x - b.x,
          dy = a.y - b.y,
          d2 = dx * dx + dy * dy;
        if (d2 < near2) {
          ax += (dx * o.separation.push) / (d2 + 1);
          ay += (dy * o.separation.push) / (d2 + 1);
        }
      }
    if (o.band) {
      if (a.y < o.band.from) ay += (o.band.from - a.y) * o.band.pull;
      if (a.y > o.band.to) ay -= (a.y - o.band.to) * o.band.pull;
    }
    if (o.flee) {
      const dx = a.x - o.flee.x,
        dy = a.y - o.flee.y,
        d = Math.hypot(dx, dy) + 1;
      ax += (dx / d) * o.flee.push;
      ay += (dy / d) * o.flee.push;
    }
    if (o.wander) {
      ax += Math.sin(o.wander.t * o.wander.rate[0] + (a.seed || 0)) * o.wander.amount[0];
      ay += Math.cos(o.wander.t * o.wander.rate[1] + (a.seed || 0)) * o.wander.amount[1];
    }
    if (o.keepCentre) {
      const sx = cx - o.keepCentre.origin;
      if (sx < o.keepCentre.from) ax += (o.keepCentre.from - sx) * o.keepCentre.pull;
      else if (sx > o.keepCentre.to) ax -= (sx - o.keepCentre.to) * o.keepCentre.pull;
    }
    a.vx += ax * dt;
    a.vy += ay * dt;
    const sp = Math.hypot(a.vx, a.vy),
      own = a.speed === undefined ? 1 : a.speed,
      max = o.speed[1] * own,
      min = o.speed[0] * own;
    if (sp > max) {
      a.vx *= max / sp;
      a.vy *= max / sp;
    } else if (sp < min) {
      a.vx *= min / (sp + 0.01);
      a.vy *= min / (sp + 0.01);
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.dir = a.vx >= 0 ? 1 : -1;
    a.tilt = clamp(a.vy / (Math.abs(a.vx) + 4), -0.5, 0.5);
  }
  return list;
}

/**
 * A walker on a grid a moment later: it walks toward the middle of the tile it set out for; when it gets there, it
 * picks one of the four neighbouring tiles it may step to, at random, and sometimes pauses first.
 * @param {{x: number, y: number, tx: number, ty: number, wait?: number}} walker where it is, and where it is going (a
 *   tile's middle: tile + 0.5), in tiles; wait: seconds left of a pause
 * @param {number} dt seconds
 * @param {{speed: number, canStep: function(number, number, number, number): boolean, random: object,
 *   pause?: {chance: number, from: number, to: number}}} o speed in tiles a second; canStep(fromX, fromY, toX, toY):
 *   whether it may step from one tile to the next; random: a SeededRandom, drawn from only on arriving; pause: the
 *   chance of pausing on arriving, and how long (none if not given)
 * @returns {{x: number, y: number, tx: number, ty: number, wait: number, dir?: number, moving: boolean}} the walker a
 *   moment later (a new object); moving: it walked this moment
 * @see random-walk-wikipedia
 */
export function gridWalk(walker, dt, o) {
  const a = { ...walker, moving: false };
  if (a.wait > 0) {
    a.wait -= dt;
    return a;
  }
  const dx = a.tx - a.x,
    dy = a.ty - a.y,
    d = Math.hypot(dx, dy);
  if (d < 0.05) {
    const fx = Math.floor(a.x),
      fy = Math.floor(a.y),
      opts = [];
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (o.canStep(fx, fy, fx + ox, fy + oy)) opts.push([fx + ox, fy + oy]);
    if (opts.length) {
      const [nx, ny] = o.random.pick(opts);
      a.tx = nx + 0.5;
      a.ty = ny + 0.5;
    }
    if (o.pause && o.random.chance(o.pause.chance)) a.wait = o.random.range(o.pause.from, o.pause.to);
    return a;
  }
  a.x += (dx / d) * Math.min(d, o.speed * dt);
  a.y += (dy / d) * Math.min(d, o.speed * dt);
  a.dir = dx >= 0 ? 1 : -1;
  a.moving = true;
  return a;
}

/**
 * Something that rises in pulses (a jelly, a lantern, a spirit) a moment later: each pulse pushes it up, then it
 * coasts, and it sways gently from side to side.
 * @param {{x: number, y: number, phase: number, speed?: number, seed?: number}} a
 * @param {number} dt seconds
 * @param {number} t the time, in seconds (for the sway)
 * @param {{rate?: number, push?: number, sway?: number[]}} [o] rate: pulses (radians a second, 2.2); push: how hard
 *   (9); sway: [rate, amount] ([0.3, 3])
 * @returns {{x: number, y: number, phase: number}} a new object, with every field it had
 */
export function pulseRise(a, dt, t, o = {}) {
  const own = a.speed === undefined ? 1 : a.speed,
    sway = o.sway || [0.3, 3],
    b = { ...a, phase: a.phase + dt * (o.rate || 2.2) * own };
  const push = Math.max(0, Math.sin(b.phase)) * (o.push || 9) * own; // only the rising half of each pulse pushes
  b.y -= push * dt;
  b.x += Math.sin(t * sway[0] + (a.seed || 0)) * sway[1] * dt;
  return b;
}

/**
 * Which way to run from threats: each threat within its reach pushes away from itself, more strongly the nearer it is
 * (the push is the offset over its length plus a tenth, so it is near one unit long and grows as the threat closes),
 * and the pushes add. How afraid it makes the one fleeing is the most any threat in reach gives: 1.2 seconds, or 2.2
 * for a hard threat.
 * @param {number} x where the one fleeing is
 * @param {number} y
 * @param {{x: number, y: number, r: number, hard?: boolean}[]} threats each with its reach
 * @returns {{x: number, y: number, fear: number}} the summed push (0, 0 with none in reach) and the fear (0 with none)
 * @see reynolds-1999
 */
export function fleeVector(x, y, threats) {
  let fx = 0,
    fy = 0,
    fear = 0;
  for (const th of threats) {
    const d = Math.hypot(x - th.x, y - th.y);
    if (d < th.r) {
      fx += (x - th.x) / (d + 0.1);
      fy += (y - th.y) / (d + 0.1);
      fear = Math.max(fear, th.hard ? 2.2 : 1.2);
    }
  }
  return { x: fx, y: fy, fear };
}

/**
 * A follower's place beside its leader, for three ways of keeping together: 'cluster', a loose flock, each follower
 * in a place of its own round the leader (its angle stepping by 2.4 radians, so places spread round, and its distance
 * 7 to 19 by fours; the ground seen from above squashes it to 0.8 north to south); 'school', fish trailing behind the
 * leader along its heading, further back each, a little to one side; 'vee', birds in a V behind the leader, the first
 * follower to one side and the next to the other, each pair 7 further back and spread 0.7 as wide.
 * @param {'cluster'|'school'|'vee'} kind
 * @param {number} lx where the leader is
 * @param {number} ly
 * @param {number} la the leader's heading (radians)
 * @param {number} slot the follower's number (0, 1, 2 ...)
 * @returns {{x: number, y: number}} the place to steer for
 * @see boids-wikipedia
 * @see reynolds-1999
 */
export function formationSlot(kind, lx, ly, la, slot) {
  if (kind === 'school') {
    const a = slot * 2.1;
    return {
      x: lx - Math.cos(la) * (3 + slot * 1.6) + Math.cos(a) * 4,
      y: ly - Math.sin(la) * (3 + slot * 1.6) + Math.sin(a) * 3,
    };
  }
  if (kind === 'vee') {
    const side = slot % 2 ? 1 : -1,
      back = Math.ceil(slot / 2) * 7;
    return {
      x: lx - Math.cos(la) * back - Math.sin(la) * side * back * 0.7,
      y: ly - Math.sin(la) * back + Math.cos(la) * side * back * 0.7,
    };
  }
  const a = slot * 2.4,
    rr = 7 + (slot % 4) * 4;
  return { x: lx + Math.cos(a) * rr, y: ly + Math.sin(a) * rr * 0.8 };
}
