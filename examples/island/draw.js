// One frame by day, painted in order: the land from the back to the front (terrace tops, their walls, waterfalls, the
// sea and the river), then shadows and everything that stands or walks, sorted by depth, then what is under the water,
// the boat, smoke, butterflies and gulls.

/**
 * The frame's buffers, and the three painters that fill them by day: the heights as greys (the film's first seconds),
 * the land, and the things that stand or move on it.
 *
 * How it works: the land is seen from above and a little in front, so a terrace's ground is drawn LIFT pixels higher
 * up the screen for every terrace it stands on, and the wall below its front edge shows where the ground in front of
 * it is lower. The land is painted row by row from the back (the top of the map) to the front, so nearer land covers
 * farther land. Each screen pixel remembers which row of the land it shows (ZB, a depth buffer), and a sprite is drawn
 * only where nothing nearer is already in front of it: a tree behind a cliff is hidden by the cliff.
 */
export function makeDrawing(k, look, world, pics, life) {
  const { A, W, H, GH, FPS, LIFT, LEVELS, SEED, T, span } = k;
  // prettier-ignore
  const { bayerThreshold, blitSprite, blitSway, chamferDistance, dampedSpring, ditherEllipse, ditheredBorder,
    faceShade, fillEllipse, floatHeight, footStep, fractalNoise, gaitTiming, latticeHash, lerp, lineCells,
    obliqueToScreen, rise, scalePacked, shadeEllipse, smoothCurve, smoothstep, swayingChain, wallShade,
    waterPixel, waterTime } = A;
  const { hex, tone, C, P, PR, greyOf, CLAY, MARK_DAY, LEAVES } = look;
  // prettier-ignore
  const { n, at, lev, mask, E, LEV, MO, GR, OCT, lowest, CUT, D_SEA, D_LAND, D_BEACH, PEAK, RIV, RIV_T, D_RIV,
    HOUSES, FIELD, FIELD_T, PIER, PATH, PATH_T, LAMPS, TREES, PALMS, REEDS, SUMMIT, LIGHT, inSea } = world;
  // prettier-ignore
  const { buffer, cache, treeSprite, buildHouse, buildPerson, buildDeer, drawPalm, SUMMIT_TREE, GULL, BOAT, TOWER,
    HEN, POST } = pics;
  const { sim, pos } = life;

  // A pop that overshoots and settles, for things that appear (terraces, trees, houses): a damped spring pulled from 0
  // toward 1, its position recorded once a frame for three seconds (in three smaller steps a frame, for accuracy).
  const SPRING = [];
  {
    let x = 0,
      v = 0;
    for (let f = 0; f < FPS * 3; f++) {
      SPRING.push(x);
      for (let s = 0; s < 3; s++) [x, v] = dampedSpring(x, v, 1, 150, 12, 1 / (FPS * 3));
    }
  }
  // how far along its pop a thing is, age seconds after it appeared: 0 before, about 1.15 at most, then 1
  const springAt = (age) => (age <= 0 ? 0 : SPRING[Math.min(SPRING.length - 1, Math.floor(age * FPS))]);

  // The frame and what is known about each of its pixels. FRAME: its colour. ZB: the row of the land it shows (larger
  // is nearer; -1 is nothing yet). WM: what water shows there (0 none, 1 sea, 2 river). EM and EMID: the kind of night
  // light a sprite marked there, and whose it is (a house's number, a tip's).
  const FRAME = new Uint32Array(W * H),
    ZB = new Int16Array(W * H),
    WM = new Uint8Array(W * H),
    EM = new Uint8Array(W * H),
    EMID = new Uint16Array(W * H);
  // OUT: the frame as a buffer the almanac's drawing functions take. LAYER: a scratch frame sprites are drawn onto
  // before being copied into the frame (see stamp). LIFTS[L]: how many pixels terrace L is lifted at this moment.
  const OUT = { w: W, h: H, px: FRAME },
    LAYER = buffer(W, H),
    LIFTS = new Int16Array(LEVELS + 1);
  const LIGHTDIR = [-0.45, 0.89]; // where the light comes from: the upper left, a little toward us
  const WALL_K = 1 + faceShade([0, 1], LIGHTDIR); // every wall faces south, toward us
  // The walls' textures: for each kind of wall a 16 by 16 tile of colours (index (row << 4) | column), its pattern from
  // wallShade (stone in courses, earth in bands), all darkened by how the wall faces the light.
  const WALLS = {};
  // prettier-ignore
  for (const [kind, base] of [['earth', C.earth], ['stone', C.stone], ['snow', hex('#cfd8e1')],
    ['sand', hex('#c6a876')]])
    WALLS[kind] = Array.from({ length: 256 }, (_, k) =>
      scalePacked(base, Math.min(1.08, wallShade(kind, k & 15, k >> 4)) * WALL_K),
    );
  // what a terrace's wall is made of: earth low down, stone higher, snow-capped at the summit
  const wallKind = (L) => (L <= 3 ? 'earth' : L <= 5 ? 'stone' : 'snow');

  /**
   * Draws a sprite into the frame where nothing nearer hides it: draw(layer) draws it onto the scratch layer, and the
   * sprite stands on row z of the land.
   *
   * How it works: every pixel the sprite drew (in the box round its anchor at (sx, sy)) is copied into the frame if
   * the frame there shows a row of the land at or behind z (ZB[i] <= z), and the layer is cleared as it goes. A marker
   * pixel is not copied as a colour: its kind and owner go into EM and EMID, and the frame gets its daytime colour.
   */
  function stamp(z, sp, sx, sy, draw) {
    draw(LAYER);
    const x0 = Math.max(0, Math.round(sx) - sp.ax - 3),
      x1 = Math.min(W - 1, Math.round(sx) - sp.ax + sp.w + 3),
      y0 = Math.max(0, Math.round(sy) - sp.ay - 1),
      y1 = Math.min(H - 1, Math.round(sy) - sp.ay + sp.h + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
        const c = LAYER.px[i];
        if (!c) continue;
        LAYER.px[i] = 0;
        if (ZB[i] > z) continue;
        ZB[i] = z;
        if (c >>> 24 === 0xfe) {
          // a marker: its top byte is 0xFE; the kind of light is in the next byte and its owner in the lowest two
          EM[i] = (c >>> 16) & 255;
          EMID[i] = c & 0xffff;
          FRAME[i] = MARK_DAY[EM[i]];
        } else {
          FRAME[i] = c;
          EM[i] = 0;
        }
      }
  }
  // where land point (x, y) shows on the screen: obliqueToScreen lifts it up by its terrace's lift (with no slant, x
  // stays)
  const ground = (x, y) => obliqueToScreen(x, y, LIFTS[Math.max(0, lev(Math.round(x), Math.round(y)))], 0, 0, 0);

  /**
   * The film's first stages: the seed's noise as greys, then pressed down at the edges into an island.
   *
   * How it works: during the seed stage, the noise is shown with one octave, then two, three and four; between two
   * counts, a share of pixels (picked by the ordered-dither pattern) already shows the next, so each octave fades in.
   * During the island stage the four-octave noise blends into the island's heights, and the outlines of the coming
   * terraces appear: a pixel is darkened where its terrace differs from the one below and to its right.
   */
  function paintHeights(t) {
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++) {
        let v;
        if (t < T.seed[1]) {
          // u runs from 0 to 3 through the stage: k octaves (plus one) are shown, and u - k is how far the next has
          // come
          const u = Math.min(3, span('seed', t) * 3.6),
            k = Math.floor(u);
          v = OCT[Math.min(3, k + (bayerThreshold(x, y) < u - k ? 1 : 0))][i];
        } else v = lerp(OCT[3][i], E[i], smoothstep(0, 1, span('island', t)));
        FRAME[i] = greyOf(v, x, y);
        // and, as the island takes shape, its contours: where the terrace it will be changes
        // prettier-ignore
        if (t >= T.island[0] && E[i] >= CUT && x < W - 1 && LEV[i] !== LEV[i + 1 + W] &&
          bayerThreshold(x, y) < span('island', t) * 1.4)
          FRAME[i] = tone(FRAME[i], -2);
      }
  }

  /**
   * Paints the land at second t: its terraces lifted as far as they have risen, the sea as high as it has come in,
   * the river as far as it has run, coloured as far as the paint has reached.
   *
   * How it works: for every row of the land from the back to the front, and every pixel in it, the top of the ground
   * is drawn lifted by its terrace (sy = y - lift), as water, a bridge, or ground. Then, if the ground in front is
   * lower, the wall between them is drawn under it: the rows from just below this top down to where the ground in
   * front begins. A wall under a river is a waterfall; under a road, steps.
   */
  function paintLand(t) {
    // each terrace pops up a tenth of a second after the one below it
    for (let L = 0; L <= LEVELS; L++) LIFTS[L] = Math.round(L * LIFT * springAt(t - T.rise[0] - L * 0.1));
    const clayMix = span('rise', t) * 3, // the greys give way to clay over the first third of the rise
      // the water's level: none before the sea stage, rising from the lowest height to the sea's level during it
      wl = t < T.sea[0] ? -1 : t < T.sea[1] ? lerp(lowest, CUT, smoothstep(0, 1, span('sea', t))) : CUT,
      flooding = t >= T.sea[0] && t < T.sea[1],
      // while the sea comes in, its distance from the shore is measured again each frame, so the foam follows it
      // prettier-ignore
      dSea = flooding ? chamferDistance(mask((i) => E[i] < wl), W, GH) : D_SEA,
      paintR = span('paint', t) * 330, // how far from the summit the paint has spread, in pixels
      WT = waterTime(t, Math.floor(t * 15)), // the water's clock: how far its ripples and glints have drifted
      lit = t >= T.paint[0];
    ZB.fill(-1);
    EM.fill(0);
    WM.fill(0);
    FRAME.fill(0);
    // the land, painted from the back to the front: each pixel's top lifted by its terrace, and the wall under it where
    // the ground in front is lower; water lies at the sea's level and in the river (wob sways the sea bed's weed)
    for (let y = 0; y < GH; y++) {
      const wob = Math.round(Math.sin(y * 0.35 + t * 2.2));
      for (let x = 0; x < W; x++) {
        const i = y * W + x,
          sea = E[i] < wl,
          L = sea ? 0 : Math.max(0, LEV[i]),
          lift = LIFTS[L],
          sy = y - lift; // the screen row its top shows on
        if (sy >= H) continue;
        const river = !sea && RIV[i] && t >= RIV_T[i],
          road = PATH[i] && t >= PATH_T[i];
        let c,
          w = 0;
        if (sea && PIER[i] && t >= T.roads[1]) c = PIER[i];
        else if (sea) {
          // behind: 2 if the land just behind this sea pixel is a lifted terrace (the water lies at a cliff's foot and
          // is shaded), 1 if it is two pixels behind, 0 otherwise
          const behind =
            y > 0 && LIFTS[Math.max(0, LEV[i - W])] > 0 && E[i - W] >= wl
              ? 2
              : y > 1 && LIFTS[Math.max(0, LEV[i - 2 * W])] > 0 && E[i - 2 * W] >= wl
                ? 1
                : 0;
          // distances are in thirds of a pixel; a beach is near if the nearest land is about as near as the nearest
          // beach
          c = waterPixel(x, y, dSea[i] / 3, D_BEACH[i] <= dSea[i] + 4, behind, WT, wob, P);
          w = 1;
        } else if (river && road)
          c = (x + y) % 3 ? tone(C.plank, (x & 3) === 0 ? -1 : 0) : tone(C.plank, 1); // a bridge
        else if (river) {
          c = waterPixel(x, y, D_RIV[i] / 3 + 1, false, 0, WT, wob, PR);
          w = 2;
        } else c = groundAt(i, x, y, t, L, clayMix, paintR, road);
        if (sy >= 0) {
          FRAME[sy * W + x] = c;
          ZB[sy * W + x] = y;
          WM[sy * W + x] = w;
        }
        // the wall: from just below this top down to the screen row where the ground in front of it (j) begins
        if (y + 1 >= GH || !lift) continue;
        const j = i + W,
          lf = LIFTS[E[j] < wl ? 0 : Math.max(0, LEV[j])],
          bottom = Math.min(H, y + 1 - lf);
        for (let r = Math.max(0, sy + 1); r < bottom; r++) {
          const yy = r - sy - 1, // how far down the wall this row is (0 is its top edge)
            k = r * W + x;
          let wc;
          // a waterfall: foam and pale water in stripes that slide down the wall (t * 26 moves them; x * 5 staggers
          // them)
          if (river)
            wc = [P.FOAM, PR.LV[0], P.FOAM2, PR.LV[1], P.FOAM, PR.LV[2], P.FOAM2, PR.LV[0]][
              (yy - Math.floor(t * 26) + x * 5) & 7
            ];
          else if (road && lit)
            wc = yy & 1 ? tone(C.stone, -1) : tone(C.stone, 1); // steps cut in the wall
          else if (!lit || !painted(i, x, y, paintR)) wc = tone(CLAY[L], yy ? -2 : -1);
          // the wall's texture repeats every 16 pixels down and across; its top row is the ground's edge, a tone darker
          else wc = yy === 0 ? tone(TOPC[i], -1) : WALLS[wallKind(L)][((yy & 15) << 4) | (x & 15)];
          FRAME[k] = wc;
          ZB[k] = y;
          WM[k] = 0;
        }
      }
    }
  }

  // The ground's colours, worked out once for every pixel. TOPC: the ground's own colour by terrace: sand on the beach
  // (wet near the water), lush or dry grass, woods, heath and moor, rock at the summit; two kinds on one terrace meet
  // in a dithered border; a few pixels a tone darker or lighter for grain, tufts of grass, and flowers. TOPC_AO: the
  // same, a tone darker at the foot of a wall, where the wall shades it. CLAYC: the bare clay seen before painting.
  const TOPC = new Uint32Array(n),
    TOPC_AO = new Uint32Array(n),
    CLAYC = new Uint32Array(n);
  {
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < W; x++) {
        const i = at(x, y),
          L = LEV[i],
          m = MO[i],
          g = GR[i];
        let base;
        if (L <= 0) base = ditheredBorder((9 - D_LAND[i] / 3) / 6, x, y, g) ? C.wetSand : C.sand;
        else if (L <= 2) base = ditheredBorder((0.47 - m) * 5, x, y, g) ? C.dry : C.lush;
        else if (L <= 4) base = ditheredBorder((m - 0.55) * 4, x, y, g) ? C.wood2 : C.wood1;
        else if (L === 5) base = ditheredBorder((0.45 - m) * 4, x, y, g) ? C.moor : C.heath;
        else base = ditheredBorder((fractalNoise(x / 14, y / 14, SEED + 21, 2) - 0.62) * 4, x, y, g) ? C.rock : C.moor;
        let c = g < 0.1 ? tone(base, -1) : g > 0.93 ? tone(base, 1) : base;
        if (L >= 1 && L <= 4 && (x * 7 + y * 3) % 11 === 0 && m > 0.38) c = tone(base, -1); // tufts
        if (L >= 1 && L <= 2 && g > 0.986) c = C.flowers[latticeHash(x, y, 4) & 3];
        if (L < 0) c = base;
        TOPC[i] = c;
        const back = lev(x, y - 1) > L; // the foot of a wall: in its shade
        TOPC_AO[i] = back ? tone(c, -1) : c;
        CLAYC[i] = L < 0 ? tone(CLAY[0], -1 - (E[i] < CUT - 0.08 ? 1 : 0)) : back ? tone(CLAY[L], -1) : CLAY[L];
      }
  }
  // the distance from the summit, the paint's front spreading out from it (a little slower north and south)
  const PEAKD = (x, y) => Math.hypot(x - PEAK[0], (y - PEAK[1]) * 1.3);
  // whether the paint, spread R pixels from the summit, has reached pixel (x, y): its front is a dithered band, not a
  // line
  function painted(i, x, y, R) {
    return ditheredBorder((R - PEAKD(x, y)) / 18, x, y, GR[i]);
  }
  /**
   * The colour of the ground at pixel i at second t: grey, then clay, until the paint reaches it; after that its road
   * (once the road is drawn), its field (once planted, spreading in a dithered band), or its own colour.
   */
  function groundAt(i, x, y, t, L, clayMix, paintR, road) {
    if (t < T.paint[0] || !painted(i, x, y, paintR)) {
      if (clayMix < 1 && bayerThreshold(x, y) > clayMix) return greyOf(E[i], x, y);
      return CLAYC[i];
    }
    if (road) return lev(x, y - 1) > L ? tone(PATH[i], -1) : PATH[i];
    if (FIELD[i] && ditheredBorder((t - FIELD_T[i]) * 3, x, y, GR[i]))
      return lev(x, y - 1) > L ? tone(FIELD[i], -1) : FIELD[i];
    return TOPC_AO[i];
  }

  /**
   * Paints everything standing on the land or moving over it at second t: trees, palms, reeds, the summit tree, houses,
   * lamp posts, the lighthouse, walkers, villagers, hens and deer; then what is under the water (the whale and the
   * fish), the boat, smoke, butterflies and gulls.
   *
   * How it works: each thing standing on the land becomes an item [row it stands on, sprite, screen x, screen y,
   * draw]. Shadows are laid on the ground first. The items are sorted by row, back to front, and stamped through the
   * depth buffer, so nearer things cover farther ones and the land in front hides what is behind it. Then come the
   * things that are not hidden by the land: under the water, on it, and in the air. fr is the frame's number (for
   * flickers) and wind how hard the wind blows (stronger in the storm).
   */
  function paintThings(t, fr, wind) {
    const items = [];
    // shadows first, on the ground: the light is from the upper left, so they fall to the lower right
    for (const tr of TREES) {
      const k = springAt(t - tr.born);
      if (k <= 0) continue;
      const [sx, sy] = ground(tr.x, tr.y);
      shadeEllipse(OUT, sx + 2, sy, (2.5 + 3.6 * tr.size) * k, (1.2 + 1.2 * tr.size) * k, 0.78);
      const sp = treeSprite(tr, k);
      items.push([
        tr.y,
        sp,
        sx,
        sy,
        // the crown sways: each row above the trunk is shifted sideways, more the higher it is
        (l) =>
          blitSway(l, sp, sx, sy, (hh) =>
            hh > sp.trunk ? Math.sin(t * 2.3 + tr.phase + tr.x * 0.04) * (hh - sp.trunk) * 0.05 * wind : 0,
          ),
      ]);
    }
    for (const p of PALMS) {
      const k = springAt(t - p.born);
      if (k <= 0) continue;
      const [sx, sy] = ground(p.x, p.y);
      items.push([
        p.y,
        { ax: 15, ay: 27, w: 30, h: 30 }, // the box a palm is drawn in (it is drawn fresh, so it has no sprite)
        sx,
        sy,
        (l) => drawPalm(l, p, sx, sy, t, Math.min(1.1, k), wind),
      ]);
    }
    for (const rd of REEDS) {
      if (t < rd.born) continue;
      const [sx, sy] = ground(rd.x, rd.y),
        pts = swayingChain(sx, sy, { segments: 3, length: 5, sway: 0.35 * wind, speed: 2.6 }, 1, t, rd.id);
      items.push([
        rd.y,
        { ax: 4, ay: 7, w: 9, h: 8 },
        sx,
        sy,
        // a reed: three links of a swaying chain, drawn as lines, green with a pale seed head
        (l) => {
          for (let j = 1; j < pts.length; j++)
            // prettier-ignore
            lineCells(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], (x, y) =>
              x >= 0 && y >= 0 && x < W && y < H && (l.px[y * W + x] = j === 3 ? hex('#c9b46a') : LEAVES.meadow[j]));
        },
      ]);
    }
    {
      const k = springAt(t - SUMMIT.born);
      // the great tree rises up out of the ground as it pops (drawn lower while k is under 1)
      if (k > 0.05) {
        const [sx, sy] = ground(SUMMIT.x, SUMMIT.y),
          sp = SUMMIT_TREE;
        shadeEllipse(OUT, sx + 4, sy, 12 * k, 3 * k, 0.75);
        items.push([
          SUMMIT.y,
          sp,
          sx,
          sy + Math.round((1 - Math.min(1, k)) * 30),
          (l) =>
            blitSway(l, sp, sx, sy + Math.round((1 - Math.min(1, k)) * 30), (hh) =>
              hh > 8 ? Math.sin(t * 1.4) * (hh - 8) * 0.03 * wind : 0,
            ),
        ]);
      }
    }
    for (const h of HOUSES) {
      const k = springAt(t - h.born);
      if (k <= 0) continue;
      // a house's walls rise as it pops; each height is drawn once and kept in the cache
      const hw = Math.max(0, Math.round(h.hw * k)),
        sp = cache.get(`house:${h.id}:${hw}`, () => buildHouse(h, hw)),
        [sx, sy] = ground(h.x0 + (h.w >> 1), h.y0 + h.d - 1);
      shadeEllipse(OUT, sx + 3, sy + 1, h.w * 0.65, 2.2, 0.72);
      items.push([h.y0 + h.d - 1, sp, sx, sy, (l) => blitSprite(l, sp, sx, sy)]);
      h.screen = [sx, sy, sp]; // where it is on the screen, for the light its windows throw at night
    }
    for (const lp of LAMPS)
      if (t >= lp.born + 0.1) {
        const [sx, sy] = ground(lp.x, lp.y);
        items.push([lp.y, POST, sx, sy, (l) => blitSprite(l, POST, sx, sy)]);
        lp.screen = [sx, sy - 4];
      }
    if (LIGHT && t >= T.village[0] + 0.6) {
      const [sx, sy] = ground(LIGHT.x, LIGHT.y);
      items.push([LIGHT.y, TOWER, sx, sy, (l) => blitSprite(l, TOWER, sx, sy)]);
      LIGHT.screen = [sx, sy - 7];
    }
    if (sim.people) {
      for (const p of sim.people) {
        if (t < p.born) continue;
        // a walker's legs: footStep says whether each foot is lifted at this moment of the step (the far foot half a
        // step behind the near one), and a lifted foot is drawn a pixel short
        const q = pos(p),
          moving = p.wait <= 0,
          sA = footStep(p.phase, 1, 1),
          sB = footStep(p.phase + gaitTiming('stride')[0].far, 1, 1),
          lA = moving && sA.y > 0.4 ? 1 : 0,
          lB = moving && sB.y > 0.4 ? 1 : 0,
          sp = cache.get(`p:${p.id}:${lA}${lB}`, () => buildPerson(p, lA, lB)),
          [sx, sy] = ground(q.x, q.y);
        items.push([q.y, sp, sx, sy, (l) => blitSprite(l, sp, sx, sy, p.dir < 0)]);
      }
      for (const m of sim.milling) {
        if (t < m.born || (m.hen && t > T.night[0])) continue;
        const x = m.x * m.tile,
          y = m.y * m.tile,
          [sx, sy] = ground(x, y);
        let sp;
        if (m.hen)
          sp = HEN[m.moving ? 0 : Math.floor(t * 3 + m.id) & 1]; // a hen standing still pecks, three times a second
        else {
          const sA = footStep(m.phase, 1, 1),
            sB = footStep(m.phase + gaitTiming('stride')[0].far, 1, 1),
            lA = m.moving && sA.y > 0.4 ? 1 : 0,
            lB = m.moving && sB.y > 0.4 ? 1 : 0;
          sp = cache.get(`p:${m.id}:${lA}${lB}`, () => buildPerson(m, lA, lB));
        }
        items.push([Math.round(y), sp, sx, sy, (l) => blitSprite(l, sp, sx, sy, m.dir < 0)]);
      }
      const night = t > T.night[0];
      for (const d of sim.deer) {
        const sp_ = Math.hypot(d.vx, d.vy),
          grazing = sp_ < 1.6 && !night,
          ph = Math.round(((d.phase % 6.283) / 6.283) * 8) % 8, // its walk in eight drawings, so each is drawn once
          sp = cache.get(`d:${d.seed}:${ph}:${grazing ? 1 : 0}`, () => buildDeer(d, (ph / 8) * 6.283, grazing)),
          [sx, sy] = ground(d.x, d.y);
        items.push([Math.round(d.y), sp, sx, sy, (l) => blitSprite(l, sp, sx, sy, d.vx < 0)]);
      }
    }
    items.sort((a, b) => a[0] - b[0]); // back to front
    for (const [z, sp, sx, sy, draw] of items) stamp(z, sp, sx, sy, draw);
    if (!sim.people) return;
    // under the water: the fish, and the whale's shadow they swim from, both darkening only sea pixels (WM === 1)
    const darken = (x, y, k) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < W && y < H && WM[y * W + x] === 1)
        FRAME[y * W + x] = scalePacked(FRAME[y * W + x], k);
    };
    // the whale's body: an ellipse at each joint of its spine, wide behind the head and narrowing to the tail
    // (smoothCurve eases the widths between the given points), with two flukes at the tail
    // prettier-ignore
    const wh = sim.whale,
      radii = smoothCurve(wh.spine.length, [[0, 2.6], [0.3, 3.4], [0.8, 1.3], [1, 0.8]]);
    const shape = buffer(W, H);
    wh.spine.forEach(([x, y], k) => fillEllipse(shape, x, y, radii[k] * 1.25, radii[k], 1));
    const tail = wh.spine[wh.spine.length - 1];
    fillEllipse(shape, tail[0], tail[1] - 2, 1.2, 2.4, 1);
    fillEllipse(shape, tail[0], tail[1] + 2, 1.2, 2.4, 1);
    for (let i = 0; i < W * H; i++) if (shape.px[i] && WM[i] === 1) FRAME[i] = scalePacked(FRAME[i], 0.66);
    // a fish: three darker pixels, its head darkest, trailing back from it along the way it swims
    for (const f of sim.fish) {
      const l = Math.hypot(f.vx, f.vy) || 1;
      for (let k = 0; k < 3; k++) darken(f.x - (f.vx / l) * k, f.y - (f.vy / l) * k, k ? 0.62 : 0.5);
    }
    // the boat, rocking on the swell (floatHeight, a bird's way of sitting on the water), and its wake
    const bt = sim.boat.centre,
      ba = t * 0.22,
      bx = bt.x + Math.cos(ba) * 22,
      by = bt.y + Math.sin(ba) * 7,
      bob = Math.round(floatHeight(0, 2, 2, 1, 5, true, t, 1) * 2 - 5); // rising and falling a pixel with the swell
    if (inSea(bx, by, 6)) {
      // its wake: foam in a broken line behind it, whiter near the boat
      for (let k = 2; k < 12; k++) {
        const wx = Math.round(bx + Math.sin(ba) * k * 1.6),
          wy = Math.round(by - Math.cos(ba) * k * 0.5 + 1);
        if (wx >= 0 && wy >= 0 && wx < W && wy < H && WM[wy * W + wx] === 1 && (k + fr) % 3)
          FRAME[wy * W + wx] = k < 6 ? P.FOAM : P.FOAM2;
      }
      blitSprite(OUT, BOAT, bx, by + bob, Math.sin(ba) > 0);
    }
    // smoke (see-through puffs, in an ordered dither), butterflies, and gulls with their shadows on the ground
    for (const q of sim.smoke) {
      const [sx, sy] = obliqueToScreen(q.x, q.y, LIFTS[q.L], 0, 0, 0),
        a = 0.75 * (1 - q.age / 2.6); // a puff grows and thins out as it ages
      ditherEllipse(OUT, sx, sy, 1.2 + q.age * 1.3, 1 + q.age, C.smoke, a);
    }
    if (t < T.dusk[1])
      for (const b of sim.butterflies) {
        const [sx, sy] = ground(b.x, b.y),
          x = Math.round(sx),
          y = Math.round(sy - 4 - Math.abs(Math.sin(t * 3 + b.seed)) * 2); // fluttering a little above the grass
        if (x > 0 && y > 0 && x < W - 1 && y < H) {
          FRAME[y * W + x] = C.flowers[b.seed & 3];
          if ((fr + b.seed) & 1) FRAME[y * W + x + 1] = C.flowers[b.seed & 3]; // wings open every other frame
        }
      }
    if (t < T.night[0] + 0.4)
      sim.birds.forEach((b, k) => {
        shadeEllipse(OUT, b.x + 14, b.y + 30, 2, 1, 0.7); // its shadow on the ground, below and to the right
        blitSprite(OUT, GULL[(fr + k) % 6 < 3 ? 0 : 1], b.x, b.y);
      });
  }

  return { FRAME, OUT, ZB, WM, EM, EMID, LIFTS, ground, springAt, paintHeights, paintLand, paintThings };
}
