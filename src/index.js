// procedural-almanac: every technique, one import. What each one is, where it comes from and how it is tested:
// CATALOG.md.
export { clamp, lerp, smoothstep, wrap, angleDiff } from './numbers.js';
export { hash32, fnv1a, hashString, indexRandom, SeededRandom, latticeHash, linearCongruential } from './random.js';
export { latticeRandom, valueNoise, fractalNoise, ridgedNoise, noiseLine, noiseTile } from './noise.js';
export {
  packRgb,
  mixPacked,
  packedHsl,
  packedToHsl,
  hueShiftTone,
  bayerThreshold,
  ditheredBorder,
  scalePacked,
} from './pixels.js';
export { waterTime, waterPixel } from './water.js';
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
} from './colour.js';
export { dayCycle, aerialPerspective, twinkle, hourLight, hourTables, gradeFrame } from './light.js';
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
} from './land.js';
export { scatterAlong, windowLit, blink } from './scatter.js';
export {
  parallax,
  turnedProjection,
  turnedDepth,
  faceShade,
  obliqueShear,
  obliqueToScreen,
  obliqueToGround,
} from './projection.js';
export { flockStep, gridWalk, pulseRise, fleeVector, formationSlot } from './motion.js';
export { particleField, fall, rise, hover, wrapAround } from './particles.js';
export { branchingTree, swayingChain } from './growth.js';
export { setCanvasMaker, makeCanvas, stampCache } from './canvas.js';
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
} from './drawing.js';
export { tones, drawParts, tracePart, partOutline } from './parts.js';
export { drawList } from './display.js';
export { twoBoneLimb, twoBoneLimb3d } from './limbs.js';
export { footStep, strideRate, gaitTiming } from './gait.js';
export { genomeFrom, crossGenomes } from './genes.js';
export { seedOf, seedWords } from './seeds.js';
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
} from './raster.js';
export {
  outlineSprite,
  spriteFromRows,
  layTemplate,
  fillBetweenEdges,
  gridPixels,
  packSheet,
  leafCrown,
  barkTrunk,
} from './sprites.js';
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
} from './bodies.js';
export { cloudShadows, fogBanks, frontStrength, lightningFlash } from './weather.js';
export { gridAStar, nearestFreeCell, segmentClear, straightenPath, floodFill, untilSettled } from './paths.js';
export { roofPlan, slopeShade, roofTexel } from './roofs.js';
export { terraceLevel, wallShade, leafShade, crownRows, silhouetteNormals, crownClumps } from './relief.js';
