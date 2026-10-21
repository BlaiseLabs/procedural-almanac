// The world a seed grows, built once: the land (heights, terraces, the sea's level, distances), the river, the villages
// (their sites, houses and fields), the roads (with the jetty and the lamp posts), and where the trees, palms, reeds,
// the summit's tree and the lighthouse stand.
//
// Most of the world is kept as maps over the land: typed arrays with one value per pixel, row after row, so pixel
// (x, y) is index y * W + x. A map covers the picture's rows and a few more below (GH rows), since land there can be
// lifted up into view.

/**
 * Builds the world for the seed in k: its maps over the land, and everything placed on it.
 *
 * How it works, in order: heights from islandHeight; the sea's level and the terraces cut from the heights; distances
 * to the shore; the river; two villages with their houses and fields; roads between them found with A*; then the trees,
 * palms, reeds, the summit's tree and a lighthouse, each placed where the land allows. Each step marks what it takes in
 * RES (reserved), so later steps leave room for it: trees are not planted on roads, houses not built in fields.
 */
export function buildWorld(k, look) {
  const { A, W, H, GH, LEVELS, N, Z, ROUGH, LAND, SEED, T } = k;
  // prettier-ignore
  const { SeededRandom, chamferDistance, clamp, floodFill, fractalNoise, gridAStar, indexRandom, islandHeight,
    latticeHash, latticeRandom, lineCells, nearestFreeCell, noiseLine, plotGrid, roofTexel, scatterAlong,
    terraceLevel, untilSettled, windingRiver } = A;
  const { hex, tone, C, LEAVES } = look;

  // ---------------------------------------------------------------------------------------------------- the land
  const n = W * GH,
    at = (x, y) => y * W + x; // a pixel's index in a map
  // E: the land's height (0 to 1). LEV: its terrace (-1 for sea, 0 for beach, up to LEVELS - 1 for the summit).
  // MO: moisture, which makes grass lush or dry. FO: where forest is thick. GR: a random number for each pixel (grain).
  // OCT: the heights' noise with one, two, three and four octaves, for the film's first seconds.
  const E = new Float32Array(n),
    LEV = new Int8Array(n),
    MO = new Float32Array(n),
    FO = new Float32Array(n),
    GR = new Float32Array(n),
    OCT = [0, 1, 2, 3].map(() => new Float32Array(n));
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < W; x++) {
      // the pixel's place on islandHeight's square of N tiles, the picture centred on it
      const i = at(x, y),
        tx = (x - W / 2) * Z + N / 2,
        ty = (y - H / 2) * Z + N / 2;
      E[i] = islandHeight(tx, ty, N, SEED, { long: true, rough: ROUGH });
      // the noise islandHeight starts from, with one octave, two, three and four (lifted the way islandHeight lifts it,
      // so the four-octave noise turns smoothly into the island during the film)
      for (let k = 0; k < 4; k++)
        OCT[k][i] = clamp(fractalNoise(tx / (N * 0.28), ty / (N * 0.28), SEED % 9973, k + 1, ROUGH) * 1.25 - 0.1);
      MO[i] = fractalNoise(x / 70, y / 70, SEED + 3, 3);
      FO[i] = fractalNoise(x / 38, y / 38, SEED + 5, 3);
      GR[i] = latticeRandom(x, y, SEED);
    }
  // The sea's level (CUT): the height that leaves LAND of the picture above it, found by sorting the picture's heights.
  const sorted = E.slice(0, W * H).sort(),
    CUT = sorted[Math.floor(sorted.length * (1 - LAND))];
  // a terrace's height (STEP), chosen so that the summit (the top terrace) is the highest thirtieth of the land
  const landE = sorted.filter((e) => e >= CUT),
    STEP = (landE[Math.floor(landE.length * 0.97)] - CUT) / (LEVELS - 1);
  for (let i = 0; i < n; i++) LEV[i] = E[i] < CUT ? -1 : terraceLevel(E[i] - CUT, STEP, LEVELS);
  // Every separate piece of land gets a number in PATCH. Pieces under 40 pixels (specks of sand) are sunk: their
  // terrace and height are set to the sea's, so the sea covers them when it comes in.
  const PATCH = new Int32Array(n).fill(-1);
  {
    let patches = 0;
    for (let i = 0; i < n; i++) {
      if (LEV[i] < 0 || PATCH[i] >= 0) continue;
      // every land pixel reachable from pixel i by steps left, right, up and down (the column test stops a step off
      // the end of one row from wrapping round to the start of the next)
      const patch = floodFill(
        i,
        (j) => j,
        (j) =>
          [j - 1, j + 1, j - W, j + W].filter(
            (k) => k >= 0 && k < n && LEV[k] >= 0 && Math.abs((k % W) - (j % W)) <= 1,
          ),
      );
      for (const j of patch) PATCH[j] = patches;
      patches++;
      if (patch.size < 40) for (const j of patch) ((LEV[j] = -1), (E[j] = CUT - 0.002), (PATCH[j] = -1));
    }
  }
  // the terrace at (x, y), and sea (-1) off the edge of the map
  const lev = (x, y) => (x < 0 || y < 0 || x >= W || y >= GH ? -1 : LEV[at(x, y)]);
  // a map of 1s where f(i) is true and 0s elsewhere, the form chamferDistance takes
  const mask = (f) => Uint8Array.from({ length: n }, (_, i) => (f(i) ? 1 : 0));
  // Distances, as chamferDistance measures them: from each pixel marked 1 to the nearest marked 0, in thirds of a pixel
  // (a step across costs 3 and a diagonal step 4). D_SEA: how far a sea pixel is from land. D_LAND: how far a land
  // pixel is from the sea. D_BEACH: how far any pixel is from a beach.
  // prettier-ignore
  const D_SEA = chamferDistance(mask((i) => LEV[i] < 0), W, GH),
    D_LAND = chamferDistance(mask((i) => LEV[i] >= 0), W, GH),
    D_BEACH = chamferDistance(mask((i) => LEV[i] !== 0), W, GH);
  // the highest pixel in the picture: the summit, where the great tree will stand
  let peak = 0;
  for (let i = 0; i < W * H; i++) if (E[i] > E[peak]) peak = i;
  const PEAK = [peak % W, (peak / W) | 0]; // its x and y ((i / W) | 0 is the row, rounded down)

  // The river. windingRiver marks a band of land where a slow noise crosses its middle value, a winding line. The river
  // is the part of that band joined to its highest pixel (its source). RIV marks it, and RIV_T says when in the film
  // each pixel fills with water: the pixels are visited outward from the source one ring at a time, so the water
  // appears to run downhill.
  const RIV = new Uint8Array(n),
    RIV_T = new Float32Array(n).fill(1e9);
  {
    const cand = mask((i) => LEV[i] >= 0 && windingRiver(i % W, (i / W) | 0, SEED, 0.06).depth > 0);
    let src = -1;
    for (let i = 0; i < n; i++) if (cand[i] && (src < 0 || E[i] > E[src])) src = i;
    // ord[i]: how many rings out from the source pixel i is (-1 if the river never reaches it)
    const ord = new Int16Array(n).fill(-1);
    let front = src >= 0 ? [src] : [],
      pass = 0;
    if (src >= 0) ord[src] = 0;
    // each pass takes the newest ring (front) and adds the river pixels beside it, until a pass adds none
    untilSettled(() => {
      pass++;
      const next = [];
      for (const i of front)
        for (const j of [i - 1, i + 1, i - W, i + W])
          if (j >= 0 && j < n && cand[j] && ord[j] < 0) {
            ord[j] = pass;
            next.push(j);
          }
      front = next;
      return next.length > 0;
    });
    for (let i = 0; i < n; i++)
      if (ord[i] >= 0) {
        RIV[i] = 1;
        RIV_T[i] = T.river[0] + (ord[i] / pass) * 0.85 * (T.river[1] - T.river[0]);
      }
  }
  // D_RIV: inside the river, how far from its bank. D_TO_RIV: outside it, how far from its water (both in thirds).
  // prettier-ignore
  const D_RIV = chamferDistance(RIV, W, GH),
    D_TO_RIV = chamferDistance(mask((i) => !RIV[i]), W, GH);

  // the main island: the piece of land the summit is on (the islets are not)
  const onMain = (x, y) => PATCH[at(clamp(x, 0, W - 1), clamp(y, 0, GH - 1))] === PATCH[peak];

  // ---------------------------------------------------------------------------------------------------- villages
  const RES = new Uint8Array(n); // what is already there: 1 house, 2 village square, 3 field, 4 road
  /**
   * How flat the ground round (x, y) is: the share of points within r pixels on the same terrace and not in the river.
   * It looks at every second pixel, which is enough to tell flat from broken ground.
   */
  function flatness(x, y, r) {
    const L = lev(x, y);
    let same = 0,
      all = 0;
    for (let dy = -r; dy <= r; dy += 2)
      for (let dx = -r; dx <= r; dx += 2) {
        if (dx * dx + dy * dy > r * r) continue; // only points inside the circle
        all++;
        if (lev(x + dx, y + dy) === L && !RIV[at(clamp(x + dx, 0, W - 1), clamp(y + dy, 0, GH - 1))]) same++;
      }
    return same / all;
  }
  /**
   * Where a village could stand: points every 4 pixels on the main island, on a terrace from 1 to 5, at least
   * clear / 3 pixels from the river, each with how flat the ground round it is.
   */
  const spots = (clear) => {
    const out = [];
    for (let y = 24; y < H - 24; y += 4)
      for (let x = 24; x < W - 24; x += 4) {
        const i = at(x, y),
          L = LEV[i];
        if (L < 1 || L > 5 || !onMain(x, y) || D_TO_RIV[i] < clear) continue;
        out.push({ x, y, L, f: flatness(x, y, 15), i });
      }
    return out;
  };
  // The sites to choose from: the flattest low ground first. On an island without two such sites, the search accepts
  // ground less flat, then higher terraces, then ground nearer the river, until it has two (or settles for the summit).
  let sites = [];
  search: for (const clear of [30, 12]) {
    const all = spots(clear);
    // prettier-ignore
    for (const [flat, top] of [[0.9, 3], [0.8, 3], [0.7, 4], [0.5, 5], [-1, 5]]) {
      sites = all.filter((s) => s.f > flat && s.L <= top);
      if (sites.length >= 2) break search;
    }
  }
  if (!sites.length) sites = [{ x: PEAK[0], y: PEAK[1], L: LEV[peak], f: 1, i: peak }];
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y); // the distance between two points
  // the harbour: on the lowest terrace above the beach, as near a beach as possible
  const harbourSite = sites.filter((s) => s.L === 1).sort((a, b) => D_BEACH[a.i] - D_BEACH[b.i])[0] || sites[0];
  // the hill village: higher up, well away from the harbour, about 25 pixels from the river; or else the site furthest
  // from the harbour
  const hillSite =
    sites
      .filter((s) => s.L >= 2 && near(s, harbourSite) > 110)
      .sort((a, b) => Math.abs(D_TO_RIV[a.i] - 75) - Math.abs(D_TO_RIV[b.i] - 75))[0] ||
    sites.sort((a, b) => near(b, harbourSite) - near(a, harbourSite))[0];
  // each village's roof coverings and their colours, and how many houses it tries to build
  const VILLAGES = [
    { ...harbourSite, name: 'harbour', styles: ['thatch', 'plank'], roofs: ['#caa35c', '#8d6b4b'], count: 8 },
    { ...hillSite, name: 'hill', styles: ['redtile', 'tile'], roofs: ['#bb5840', '#5c719c'], count: 8 },
  ];
  // Houses: tried at random round each village's square, spreading out further the more tries fail. A house is built
  // only where its whole footprint, and two pixels round it, is one terrace, dry, free, and not at the water's edge.
  const HOUSES = [];
  VILLAGES.forEach((v, vi) => {
    for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) RES[at(v.x + dx, v.y + dy)] = 2; // the square
    const r = new SeededRandom(SEED + 101 * (vi + 1));
    for (let tries = 0, made = 0; tries < 1500 && made < v.count; tries++) {
      // a direction and a distance from the square, and a size (w across, d deep)
      const a = r.range(0, Math.PI * 2),
        rad = r.range(8, 22 + tries / 60),
        w = r.int(8, 12),
        d = r.int(5, 7);
      // its north-west corner: the ring round the square is drawn wider than tall, as the land is seen from above
      const x0 = Math.round(v.x + Math.cos(a) * rad * 1.3 - w / 2),
        y0 = Math.round(v.y + Math.sin(a) * rad * 0.8 - d / 2),
        L = lev(x0, y0);
      let ok = L >= 1;
      for (let y = y0 - 2; ok && y <= y0 + d + 1; y++)
        for (let x = x0 - 2; ok && x <= x0 + w + 1; x++) {
          const i = at(clamp(x, 0, W - 1), clamp(y, 0, GH - 1));
          if (lev(x, y) !== L || RIV[i] || RES[i] || D_LAND[i] < 12 || D_TO_RIV[i] < 9) ok = false;
        }
      if (!ok) continue;
      for (let y = y0 - 1; y <= y0 + d; y++) for (let x = x0 - 1; x <= x0 + w; x++) RES[at(x, y)] = 1;
      const k = r.int(0, 1); // which of the village's two roof coverings
      // hw: its walls' height; door: how far along the front wall the door is; born: when in the film it pops up
      // prettier-ignore
      HOUSES.push({ id: HOUSES.length, v: vi, x0, y0, w, d, L, hw: r.int(4, 6), kind: r.pick(['gable', 'hip']),
        style: v.styles[k], roof: hex(v.roofs[k]), wall: r.chance(0.6) ? C.plaster : C.timber, door: r.int(1, w - 3),
        chimney: r.chance(0.45), born: T.village[0] + made * 0.11 + vi * 0.05 });
      made++;
    }
  });

  // Fields round each village: a ring from 15 pixels out to between 30 and 42, its outer edge ragged by the forest map.
  // plotGrid lays square plots at an angle and says which plot a pixel is in and how near its edge: near an edge is a
  // bank; inside, each plot is a crop picked by the plot's own random number, planted in rows across the plot.
  const FIELD = new Uint32Array(n), // each field pixel's colour (0 where there is no field)
    FIELD_T = new Float32Array(n).fill(1e9); // when in the film it is planted
  const CROPS = [C.wheat, C.greens, C.cabbage, C.paddy, C.fallow, 0, C.wheat, 0]; // 0: that plot stays meadow
  VILLAGES.forEach((v, vi) => {
    const ang = 0.35 + vi * 0.5, // the plots' angle
      cs = Math.cos(ang),
      sn = Math.sin(ang);
    for (let y = v.y - 44; y <= v.y + 44; y++)
      for (let x = v.x - 60; x <= v.x + 60; x++) {
        if (x < 0 || y < 0 || x >= W || y >= GH) continue;
        const i = at(x, y),
          d = Math.hypot((x - v.x) * 0.8, y - v.y);
        if (d < 15 || d > 30 + 12 * FO[i] || LEV[i] !== v.L || RIV[i] || RES[i] || D_TO_RIV[i] < 6 || D_LAND[i] < 15)
          continue;
        const p = plotGrid(x - v.x, y - v.y, 7, ang),
          crop = CROPS[latticeHash(p.iu, p.iv, SEED) & 7]; // & 7: the plot's random number, 0 to 7
        if (!crop) continue;
        const u = (x - v.x) * cs + (y - v.y) * sn; // the distance along the plots' angle, which sets the rows
        let c;
        if (p.edge < 0.9) c = C.bank;
        else if (crop === C.paddy)
          c = (x + 2 * y) % 4 === 0 ? C.sprout : crop; // a paddy: water, sprouts in a lattice
        else c = Math.floor(u) & 1 ? tone(crop, -1) : crop; // every other row a tone darker
        FIELD[i] = c;
        FIELD_T[i] = T.village[0] + 0.35 + (d / 40) * 0.6;
        RES[i] = 3;
      }
  });

  // ---------------------------------------------------------------------------------------------------- roads
  // Roads are found on a coarser grid of cells, PC pixels square. A cell is open where it is land with no house on it,
  // and where the terraces round it differ by one at most, so a road climbs one terrace at a time and winds to find
  // where it can.
  const PC = 3;
  /** Whether a road may pass through cell (cx, cy). */
  function cellFree(cx, cy) {
    const x = cx * PC + 1, // the cell's middle pixel
      y = cy * PC + 1;
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return false;
    const i = at(x, y);
    if (LEV[i] < 0 || RES[i] === 1) return false;
    // the lowest and the highest terrace among the cell and its eight neighbours
    let lo = 9,
      hi = -9;
    for (let dy = -3; dy <= 3; dy += 3)
      for (let dx = -3; dx <= 3; dx += 3) {
        const L = lev(x + dx, y + dy);
        lo = Math.min(lo, L);
        hi = Math.max(hi, L);
      }
    return hi - lo <= 1;
  }
  // the open cell nearest pixel (x, y), within 20 cells (the villages' squares and the summit are not always open)
  const toCell = (x, y) => nearestFreeCell(Math.round((x - 1) / PC), Math.round((y - 1) / PC), cellFree, 20);
  // A landing on the beach below the harbour: the first beach pixel one to two pixels from the water, searched for on
  // circles of growing radius round the harbour.
  let pier = null;
  for (let r = 4; r < 90 && !pier; r += 2)
    for (let a = 0; a < 64 && !pier; a++) {
      const x = Math.round(harbourSite.x + Math.cos((a / 64) * Math.PI * 2) * r),
        y = Math.round(harbourSite.y + Math.sin((a / 64) * Math.PI * 2) * r);
      if (lev(x, y) === 0 && D_LAND[at(x, y)] <= 6 && D_LAND[at(x, y)] >= 3) pier = { x, y };
    }
  // The jetty: a line of planks two pixels wide from the landing out over the water. Its direction is the one of
  // sixteen in which the sea, 14 pixels out, is deepest. roofTexel's plank pattern gives the boards their seams.
  const PIER = new Uint32Array(n); // each plank pixel's colour
  let pierEnd = null;
  if (pier) {
    let best = -1,
      dir = [0, 1];
    for (let a = 0; a < 16; a++) {
      const dx = Math.cos((a / 16) * Math.PI * 2),
        dy = Math.sin((a / 16) * Math.PI * 2),
        x = Math.round(pier.x + dx * 14),
        y = Math.round(pier.y + dy * 14);
      if (x >= 0 && y >= 0 && x < W && y < H && LEV[at(x, y)] < 0 && D_SEA[at(x, y)] > best)
        ((best = D_SEA[at(x, y)]), (dir = [dx, dy]));
    }
    const x0 = pier.x,
      y0 = pier.y;
    for (let k = 0; k <= 16; k++) {
      const x = Math.round(pier.x + dir[0] * k),
        y = Math.round(pier.y + dir[1] * k);
      // prettier-ignore
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = at(x + ox, y + oy);
        if (LEV[i] >= 0) continue; // planks only over the water
        const tex = roofTexel('plank', x + ox, y + oy, x0, y0);
        PIER[i] = tex === 'edge' || tex === 'deep' ? tone(C.plank, -1) : tex === 'lit' ? tone(C.plank, 1) : C.plank;
      }
      pierEnd = { x, y, dir };
    }
  }
  // the roads to make: harbour to hill village, hill village to just below the summit, and harbour to the landing
  const ROUTES = [
    [VILLAGES[0], VILLAGES[1]],
    [VILLAGES[1], { x: PEAK[0], y: PEAK[1] + 6 }],
    ...(pier ? [[VILLAGES[0], pier]] : []),
  ];
  // PATH: each road pixel's colour; PATH_T: when in the film it is drawn; ROADS: each road's pixels, in order
  const PATH = new Uint32Array(n),
    PATH_T = new Float32Array(n).fill(1e9),
    ROADS = [];
  ROUTES.forEach(([a, b], ri) => {
    const ca = toCell(a.x, a.y),
      cb = toCell(b.x, b.y),
      cells = ca && cb && gridAStar(ca, cb, { free: cellFree, budget: 60000 }); // the shortest way through open cells
    if (!cells) return;
    // each cell's middle, nudged up to a pixel each way by a slow noise, so the road wanders a little, not in steps
    const pts = cells.map(([cx, cy], k) => [
      cx * PC + 1 + Math.round((noiseLine(k * 0.3, SEED + ri) - 0.5) * 2.4),
      cy * PC + 1 + Math.round((noiseLine(k * 0.3 + 50, SEED + ri) - 0.5) * 2.4),
    ]);
    // the points joined into one line of pixels (lineCells), each pixel once
    const line = [];
    for (let k = 1; k < pts.length; k++)
      lineCells(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], (x, y) => {
        const last = line[line.length - 1];
        if (!last || last[0] !== x || last[1] !== y) line.push([x, y]);
      });
    // the road is two pixels wide (a pixel and those to its right and below); it is drawn from its start to its end
    // over 0.75 seconds, and trees are kept three pixels back from it
    line.forEach(([x, y], k) => {
      // prettier-ignore
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
        const i = at(x + dx, y + dy);
        if (LEV[i] < 0) continue;
        PATH[i] = GR[i] < 0.2 ? tone(C.dirt, -1) : GR[i] > 0.85 ? tone(C.dirt, 1) : C.dirt;
        PATH_T[i] = Math.min(PATH_T[i], T.roads[0] + ri * 0.12 + (k / line.length) * 0.75);
      }
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) if (!RES[at(x + dx, y + dy)]) RES[at(x + dx, y + dy)] = 4;
    });
    ROADS.push(line);
  });
  // Lamp posts: scatterAlong picks places along each road, about every 26 pixels. A post stands 3 pixels to one side
  // of the road (the side picked by the slot's variant), found by turning the road's direction there a quarter turn.
  const LAMPS = [];
  ROADS.forEach((line, ri) => {
    if (line.length < 14) return;
    for (const s of scatterAlong(6, line.length - 6, 26, SEED + ri, { chance: 0.85 })) {
      const k = clamp(Math.round(s.x), 1, line.length - 2),
        [x, y] = line[k],
        dx = line[k + 1][0] - line[k - 1][0], // the road's direction at that point
        dy = line[k + 1][1] - line[k - 1][1],
        side = s.variant & 1 ? 1 : -1,
        l = Math.hypot(dx, dy) || 1,
        lx = Math.round(x - (dy / l) * 3 * side), // (-dy, dx) is (dx, dy) turned a quarter turn
        ly = Math.round(y + (dx / l) * 3 * side);
      if (lev(lx, ly) >= 0 && !RIV[at(lx, ly)]) LAMPS.push({ x: lx, y: ly, born: PATH_T[at(x, y)] });
    }
  });

  // ---------------------------------------------------------------------------------------------------- the forest
  // Trees: one chance in each 6-pixel cell, at a random point in it. Whether a tree grows there depends on the terrace
  // and on the forest map (thick forest on the middle terraces, a few lone trees on the meadows, pines up high). Trees
  // keep off houses, fields, roads, the river and the shore, and off the edge of a terrace.
  const TREES = [];
  for (let gy = 0; gy < GH / 6; gy++)
    for (let gx = 0; gx < W / 6; gx++) {
      const id = gy * 97 + gx, // the cell's number, which picks its random numbers
        x = Math.round(gx * 6 + indexRandom(id, SEED + 1) * 5),
        y = Math.round(gy * 6 + indexRandom(id, SEED + 2) * 5);
      if (x < 2 || x >= W - 2 || y < 4 || y >= GH - 1) continue;
      const i = at(x, y),
        L = LEV[i],
        f = FO[i];
      if (L < 1 || RES[i] || D_TO_RIV[i] < 7 || D_LAND[i] < 9 || lev(x, y + 1) !== L) continue;
      // the chance of a tree: terraces 1 and 2 meadow, 3 and 4 wood, 5 highland, 6 the summit
      // prettier-ignore
      const p = L <= 2 ? (f > 0.56 ? 0.75 : 0.06) : L <= 4 ? (f > 0.44 ? 0.88 : 0.22)
        : L === 5 ? (f > 0.45 ? 0.55 : 0.1) : 0.12;
      if (indexRandom(id, SEED + 3) > p) continue;
      const blossom = L <= 2 && indexRandom(id, SEED + 4) < 0.18,
        cone = L >= 5 || (L >= 3 && indexRandom(id, SEED + 5) < 0.4);
      // seed: draws its crown the same way at every size; phase: its own moment in the wind; order: when it grows
      // (thick forest first, so the woods spread outward from their hearts)
      // prettier-ignore
      TREES.push({ id: TREES.length, x, y, L, kind: cone ? 'cone' : 'round', seed: SEED * 7 + id,
        leaf: blossom ? LEAVES.blossom : cone ? LEAVES.pine : L <= 2 ? LEAVES.meadow : LEAVES.wood,
        size: 0.72 + indexRandom(id, SEED + 6) * 0.45, lean: Math.round((indexRandom(id, SEED + 7) - 0.5) * 2),
        phase: indexRandom(id, SEED + 8) * 6.28, order: 1 - f + indexRandom(id, SEED + 9) * 0.25 });
    }
  // each tree's moment to sprout, spread over the forest stage in that order
  {
    const byOrder = [...TREES].sort((a, b) => a.order - b.order);
    byOrder.forEach((tr, k) => (tr.born = T.forest[0] + (k / byOrder.length) * 1.0));
  }
  // palms: one chance in each 9-pixel cell on the beach, away from the water, a dozen at most
  const PALMS = [];
  for (let gy = 0; gy < GH / 9; gy++)
    for (let gx = 0; gx < W / 9; gx++) {
      const id = gy * 61 + gx,
        x = Math.round(gx * 9 + indexRandom(id, SEED + 11) * 8),
        y = Math.round(gy * 9 + indexRandom(id, SEED + 12) * 8),
        i = at(clamp(x, 0, W - 1), clamp(y, 0, GH - 1));
      if (lev(x, y) !== 0 || D_LAND[i] < 5 || RES[i] || indexRandom(id, SEED + 13) > 0.45 || PALMS.length > 11)
        continue;
      // prettier-ignore
      PALMS.push({ x, y, lean: indexRandom(id, SEED + 14) < 0.5 ? -3 : 3,
        born: T.forest[0] + 0.3 + indexRandom(id, SEED + 15) * 0.8, id });
    }
  // reeds: on the banks, one to two pixels from the river's water, at about one pixel in thirteen
  const REEDS = [];
  for (let i = 0; i < W * H; i++) {
    // prettier-ignore
    if (!RIV[i] && LEV[i] >= 1 && D_TO_RIV[i] >= 3 && D_TO_RIV[i] <= 5 && !RES[i] &&
      latticeHash(i % W, (i / W) | 0, SEED) % 13 === 0)
      REEDS.push({ x: i % W, y: (i / W) | 0, id: REEDS.length, born: RIV_T[i] || T.river[1] });
  }
  for (const r of REEDS) r.born = T.forest[0] + 0.2 + indexRandom(r.id, SEED + 16) * 0.8;
  const SUMMIT = { x: PEAK[0], y: PEAK[1], born: T.forest[0] + 0.9 }; // the great tree

  // A lighthouse on the highest islet. Without an islet, it goes on the headland furthest from the summit: a point of
  // land three to six pixels from the sea, clear of everything, not too near the picture's edge.
  let LIGHT = null;
  for (let i = 0; i < W * H; i++) {
    const x = i % W,
      y = (i / W) | 0;
    if (LEV[i] < 0 || D_LAND[i] < 7 || onMain(x, y) || y < 12 || x < 6 || x > W - 6) continue;
    if (!LIGHT || E[i] > E[at(LIGHT.x, LIGHT.y)]) LIGHT = { x, y };
  }
  if (!LIGHT) {
    let best = -1;
    for (let i = 0; i < W * H; i++)
      // prettier-ignore
      if (LEV[i] >= 0 && D_LAND[i] < 18 && D_LAND[i] > 9 && !RES[i] && ((i / W) | 0) > 14 && i % W > 8 &&
        i % W < W - 8) {
        const d = Math.hypot((i % W) - PEAK[0], ((i / W) | 0) - PEAK[1]);
        if (d > best) ((best = d), (LIGHT = { x: i % W, y: (i / W) | 0 }));
      }
  }

  // Questions life asks of the world. inSea: is (x, y) open sea, at least d / 3 pixels from land (where fish may swim
  // and the boat may sail)?
  const inSea = (x, y, d = 9) =>
    x >= 2 &&
    y >= 2 &&
    x < W - 2 &&
    y < H - 2 &&
    LEV[at(Math.round(x), Math.round(y))] < 0 &&
    D_SEA[at(Math.round(x), Math.round(y))] >= d;
  // onGround: is (x, y) on terrace L, dry, and with no house on it?
  const onGround = (x, y, L) =>
    lev(Math.round(x), Math.round(y)) === L &&
    !RIV[at(Math.round(x), Math.round(y))] &&
    RES[at(Math.round(x), Math.round(y))] !== 1;
  const lowest = sorted[0]; // the lowest height in the picture, where the sea starts coming in

  // prettier-ignore
  return { n, at, lev, mask, near, E, LEV, MO, FO, GR, OCT, lowest, CUT, STEP, PATCH, D_SEA, D_LAND, D_BEACH, peak,
    PEAK, RIV, RIV_T, D_RIV, D_TO_RIV, onMain, RES, harbourSite, hillSite, VILLAGES, HOUSES, FIELD, FIELD_T, PIER,
    pierEnd, PATH, PATH_T, ROADS, LAMPS, TREES, PALMS, REEDS, SUMMIT, LIGHT, inSea, onGround };
}
