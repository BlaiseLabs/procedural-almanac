// Limbs: bones joined end to end, posed by where their tip should be (inverse kinematics), not by their angles.

import { clamp } from './numbers.js';

/**
 * A limb of two bones (a thigh and a shin, an upper arm and a forearm) reaching for a point: where its middle joint
 * goes so that its tip lands on the point. Out of reach, the limb straightens toward the point.
 * @param {{x: number, y: number}} hip where the limb is fixed
 * @param {{x: number, y: number}} target where its tip should land
 * @param {number} upper the first bone's length
 * @param {number} lower the second bone's length
 * @param {1|-1} bend which side the joint bends to (-1 mirrors 1 across the line from hip to target)
 * @returns {{knee: {x: number, y: number}, foot: {x: number, y: number}}} the joint and the tip
 * @example twoBoneLimb({ x: 0, y: 10 }, { x: 3, y: 0 }, 6, 6, 1) // a knee bent forward, the foot on the ground
 * @see inverse-kinematics-wikipedia
 * @see law-of-cosines-wikipedia
 */
export function twoBoneLimb(hip, target, upper, lower, bend) {
  const dx = target.x - hip.x,
    dy = target.y - hip.y,
    reach = Math.min(Math.hypot(dx, dy), upper + lower - 0.01), // at most a straight limb
    toward = Math.atan2(dy, dx);
  // the angle at the hip between the first bone and the line to the target, from the three sides [law-of-cosines-wikipedia]
  const cosHip = clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1),
    first = toward - bend * Math.acos(cosHip);
  const knee = { x: hip.x + Math.cos(first) * upper, y: hip.y + Math.sin(first) * upper },
    second = Math.atan2(target.y - knee.y, target.x - knee.x);
  return { knee, foot: { x: knee.x + Math.cos(second) * lower, y: knee.y + Math.sin(second) * lower } };
}

/**
 * A limb of two bones in three dimensions, from a hip to a foot: where the knee goes, the foot pulled in to the
 * limb's reach if it is too far (and the limb never folded tighter than its bones allow), the knee bent toward a pole
 * direction (up, out to the side, back for a hind leg) and never below the ground.
 * @param {number} hx the hip
 * @param {number} hy
 * @param {number} hz
 * @param {number} fx where the foot should be
 * @param {number} fy
 * @param {number} fz
 * @param {number} l1 the upper bone's length
 * @param {number} l2 the lower bone's length
 * @param {number} px the way the knee bends (a direction; the part of it along the limb is ignored)
 * @param {number} py
 * @param {number} pz
 * @param {number} [ground] the lowest the knee may be
 * @returns {number[]} [knee x, y, z, foot x, y, z]
 * @example twoBoneLimb3d(0, 0, 4, 0, 0, 0, 3, 3, 1, 0, 1) // a knee bent forward and up
 * @see inverse-kinematics-wikipedia
 * @see law-of-cosines-wikipedia
 */
export function twoBoneLimb3d(hx, hy, hz, fx, fy, fz, l1, l2, px, py, pz, ground = 0) {
  let dx = fx - hx,
    dy = fy - hy,
    dz = fz - hz,
    d = Math.hypot(dx, dy, dz) || 0.001;
  const max = l1 + l2 - 0.02,
    min = Math.abs(l1 - l2) + 0.02;
  if (d > max) {
    const k = max / d;
    dx *= k;
    dy *= k;
    dz *= k;
    fx = hx + dx;
    fy = hy + dy;
    fz = hz + dz;
    d = max;
  }
  if (d < min) d = min;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d,
    uy = dy / d,
    uz = dz / d;
  const dot = px * ux + py * uy + pz * uz;
  px -= dot * ux;
  py -= dot * uy;
  pz -= dot * uz;
  const pl = Math.hypot(px, py, pz) || 1;
  return [hx + ux * a + (px / pl) * h, hy + uy * a + (py / pl) * h, Math.max(ground, hz + uz * a + (pz / pl) * h), fx, fy, fz];
}
