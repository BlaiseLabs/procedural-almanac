// Life on the island, a step at a time: walkers on the roads and villagers milling in the squares, the herd, fish and
// the whale, the gulls, butterflies, chimney smoke, the fire's embers, the rain, fireflies and the sky lanterns.

/**
 * Everything that moves: its state (sim), how it moves on by a moment (step), and where a walker is (pos).
 *
 * How it works: life begins when the life stage does. startLife makes every creature, each from its kind's genes
 * (genomeFrom), so no two are alike. step(t, dt) then moves everything on by dt seconds (a twentieth): each creature
 * with the almanac's rule for its kind (walking a road, flocking, walking a grid, rising, falling, hovering). All of
 * the state is kept in sim, so that wiping sim starts life over.
 */
export function makeLife(k, look, world) {
  const { A, W, H, GH, LIFT, SEED, T } = k;
  // prettier-ignore
  const { SeededRandom, bodySpots, clamp, coatColours, crossGenomes, dampedSpring, fall, fleeVector, flockStep,
    followJoint, formationSlot, genomeFrom, gridWalk, hover, indexRandom, lerp, particleField, pulseRise, rise,
    strideRate, wanderingHeading, wrapAround } = A;
  const { hex, tone } = look;
  // prettier-ignore
  const { at, lev, near, LEV, D_SEA, RIV, RES, harbourSite, hillSite, VILLAGES, HOUSES, pierEnd, ROADS, inSea,
    onGround } = world;

  // ---------------------------------------------------------------------------------------------------- the kinds
  // A kind's genes, as genomeFrom reads them: a list is a choice of one, a pair of numbers a range to pick from, and {
  // chance } a yes or no. A villager's skin and hair, whether they wear a hat, how fast they walk and how long a step.
  const PEOPLE_GENES = {
    skin: ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3a'],
    hair: ['#2b1d14', '#5a3a22', '#c9a26a', '#d8d2c8', '#1e1a1a'],
    hat: { chance: 0.35 },
    speed: [7, 11],
    stride: [0.9, 1.3],
  };
  // a deer's size, whether it is a stag (antlers), its coat's hue (a brown), and its gait
  const DEER_KIND = { size: [0.85, 1.1], antlers: { chance: 0.4 }, hue: [24, 36], gait: 'walk', fawn: false };

  // the state of everything alive; f is the last frame it was stepped to (-1 before the first)
  const sim = { f: -1 };
  /**
   * Makes the island's life, once, as the life stage begins.
   *
   * How it works: one seeded random stream (r) makes everything, always in the same order, so the same seed always
   * gives the same villagers and animals. Walkers are set along each road (four on the first road, two on the others).
   * The herd of four deer is drawn from the deer's genes, and a fawn is bred from the first two (crossGenomes) with
   * spots on its back. The fish start in the bay below the harbour, and the whale in the deepest water near the middle.
   * Then come the gulls (off the left edge), butterflies, the boat, villagers and hens for the squares, and the
   * particles for rain, fireflies and the sky lanterns.
   */
  function startLife() {
    const r = new SeededRandom(SEED + 5);
    sim.people = [];
    ROADS.forEach((line, ri) => {
      for (let k = 0; k < (ri === 0 ? 4 : 2); k++) {
        const g = genomeFrom(PEOPLE_GENES, r),
          coat = coatColours(r, { hue: [r.range(0, 360), 40] }, { s: [0.35, 0.65], l: [0.4, 0.58] });
        // coatColours gives a back, a belly and an accent colour: the shirt, and darker trousers
        g.shirt = coat.back;
        g.trousers = tone(coat.accent, -1);
        g.skinC = hex(g.skin);
        g.hairC = hex(g.hair);
        sim.people.push({
          id: sim.people.length,
          line,
          s: r.range(0, line.length - 1), // how far along the road they are, in pixels
          dir: r.sign(), // walking toward the road's end (1) or its start (-1)
          g,
          phase: 0,
          wait: 0,
          born: T.life[0] + k * 0.25 + ri * 0.1,
        });
      }
    });
    // a herd: four deer grown from their kind's ranges, and a fawn bred from two of them
    const meadow = deerMeadow(),
      herd = [];
    for (let k = 0; k < 4; k++) {
      const g = genomeFrom(DEER_KIND, r);
      g.coat = coatColours(r, { hue: [g.hue, 8] }, { s: [0.35, 0.5], l: [0.4, 0.5] });
      g.spots = [];
      herd.push(g);
    }
    const fawn = crossGenomes(herd[0], herd[1], DEER_KIND, r, 0.1);
    fawn.fawn = true;
    fawn.antlers = false;
    fawn.coat = coatColours(r, { hue: [fawn.hue, 8] }, { s: [0.4, 0.5], l: [0.45, 0.52] });
    fawn.spots = bodySpots(r, 1, 3, 4);
    herd.push(fawn);
    sim.deer = herd.map((g, k) => ({
      x: meadow.x + r.range(-10, 10),
      y: meadow.y + r.range(-6, 6),
      vx: r.range(-1, 1),
      vy: r.range(-1, 1),
      g,
      phase: 0,
      seed: k,
      fear: 0,
    }));
    sim.meadow = meadow;
    // fish in the bay, and a whale in the deep they keep away from
    const bay = seaPoint(harbourSite, 36, 70),
      deep = seaPoint({ x: W / 2, y: H / 2 }, 75, 999);
    sim.fish = Array.from({ length: 16 }, (_, k) => ({
      x: bay.x + r.range(-8, 8),
      y: bay.y + r.range(-5, 5),
      vx: r.range(-6, 6),
      vy: r.range(-4, 4),
      seed: k,
      speed: r.range(0.9, 1.1),
    }));
    sim.bay = bay;
    // the whale's spine: ten points 3 pixels apart, the first being its head
    sim.whale = { deep, spine: Array.from({ length: 10 }, (_, k) => [deep.x - k * 3, deep.y]) };
    sim.birds = Array.from({ length: 7 }, (_, k) => ({ x: -40 - k * 6, y: 44, vx: 0, vy: 0 })); // off the left edge
    sim.butterflies = Array.from({ length: 6 }, (_, k) => ({
      x: meadow.x + r.range(-30, 30),
      y: meadow.y + r.range(-20, 20),
      a: r.range(0, 6.28),
      s: r.range(0, 500),
      seed: SEED + k,
    }));
    // the boat sails round a point off the end of the jetty
    sim.boat = {
      centre: pierEnd
        ? { x: pierEnd.x + pierEnd.dir[0] * 16, y: pierEnd.y + pierEnd.dir[1] * 9 }
        : seaPoint(harbourSite, 45, 80),
    };
    // Villagers milling about each square, and hens about the harbour's: walkers on a grid (gridWalk). A villager's
    // grid has tiles of 2 pixels (tile: 2), a hen's of 1; x and y are in tiles, and tx, ty is the tile it is heading
    // for.
    sim.milling = [];
    VILLAGES.forEach((v, vi) => {
      const L = lev(v.x, v.y);
      for (let k = 0; k < 7; k++) {
        const g = genomeFrom(PEOPLE_GENES, r),
          coat = coatColours(r, { hue: [r.range(0, 360), 40] }, { s: [0.35, 0.65], l: [0.4, 0.58] });
        Object.assign(g, { shirt: coat.back, trousers: tone(coat.accent, -1), skinC: hex(g.skin), hairC: hex(g.hair) });
        const tx = Math.floor((v.x + r.range(-6, 6)) / 2),
          ty = Math.floor((v.y + r.range(-4, 4)) / 2);
        sim.milling.push({
          id: 100 + sim.milling.length,
          x: tx + 0.5,
          y: ty + 0.5,
          tx: tx + 0.5,
          ty: ty + 0.5,
          wait: r.range(0, 1),
          g,
          phase: 0,
          dir: 1,
          v,
          L,
          tile: 2,
          speed: 2.4,
          born: T.life[0] + k * 0.08,
        });
      }
    });
    for (let k = 0; k < 6; k++) {
      const v = VILLAGES[0],
        tx = Math.floor(v.x + r.range(-8, 8)),
        ty = Math.floor(v.y + r.range(-5, 5));
      sim.milling.push({
        id: 200 + k,
        hen: true,
        x: tx + 0.5,
        y: ty + 0.5,
        tx: tx + 0.5,
        ty: ty + 0.5,
        wait: 0,
        v,
        L: lev(v.x, v.y),
        tile: 1,
        speed: 5,
        born: T.life[0],
        dir: 1,
      });
    }
    sim.walkRandom = new SeededRandom(SEED + 31); // where the walkers on the grid turn next
    sim.smoke = [];
    sim.embers = [];
    // rain over the whole picture; fireflies only where they start over grass, not on the sea or the roads
    sim.rain = particleField(260, W, H, r);
    sim.flies = particleField(160, W, H, r).filter(
      (q) => lev(Math.round(q.x), Math.round(q.y)) >= 1 && !RES[at(Math.round(q.x), Math.round(q.y))],
    );
    // sky lanterns, let go from the two villages in turn as night falls (y is on the screen: above the square's
    // terrace)
    sim.lanterns = Array.from({ length: 22 }, (_, k) => {
      const v = VILLAGES[k % 2];
      return {
        x: v.x + r.range(-10, 10),
        y: v.y - 6 - v.L * LIFT,
        phase: r.range(0, 6),
        seed: k,
        speed: r.range(0.75, 1.25),
        born: T.night[0] - 0.3 + k * 0.09,
      };
    });
  }
  /**
   * Where the herd grazes: the point on the lower terraces (1 and 2) with the most open grass round it (no houses,
   * fields, roads or river within about 20 pixels), preferring ground about 60 pixels from the hill village.
   */
  function deerMeadow() {
    let best = null;
    for (let y = 20; y < H - 20; y += 6)
      for (let x = 20; x < W - 20; x += 6) {
        if (lev(x, y) < 1 || lev(x, y) > 2 || RES[at(x, y)]) continue;
        let free = 0;
        for (let dy = -14; dy <= 14; dy += 4)
          for (let dx = -20; dx <= 20; dx += 4)
            if (lev(x + dx, y + dy) === lev(x, y) && !RES[at(x + dx, y + dy)] && !RIV[at(x + dx, y + dy)]) free++;
        const score = free - Math.abs(near({ x, y }, hillSite) - 60) * 0.2;
        if (!best || score > best.score) best = { x, y, score, L: lev(x, y) };
      }
    return best;
  }
  /**
   * The point of open sea nearest `from` whose distance from land is between dmin and dmax (in thirds of a pixel),
   * looked for on a grid of every third pixel. Used for the fish's bay, the whale's deep water and the boat.
   */
  function seaPoint(from, dmin, dmax) {
    let best = null;
    for (let y = 8; y < H - 8; y += 3)
      for (let x = 8; x < W - 8; x += 3) {
        const d = D_SEA[at(x, y)];
        if (LEV[at(x, y)] >= 0 || d < dmin || d > dmax) continue;
        const s = near({ x, y }, from);
        if (!best || s < best.s) best = { x, y, s };
      }
    return best || { x: 20, y: H - 20 };
  }

  /**
   * Moves life on by dt seconds, to second t.
   *
   * How it works, creature by creature. Walkers move along their road at their own speed and turn back at its ends. The
   * herd flocks (flockStep: keep together, face the same way, keep apart, wander) and runs from any walker within 26
   * pixels (fleeVector), but never leaves its meadow. The whale's head swims a slow loop and its spine follows it
   * (followJoint). Villagers and hens walk their grids. The fish school (flockStep again) and scatter from the whale
   * when it comes near the bay. The gulls fly in a V (formationSlot). Butterflies wander (wanderingHeading). Smoke and
   * embers rise, the rain falls, fireflies hover, and lanterns rise in pulses.
   */
  function step(t, dt) {
    if (t < T.life[0] - 0.05) return; // nothing lives before the life stage
    if (!sim.people) startLife();
    for (const p of sim.people) {
      if (t < p.born) continue;
      if (p.wait > 0) p.wait -= dt;
      else {
        p.s += p.dir * p.g.speed * dt;
        p.phase += p.g.speed * dt * strideRate(p.g.stride); // the step's phase turns with the distance walked
        if (p.s <= 0 || p.s >= p.line.length - 1) {
          p.s = clamp(p.s, 0, p.line.length - 1);
          p.dir = -p.dir;
          p.wait = 0.6;
        }
      }
    }
    // the herd keeps together and wanders; when someone comes near, it runs from them
    // every walker is a threat to the deer within 26 pixels
    const threats = sim.people.filter((p) => t >= p.born).map((p) => ({ ...pos(p), r: 26, hard: false }));
    const moved = flockStep(sim.deer, dt, {
      cohesion: 0.12,
      alignment: 0.25,
      separation: { within: 7, push: 8 },
      speed: [0, 6],
      wander: { t, rate: [0.31, 0.43], amount: [2.5, 2] },
    });
    sim.deer = moved.map((d, k) => {
      const old = sim.deer[k],
        fl = fleeVector(d.x, d.y, threats);
      let fear = Math.max(old.fear - dt, fl.fear); // fear lasts a moment after the threat has passed
      if (fl.fear) {
        d.vx += fl.x * 30 * dt;
        d.vy += fl.y * 30 * dt;
      }
      // a frightened deer may run (up to 16 pixels a second); a calm one walks (up to 6)
      const sp = Math.hypot(d.vx, d.vy),
        max = fear > 0 ? 16 : 6;
      if (sp > max) ((d.vx *= max / sp), (d.vy *= max / sp));
      // a step off the meadow's terrace, or too far from it, is undone and the deer turned back toward its middle
      if (!onGround(d.x, d.y, sim.meadow.L) || near(d, sim.meadow) > 34) {
        d.x = old.x;
        d.y = old.y;
        d.vx = (sim.meadow.x - old.x) * 0.3;
        d.vy = (sim.meadow.y - old.y) * 0.3;
      }
      return { ...d, fear, phase: old.phase + Math.hypot(d.x - old.x, d.y - old.y) * strideRate(0.9), g: old.g };
    });
    // the whale's head swims a slow loop; its spine follows, each joint bending no more than a spine bends
    const wh = sim.whale,
      a = t * 0.35,
      head = [wh.deep.x + Math.cos(a) * 34, wh.deep.y + Math.sin(a * 1.3) * 9]; // a loop wider than it is tall
    wh.spine[0] = head;
    for (let k = 1; k < wh.spine.length; k++) {
      // back: the direction from the joint before this one back along the spine (for the second joint, toward where
      // this joint already is). followJoint keeps the joint 3.2 pixels behind, turned at most 0.35 radians from it.
      const [lx, ly] = wh.spine[k - 1],
        back =
          k > 1
            ? Math.atan2(wh.spine[k - 1][1] - wh.spine[k - 2][1], wh.spine[k - 1][0] - wh.spine[k - 2][0]) + Math.PI
            : Math.atan2(wh.spine[k][1] - ly, wh.spine[k][0] - lx);
      wh.spine[k] = followJoint(lx, ly, wh.spine[k][0], wh.spine[k][1], 3.2, back, 0.35);
    }
    // the villagers and hens on their grids: a walker may step to a tile on its own terrace, with no house and no
    // river, within reach of its square (the 1.4 stretches the reach across, as the ground is seen from above)
    for (let k = 0; k < sim.milling.length; k++) {
      const m = sim.milling[k];
      if (t < m.born) continue;
      const s = m.tile,
        reach = m.hen ? 16 : 22,
        next = gridWalk(m, dt, {
          speed: m.speed,
          random: sim.walkRandom,
          pause: m.hen ? { chance: 0.6, from: 0.2, to: 0.9 } : { chance: 0.35, from: 0.4, to: 1.6 },
          canStep: (fx, fy, x, y) => {
            const px = Math.round((x + 0.5) * s), // the tile's middle, in pixels
              py = Math.round((y + 0.5) * s),
              i = at(clamp(px, 0, W - 1), clamp(py, 0, GH - 1));
            return lev(px, py) === m.L && RES[i] !== 1 && !RIV[i] && Math.hypot(px - m.v.x, (py - m.v.y) * 1.4) < reach;
          },
        });
      next.phase = (m.phase || 0) + (next.moving ? m.speed * s * dt * strideRate(1.1) : 0);
      next.dir = next.dir || m.dir;
      sim.milling[k] = next;
    }
    // The fish school; when the whale's head is within 60 pixels of the bay they flee from it. A fish that would swim
    // out of open water stays where it was and turns back toward the bay.
    const fishPrev = sim.fish;
    sim.fish = flockStep(sim.fish, dt, {
      cohesion: 0.5,
      alignment: 0.6,
      separation: { within: 4, push: 12 },
      speed: [7, 16],
      wander: { t, rate: [0.5, 0.7], amount: [6, 6] },
      ...(near({ x: head[0], y: head[1] }, sim.bay) < 60 ? { flee: { x: head[0], y: head[1], push: 22 } } : {}),
    }).map((f, k) => {
      if (inSea(f.x, f.y)) return f;
      const o = fishPrev[k];
      return { ...f, x: o.x, y: o.y, vx: (sim.bay.x - o.x) * 0.5, vy: (sim.bay.y - o.y) * 0.5 };
    });
    // Gulls in a V: the leader crosses the sky from the left edge to past the right during the life stage and dusk,
    // rising and falling on a gentle wave (u is how far across it is, la the direction it is heading). Every other gull
    // is pulled toward its place in the V by a spring (dampedSpring), so the V bends and settles as the leader turns.
    const u = clamp((t - T.life[0]) / (T.dusk[1] - T.life[0])),
      lx = lerp(-30, W + 60, u),
      ly = 46 + Math.sin(u * 5) * 10,
      la = Math.atan2(Math.cos(u * 5) * 10 * 5, W + 90);
    sim.birds = sim.birds.map((b, k) => {
      const slot = k ? formationSlot('vee', lx, ly, la, k - 1) : { x: lx, y: ly };
      const [x, vx] = dampedSpring(b.x, b.vx, slot.x, 30, 8, dt),
        [y, vy] = dampedSpring(b.y, b.vy, slot.y, 30, 8, dt);
      return { x, y, vx, vy };
    });
    // butterflies wander (their heading drifts with noise along the way they have come) and turn back at the shore
    for (const b of sim.butterflies) {
      b.a = wanderingHeading(b.a, (b.s += 9 * dt), b.seed, 0, 0.25);
      const nx = b.x + Math.cos(b.a) * 9 * dt,
        ny = b.y + Math.sin(b.a) * 9 * dt;
      if (lev(Math.round(nx), Math.round(ny)) >= 1) ((b.x = nx), (b.y = ny));
      else b.a += Math.PI;
    }
    // Chimney smoke: each chimney puffs at random, about one frame in three, from its roof's height. Smoke and the
    // fire's embers rise and are forgotten once old. Rain falls slanting and comes back at the top when it leaves the
    // bottom (wrapAround); fireflies loop where they are (hover); lanterns rise in pulses (pulseRise).
    for (const h of HOUSES)
      if (h.chimney && t > h.born + 0.5 && indexRandom(sim.f * 31 + h.id, SEED) < 0.3)
        sim.smoke.push({
          x: h.x0 + h.w - 3,
          y: h.y0 - h.hw - 1,
          z: 1,
          p: 0,
          s: indexRandom(h.id + sim.f, 9),
          L: h.L,
          age: 0,
        });
    sim.smoke = sim.smoke
      .map((q) => ({ ...rise(q, dt, { speed: 5, spread: 3, wind: 4, sway: [2, 2] }), L: q.L, age: q.age + dt }))
      .filter((q) => q.age < 2.6);
    if (t > T.dusk[0])
      for (let k = 0; k < 2; k++)
        sim.embers.push({
          x: hillSite.x + indexRandom(sim.f * 7 + k, 3) * 4 - 2,
          y: hillSite.y - 3,
          z: 1,
          p: 0,
          s: indexRandom(sim.f * 3 + k, 5),
          age: 0,
        });
    sim.embers = sim.embers
      .map((q) => ({ ...rise(q, dt, { speed: 9, spread: 8, wind: 2, sway: [3, 3] }), age: q.age + dt }))
      .filter((q) => q.age < 1.4);
    sim.rain = sim.rain.map((q) => wrapAround(fall(q, dt, { speed: 230, wind: -60 }), W, H, 8));
    sim.flies = sim.flies.map((q) => hover(q, dt, { x: [0.9, 5], y: [1.3, 4] }));
    sim.lanterns = sim.lanterns.map((l) =>
      t > l.born ? pulseRise(l, dt, t, { rate: 3, push: 42, sway: [0.6, 7] }) : l,
    );
  }
  // where a walker on a road is: the road's pixel nearest how far along it they are, one pixel up (their feet)
  function pos(p) {
    const k = clamp(Math.round(p.s), 0, p.line.length - 1);
    return { x: p.line[k][0], y: p.line[k][1] - 1 };
  }

  return { sim, step, pos };
}
