// procedural-almanac: every technique, one import. What each one is, where it comes from and how it is tested:
// CATALOG.md.
export { clamp, lerp, smoothstep, wrap, angleDiff } from './core/numbers.js';
export { hash32, fnv1a, hashString, indexRandom, SeededRandom, latticeHash, linearCongruential } from './core/random.js';
export { latticeRandom, valueNoise, fractalNoise, ridgedNoise, noiseLine, noiseTile } from './core/noise.js';
export {
  packRgb,
  mixPacked,
  packedHsl,
  packedToHsl,
  hueShiftTone,
  bayerThreshold,
  ditheredBorder,
  scalePacked,
} from './pixels/pixels.js';
export { waterTime, waterPixel } from './world/water.js';
export {
  hexToRgb,
  rgbToHex,
  rgba,
  mixColour,
  shade,
  luma,
  rgbToHsl,
  hslToRgb,
  hueToward,
  gradeColour,
} from './core/colour.js';
export { dayCycle, aerialPerspective, twinkle, hourLight, hourTables, gradeFrame } from './sky/light.js';
export {
  hillLine,
  islandHeight,
  levelCut,
  heightWater,
  wanderingHeading,
  chamferDistance,
  wobbledRing,
  mountainRise,
  windingRiver,
  plotGrid,
} from './world/land.js';
export { scatterAlong, windowLit, blink } from './world/scatter.js';
export {
  parallax,
  turnedProjection,
  turnedDepth,
  faceShade,
  obliqueShear,
  obliqueToScreen,
  obliqueToGround,
} from './world/projection.js';
export { flockStep, gridWalk, pulseRise, fleeVector, formationSlot } from './creatures/motion.js';
export { particleField, fall, rise, hover, wrapAround } from './creatures/particles.js';
export { branchingTree, swayingChain } from './world/growth.js';
export { setCanvasMaker, makeCanvas, stampCache } from './canvas/canvas.js';
export {
  partPath,
  fillInArt,
  drawRecipe,
  grain,
  vignette,
  glowSprite,
  glowingDisc,
  lightRays,
  fogBands,
  mirrorBelow,
  puffCloud,
  inkedLine,
} from './canvas/drawing.js';
export { tones, drawParts, tracePart, partOutline } from './canvas/parts.js';
export { drawList } from './canvas/display.js';
export { twoBoneLimb, twoBoneLimb3d } from './creatures/limbs.js';
export { footStep, strideRate, gaitTiming } from './creatures/gait.js';
export { genomeFrom, crossGenomes } from './creatures/genes.js';
export { seedOf, seedWords } from './core/seeds.js';
export {
  ellipseRows,
  fillEllipse,
  capsuleSteps,
  lineCells,
  polygonRows,
  ditherEllipse,
  shadeEllipse,
  blitSprite,
  blitSway,
  outlinePass,
  cutSprite,
  drawnBounds,
} from './pixels/raster.js';
export {
  outlineSprite,
  spriteFromRows,
  layTemplate,
  fillBetweenEdges,
  gridPixels,
  packSheet,
  leafCrown,
  barkTrunk,
} from './pixels/sprites.js';
export {
  followJoint,
  dampedSpring,
  footSwing,
  footReady,
  floatHeight,
  waterlineCut,
  depthUnderCut,
  despeckle,
  staggeredScales,
  topEdgeShine,
  furTufts,
  rimDetail,
  smoothCurve,
  bodySpots,
  bodyPattern,
  coatColours,
  resampleList,
  blendRecords,
} from './creatures/bodies.js';
export { cloudShadows, fogBanks, frontStrength, lightningFlash } from './sky/weather.js';
export { gridAStar, nearestFreeCell, segmentClear, straightenPath, floodFill, untilSettled } from './world/paths.js';
export { roofPlan, slopeShade, roofTexel } from './world/roofs.js';
export { terraceLevel, wallShade, leafShade, crownRows, silhouetteNormals, crownClumps } from './world/relief.js';
