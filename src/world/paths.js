// Ways across a grid: a shortest way round what is blocked, the nearest open cell to a point, whether a straight line
// crosses anything, a way made straight where it can be, everything reachable from a start, and a set grown until it
// stops growing.

/**
 * A shortest way over a grid of cells (eight ways, never cutting a corner past a blocked cell), the octile distance its
 * guess, looking at no more than a budget of cells. Cells may be negative.
 * @param {number[]} a [x, y] the start cell
 * @param {number[]} b [x, y] the goal cell
 * @param {{free: function(number, number): boolean, budget?: number}} o free(x, y): a cell can be stood on
 * @returns {number[][]|null} the cells from a to b, or null if none was found within the budget
 * @see a-star-wikipedia
 */
export function gridAStar(a, b, { free, budget = 5000 }) {
  const key = (x, y) => (x + 32768) * 65536 + (y + 32768), // (cells may be negative: offset to stay whole and apart)
    goal = key(b[0], b[1]),
    h = (x, y) => {
      const dx = Math.abs(x - b[0]),
        dy = Math.abs(y - b[1]);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
  const g = new Map([[key(a[0], a[1]), 0]]),
    came = new Map(),
    heap = [[h(a[0], a[1]), a[0], a[1]]];
  const push = (n) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  let seen = 0;
  while (heap.length && seen++ < budget) {
    const [, x, y] = pop(),
      k = key(x, y),
      gk = g.get(k);
    if (k === goal) {
      const out = [[x, y]];
      for (let c = came.get(k); c !== undefined; c = came.get(c)) out.push([Math.floor(c / 65536) - 32768, (c % 65536) - 32768]);
      return out.reverse();
    }
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = x + dx,
          ny = y + dy;
        if (!free(nx, ny) || (dx && dy && (!free(x + dx, y) || !free(x, y + dy)))) continue;
        const nk = key(nx, ny),
          ng = gk + (dx && dy ? 1.414 : 1);
        if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
          g.set(nk, ng);
          came.set(nk, k);
          push([ng + h(nx, ny), nx, ny]);
        }
      }
  }
  return null;
}

/**
 * The open cell nearest a cell: the cell itself if open, else the first open one on rings drawn outward (each ring's
 * top and bottom rows, then its sides, across).
 * @param {number} cx
 * @param {number} cy
 * @param {function(number, number): boolean} free
 * @param {number} [r] how many rings out to look
 * @returns {number[]|null} [x, y], or null within r rings
 * @see a-star-wikipedia
 */
export function nearestFreeCell(cx, cy, free, r = 14) {
  if (free(cx, cy)) return [cx, cy];
  for (let d = 1; d <= r; d++)
    for (let i = -d; i <= d; i++)
      for (const [x, y] of [
        [cx + i, cy - d],
        [cx + i, cy + d],
        [cx - d, cy + i],
        [cx + d, cy + i],
      ])
        if (free(x, y)) return [x, y];
  return null;
}

/**
 * Whether the straight line between two points crosses nothing: points along it a step apart (not the ends), each
 * asked whether it is open.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} step how far apart the points it asks about are (about)
 * @param {function(number, number): boolean} isFree
 * @returns {boolean}
 * @see any-angle-path-wikipedia
 */
export function segmentClear(x0, y0, x1, y1, step, isFree) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step);
  for (let i = 1; i < n; i++) if (!isFree(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}

/**
 * A way of points made straight where it can be: from the start, a point is kept only where the straight line from
 * the last one kept to the next would cross something; the last point is always kept.
 * @param {{x: number, y: number}} start where the way begins
 * @param {{x: number, y: number}[]} points the way's points, the first being the start's own cell
 * @param {function(number, number, number, number): boolean} clear whether a straight line crosses nothing
 * @returns {{x: number, y: number}[]} the points to walk to, in order
 * @see any-angle-path-wikipedia
 */
export function straightenPath(start, points, clear) {
  const out = [];
  let from = start;
  for (let i = 1; i < points.length; i++) {
    const next = points[i];
    if (!clear(from.x, from.y, next.x, next.y)) {
      const keep = { x: points[i - 1].x, y: points[i - 1].y };
      out.push(keep);
      from = keep;
    }
  }
  const last = points[points.length - 1];
  out.push({ x: last.x, y: last.y });
  return out;
}

/**
 * Everything reachable from a start by steps: each node's next nodes (those a step can reach) visited once, by their
 * ids, depth first.
 * @param {*} start
 * @param {function(*): *} id a node's id
 * @param {function(*): Array} next the nodes one step from a node
 * @returns {Set} the ids reached, the start's first
 * @see flood-fill-wikipedia
 */
export function floodFill(start, id, next) {
  const seen = new Set([id(start)]),
    todo = [start];
  while (todo.length) {
    const t = todo.pop();
    for (const n of next(t)) {
      const k = id(n);
      if (!seen.has(k)) {
        seen.add(k);
        todo.push(n);
      }
    }
  }
  return seen;
}

/**
 * A set grown until it stops growing: a pass is run again for as long as the last one added anything.
 * @param {function(): boolean} pass one pass over the rules; true if it added something
 * @returns {number} how many passes were run
 * @see least-fixed-point-wikipedia
 */
export function untilSettled(pass) {
  let n = 0;
  for (let grew = true; grew; n++) grew = pass();
  return n;
}
