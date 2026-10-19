// A display list: a drawing given as data (shapes, each with its fill or stroke, and groups that move, blend or shade
// what is in them) and drawn by one function. A program says what to draw; this says it to the canvas.

const PATH = new Set([
  'moveTo',
  'lineTo',
  'quadraticCurveTo',
  'bezierCurveTo',
  'arc',
  'ellipse',
  'rect',
  'roundRect',
  'closePath',
]);

const pathCommand = (g, command, args) => {
  if (!PATH.has(command)) throw new Error(`"${command}" is not a path command (one of: ${[...PATH].join(', ')})`);
  g[command](...args);
};
// a fill or a stroke: a CSS colour, or a gradient as data
function paintOf(g, p) {
  if (typeof p === 'string') return p;
  const gr = p.linear ? g.createLinearGradient(...p.linear) : g.createRadialGradient(...p.radial);
  for (const [at, colour] of p.stops) gr.addColorStop(at, colour);
  return gr;
}
// the settings an item or a group gives (only those; the rest stay as the canvas has them)
function settings(g, it) {
  if (it.composite !== undefined) g.globalCompositeOperation = it.composite;
  if (it.alpha !== undefined) g.globalAlpha = it.alpha;
  if (it.shadow) {
    if (it.shadow.color !== undefined) g.shadowColor = it.shadow.color;
    if (it.shadow.blur !== undefined) g.shadowBlur = it.shadow.blur;
    if (it.shadow.x !== undefined) g.shadowOffsetX = it.shadow.x;
    if (it.shadow.y !== undefined) g.shadowOffsetY = it.shadow.y;
  }
}

/**
 * Draws a display list: a drawing described as data. Each item is a shape or a group, drawn in order.
 *
 * A shape is { path: [[command, ...numbers], ...] } (the canvas's own path commands: moveTo, lineTo,
 * quadraticCurveTo, bezierCurveTo, arc, ellipse, rect, roundRect, closePath) or { rect: [x, y, w, h] } (a filled
 * rectangle), with fill and/or stroke (a CSS colour, or a gradient: { linear: [x0, y0, x1, y1] } or
 * { radial: [x0, y0, r0, x1, y1, r1] }, with stops: [[0, colour], ...]), and, if it says so, width, cap, join,
 * fillRule, composite, alpha and shadow ({ color, blur, x, y }). A group is { group: [items] }, with translate,
 * scale and rotate (applied in that order), composite, alpha, shadow, and clip (a path, in the same commands: what
 * is in the group is drawn only inside it), all undone after it.
 *
 * Only what an item says is set: anything it leaves out stays as the canvas has it, as hand-written drawing does.
 * Falsy items (a hat no one wears) are skipped.
 * @param {object} g a canvas 2D context
 * @param {object[]} items
 * @see display-list-wikipedia
 */
export function drawList(g, items) {
  for (const it of items) {
    if (!it) continue;
    if (it.group) {
      g.save();
      if (it.translate) g.translate(...it.translate);
      if (it.scale) g.scale(...it.scale);
      if (it.rotate) g.rotate(it.rotate);
      settings(g, it);
      if (it.clip) {
        g.beginPath();
        for (const [command, ...args] of it.clip) pathCommand(g, command, args);
        g.clip();
      }
      drawList(g, it.group);
      g.restore();
      continue;
    }
    settings(g, it);
    if (it.width !== undefined) g.lineWidth = it.width;
    if (it.cap !== undefined) g.lineCap = it.cap;
    if (it.join !== undefined) g.lineJoin = it.join;
    if (it.rect) {
      g.fillStyle = paintOf(g, it.fill);
      g.fillRect(...it.rect);
      continue;
    }
    g.beginPath();
    for (const [command, ...args] of it.path) pathCommand(g, command, args);
    if (it.fill !== undefined) {
      g.fillStyle = paintOf(g, it.fill);
      it.fillRule ? g.fill(it.fillRule) : g.fill();
    }
    if (it.stroke !== undefined) {
      g.strokeStyle = paintOf(g, it.stroke);
      g.stroke();
    }
  }
}
