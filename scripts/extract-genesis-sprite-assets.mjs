import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [inputPath, outputPath = 'public/assets/season/genesis'] = process.argv.slice(2);
if (!inputPath) {
  throw new Error('Usage: node scripts/extract-genesis-sprite-assets.mjs <2x2-sprite-image> [output-directory]');
}

const sourcePath = path.resolve(inputPath);
const outputDir = path.resolve(outputPath);
const sourceBuffer = await sharp(sourcePath, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate().toBuffer();
const { width, height } = await sharp(sourceBuffer).metadata();
if (!width || !height || width < 2 || height < 2) {
  throw new Error('The sprite image must be at least 2x2 pixels.');
}

const midX = Math.floor(width / 2);
const midY = Math.floor(height / 2);
const quadrants = [
  { name: 'vip-briefcase.webp', column: 0, row: 0, bottomShadowStart: 0.88, lowerZoneClearStart: 0.88, shadowFadeStart: 0.94 },
  { name: 'genesis-vip-plate.webp', column: 1, row: 0, bottomShadowStart: 0.9, lowerZoneClearStart: 0.9, shadowFadeStart: 0.96 },
  { name: 'currency-key-bundle.webp', column: 0, row: 1, bottomShadowStart: 0.97, lowerZoneClearStart: 0.97, shadowFadeStart: 1 },
  { name: 'genesis-archive-chest.webp', column: 1, row: 1, bottomShadowStart: 0.58, lowerZoneClearStart: 0.58, shadowFadeStart: 0.82 },
];

function isLightBackdrop(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return Math.min(red, green, blue) >= 205 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 50;
}

function isNeutralContactShadow(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  const brightness = (red + green + blue) / 3;
  return chroma < 28 && brightness > 95;
}

function removeConnectedBackdrop(raw, name, bottomShadowStart, lowerZoneClearStart, shadowFadeStart) {
  const { data, info } = raw;
  const { width: imageWidth, height: imageHeight, channels } = info;
  if (channels !== 4) throw new Error(`${name}: expected RGBA pixels after ensureAlpha().`);

  const step = Math.max(1, Math.floor(Math.max(imageWidth, imageHeight) / 220));
  let edgeSamples = 0;
  let lightEdgeSamples = 0;
  const sampleEdge = (x, y) => {
    const offset = (y * imageWidth + x) * channels;
    if (data[offset + 3] <= 16) return;
    edgeSamples += 1;
    if (isLightBackdrop(data, offset)) lightEdgeSamples += 1;
  };
  for (let x = 0; x < imageWidth; x += step) {
    sampleEdge(x, 0);
    sampleEdge(x, imageHeight - 1);
  }
  for (let y = step; y < imageHeight - step; y += step) {
    sampleEdge(0, y);
    sampleEdge(imageWidth - 1, y);
  }
  if (!edgeSamples || lightEdgeSamples / edgeSamples < 0.5) {
    throw new Error(`${name}: the crop does not have the expected light background on its outer edges.`);
  }

  const pixelCount = imageWidth * imageHeight;
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;
  let removed = 0;
  const seed = (index) => {
    if (index < 0 || index >= pixelCount || visited[index]) return;
    const offset = index * channels;
    if (data[offset + 3] <= 16 || !isLightBackdrop(data, offset)) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < imageWidth; x += 1) {
    seed(x);
    seed((imageHeight - 1) * imageWidth + x);
  }
  for (let y = 1; y < imageHeight - 1; y += 1) {
    seed(y * imageWidth);
    seed(y * imageWidth + imageWidth - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const offset = index * channels;
    data[offset + 3] = 0;
    removed += 1;

    const x = index % imageWidth;
    const y = Math.floor(index / imageWidth);
    if (x > 0) seed(index - 1);
    if (x + 1 < imageWidth) seed(index + 1);
    if (y > 0) seed(index - imageWidth);
    if (y + 1 < imageHeight) seed(index + imageWidth);
  }

  const shadowStartY = Math.floor(imageHeight * bottomShadowStart);
  const shadowVisited = new Uint8Array(pixelCount);
  const shadowQueue = new Uint32Array(pixelCount);
  let shadowHead = 0;
  let shadowTail = 0;
  let removedShadow = 0;
  const seedShadow = (index) => {
    if (index < 0 || index >= pixelCount || shadowVisited[index]) return;
    const x = index % imageWidth;
    const y = Math.floor(index / imageWidth);
    if (y < shadowStartY) return;
    const offset = index * channels;
    if (data[offset + 3] <= 16 || !isNeutralContactShadow(data, offset)) return;
    shadowVisited[index] = 1;
    shadowQueue[shadowTail] = index;
    shadowTail += 1;
  };

  for (let y = shadowStartY; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const index = y * imageWidth + x;
      const offset = index * channels;
      if (data[offset + 3] <= 16 || !isNeutralContactShadow(data, offset)) continue;
      const touchesTransparent = x === 0 || x === imageWidth - 1 || y === imageHeight - 1
        || (x > 0 && data[offset - channels + 3] <= 16)
        || (x + 1 < imageWidth && data[offset + channels + 3] <= 16)
        || (y > 0 && data[offset - imageWidth * channels + 3] <= 16)
        || (y + 1 < imageHeight && data[offset + imageWidth * channels + 3] <= 16);
      if (touchesTransparent) seedShadow(index);
    }
  }

  while (shadowHead < shadowTail) {
    const index = shadowQueue[shadowHead];
    shadowHead += 1;
    const offset = index * channels;
    data[offset + 3] = 0;
    removedShadow += 1;

    const x = index % imageWidth;
    const y = Math.floor(index / imageWidth);
    if (x > 0) seedShadow(index - 1);
    if (x + 1 < imageWidth) seedShadow(index + 1);
    if (y > 0) seedShadow(index - imageWidth);
    if (y + 1 < imageHeight) seedShadow(index + imageWidth);
  }

  let removedPockets = 0;
  const lowerZoneClearY = Math.floor(imageHeight * lowerZoneClearStart) + 1;
  for (let y = lowerZoneClearY; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const offset = (y * imageWidth + x) * channels;
      if (data[offset + 3] <= 16) continue;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      const brightness = (red + green + blue) / 3;
      const isGold = red - blue > 32 && green - blue > 15;
      if (!isGold && chroma <= 25 && brightness >= 75) {
        data[offset + 3] = 0;
        removedPockets += 1;
      }
    }
  }

  let softenedShadow = 0;
  const shadowFadeY = Math.floor(imageHeight * shadowFadeStart) + 1;
  for (let y = shadowFadeY; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const offset = (y * imageWidth + x) * channels;
      if (data[offset + 3] <= 16) continue;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      const brightness = (red + green + blue) / 3;
      if (chroma <= 20 && brightness >= 45 && brightness <= 75) {
        data[offset] = 10;
        data[offset + 1] = 10;
        data[offset + 2] = 12;
        data[offset + 3] = Math.round(data[offset + 3] * 0.25);
        softenedShadow += 1;
      }
    }
  }

  if (!removed) throw new Error(`${name}: no edge-connected white/light-gray background was removed.`);
  let visiblePixels = 0;
  for (let offset = 3; offset < data.length; offset += channels) {
    if (data[offset] > 16) visiblePixels += 1;
  }
  if (!visiblePixels) throw new Error(`${name}: background removal erased the full crop.`);

  return { removed, removedShadow, removedPockets, softenedShadow, visiblePixels };
}

await fs.mkdir(outputDir, { recursive: true });
for (const quadrant of quadrants) {
  const left = quadrant.column === 0 ? 0 : midX;
  const top = quadrant.row === 0 ? 0 : midY;
  const cropWidth = quadrant.column === 0 ? midX : width - midX;
  const cropHeight = quadrant.row === 0 ? midY : height - midY;
  const raw = await sharp(sourceBuffer, { limitInputPixels: 40_000_000, failOn: 'error' })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { removed, removedShadow, removedPockets, softenedShadow, visiblePixels } = removeConnectedBackdrop(raw, quadrant.name, quadrant.bottomShadowStart, quadrant.lowerZoneClearStart, quadrant.shadowFadeStart);
  const trimmed = await sharp(raw.data, { raw: raw.info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .resize({ width: 1_120, height: 1_120, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  const trimmedMetadata = await sharp(trimmed).metadata();
  const padding = Math.max(16, Math.round(Math.min(trimmedMetadata.width ?? 1, trimmedMetadata.height ?? 1) * 0.035));
  const outputFile = path.join(outputDir, quadrant.name);
  await sharp(trimmed)
    .extend({ top: padding, right: padding, bottom: padding, left: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toFile(outputFile);
  const outputMetadata = await sharp(outputFile).metadata();
  console.log(`${quadrant.name}: ${outputMetadata.width}x${outputMetadata.height}, removed ${removed.toLocaleString('en-US')} backdrop, ${removedShadow.toLocaleString('en-US')} connected-shadow, and ${removedPockets.toLocaleString('en-US')} enclosed-neutral pixels; softened ${softenedShadow.toLocaleString('en-US')} shadow pixels, kept ${visiblePixels.toLocaleString('en-US')}.`);
}

console.log(`Extracted ${quadrants.length} transparent WebP assets from ${width}x${height} sprite into ${outputDir}.`);
