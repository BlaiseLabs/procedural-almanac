// The checks of src/canvas.js: one sentence each, the sentences almanac.json lists.
import * as A from '../../src/index.js';
import { assert } from '../helpers.mjs';

export const CHECKS = [
  {
    entry: 'setCanvasMaker',
    says: 'after it, makeCanvas makes canvases the way it was told',
    run() {
      const made = [];
      A.setCanvasMaker((w, h) => (made.push([w, h]), { w, h }));
      try {
        assert.deepEqual(A.makeCanvas(7, 9), { w: 7, h: 9 });
        assert.deepEqual(made, [[7, 9]]);
      } finally {
        import('../helpers.mjs'); // (the helpers set the real maker again below)
      }
    },
  },
  {
    entry: 'makeCanvas',
    says: 'it gives a canvas of the size asked, to draw on',
    async run() {
      const { createCanvas } = await import('@napi-rs/canvas');
      A.setCanvasMaker((w, h) => createCanvas(w, h));
      const c = A.makeCanvas(33, 21);
      assert.equal(c.width, 33);
      assert.equal(c.height, 21);
      assert.equal(typeof c.getContext('2d').fillRect, 'function');
    },
  },
  {
    entry: 'stampCache',
    says: 'it makes each key once, and past its limit forgets the oldest first',
    run() {
      const cache = A.stampCache(3);
      let made = 0;
      const make = () => ++made;
      for (const key of ['a', 'b', 'a', 'c', 'b']) cache.get(key, make);
      assert.equal(made, 3);
      cache.get('d', make); // a fourth: 'a' is forgotten
      assert.equal(cache.size, 3);
      cache.get('a', make);
      assert.equal(made, 5);
    },
  },
];
