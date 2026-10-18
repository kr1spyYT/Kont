import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [inputPath, outputPath = 'public/assets/season/genesis'] = process.argv.slice(2);
if (!inputPath) {
  console.error('Usage: node scripts/extract-season-assets.mjs <season-mockup.png> [output-directory]');
  process.exit(2);
}

const outputDir = path.resolve(outputPath);
await fs.mkdir(outputDir, { recursive: true });
const source = sharp(path.resolve(inputPath), { limitInputPixels: 40_000_000, failOn: 'error' }).rotate();
const metadata = await source.metadata();
if (metadata.width !== 1024 || metadata.height !== 1536) {
  console.warn(`Reference image is ${metadata.width}x${metadata.height}; crop coordinates are designed for 1024x1536.`);
}

const crops = [
  { name: 'hero-genesis-case', left: 526, top: 126, width: 444, height: 258, keepBackdrop: true },
  { name: 'final-genesis-case', left: 405, top: 1172, width: 216, height: 145 },
  { name: 'season-crown', left: 78, top: 137, width: 76, height: 72 },
  { name: 'free-pass-crest', left: 64, top: 415, width: 67, height: 76 },
  { name: 'vip-pass-crest', left: 635, top: 415, width: 68, height: 76 },
  { name: 'vip-license-frame', left: 429, top: 829, width: 166, height: 60 },
  { name: 'reward-coin-silver', left: 77, top: 513, width: 76, height: 63 },
  { name: 'reward-key-silver', left: 79, top: 583, width: 76, height: 61 },
  { name: 'reward-case-silver', left: 71, top: 655, width: 78, height: 64 },
  { name: 'reward-xp-silver', left: 78, top: 884, width: 65, height: 66 },
  { name: 'reward-case-gold', left: 641, top: 511, width: 76, height: 65 },
  { name: 'reward-key-gold', left: 642, top: 583, width: 78, height: 63 },
  { name: 'reward-coin-gold', left: 642, top: 653, width: 77, height: 64 },
  { name: 'reward-xp-gold', left: 643, top: 730, width: 73, height: 67 },
];

function maxChannelDistance(data, offset, color, channels) {
  return Math.max(Math.abs(data[offset] - color[0]), Math.abs(data[offset + 1] - color[1]), Math.abs(data[offset + 2] - color[2]));
}

function removeConnectedBackdrop(raw, tolerance = 46) {
  const { data, info } = raw;
  if (info.channels !== 4) return raw;
  const points = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1];
  const samples = points.map((index) => {
    const offset = index * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  });
  const avg = [0, 1, 2].map((c) => Math.round(samples.reduce((sum, color) => sum + color[c], 0) / samples.length));
  if (samples.some((color) => Math.max(...color.map((v, c) => Math.abs(v - avg[c]))) > 52)) return raw;
  const total = info.width * info.height;
  const visited = new Uint8Array(total);
  const queue = new Uint32Array(total);
  let head = 0;
  let tail = 0;
  const seed = (index) => {
    if (index < 0 || index >= total || visited[index]) return;
    const offset = index * 4;
    if (data[offset + 3] <= 8 || maxChannelDistance(data, offset, avg, info.channels) > tolerance) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < info.width; x += 1) {
    seed(x);
    seed((info.height - 1) * info.width + x);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    seed(y * info.width);
    seed(y * info.width + info.width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const offset = index * 4;
    data[offset + 3] = 0;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (x > 0) seed(index - 1);
    if (x + 1 < info.width) seed(index + 1);
    if (y > 0) seed(index - info.width);
    if (y + 1 < info.height) seed(index + info.width);
  }
  return raw;
}

for (const crop of crops) {
  const extracted = sharp(path.resolve(inputPath)).extract({
    left: crop.left,
    top: crop.top,
    width: crop.width,
    height: crop.height,
  });
  let input = await extracted.png().toBuffer();
  if (!crop.keepBackdrop) {
    const raw = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    input = await sharp(removeConnectedBackdrop(raw).data, { raw: raw.info })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
      .png()
      .toBuffer();
  }
  await sharp(input)
    .resize(320, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(path.join(outputDir, `${crop.name}.webp`));
}

console.log(`Generated ${crops.length} WebP season assets in ${outputDir}`);
