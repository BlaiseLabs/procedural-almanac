// The look of the island: its palette (every colour, graded once, with a ramp of tones for each), and the small
// pictures drawn from it: trees, palms, the summit's great tree, houses, villagers, deer, gulls, hens, the boat, the
// lighthouse and the lamp posts.

/**
 * The palette: every colour the film uses, and the two helpers that make colours (hex and tone).
 *
 * How it works: colours are written as "#rrggbb" and passed through hex(), which grades each one the same way (a little
 * more saturated, a little warmer, a little more contrast) and packs it into one 32-bit number, the form the frame's
 * pixels are kept in. Some entries are lists: steps of one colour (the sea's depths, the clay of each terrace, heights
 * as greys) or kinds of one thing (flowers, fire).
 */
export function makePalette(k) {
  const { A } = k;
  const { bayerThreshold, clamp, gradeColour, hexToRgb, hueShiftTone, packRgb } = A;

  // the whole palette passes through one grade, as a film's does
  const LOOK = { sat: 1.08, warm: 0.05, contrast: 1.04 };
  // a "#rrggbb" colour, graded, as one packed number: 0xAABBGGRR, the byte order an ImageData keeps on most machines
  const hex = (s) => packRgb(...hexToRgb(gradeColour(s, LOOK)));
  const RAMPS = new Map();
  // tone(c, k): colour c made k steps darker (k below 0) or lighter (above 0), k from -2 to 2. Each step also turns the
  // hue, darker toward blue and lighter toward yellow, the way pixel artists shade. A colour's five tones are worked
  // out the first time it is asked for and kept in RAMPS.
  const tone = (c, k) => {
    let r = RAMPS.get(c);
    if (!r) RAMPS.set(c, (r = [-1.7, -0.85, 0, 0.75, 1.5].map((s) => (s ? hueShiftTone(c, s) : c))));
    return r[k + 2];
  };
  // the named colours: the land and its walls, fields, houses, people, lights, the captions
  const C = {
    sand: hex('#ead9a2'),
    wetSand: hex('#d3bd86'),
    lush: hex('#74c25a'),
    dry: hex('#a7c463'),
    wood1: hex('#58a44c'),
    wood2: hex('#468f48'),
    heath: hex('#86a05c'),
    moor: hex('#a08f6a'),
    rock: hex('#a39c8e'),
    snow: hex('#e9ece6'),
    earth: hex('#a8774f'),
    stone: hex('#8f8c87'),
    dirt: hex('#cfac72'),
    plank: hex('#a9763f'),
    bank: hex('#9c7c4e'),
    wheat: hex('#e2c25c'),
    greens: hex('#6aab4b'),
    cabbage: hex('#93c979'),
    fallow: hex('#a87b53'),
    paddy: hex('#93d3cf'),
    sprout: hex('#5fb35a'),
    flowers: ['#fff4e0', '#ffd75a', '#ff9fb8', '#c9a9ff'].map(hex),
    bark: [hex('#5b3b26'), hex('#87593a')],
    inkTree: hex('#1e2b22'),
    ink: hex('#24191b'),
    plaster: hex('#ece0c6'),
    timber: hex('#c9996a'),
    door: hex('#5d3b25'),
    glass: hex('#33496c'),
    lit: hex('#ffd98a'),
    lamp: hex('#fff0b0'),
    pole: hex('#3b2f2c'),
    fire: [hex('#fff3b0'), hex('#ffb347'), hex('#f0632e')],
    smoke: hex('#d9d6d2'),
    rain: hex('#a9c2e2'),
    star: hex('#e6eeff'),
    firefly: hex('#e9ff8f'),
    lantern: hex('#ffb04a'),
    text: hex('#f6eed8'),
    accent: hex('#ffd36e'),
    textInk: hex('#1a1824'),
    mark: hex('#c8c0b0'),
    fog: hex('#ebe8f2'),
    gull: hex('#fbfbf6'),
    gullShade: hex('#b9c0c8'),
    sail: hex('#f8f3e6'),
    hull: hex('#8a5432'),
    beacon: hex('#fff6c8'),
    tower: hex('#f2efe8'),
    towerRed: hex('#c8473c'),
    tip: hex('#ffc2e0'),
    tipBright: hex('#fff4fb'),
  };
  // the sea's palette for waterPixel: seven depths from shallow to deep (LV), foam, glints on the crests, weed seen on
  // the sea bed, and sand seen through shallow water near a beach
  const P = {
    LV: ['#74cfdc', '#5ec0d7', '#4caecf', '#3e9bc5', '#3489ba', '#2c78ad', '#25679f'].map(hex),
    FOAM: hex('#f6fdff'),
    FOAM2: hex('#c4ecf2'),
    GLINT: hex('#ffffff'),
    GLINT2: hex('#dff8ff'),
    WEED: hex('#2f7db0'),
    WEED2: hex('#3487b6'),
    SAND: ['#e2d3a0', '#bfd0a6', '#8cc2b4'].map(hex),
  };
  // the river's palette: the sea's, with lighter, greener water
  const PR = {
    ...P,
    LV: ['#9ee6dc', '#86d9d6', '#6fcad0', '#5cb8c8', '#4ea6bf', '#4494b4', '#3b83a8'].map(hex),
    WEED: hex('#4a9a8a'),
    WEED2: hex('#58a890'),
  };
  // nine greys, dark to light, for the heights before the land is painted
  const GREYS = ['#16182a', '#2a2b3c', '#40404e', '#575562', '#706c76', '#8b8690', '#a7a1a8', '#c7c1c1', '#ebe5d6'].map(
    hex,
  );
  // greyOf(v, x, y): a height v (0 to 1) as one of the nine greys. Adding the ordered-dither threshold before rounding
  // down mixes the two nearest greys in a fixed pattern of pixels, so the steps between them show as fine dots, not
  // bands.
  const greyOf = (v, x, y) => GREYS[clamp(Math.floor(v * 8 + bayerThreshold(x, y)), 0, 8)];
  // the bare clay of each terrace before it is painted, darker low down and lighter high up
  const CLAY = ['#7e7a74', '#8f8a82', '#a09a90', '#b0a99e', '#bfb8ac', '#cdc6ba', '#dbd5ca'].map(hex);
  // Markers: a few pixels of some sprites (windows, lamps, the summit tree's tips, the lighthouse's lamp) are drawn as
  // a code instead of a colour, so that after dark the frame can find them and light them. A real colour has 0xFF in
  // its top byte; a marker has 0xFE there, then the kind of light (MARK) in the next byte and which house or tip it
  // belongs to (id) in the lowest two. MARK_DAY is the colour each kind shows by day.
  const MARK = { win: 1, lamp: 2, tip: 3, beacon: 4, fire: 5 };
  // marker(kind, id): the code for a marker pixel (0xFE, then the kind, then the owner)
  const marker = (type, id = 0) => (0xfe000000 | (type << 16) | id) >>> 0;
  const MARK_DAY = [0, C.glass, C.pole, hex('#f3a9c8'), C.beacon, C.fire[1]];
  // the leaves of each kind of tree, darkest first
  const LEAVES = {
    meadow: ['#2f6b35', '#4d9a43', '#78c25a', '#a8df7c'],
    wood: ['#24532f', '#3b7d3c', '#5aa148', '#86c767'],
    pine: ['#1d4433', '#2e6444', '#468556', '#6aa874'],
    blossom: ['#7a4a6a', '#c9739c', '#f0a3c3', '#ffd6e6'],
  };
  for (const k of Object.keys(LEAVES)) LEAVES[k] = LEAVES[k].map(hex);

  return { hex, tone, C, P, PR, GREYS, greyOf, CLAY, MARK, marker, MARK_DAY, LEAVES };
}

/**
 * The small pictures: trees, palms, the summit tree, houses, villagers, deer, gulls, hens, the boat, the lighthouse and
 * the lamp posts.
 *
 * How it works: a sprite is a small buffer of packed pixels ({w, h, px}, 0 meaning see-through) with an anchor (ax,
 * ay), the point of it that stands on the ground. Most are drawn into a buffer with the almanac's raster helpers, given
 * a dark outline, and cut down to the box round what was drawn. A picture drawn often in the same state (a tree at a
 * step of its growth, a house as its walls rise, a villager mid-step) is kept in a cache, so it is drawn only once.
 */
export function makeSprites(k, look) {
  const { A, SEED } = k;
  // prettier-ignore
  const { SeededRandom, barkTrunk, blitSprite, branchingTree, capsuleSteps, clamp, cutSprite, drawnBounds,
    fillEllipse, footStep, gaitTiming, layTemplate, leafCrown, lineCells, outlinePass, roofPlan, roofTexel,
    slopeShade, spriteFromRows, stampCache, swayingChain } = A;
  const { hex, tone, C, MARK, marker, LEAVES } = look;

  // up to 6000 drawn sprites, each found again by a key such as 't:12:7' (tree 12 at growth step 7)
  const cache = stampCache(6000);
  // an empty picture, w by h pixels
  const buffer = (w, h) => ({ w, h, px: new Uint32Array(w * h) });
  // the picture cut down to the box round what was drawn in it, its anchor kept at the same point
  const trim = (r, ax, ay) => {
    const b = drawnBounds(r);
    return b ? cutSprite(r, b[0], b[1], b[2], b[3], ax, ay) : null;
  };

  /**
   * Draws tree tr at k of its full size (k grows from 0 to about 1.1 as the tree springs up, then settles at 1).
   *
   * How it works: a sapling (under a fifth of full size) is two pixels. A round tree is a trunk (barkTrunk) with a
   * crown of leaf clumps on top (leafCrown), dotted with blossom if it is a blossom tree. A cone tree (a pine) is a
   * short trunk with three crowns stacked, each smaller than the one below. The tree's own seed places its clumps the
   * same way at every size, so it grows rather than changes. The sprite also records how tall its trunk is (sp.trunk),
   * so that only the crown above it sways in the wind.
   */
  function buildTree(tr, k) {
    const r = buffer(34, 44),
      ax = 17,
      ay = 41,
      rnd = new SeededRandom(tr.seed),
      s = tr.size * k;
    if (s < 0.2) {
      r.px[at0(r, ax, ay)] = tr.leaf[2];
      r.px[at0(r, ax, ay - 1)] = tr.leaf[3];
    } else if (tr.kind === 'round') {
      const rx = 2.4 + 4 * s,
        ry = rx * 0.84,
        th = Math.max(1, Math.round(1 + 3.2 * s)),
        cy = ay - th - ry * 0.8;
      barkTrunk(r, ax, cy + ry * 0.3, ay, s > 0.55 ? 2 : 1, C.bark, tr.lean);
      leafCrown(
        r,
        rnd,
        ax + tr.lean,
        cy,
        rx,
        ry,
        tr.leaf,
        tr.leaf === LEAVES.blossom ? { bloom: hex('#fff0f6'), bloomEvery: 7, seed: tr.seed } : {},
      );
    } else {
      const th = Math.max(1, Math.round(1 + 2 * s));
      barkTrunk(r, ax, ay - th - 6 * s, ay, 1, C.bark, 0);
      for (let j = 0; j < 3; j++) {
        const rx = (3.6 - j * 1.05) * (0.45 + s * 0.62);
        leafCrown(r, rnd, ax, ay - th - rx * 0.55 - j * 4 * (0.45 + s * 0.55), rx, rx * 0.72, tr.leaf, { clumps: 4 });
      }
    }
    outlinePass(r, C.inkTree);
    const sp = trim(r, ax, ay);
    sp.trunk = 2 + Math.round(3 * s);
    return sp;
  }
  // the index of pixel (x, y) in a picture's buffer, which holds its rows one after another
  function at0(r, x, y) {
    return y * r.w + x;
  }
  /**
   * Draws a palm into layer, standing at screen point (sx, sy), at k of its size, its fronds blowing in the wind.
   *
   * How it works: a palm moves every frame, so it is drawn afresh each time rather than cached. Its trunk leans by
   * p.lean. Six fronds fan out from the top of the trunk, each a chain of four links (swayingChain) whose wave bends it
   * most at its tip. The links are drawn as lines, each a little lower than the last so the frond droops, light near
   * the crown and darker toward the tip.
   */
  function drawPalm(layer, p, sx, sy, t, k, wind) {
    const r = buffer(30, 30),
      ax = 15,
      ay = 27,
      h = Math.round(13 * k);
    if (h < 2) return;
    barkTrunk(r, ax, ay - h, ay, 1, [hex('#7a5a3a'), hex('#a8845a')], p.lean * k);
    const cx = ax + Math.round(p.lean * k),
      cy = ay - h;
    for (let f = 0; f < 6; f++) {
      const ang = -2.6 + f * 1.05,
        pts = swayingChain(
          cx,
          cy,
          { segments: 4, length: 7 * k, sway: 0.25 + 0.2 * wind, speed: 2.2, lean: ang },
          1,
          t,
          f + p.id,
        );
      for (let j = 1; j < pts.length; j++)
        lineCells(pts[j - 1][0], pts[j - 1][1] + j * 0.6, pts[j][0], pts[j][1] + j * 0.9, (x, y) => {
          if (x >= 0 && y >= 0 && x < r.w && y < r.h)
            r.px[y * r.w + x] = j < 2 ? LEAVES.meadow[3] : j < 4 ? LEAVES.meadow[2] : LEAVES.meadow[1];
        });
    }
    r.px[cy * r.w + cx] = hex('#6b4a2a');
    outlinePass(r, C.inkTree);
    blitSprite(layer, { ...r, ax, ay }, sx, sy);
  }
  /**
   * The great tree on the summit, drawn once.
   *
   * How it works: branchingTree gives the branches as segments, each shorter and thinner than the one it grew from.
   * Each is drawn as a run of discs (capsuleSteps) that narrows toward its end. A clump of blossom sits on every branch
   * tip, and one pixel of each clump is a marker, so the tips glow after dark. sp.tips keeps where the tips are, for
   * the light they throw.
   */
  const SUMMIT_TREE = (() => {
    const r = buffer(60, 56),
      ax = 30,
      ay = 53,
      rnd = new SeededRandom(SEED + 77);
    const tree = branchingTree(
      ax,
      ay,
      { levels: 5, forks: 2, spread: 0.62, decay: 0.74, length: 11, width: 3.4 },
      1,
      rnd,
    );
    for (const s of tree.segments)
      capsuleSteps(s.x0, s.y0, s.width / 2, s.x1, s.y1, (s.width * 0.74) / 2, (x, y, rr) =>
        fillEllipse(r, x, y, rr, rr, s.level > 3 ? C.bark[0] : C.bark[1]),
      );
    tree.tips.forEach(([x, y], k) => {
      leafCrown(r, rnd, x, y, 3.4, 2.8, LEAVES.blossom, { clumps: 3, bloom: hex('#fff0f6'), bloomEvery: 6, seed: k });
      r.px[Math.round(y) * r.w + Math.round(x)] = marker(MARK.tip, k);
    });
    outlinePass(r, C.inkTree);
    const sp = trim(r, ax, ay);
    sp.tips = tree.tips.map(([x, y]) => [x - ax, y - ay]);
    return sp;
  })();

  /**
   * Draws house h with its walls hw pixels high (hw grows from 0 as the house pops up).
   *
   * How it works, from the top down. The roof is seen from above: roofPlan gives the rectangle of its eaves and the row
   * of its ridge. On a gable roof, pixels above the ridge are on the north slope and those below on the south slope; on
   * a hip roof the ends slope too, and a pixel belongs to whichever of the four slopes it is nearest. Each slope has
   * its own light (the north lit, the east in shade), roofTexel adds the covering's pattern (tiles, thatch or planks),
   * and slopeShade darkens the south slope along its eave and lights it just under the ridge. Below the roof is the
   * front wall: a shadow under the eave, darker corners, a door, and windows drawn as markers so that they light up at
   * night.
   */
  function buildHouse(h, hw) {
    const w = h.w,
      d = h.d,
      r = buffer(w + 6, d + hw + 6),
      ax = (w >> 1) + 3,
      ay = d + hw + 3,
      by = ay - hw; // the roof's south eave (the wall's top)
    const plan = roofPlan(h.kind, w, d, 1, ax, by),
      { x0, x1, yN, yS, yR, inset } = plan;
    // how many tones lighter (+) or darker (-) each part of the covering's pattern is
    const TEX = { seam: -1, mortar: 1, lit: 1, shaded: -1, edge: -1, deep: -2, glow: 1, dim: -1 };
    for (let y = yN; y <= yS; y++)
      for (let x = x0; x <= x1; x++) {
        // which slope this pixel is on: n(orth), s(outh), e(ast) or w(est)
        let facet = y < yR ? 'n' : 's';
        if (h.kind === 'hip') {
          const dw = (x - x0) / Math.max(1, inset),
            de = (x1 - x) / Math.max(1, inset),
            dn = (y - yN) / Math.max(1, yR - yN),
            ds = (yS - y) / Math.max(1, yS - yR),
            m = Math.min(dw, de, dn, ds);
          facet = m === dw ? 'w' : m === de ? 'e' : m === dn ? 'n' : 's';
        }
        // k: how many tones lighter or darker than the roof's own colour this pixel is drawn
        let k = facet === 'n' ? 1 : facet === 'w' ? 0 : facet === 'e' ? -1 : 0;
        const tex = roofTexel(h.style, x, y, x0, facet === 'n' ? yN : yR);
        if (tex) k += TEX[tex];
        if (facet === 's') {
          const sh = slopeShade(y, yR, yS);
          if (sh === 'eave') k -= 1;
          else if (sh === 'ridge') k += 1;
        }
        if (y === yR && facet !== 'e') k = 2; // the ridge itself catches the most light
        r.px[y * r.w + x] = tone(h.roof, clamp(k, -2, 2));
      }
    // a stone chimney on the back slope
    if (h.chimney)
      for (let y = yN + 1; y <= yN + 3; y++)
        for (let x = x1 - 4; x <= x1 - 3; x++) r.px[y * r.w + x] = y === yN + 1 ? tone(C.stone, 1) : C.stone;
    // the front wall, under the roof: u counts pixels across it, row counts rows down from the eave
    for (let y = by + 1; y <= ay; y++)
      for (let x = x0 + 1; x <= x1 - 1; x++) {
        const u = x - x0 - 1,
          row = y - by - 1;
        let c = row === 0 ? tone(h.wall, -2) : u === 0 || u === w - 1 ? tone(h.wall, -1) : h.wall;
        // a window: two columns near each end of the wall, but never right beside the door
        const pane = (u === 1 || u === 2 || u === w - 3 || u === w - 2) && (u < h.door - 1 || u > h.door + 2);
        if (u >= h.door && u <= h.door + 1 && row >= hw - 3) c = row === hw - 3 ? tone(C.door, -1) : C.door;
        else if (hw >= 4 && row >= 1 && row <= Math.min(2, hw - 3) && pane) c = marker(MARK.win, h.id);
        r.px[y * r.w + x] = c;
      }
    outlinePass(r, C.ink);
    return { ...r, ax, ay, roofTop: yN - ay, chimney: [x1 - 3.5 - ax, yN + 1 - ay] };
  }
  /**
   * Draws a villager; lA and lB say whether the left and right foot is lifted (a lifted leg is a pixel shorter).
   *
   * How it works: a villager is a few pixels in fixed places, from the feet up: two legs in the trousers' colour, a
   * body three pixels wide in the shirt's colour (its right side and the arms a tone darker), a head in the skin's
   * colour with a row of hair on top and, if their genes say so, a straw hat with a brim. The genes choose only colours
   * and the hat.
   */
  function buildPerson(p, lA, lB) {
    const r = buffer(9, 12),
      ax = 4,
      ay = 10,
      g = p.g;
    const legs = [
      [3, lA],
      [5, lB],
    ];
    // a lifted leg stops a pixel short
    for (const [x, l] of legs) for (let y = 8; y <= 9 - l; y++) r.px[y * r.w + x] = g.trousers;
    for (let y = 5; y <= 7; y++) for (let x = 3; x <= 5; x++) r.px[y * r.w + x] = x === 5 ? tone(g.shirt, -1) : g.shirt;
    r.px[6 * r.w + 2] = tone(g.shirt, -1);
    r.px[6 * r.w + 6] = tone(g.shirt, -1);
    for (let y = 2; y <= 4; y++) for (let x = 3; x <= 5; x++) r.px[y * r.w + x] = y === 2 ? g.hairC : g.skinC;
    if (g.hat) {
      for (let x = 2; x <= 6; x++) r.px[2 * r.w + x] = hex('#e0c068');
      r.px[1 * r.w + 4] = hex('#c9a24a');
      r.px[1 * r.w + 3] = hex('#e0c068');
      r.px[1 * r.w + 5] = hex('#e0c068');
    }
    outlinePass(r, C.ink);
    return { ...r, ax, ay };
  }
  /**
   * Draws a deer at a moment of its walk (phase), with its head down if it is grazing.
   *
   * How it works: the deer is seen from above and a little in front. Its legs are drawn first, so that the body covers
   * their tops: a hind pair and a fore pair, each leg placed by footStep at its own moment of the walk (gaitTiming),
   * swinging forward and back and a pixel shorter while lifted. The body and the belly under it are ellipses in the
   * coat's colours; the head is an ellipse ahead of the body (lower when grazing), with an ear, antlers on a stag, a
   * pale tail and, on a fawn, white spots.
   */
  function buildDeer(d, phase, grazing) {
    const r = buffer(17, 13),
      ax = 8,
      ay = 10,
      g = d.g,
      s = g.size * (g.fawn ? 0.72 : 1);
    const timing = gaitTiming(g.gait);
    // [where the pair's hips are across the sprite, the pair's timing]: the hind pair, then the fore pair. In each
    // pair, side 0 is the far leg (a tone darker) and side 1 the near one.
    [
      [5.5, timing[1]],
      [10.5, timing[0]],
    ].forEach(([hx, pair]) =>
      [pair.far, pair.near].forEach((off, side) => {
        const st = footStep(phase + off, 0.9, 1),
          x = Math.round(hx + st.x * s + side - 0.5);
        for (let y = 7; y <= 9 - (st.y > 0.5 ? 1 : 0); y++)
          r.px[y * r.w + x] = side ? g.coat.back : tone(g.coat.back, -1);
      }),
    );
    fillEllipse(r, 8, 5.5, 3.6 * s, 1.9 * s, g.coat.back);
    fillEllipse(r, 8, 6.5, 2.6 * s, 0.7, g.coat.belly);
    const hy = grazing ? 7 : 3.4;
    fillEllipse(r, 8 + 4.1 * s, hy, 1.5, 1.3, tone(g.coat.back, 1));
    r.px[Math.round(hy - 1.6) * r.w + Math.round(8 + 3.6 * s)] = g.coat.back;
    if (g.antlers && !grazing) {
      r.px[Math.round(hy - 2.4) * r.w + Math.round(8 + 3.4 * s)] = hex('#d8c09a');
      r.px[Math.round(hy - 3.2) * r.w + Math.round(8 + 3 * s)] = hex('#d8c09a');
    }
    r.px[4 * r.w + Math.round(8 - 3.8 * s)] = g.coat.belly;
    for (const sp of g.spots) r.px[Math.round(5 + sp.dy) * r.w + Math.round(8 + (sp.at - 2) * 1.3)] = hex('#f4ead8');
    outlinePass(r, C.ink);
    return { ...r, ax, ay };
  }
  // a gull, wings up and wings level: the two frames of its flap
  const GULL = [
    spriteFromRows(['#...#', '.#.#.', '..#..'], () => C.gull, { outline: false }),
    spriteFromRows(['.....', '##.##', '..#..'], () => C.gull, { outline: false }),
  ];
  // the boat: templates of letters (m the mast, s the sail, h the hull) laid onto a grid, then coloured
  const BOAT = (() => {
    const grid = Array.from({ length: 8 }, () => [...'.........']);
    layTemplate(grid, ['....m....', '...sm....', '..ssm....', '.sssm....', 'sssssm...'], 0); // the sail and the mast
    layTemplate(grid, ['.hhhhhhh.', '..hhhhh..'], 5); // the hull, laid under them
    const pal = { m: hex('#6b4a2a'), s: C.sail, h: C.hull };
    return spriteFromRows(
      grid.map((r) => r.join('')),
      (ch) => pal[ch],
      { ink: C.ink },
    );
  })();
  // the lighthouse: its lamp (b, a marker, so it can blink at night), red and white bands, a stone base
  const TOWER = spriteFromRows(
    ['.bbb.', '.rrr.', '.www.', '.rrr.', '.www.', '.rrr.', 'sssss'],
    (ch) => (ch === 'b' ? marker(MARK.beacon) : ch === 'r' ? C.towerRed : ch === 'w' ? C.tower : C.stone),
    { ink: C.ink },
  );
  // a hen standing (a red comb, an orange beak), and pecking
  const HEN = [
    spriteFromRows(
      ['.r.', 'wwo', 'ww.'],
      (ch) => (ch === 'r' ? hex('#d8402e') : ch === 'o' ? hex('#e8a03a') : hex('#f7f2e6')),
      { ink: C.ink },
    ),
    spriteFromRows(['...', 'ww.', 'wwo'], (ch) => (ch === 'o' ? hex('#e8a03a') : hex('#f7f2e6')), { ink: C.ink }),
  ];
  // a lamp post: its lamp (a marker, lit at night) on a pole three pixels tall
  const POST = spriteFromRows(['l', 'p', 'p', 'p'], (ch) => (ch === 'l' ? marker(MARK.lamp) : C.pole), { ink: C.ink });
  // tree tr at k of its size, from the cache. Sizes are rounded to twelfths, so a growing tree is drawn about 14 times.
  const treeSprite = (tr, k) =>
    cache.get(`t:${tr.id}:${Math.round(k * 12)}`, () => buildTree(tr, Math.round(k * 12) / 12));

  // prettier-ignore
  return { buffer, cache, treeSprite, buildHouse, buildPerson, buildDeer, drawPalm, SUMMIT_TREE, GULL, BOAT, TOWER,
    HEN, POST };
}
