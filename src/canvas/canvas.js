// The plumbing under the drawing: making a canvas (in a browser or in Node), and keeping things drawn once to stamp
// many times.

let maker = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * Says how canvases are made, once, at the start: a browser needs nothing (an OffscreenCanvas, or a canvas element);
 * Node is given one, e.g. createCanvas from @napi-rs/canvas.
 * @param {function(number, number): object} fn (width, height) to a canvas
 * @example setCanvasMaker((w, h) => createCanvas(w, h))
 */
export function setCanvasMaker(fn) {
  maker = fn;
}

/**
 * A new canvas, made the way setCanvasMaker said.
 * @param {number} w
 * @param {number} h
 * @returns {object} a canvas (getContext('2d') for its drawing)
 */
export const makeCanvas = (w, h) => maker(w, h);

/**
 * A cache of things drawn once and stamped many times (a tree, a creature at a frame of its walk): get(key, make)
 * returns what make() drew the first time the key was asked for. Past its limit, the oldest is forgotten. It changes
 * no picture, only how often the same thing is drawn.
 * @param {number} [limit] how many to keep (1500)
 * @returns {{get: function(string, function(): *): *, size: number}}
 * @see sprite-wikipedia
 */
export function stampCache(limit = 1500) {
  const kept = new Map();
  return {
    get(key, make) {
      let s = kept.get(key);
      if (!s) {
        s = make();
        kept.set(key, s);
        if (kept.size > limit) kept.delete(kept.keys().next().value);
      }
      return s;
    },
    get size() {
      return kept.size;
    },
  };
}
