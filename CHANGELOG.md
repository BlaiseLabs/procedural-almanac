# Changelog

All notable changes to this almanac are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `projection`: `obliqueShear`, `obliqueToScreen`, `obliqueToGround`; `relief` (new): `terraceLevel`, `wallShade`,
  `leafShade`, `crownRows`, `silhouetteNormals`, `crownClumps`, the depth view of OpenWorldBuilder's top worlds (the
  same pixels in Chromium: 0 different).

- `roofs` (new): `roofPlan`, `slopeShade`, `roofTexel`, the roofs of OpenWorldBuilder's code-drawn buildings (the
  same pixels: 0 different).

- `paths` (new): `gridAStar`, `nearestFreeCell`, `segmentClear`, `straightenPath`, `floodFill`, `untilSettled`, the ways
  round buildings, the reachable land and the reachable items of OpenGameBuilder's games (the same paths, the same games won).

- The top view's land, weather and life as entries, each giving the numbers of the code it came from (0 pixels different):
  `weather` (new): `cloudShadows`, `fogBanks`, `frontStrength`, `lightningFlash`; `light`: `hourLight`, `hourTables`,
  `gradeFrame`; `motion`: `fleeVector`, `formationSlot`; `land`: `chamferDistance` (established), `wobbledRing`,
  `mountainRise`, `windingRiver`, `plotGrid`.

- `bodies` (new): a creature's techniques from OpenWorldBuilder's top view: `followJoint` (a spine that follows its head), `dampedSpring`, `footSwing` and `footReady` (planted feet that step), `floatHeight`, `waterlineCut` and `depthUnderCut` (a body in the water), `despeckle`, `staggeredScales`, `topEdgeShine`, `furTufts`, `rimDetail` (a sprite's finishing passes), `smoothCurve`, `bodySpots`, `bodyPattern`, `coatColours`, `resampleList`, `blendRecords` (a genome made and mixed). `limbs`: `twoBoneLimb3d`. The top view draws the same pixels with them.

- `raster` (new): `ellipseRows`, `fillEllipse`, `capsuleSteps`, `lineCells`, `polygonRows`, `ditherEllipse`, `shadeEllipse`, `blitSprite`, `blitSway`, `outlinePass`, `cutSprite`, `drawnBounds` (drawing in whole pixels into a buffer of packed colours); `pixels`: `scalePacked`
- `sprites` (new): `outlineSprite`, `spriteFromRows`, `layTemplate`, `fillBetweenEdges`, `gridPixels`, `packSheet` (sprites from letters and templates), `leafCrown`, `barkTrunk` (the parts of a plant)

- The top-down pixel world of OpenWorldBuilder's top view (vendored from 綴 Tsuzuri's 言の葉), its techniques as entries,
  each giving the same numbers as the code it came from (the top view draws the same pixels with them, 0 different):
  - `pixels` (new): `packRgb`, `mixPacked`, `packedHsl`, `packedToHsl` (colours as an ImageData's 32-bit pixels),
    `hueShiftTone` (a pixel artist's hue-shifted shade), `bayerThreshold` (ordered dithering), `ditheredBorder`;
  - `water` (new): `waterTime`, `waterPixel` (water seen from above: foam, swells, ripples, glints, shallows, weed);
  - `land`: `levelCut` (the height a share of the land lies below), `heightWater` (lower is water, higher is ground),
    `wanderingHeading` (a path that wanders by itself);
  - `noise`: `noiseTile` (value noise that tiles); `random`: `latticeHash`, `linearCongruential`; `numbers`:
    `angleDiff`.
- Six references, each checked at its source: ordered dithering, the probit, linear congruential generators,
  ImageData, endianness, and Slynyrd's colour palettes (hue shift along a ramp).

- `crossGenomes`: a child's genes from two parents of one kind (each number mixed between theirs, each choice one
  parent's, a rare mutation that never leaves the kind); OpenGameBuilder's creatures breed with it.
- `tracePart`: a figure part's outline, for drawing over a part clipped to it (drawParts' markings hook; OpenWorldBuilder
  draws its creatures' bellies, spots and stripes with it).
- `drawList`: a display list, a drawing given as data (shapes in the canvas's own path commands, fills and strokes,
  groups that move, blend or shade them) and drawn by one function; OpenWorldBuilder's bodies are described this way.

## [0.2.0] - 2026-10-17

### Added

- 61 techniques ported from OpenWorldBuilder's engine, each giving the same numbers (and, for drawing, the same
  pixels) as the code it came from:
  - basics, noise and colour: `clamp`, `lerp`, `smoothstep`, `wrap`, `indexRandom`, `SeededRandom.sign`,
    `latticeRandom`, `valueNoise`, `fractalNoise`, `ridgedNoise`, `noiseLine`, `hexToRgb`, `rgbToHex`, `rgba`,
    `mixColour`, `shade`, `luma`, `rgbToHsl`, `hslToRgb`, `hueToward`, `gradeColour`;
  - light, land, scattering and projection: `dayCycle`, `aerialPerspective`, `twinkle`, `hillLine`, `islandHeight`,
    `scatterAlong`, `windowLit`, `blink`, `parallax`, `turnedProjection`, `turnedDepth`, `faceShade`;
  - motion and particles: `flockStep`, `gridWalk`, `pulseRise`, `particleField`, `fall`, `rise`, `hover`,
    `wrapAround`;
  - growth: `branchingTree`, `swayingChain`;
  - drawing: `setCanvasMaker`, `makeCanvas`, `stampCache`, `partPath`, `fillInArt`, `drawRecipe`, `grain`, `vignette`,
    `glowSprite`, `glowingDisc`, `lightRays`, `fogBands`, `mirrorBelow`, `puffCloud`, `inkedLine`, `tones`,
    `drawParts`;
  - readable seeds: `seedOf`, `seedWords`.
- 44 more references, each checked at its source; two gallery pictures (hills, growth).
- The checks in a file per module; the test run holds each check to its module's file and needs the catalog to know
  how every entry is called.

## [0.1.0] - 2026-10-17

### Added

- The first entries. Established: `hash32`, `fnv1a`, `hashString`, `SeededRandom`, `twoBoneLimb`, `gaitTiming`.
  Original: `footStep`, `strideRate`, `genomeFrom`.
- The catalog (`CATALOG.md`), the gallery (footfall diagrams of every gait; a leg stepping and walking), the
  bibliography in CSL-JSON, and the checks, each a sentence the catalog lists.
