// One seed, one island, filmed: the scene in scene.js rendered frame by frame in Node, written out as a GIF and an MP4
// (with ffmpeg), or as single frames. The same scene runs live in a browser in index.html.
//
//   node examples/island/island.mjs                        island.gif and island.mp4 beside this file (needs ffmpeg)
//   node examples/island/island.mjs --still 11 frame.png   one frame, at 11 seconds
//   node examples/island/island.mjs --sheet sheet.png      a frame every second, on one sheet
//   --seed <words>  another island (heron-bay-8)          --scale <n>  the GIF's screen pixels per pixel (2)
//   --start <s>     the second the film opens on (it loops; by default the whole island, by day)
import { island } from './scene.js';
import { deflateSync } from 'node:zlib';
import { writeFileSync, openSync, readSync, writeSync, closeSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// opt('--seed', d): the word after --seed on the command line, or d if it is not there
const argv = process.argv.slice(2),
  opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const scene = island(opt('--seed', 'heron-bay-8')),
  { W, H, FPS, DUR, frames } = scene,
  report = () => process.stderr.write(scene.report().join('\n') + '\n'); // the scene's account, printed at the end

/**
 * Writes pixels (packed, one 32-bit number each) to a PNG file, with nothing but Node's own zlib.
 *
 * How it works: a PNG is a signature and a list of chunks, each its length, its type, its data and a checksum (CRC-32).
 * The header (IHDR) gives the size and says the pixels are 8-bit RGBA. The pixels (IDAT) are the rows, each after a 0
 * byte that means "no filter", compressed with deflate. The pixels' bytes are already in R, G, B, A order, since a
 * packed colour 0xAABBGGRR is stored lowest byte first.
 */
function png(path, w, h, px) {
  // the CRC-32 table: for each byte, the remainder of its polynomial division (the standard 0xEDB88320 polynomial)
  const crcT = Array.from({ length: 256 }, (_, k) => {
    let c = k;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  // the CRC-32 of bytes b, a byte at a time through the table
  const crc = (b) => {
    let c = 0xffffffff;
    for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  // one chunk: its data's length, its type, its data, and the CRC of type and data
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type), data]),
      out = Buffer.alloc(td.length + 8);
    out.writeUInt32BE(data.length, 0);
    td.copy(out, 4);
    out.writeUInt32BE(crc(td), td.length + 4);
    return out;
  };
  const raw = Buffer.alloc((w * 4 + 1) * h),
    bytes = Buffer.from(px.buffer, px.byteOffset, px.byteLength);
  for (let y = 0; y < h; y++) bytes.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
// pixels w by h made s times larger, every pixel an s by s block (no smoothing, so the pixel art stays sharp)
const scaleUp = (px, w, h, s) => {
  const out = new Uint32Array(w * s * h * s);
  for (let y = 0; y < h * s; y++)
    for (let x = 0; x < w * s; x++) out[y * w * s + x] = px[((y / s) | 0) * w + ((x / s) | 0)];
  return out;
};
// one frame (--still), a sheet of frames (--sheet), or the whole film (the default)
if (argv.includes('--still')) {
  const t = +opt('--still', 10),
    f = Math.round(t * FPS);
  png(argv[argv.indexOf('--still') + 2] || 'frame.png', W * 2, H * 2, scaleUp(scene.frame(f), W, H, 2));
  report();
} else if (argv.includes('--sheet')) {
  const shots = [],
    times = opt('--at', '')
      ? opt('--at')
          .split(',')
          .map((s) => Math.round(+s * FPS))
      : null;
  for (let f = 0; f < frames; f++) {
    if (times ? times.includes(f) : f % FPS === FPS / 2) shots.push(scene.frame(f).slice());
  }
  const sheet = scene.A.packSheet(shots, W, H, +opt('--across', 4));
  png(opt('--sheet', 'sheet.png'), sheet.w, sheet.h, sheet.data);
  report();
} else {
  // the frames go to a file first, then ffmpeg reads it three times: for the GIF's palette, the GIF, and the MP4, so
  // nothing has to hold the whole film in memory
  const scale = +opt('--scale', 2),
    here = new URL('.', import.meta.url).pathname,
    gif = opt('--gif', here + 'island.gif'),
    mp4 = opt('--mp4', here + 'island.mp4'),
    dir = mkdtempSync(join(tmpdir(), 'island-')),
    raw = join(dir, 'frames.rgba'),
    pal = join(dir, 'palette.png'),
    fd = openSync(raw, 'w');
  for (let f = 0; f < frames; f++) {
    writeSync(fd, new Uint8Array(scene.frame(f).buffer));
    if (f % FPS === 0) process.stderr.write(`\r${f / FPS} s of ${DUR.toFixed(1)}`);
  }
  closeSync(fd);
  // the film loops, so it may start anywhere: by default where the island is first whole, in daylight (the first
  // frame is what a feed shows before it plays), going round through the night and back to the seed
  const start = Math.round(+opt('--start', scene.opening) * FPS) % frames,
    looped = join(dir, 'looped.rgba'),
    size = W * H * 4,
    chunk = Buffer.alloc(size * FPS),
    from = openSync(raw, 'r'),
    to = openSync(looped, 'w');
  // copy the frames from `start` to the end, then those before `start`, a second's worth at a time
  for (const [a, b] of [
    [start, frames],
    [0, start],
  ])
    for (let f = a; f < b; f += FPS) {
      const k = Math.min(FPS, b - f),
        got = readSync(from, chunk, 0, k * size, f * size);
      writeSync(to, chunk, 0, got);
    }
  closeSync(from);
  closeSync(to);
  const input = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', looped];
  // runs ffmpeg with the given arguments, quietly, and stops if it fails
  const ffmpeg = (...a) => {
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
    if (r.status) throw new Error('ffmpeg failed: ' + a.join(' '));
  };
  // a GIF holds at most 256 colours: first the best 256 for the whole film (palettegen), then the GIF made with them,
  // each pixel enlarged without smoothing and no dithering (paletteuse); then an MP4, four times as large
  ffmpeg(...input, '-vf', 'palettegen=max_colors=256:stats_mode=full', pal);
  ffmpeg(
    ...input,
    '-i',
    pal,
    '-filter_complex',
    `[0:v]scale=iw*${scale}:ih*${scale}:flags=neighbor[s];[s][1:v]paletteuse=dither=none:diff_mode=rectangle`,
    '-loop',
    '0',
    gif,
  );
  ffmpeg(
    ...input,
    '-vf',
    'scale=iw*4:ih*4:flags=neighbor',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '14',
    '-preset',
    'slow',
    mp4,
  );
  rmSync(dir, { recursive: true });
  process.stderr.write(`\n${gif}\n${mp4}\n`);
  report();
}
