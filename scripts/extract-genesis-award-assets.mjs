import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const inputPath = process.argv[2] ?? String.raw`C:\Users\USER\Downloads\Роскошная сетка золотых трофеев.png`;
const outputDirectory = path.resolve('public/assets/season/genesis/rewards');
const outputSize = 512;
const padding = 20;
const backgroundColor = { r: 0, g: 0, b: 0, alpha: 0 };
const assets = [
  // Crops avoid the source sheet's intentional overlap across row boundaries.
  { name: 'unboxing-podium.webp', column: 0, top: 230, bottom: 490 },
  { name: 'quicksell-bolt.webp', column: 1, top: 0, bottom: 455 },
  { name: 'auction-gavel.webp', column: 2, top: 0, bottom: 465 },
  { name: 'verified-seal.webp', column: 0, top: 490, bottom: 1024 },
  { name: 'trophy-gold.webp', column: 1, top: 460, bottom: 1024 },
  { name: 'trophies-silver-bronze.webp', column: 2, top: 490, bottom: 1024 },
];

function isBackdropPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  const chroma = maximum - minimum;
  const brightness = (red + green + blue) / 3;

  if (alpha === 0) return true;
  // The sheet has a white background and low-chroma grey contact shadows.
  // Gold highlights remain protected by their higher channel spread.
  return (brightness >= 188 && chroma <= 62) || (brightness >= 118 && chroma <= 30);
}

function removeEdgeBackdrop(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;
  let removed = 0;

  const enqueue = (x, y) => {
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;
    const offset = pixelIndex * 4;
    if (!isBackdropPixel(data, offset)) return;
    queue[tail++] = pixelIndex;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
    removed += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  return removed;
}

async function main() {
  const source = await sharp(inputPath).rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cellWidth = Math.floor(source.info.width / 3);
  const cellHeight = Math.floor(source.info.height / 2);
  if (cellWidth < 1 || cellHeight < 1) throw new Error(`Image is too small for a 3x2 sheet: ${source.info.width}x${source.info.height}`);
  await fs.mkdir(outputDirectory, { recursive: true });

  for (const asset of assets) {
    const left = asset.column * cellWidth;
    const top = asset.top;
    const width = asset.column === 2 ? source.info.width - left : cellWidth;
    const height = Math.min(source.info.height, asset.bottom) - top;
    const crop = await sharp(source.data, { raw: source.info }).extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true });
    const removedPixels = removeEdgeBackdrop(crop.data, crop.info.width, crop.info.height);
    const trimmed = await sharp(crop.data, { raw: crop.info })
      .trim({ background: backgroundColor, threshold: 0 })
      .resize({ width: outputSize - padding * 2, height: outputSize - padding * 2, fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    const canvas = await sharp({
      create: { width: outputSize, height: outputSize, channels: 4, background: backgroundColor },
    })
      .composite([{
        input: trimmed.data,
        left: Math.round((outputSize - trimmed.info.width) / 2),
        top: Math.round((outputSize - trimmed.info.height) / 2),
      }])
      .webp({ quality: 91, alphaQuality: 100, effort: 6 })
      .toBuffer();
    const destination = path.join(outputDirectory, asset.name);
    await fs.writeFile(destination, canvas);
    const verified = await sharp(canvas).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cornerOffsets = [0, (outputSize - 1) * 4, (outputSize * (outputSize - 1)) * 4, (outputSize * outputSize - 1) * 4];
    if (cornerOffsets.some((offset) => verified.data[offset + 3] !== 0)) {
      throw new Error(`${asset.name} has a non-transparent canvas corner`);
    }
    let visiblePixels = 0;
    for (let offset = 3; offset < verified.data.length; offset += 4) {
      if (verified.data[offset] > 0) visiblePixels += 1;
    }
    if (visiblePixels === 0) throw new Error(`${asset.name} is empty after background removal`);
    const metadata = await sharp(canvas).metadata();
    console.log(`${asset.name}: ${metadata.width}x${metadata.height}, transparent corners verified, ${visiblePixels} visible pixels, flood-fill removed ${removedPixels} pixels`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
