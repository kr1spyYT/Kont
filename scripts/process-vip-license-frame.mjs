import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [inputPath, requestedOutputPath] = process.argv.slice(2);

if (!inputPath) {
  throw new Error('Usage: node scripts/process-vip-license-frame.mjs <source-image> [output.webp]');
}

const outputPath = requestedOutputPath ?? path.resolve('public/assets/season/genesis/vip-frame-empty.webp');
const { data, info } = await sharp(inputPath)
  .rotate()
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const pixelCount = width * height;
const visited = new Uint8Array(pixelCount);
const queue = new Uint32Array(pixelCount);
let queueEnd = 0;
let queueStart = 0;

function getPixel(index) {
  const offset = index * channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return {
    offset,
    brightness: (red + green + blue) / 3,
    chroma: Math.max(red, green, blue) - Math.min(red, green, blue),
  };
}

function isBackground(index) {
  const { brightness, chroma } = getPixel(index);
  return chroma <= 30 && brightness >= 182;
}

function enqueue(index) {
  if (!visited[index] && isBackground(index)) {
    visited[index] = 1;
    queue[queueEnd++] = index;
  }
}

for (let x = 0; x < width; x += 1) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (queueStart < queueEnd) {
  const index = queue[queueStart++];
  const x = index % width;
  const y = Math.floor(index / width);
  if (x > 0) enqueue(index - 1);
  if (x + 1 < width) enqueue(index + 1);
  if (y > 0) enqueue(index - width);
  if (y + 1 < height) enqueue(index + width);
}

for (let index = 0; index < pixelCount; index += 1) {
  const { offset, brightness, chroma } = getPixel(index);
  if (visited[index]) {
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
    continue;
  }

  const x = index % width;
  const y = Math.floor(index / width);
  let touchesBackground = false;
  for (let dy = -1; dy <= 1 && !touchesBackground; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && visited[ny * width + nx]) {
        touchesBackground = true;
        break;
      }
    }
  }

  if (touchesBackground && chroma <= 40 && brightness >= 110 && brightness < 182) {
    const edgeAlpha = Math.round(((182 - brightness) / (182 - 110)) * 255);
    data[offset + 3] = Math.min(data[offset + 3], edgeAlpha);
  }
}

// Locate the lower edge from structural carbon/gold pixels, not the neutral contact shadow.
const lowerScanStart = Math.floor(height * 0.58);
const structuralPixelThreshold = Math.max(12, Math.round(width * 0.004));
let lowerArtworkEdge = -1;
for (let y = lowerScanStart; y < height; y += 1) {
  let structuralPixels = 0;
  for (let x = 0; x < width; x += 1) {
    const index = y * width + x;
    if (data[index * channels + 3] < 128) continue;
    const { brightness, chroma } = getPixel(index);
    if ((chroma > 45 && brightness < 220) || brightness < 72) structuralPixels += 1;
  }
  if (structuralPixels >= structuralPixelThreshold) lowerArtworkEdge = y;
}

if (lowerArtworkEdge < 0) {
  throw new Error('Could not detect the lower edge of the VIP frame.');
}

// The area below the frame contains only neutral floor/contact shadow, including enclosed pixels.
for (let y = lowerArtworkEdge + 1; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const { offset, brightness, chroma } = getPixel(y * width + x);
    if (chroma <= 34 && brightness >= 45) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
}

// Drop near-zero-alpha fringe before trimming to the exact visible artwork bounds.
for (let index = 0; index < pixelCount; index += 1) {
  const offset = index * channels;
  if (data[offset + 3] <= 4) {
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
}

let left = width;
let top = height;
let right = -1;
let bottom = -1;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * channels + 3] > 0) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
}

if (right < left || bottom < top) {
  throw new Error('No opaque artwork remained after background removal.');
}

const cropWidth = right - left + 1;
const cropHeight = bottom - top + 1;
const insetMark = { left: 1034, top: 453, width: 97, height: 48 };

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await sharp(data, { raw: { width, height, channels } })
  .extract({ left, top, width: cropWidth, height: cropHeight })
  .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
  .composite([{
    input: {
      create: {
        width: insetMark.width,
        height: insetMark.height,
        channels: 4,
        background: { r: 247, g: 247, b: 245, alpha: 1 },
      },
    },
    left: insetMark.left,
    top: insetMark.top,
  }])
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(outputPath);

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  source: { width, height },
  crop: { left, top, width: cropWidth, height: cropHeight, aspect: Number((cropWidth / cropHeight).toFixed(3)) },
  outputDimensions: { width: output.width, height: output.height },
  cleanedInsetMark: insetMark,
  lowerArtworkEdge,
  floodFilledPixels: queueEnd,
}));
