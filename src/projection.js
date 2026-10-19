// Projection: where a point of a world lands on the screen. Side-on, far things move slower than near ones
// (parallax); from above, a turning grid is tipped back into an isometric view and painted back to front.

/**
 * How far a layer has scrolled when the camera has moved: a layer at depth d moves d times as far, so the far land
 * drifts and the near land rushes past.
 * @param {number} camera how far the camera has moved
 * @param {number} depth 0 at the horizon (never moves), 1 the nearest layer (moves with the camera)
 * @returns {number}
 * @see parallax-scrolling-wikipedia
 */
export const parallax = (camera, depth) => camera * depth;

/**
 * A point of a turning square grid to the screen: turned round the grid's centre, tipped back so the ground is half
 * as deep as it is wide (the 2:1 view of isometric games), and lifted by its height.
 * @param {number} x the point, in tiles (0 to size)
 * @param {number} y
 * @param {number} z its height, in levels
 * @param {{size: number, angle: number, scale: number, lift: number, cx: number, cy: number}} view size: tiles across;
 *   angle: how far the grid has turned (radians); scale: pixels per tile; lift: pixels per level; cx, cy: where the
 *   grid's centre lands
 * @returns {number[]} [x, y] on the screen
 * @see isometric-graphics-wikipedia
 * @see isometric-projection-wikipedia
 */
export function turnedProjection(x, y, z, view) {
  const c = Math.cos(view.angle),
    s = Math.sin(view.angle),
    px = x - view.size / 2,
    py = y - view.size / 2;
  const rx = px * c - py * s,
    ry = px * s + py * c,
    k = view.scale;
  return [view.cx + rx * k, view.cy + ry * k * 0.5 - z * view.lift];
}

/**
 * How far back a point of a turning grid is, after turning: sort tiles by this, smallest first, and draw them in that
 * order, so nearer things are painted over farther ones (the painter's algorithm).
 * @param {number} x the point, in tiles
 * @param {number} y
 * @param {number} size tiles across the grid
 * @param {number} angle how far it has turned
 * @returns {number} larger is nearer
 * @see painters-algorithm-wikipedia
 */
export const turnedDepth = (x, y, size, angle) => (x - size / 2) * Math.sin(angle) + (y - size / 2) * Math.cos(angle);

/**
 * How much darker a wall is than the ground on top of it, by which way it faces: a wall facing the light is a little
 * darker (-0.18), one facing away a good deal darker (-0.40), and those between in proportion to how much they face
 * it. Give it to shade() with the top's colour.
 * @param {number[]} normal the way the wall faces, [x, y] of length 1
 * @param {number[]} light the way to the light, [x, y] of length 1
 * @returns {number} -0.40..-0.18
 * @see lambertian-wikipedia
 */
export const faceShade = (normal, light) => -0.18 - 0.22 * (1 - (normal[0] * light[0] + normal[1] * light[1])) * 0.5;

/**
 * The oblique camera that keeps vertical edges vertical and level lines level while depth runs up and to the left: a
 * camera looking straight down whose projection is sheared (screen x = x + m z across, z - y down, heights rising q
 * to k). The matrix to multiply into an orthographic camera's projection, row by row (as Matrix4.set takes it), for a
 * camera at a height camH: view space is x_v = x, y_v = -z, z_v = y - camH.
 * @param {number} m how far depth runs across per pixel up (0.5: half a pixel)
 * @param {number} q how far depth runs up per pixel back
 * @param {number} k how far a height rises per unit
 * @param {number} camH the camera's height
 * @returns {number[]} sixteen numbers, row by row
 * @see oblique-projection-wikipedia
 */
export const obliqueShear = (m, q, k, camH) => [1, -m, 0, 0, 0, q, k, k * camH, -m, -1, q / k, 0, 0, 0, 0, 1];

/**
 * Where a point of the ground shows in that oblique view, relative to the camera's place on the ground: across, its
 * offset plus m times how far back it is; down, how far back it is less its height.
 * @param {number} x the point (world units)
 * @param {number} y its depth (world units, back is smaller)
 * @param {number} h the ground's height there
 * @param {number} cx the camera's place
 * @param {number} cy
 * @param {number} m as obliqueShear's
 * @returns {number[]} [across, down] from the camera's place
 * @see oblique-projection-wikipedia
 */
export function obliqueToScreen(x, y, h, cx, cy, m) {
  return [x - cx + m * (y - cy), -(-(y - cy) + h)];
}

/**
 * The point of the ground under a place in the oblique view (the inverse of obliqueToScreen): first as if the ground
 * were flat, then once more at the height found there.
 * @param {number} X across, from the camera's place
 * @param {number} Y down, from the camera's place
 * @param {number} cx the camera's place
 * @param {number} cy
 * @param {number} m as obliqueShear's
 * @param {function(number, number): number} heightAt the ground's height at a point
 * @returns {number[]} [x, y] on the ground
 * @see oblique-projection-wikipedia
 */
export function obliqueToGround(X, Y, cx, cy, m, heightAt) {
  let z = Y + cy,
    x = X + cx - m * (z - cy);
  const h = heightAt(x, z);
  z = Y + cy + h;
  x = X + cx - m * (z - cy);
  return [x, z];
}
