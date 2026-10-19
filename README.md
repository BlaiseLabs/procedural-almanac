# procedural-almanac

Procedural drawing and motion for the canvas: walk cycles, flocks, noise-made land, light and projection, where every
technique cites where it came from.

Version 0.2 holds 72 techniques, 36 established and 36 original, citing 60 sources and held by 150 checks. The full
list, with every source and every test, is the [catalog](CATALOG.md).

| module                   | techniques                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `numbers`                | clamp, lerp, smoothstep, wrap, angleDiff                                                                                          |
| `random`                 | hash32, fnv1a, hashString, indexRandom, SeededRandom, latticeHash, linearCongruential                                             |
| `noise`                  | latticeRandom, valueNoise, fractalNoise, ridgedNoise, noiseLine, noiseTile                                                        |
| `colour`                 | hexToRgb, rgbToHex, rgba, mixColour, shade, luma, rgbToHsl, hslToRgb, hueToward, gradeColour                                      |
| `pixels`                 | packRgb, mixPacked, packedHsl, packedToHsl, hueShiftTone, bayerThreshold, ditheredBorder                                          |
| `light`                  | dayCycle, aerialPerspective, twinkle                                                                                              |
| `water`                  | waterTime, waterPixel                                                                                                             |
| `land`                   | hillLine, islandHeight, levelCut, heightWater, wanderingHeading                                                                   |
| `scatter`                | scatterAlong, windowLit, blink                                                                                                    |
| `projection`             | parallax, turnedProjection, turnedDepth, faceShade                                                                                |
| `limbs`, `gait`, `genes` | twoBoneLimb; footStep, strideRate, gaitTiming; genomeFrom, crossGenomes                                                           |
| `motion`                 | flockStep, gridWalk, pulseRise                                                                                                    |
| `particles`              | particleField, fall, rise, hover, wrapAround                                                                                      |
| `growth`                 | branchingTree, swayingChain                                                                                                       |
| `drawing`                | partPath, fillInArt, drawRecipe, grain, vignette, glowSprite, glowingDisc, lightRays, fogBands, mirrorBelow, puffCloud, inkedLine |
| `parts`                  | tones, drawParts, tracePart                                                                                                       |
| `display`                | drawList                                                                                                                          |
| `canvas`                 | setCanvasMaker, makeCanvas, stampCache                                                                                            |
| `seeds`                  | seedOf, seedWords                                                                                                                 |

## What it is

An almanac: a catalog of techniques, each one a function you can import and use without reading its math, and each
one telling you where to read the math if you want to.

- **Established techniques** are someone else's work, and cite it: an _intro_ to start from (often an encyclopedia
  article) and the _source_ it comes from (a paper, a book, a standard, published code).
- **Originals** are this almanac's own. With nothing to cite, they explain themselves: their purpose, what inspired
  them, which established techniques they build on, and how they work in plain words.
- **Every entry lists its tests** as sentences ("when the point is in reach, the tip lands on it"), and the test run
  fails if a sentence in the catalog is not a real check, or a check is not in the catalog.

![Footfall diagrams of every gait](gallery/gaits.svg)

## Who it is for

- **Creative coders and generative artists** who want proven techniques (a limb that steps, legs that keep a gait)
  without deriving the math again.
- **Indie game developers** drawing in 2D who want characters and scenery made from code instead of sprite sheets.
- **Learners** who want to understand a technique: every entry starts at a plain explanation and leads to the source.
- **Programs that build worlds as data**, including ones written by language models: they need primitives with clear
  names and clear documentation.

## What it is not

Not a game engine, not physics, not 3D or WebGL, and not a framework that owns your render loop. These are functions
you call, with your own canvas, at your own pace.

## Use it

Plain ES modules, no dependencies, no build step: it runs in any modern browser and in Node 18 or later. In Node,
the drawing techniques need a canvas: tell the almanac how to make one, once (`setCanvasMaker`, with
[@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) for example).

```js
import { SeededRandom, genomeFrom, gaitTiming, footStep, strideRate, twoBoneLimb } from 'procedural-almanac';

// a deer: its leg length and gait drawn from its kind's ranges, the same deer every time from the same seed
const deer = genomeFrom({ leg: [6, 8], gait: ['walk', 'trot'] }, new SeededRandom('deer 1'));
const stride = deer.leg * 0.42,
  lift = deer.leg * 0.22,
  rate = strideRate(stride), // the walk's phase per unit walked, so planted feet end where they landed
  [fore] = gaitTiming(deer.gait); // the phase of each leg, pair by pair

// the near fore leg, when the deer has walked `distance`: its hip, knee and foot
function foreLeg(distance, hip) {
  const step = footStep(distance * rate + fore.near, stride, lift);
  return twoBoneLimb(hip, { x: hip.x + step.x, y: step.y }, deer.leg * 0.54, deer.leg * 0.54, -1);
}
const { knee, foot } = foreLeg(10, { x: 10, y: deer.leg });
```

In a browser without a bundler, one line of import map tells it where the almanac is:

```html
<script type="importmap">
  { "imports": { "procedural-almanac": "./node_modules/procedural-almanac/src/index.js" } }
</script>
```

## How it is organised

| file                     | what it holds                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`                   | the techniques; each one's doc comment (JSDoc) names its references with `@see`, and a step inside one can cite its own (`[law-of-cosines-wikipedia]`)               |
| `almanac.json`           | the entries: for each technique, its kind and what the catalog says about it                                                                                         |
| `references.json`        | the bibliography, in [CSL-JSON](https://citationstyles.org/), the format reference managers such as Zotero read and write                                            |
| `tests/checks/`          | every check, one sentence each, the same sentences the entries list, a file per module; the drawing checks read real pixels (@napi-rs/canvas, a dev dependency only) |
| `tests/run.mjs`          | `npm test`: the checks, then the almanac held to itself (below)                                                                                                      |
| `CATALOG.md`, `gallery/` | written from the above by `npm run docs`                                                                                                                             |

`npm test` fails when any of these is true:

- an export has no entry, or an entry no export;
- an established entry cites nothing, or an original lacks its purpose, inspiration or plain-words description;
- a reference is named that does not exist, or one exists that nothing cites;
- the code's `@see` lines and its entry disagree;
- a test sentence is not a real check, or a check is not listed;
- this README's example does not run;
- the catalog or the gallery is out of date.

## Standards it follows

[CSL-JSON](https://citationstyles.org/) for references, [JSDoc](https://jsdoc.app/) for doc comments,
[Citation File Format](https://citation-file-format.github.io/) for citing the almanac itself (`CITATION.cff`),
[Semantic Versioning](https://semver.org/) and [Keep a Changelog](https://keepachangelog.com/) for releases, and an
[SPDX](https://spdx.org/licenses/) licence identifier.

## Contributing

A better reference is welcome: it is a change to `references.json` and the entry that cites it. A new technique is its
code, its entry and its checks; `npm test` says what is missing. If something here is called original but is in fact
established, that is the most useful correction of all: show the source, and it moves.

## Licence

[MIT](LICENSE).
