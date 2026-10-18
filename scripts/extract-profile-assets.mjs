import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [inputPath, outputPath = 'public/assets/profile'] = process.argv.slice(2);
if (!inputPath) {
  throw new Error('Usage: node scripts/extract-profile-assets.mjs <profile-sprite-sheet> [output-directory]');
}

const sourcePath = path.resolve(inputPath);
const outputDir = path.resolve(outputPath);
const reference = { width: 1_536, height: 1_024 };
const sourceBuffer = await sharp(sourcePath, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate().toBuffer();
const sourceMetadata = await sharp(sourceBuffer).metadata();
if (!sourceMetadata.width || !sourceMetadata.height) throw new Error('Could not read source sprite dimensions.');
const scaleX = sourceMetadata.width / reference.width;
const scaleY = sourceMetadata.height / reference.height;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const cropRect = ({ left, top, width, height }) => ({
  left: Math.max(0, Math.round(left * scaleX)),
  top: Math.max(0, Math.round(top * scaleY)),
  width: Math.min(sourceMetadata.width - Math.round(left * scaleX), Math.round(width * scaleX)),
  height: Math.min(sourceMetadata.height - Math.round(top * scaleY), Math.round(height * scaleY)),
});

function isConnectedLightBackdrop(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  const brightness = (red + green + blue) / 3;
  return minimum >= 174 && brightness >= 188 && maximum - minimum <= 52;
}

function removeEdgeBackdrop(raw, name) {
  const { data, info } = raw;
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`${name}: expected RGBA pixels.`);

  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;
  let removed = 0;
  let edgeBackdropSeeds = 0;
  const seed = (index) => {
    if (index < 0 || index >= pixelCount || visited[index]) return;
    const offset = index * channels;
    if (data[offset + 3] <= 8 || !isConnectedLightBackdrop(data, offset)) return;
    visited[index] = 1;
    queue[tail++] = index;
    edgeBackdropSeeds += 1;
  };

  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const offset = index * channels;
    data[offset + 3] = 0;
    removed += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) seed(index - 1);
    if (x + 1 < width) seed(index + 1);
    if (y > 0) seed(index - width);
    if (y + 1 < height) seed(index + width);
  }

  if (!edgeBackdropSeeds || !removed) throw new Error(`${name}: no connected light backdrop found; refusing to save an unprocessed crop.`);
  return removed;
}

async function cleanRect(rect, name) {
  const bounded = cropRect(rect);
  if (bounded.width < 2 || bounded.height < 2) throw new Error(`${name}: crop falls outside the source image.`);
  const raw = await sharp(sourceBuffer, { limitInputPixels: 40_000_000, failOn: 'error' })
    .extract(bounded)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const removed = removeEdgeBackdrop(raw, name);
  const trimmed = await sharp(raw.data, { raw: raw.info })
    .trim({ background: transparent, threshold: 0 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  const trimmedMetadata = await sharp(trimmed).metadata();
  if (!trimmedMetadata.width || !trimmedMetadata.height) throw new Error(`${name}: transparent trim removed the full crop.`);
  return { buffer: trimmed, removed, width: trimmedMetadata.width, height: trimmedMetadata.height };
}

async function saveContain(name, cleaned, width, height) {
  const outputFile = path.join(outputDir, name);
  await sharp(cleaned.buffer)
    .resize({ width, height, fit: 'contain', position: 'centre', background: transparent })
    .webp({ quality: 91, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(outputFile);
  const metadata = await sharp(outputFile).metadata();
  const size = (await fs.stat(outputFile)).size;
  console.log(`${name}: ${metadata.width}x${metadata.height}, ${size.toLocaleString('en-US')} bytes, removed ${cleaned.removed.toLocaleString('en-US')} connected background pixels.`);
  return outputFile;
}

async function saveCombinedSlot(name, itemRect, itemBox) {
  const item = await cleanRect(itemRect, name);
  const base = await cleanRect({ left: 1_085, top: 805, width: 400, height: 145 }, `${name} platform`);
  const resizedItemBuffer = await sharp(item.buffer)
    .resize({ width: itemBox.width, height: itemBox.height, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const itemMetadata = await sharp(resizedItemBuffer).metadata();
  const itemWidth = itemMetadata.width ?? itemBox.width;
  const itemHeight = itemMetadata.height ?? itemBox.height;
  const itemLeft = Math.round((320 - itemWidth) / 2);
  const platformTop = 202;
  const itemTop = Math.max(0, platformTop - itemHeight + 4);
  const platformBuffer = await sharp(base.buffer)
    .resize({ width: 320, height: 118, fit: 'contain', background: transparent })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const outputFile = path.join(outputDir, name);
  await sharp({ create: { width: 320, height: 320, channels: 4, background: transparent } })
    .composite([
      { input: platformBuffer, left: 0, top: platformTop },
      { input: resizedItemBuffer, left: itemLeft, top: itemTop },
    ])
    .webp({ quality: 91, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(outputFile);
  const metadata = await sharp(outputFile).metadata();
  const size = (await fs.stat(outputFile)).size;
  console.log(`${name}: ${metadata.width}x${metadata.height}, ${size.toLocaleString('en-US')} bytes, combined with ${base.removed.toLocaleString('en-US')} cleaned platform-background pixels.`);
}

await fs.mkdir(outputDir, { recursive: true });

const directAssets = [
  { name: 'vip_member_card.webp', rect: { left: 38, top: 0, width: 470, height: 470 }, width: 720, height: 720 },
  { name: 'empty_car_podium.webp', rect: { left: 475, top: 145, width: 590, height: 280 }, width: 900, height: 460 },
  { name: 'pedestal_head.webp', rect: { left: 1_090, top: 100, width: 410, height: 370 }, width: 480, height: 480 },
  { name: 'pedestal_top.webp', rect: { left: 65, top: 510, width: 405, height: 450 }, width: 480, height: 480 },
  { name: 'pedestal_bottom.webp', rect: { left: 585, top: 510, width: 410, height: 450 }, width: 480, height: 480 },
  { name: 'pedestal_base.webp', rect: { left: 1_085, top: 805, width: 400, height: 145 }, width: 640, height: 240 },
];
for (const asset of directAssets) {
  const cleaned = await cleanRect(asset.rect, asset.name);
  await saveContain(asset.name, cleaned, asset.width, asset.height);
}

await saveCombinedSlot(
  'pedestal_shoes.webp',
  { left: 1_060, top: 640, width: 215, height: 175 },
  { width: 260, height: 185 },
);
await saveCombinedSlot(
  'pedestal_accessory.webp',
  { left: 1_260, top: 550, width: 220, height: 265 },
  { width: 210, height: 230 },
);

console.log(`Extracted 8 transparent profile assets from ${sourceMetadata.width}x${sourceMetadata.height} into ${outputDir}.`);
