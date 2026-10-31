// What goes over the frame: clouds and fog, the light of the hour (with lamps, windows, fires and stars holding off the
// dark), rain and lightning, then the captions, the mark in the corner, the card at dawn, the close look at the harbour
// and the dissolve back to noise.
import { textRows } from './font.js';

/**
 * The layers laid over the painted frame, in the order they are laid: skies (clouds' shadows, fog), light (the hour's
 * light and what glows at night), rain (and lightning), and finish (the close-up, the fade, the captions).
 *
 * How it works: each works on the frame's pixels in place. Light is the subtle one: the almanac's gradeFrame recolours
 * the whole frame for the hour (night turns it deep blue) except near lights, where the dark is held off in steps. The
 * lights themselves (windows, lamps, the fire, stars) are then drawn at full brightness, after the grading, so they
 * are never dimmed.
 */
export function makeOverlay(k, look, world, pics, life, frame) {
  const { A, used, W, H, LIFT, SEED, STAGES, T, span, CAPTIONS } = k;
  // prettier-ignore
  const { bayerThreshold, blink, blitSprite, clamp, cloudShadows, fogBanks, gradeFrame, hourLight, hourTables,
    indexRandom, latticeHash, lerp, lightningFlash, lineCells, mixPacked, obliqueToScreen, smoothstep,
    spriteFromRows, twinkle, windowLit } = A;
  const { tone, C, greyOf, MARK } = look;
  const { at, LEV, GR, OCT, hillSite, VILLAGES, HOUSES, LAMPS, SUMMIT, LIGHT } = world;
  const { SUMMIT_TREE } = pics;
  const { sim } = life;
  const { FRAME, OUT, WM, EM, EMID, LIFTS, ground } = frame;

  // scratch buffers the almanac's functions hand back to be reused next frame, and the hour's colour tables, kept by
  // their key so each is made once
  let gradeScratch, cloudScratch, fogScratch;
  const tables = new Map();

  /**
   * Clouds' shadows drifting over everything from the forest stage on (more cloud in the storm), and at dawn fog banks
   * that thin as the morning comes. tod is the time of day; a shadow is full by day and half (a dither) at dusk and
   * dawn.
   */
  function skies(t, tod, storm) {
    if (t >= T.forest[0])
      cloudScratch = cloudShadows(FRAME, W, H, {
        x: t * 9,
        y: t * 3,
        seed: SEED,
        cover: 0.3 + storm * 0.75,
        strong: tod < 0.4 || tod > 0.95 || storm > 0.3,
        scratch: cloudScratch,
      });
    if (t >= T.dawn[0] && t < T.fade[1]) {
      const dn = span('dawn', t);
      fogScratch = fogBanks(FRAME, W, H, {
        x: t * 10,
        y: t * 2,
        density: 0.82 - dn * 0.45,
        colour: C.fog,
        seed: SEED + 9,
        scratch: fogScratch,
      });
    }
  }

  /**
   * The hour's light. By plain day it changes nothing. Otherwise hourLight says how much it is night and dusk (wetter
   * air in the storm greys it), hourTables turns that into a colour table for each of red, green and blue, and
   * gradeFrame recolours every pixel by them, holding the dark off round each light. Then glow draws the lights.
   */
  function light(t, fr, tod, storm) {
    const hl = hourLight(tod, 1, storm * 0.8),
      lights = t >= T.dusk[0] ? lightsAt(t, fr, hl.night) : [];
    if (!hl.plain) {
      if (!tables.has(hl.key)) tables.set(hl.key, hourTables(hl.night, hl.dusk, hl.morning, 1, storm * 0.8));
      gradeScratch = gradeFrame(FRAME, W, H, tables.get(hl.key), { night: hl.night, lights, scratch: gradeScratch });
    }
    glow(t, fr, hl.night);
  }

  /**
   * The storm: rain across the picture, and two flashes of lightning. Each raindrop has its own number from 0 to 1 and
   * is drawn only while the storm is stronger than that, so the rain thickens and thins with the front. A drop is a
   * short slanting streak, mixed into the pixels under it. A flash lasts a third of a second (lightningFlash flickers
   * it).
   */
  function rain(t, storm) {
    if (storm > 0.02) {
      for (const q of sim.rain)
        if (q.s < storm)
          lineCells(q.x, q.y, q.x - 1, q.y + 3, (x, y) => {
            if (x >= 0 && y >= 0 && x < W && y < H) FRAME[y * W + x] = mixPacked(FRAME[y * W + x], C.rain, 0.55);
          });
      const st = t - T.storm[0];
      for (const strike of [0.62, 1.05])
        if (st >= strike && st < strike + 0.34) lightningFlash(FRAME, 0.34 - (st - strike));
    }
  }

  /**
   * The lights after dark, as gradeFrame takes them: each a point on the screen (x, y), how far its light reaches (r)
   * and how strongly it holds off the dark (k). Lit windows (windowLit picks which houses, a share that grows as night
   * deepens), the lamp posts, the hill village's fire (flickering in reach), the lighthouse while its beacon blinks on,
   * every other tip of the summit tree, fireflies while they glow, and the sky lanterns.
   */
  function lightsAt(t, fr, night) {
    const L = [];
    if (night < 0.12) return L;
    const share = clamp((night - 0.15) * 2.5) * 0.9;
    for (const h of HOUSES)
      if (h.screen && windowLit(h.id, 0, 0, SEED, t, share))
        L.push({ x: h.screen[0], y: h.screen[1] - 2, r: 13 + h.w * 0.4, k: 0.9 });
    for (const lp of LAMPS) if (lp.screen) L.push({ x: lp.screen[0], y: lp.screen[1] + 3, r: 15, k: 0.85 });
    const [fx, fy] = ground(hillSite.x, hillSite.y);
    L.push({ x: fx, y: fy - 1, r: 20 + indexRandom(fr, 7) * 4, k: 1 });
    if (LIGHT && LIGHT.screen && blink(t, 5, 0, 0.3)) L.push({ x: LIGHT.screen[0], y: LIGHT.screen[1], r: 34, k: 1 });
    const [tx, ty] = ground(SUMMIT.x, SUMMIT.y);
    for (const [x, y] of SUMMIT_TREE.tips.filter((_, k) => k % 2 === 0))
      L.push({ x: tx + x, y: ty + y, r: 10, k: 0.75 });
    for (const q of sim.flies) if (twinkle(t, q.p * 3, 0.5) > 0.6) L.push({ x: q.x, y: q.y, r: 5, k: 0.6 });
    for (const l of sim.lanterns) if (t > l.born && l.y > 4) L.push({ x: l.x, y: l.y, r: 11, k: 0.85 });
    return L;
  }
  /**
   * What glows, drawn after the light is graded so it is never dimmed.
   *
   * How it works: the markers stamped into the frame (EM) are lit: a window in a lit house, a lamp, a tip of the summit
   * tree (two by two pixels, twinkling) and the lighthouse's beacon when it blinks on. Then the hill village's fire
   * (its flames jump a pixel at random each frame) and its embers; and, at night, stars reflected in the sea, fireflies
   * and the sky lanterns.
   */
  function glow(t, fr, night) {
    const on = night > 0.18;
    const share = clamp((night - 0.15) * 2.5) * 0.9; // the share of houses with lit windows, up to nine in ten
    for (let i = 0; i < W * H; i++) {
      const m = EM[i];
      if (!m || !on) continue;
      if (m === MARK.win) {
        if (windowLit(EMID[i], 0, 0, SEED, t, share)) FRAME[i] = C.lit;
      } else if (m === MARK.lamp) FRAME[i] = C.lamp;
      else if (m === MARK.tip) {
        const c = twinkle(t, EMID[i] * 1.7) > 0.8 ? C.tipBright : C.tip;
        for (const d of [0, 1, W, W + 1]) if (i + d < W * H) FRAME[i + d] = c;
      } else if (m === MARK.beacon && blink(t, 5, 0, 0.3)) FRAME[i] = C.beacon;
    }
    if (!sim.people || t < T.dusk[0]) return;
    // the fire in the hill village's square, and its embers
    const [fx, fy] = ground(hillSite.x, hillSite.y);
    for (let k = 0; k < 7; k++) {
      const x = Math.round(fx - 1 + (k % 3)),
        y = Math.round(fy) - 1 - Math.floor(k / 3) - (indexRandom(fr * 7 + k, 11) < 0.5 ? 1 : 0);
      if (x >= 0 && y >= 0 && x < W && y < H) FRAME[y * W + x] = C.fire[k < 3 ? 2 : k < 6 ? 1 : 0];
    }
    for (const q of sim.embers) {
      const x = Math.round(q.x),
        y = Math.round(obliqueToScreen(q.x, q.y, LIFTS[hillSite.L], 0, 0, 0)[1]);
      if (x >= 0 && y >= 0 && x < W && y < H && q.age < 1.2) FRAME[y * W + x] = q.age < 0.5 ? C.fire[0] : C.fire[1];
    }
    if (!on) return;
    // Stars in the sea: about one sea pixel in 487 (picked by its hash, so always the same ones), each twinkling at its
    // own phase, brighter the deeper the night. Then fireflies, and the lanterns let go from the villages.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (WM[i] !== 1 || latticeHash(x, y, SEED) % 487) continue;
        const k = twinkle(t, (latticeHash(x, y, 3) % 628) / 100, 0.6);
        if (k > 0.55) FRAME[i] = mixPacked(FRAME[i], C.star, (k - 0.4) * night);
      }
    for (const q of sim.flies) {
      const x = Math.round(q.x),
        y = Math.round(q.y);
      if (x >= 0 && y >= 0 && x < W && y < H && twinkle(t, q.p * 3, 0.5) > 0.6) FRAME[y * W + x] = C.firefly;
    }
    for (const l of sim.lanterns) {
      if (t <= l.born || l.y < 2) continue;
      const x = Math.round(l.x),
        y = Math.round(l.y);
      // a lantern: two pixels wide and three tall, its top the brightest
      for (const [dx, dy, c] of [
        [0, 0, C.lamp],
        [1, 0, C.lit],
        [0, 1, C.lantern],
        [1, 1, C.lantern],
        [0, 2, tone(C.lantern, -1)],
        [1, 2, tone(C.lantern, -1)],
      ])
        if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) FRAME[(y + dy) * W + x + dx] = c;
    }
  }

  // ---------------------------------------------------------------------------------------------------- captions
  // Drawn captions, kept by their text and how many letters of it show (a caption types itself out), so each is drawn
  // once.
  const CAP = new Map();
  // a caption, from the kept ones, drawn the first time it is asked for
  function caption(lines, chars) {
    const key = lines.join('|') + ':' + chars;
    return CAP.get(key) || (CAP.set(key, makeCaption(lines, chars)), CAP.get(key));
  }
  /**
   * Draws the first `chars` letters of lines of text as one sprite, with the pixel font (font.js): letters in pale
   * text, words in backticks in gold, all outlined in dark ink so they read over anything. big doubles every pixel.
   */
  function makeCaption(lines, chars, big = false) {
    let left = chars;
    const rows = [];
    for (const line of lines) {
      const shown = line.slice(0, Math.max(0, left));
      left -= line.length;
      rows.push(...textRows(shown, { big }), ...(big ? ['.', '.', '.', '.'] : ['.', '.']));
    }
    const width = Math.max(1, ...rows.map((r) => r.length));
    return spriteFromRows(
      rows.map((r) => r.padEnd(width, '.')),
      (ch) => (ch === '+' ? C.accent : C.text),
      { ink: C.textInk, ax: 0, ay: 0 },
    );
  }
  // the library's name in the top-left corner of every frame
  const MARK_SPRITE = spriteFromRows(textRows('procedural-almanac'), () => C.mark, { ink: C.textInk, ax: 0, ay: 0 });
  // when the close look lasts, and the copy of the frame it reads from
  const ZOOM = [T.life[0] + 0.25, T.life[1]],
    SRC = new Uint32Array(W * H);
  /**
   * The close look during the life stage: a quarter of the picture (half as wide, half as tall) shown at twice the
   * size, whole pixels only, its window panning from the harbour village up to the summit.
   *
   * How it works: the frame is copied (SRC), and each pixel of the frame takes the copy's pixel at half its distance
   * from the window's corner (cx, cy): x >> 1 is x halved, rounded down, so each copied pixel fills two by two.
   */
  function closeLook(t) {
    // u: how far the pan has gone (it waits half a second, then eases from the harbour to the summit)
    const u = smoothstep(0, 1, clamp((t - ZOOM[0] - 0.5) / (ZOOM[1] - ZOOM[0] - 0.7))),
      a = { x: VILLAGES[0].x, y: VILLAGES[0].y - VILLAGES[0].L * LIFT },
      b = { x: SUMMIT.x, y: SUMMIT.y - LEV[at(SUMMIT.x, SUMMIT.y)] * LIFT + 10 },
      cx = clamp(Math.round(lerp(a.x, b.x, u) - W / 4), 0, W / 2),
      cy = clamp(Math.round(lerp(a.y, b.y, u) - H / 4), 0, H / 2);
    SRC.set(FRAME);
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++) FRAME[i] = SRC[(cy + (y >> 1)) * W + cx + (x >> 1)];
  }
  /**
   * The last layers of a frame. The close look, while it lasts. In the fade, pixels dissolve back into the seed's
   * one-octave noise (the film's first frame, so the GIF loops), in an order set by the dither pattern and each pixel's
   * grain. Then the library's name in the corner, the caption of the stage (typing itself out at 150 letters a second;
   * the last one leaves before the loop), and at dawn the end card with the count of techniques used.
   */
  function finish(t) {
    if (t >= ZOOM[0] && t < ZOOM[1]) closeLook(t);
    if (t >= T.fade[0]) {
      const u = span('fade', t);
      for (let y = 0, i = 0; y < H; y++)
        for (let x = 0; x < W; x++, i++)
          if (bayerThreshold(x, y) * 0.55 + GR[i] * 0.45 < u * 1.06) FRAME[i] = greyOf(OCT[0][i], x, y);
    }
    blitSprite(OUT, MARK_SPRITE, 4, 3);
    for (const [k] of STAGES) {
      if (t < T[k][0] || t >= T[k][1] || !CAPTIONS[k]) continue;
      const lines = CAPTIONS[k],
        chars = Math.floor((t - T[k][0]) * 150),
        fadeOut = k === 'fade' && t > T.fade[1] - 0.3;
      if (fadeOut) continue;
      const sp = caption(lines, chars);
      blitSprite(OUT, sp, 4, H - 4 - sp.h);
    }
    if (t >= T.dawn[0] + 0.3 && t < T.fade[0] + 0.25) {
      // the card's big title is drawn once and kept; the line under it counts the techniques called so far
      const card = CAP.get('end') || (CAP.set('end', makeCaption(['one seed, one island'], 99, true)), CAP.get('end'));
      const sub = caption([`${used.size} techniques · no image files`, '`procedural-almanac`'], 99);
      blitSprite(OUT, card, (W - card.w) >> 1, 70); // centred: (W - width) / 2, rounded down
      blitSprite(OUT, sub, (W - sub.w) >> 1, 96);
    }
    return FRAME;
  }

  return { skies, light, rain, finish };
}
