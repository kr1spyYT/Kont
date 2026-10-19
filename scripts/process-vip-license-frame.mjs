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

function isBackground(index) {
  const offset = index * channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const brightness = (red + green + blue) / 3;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  return chroma <= 34 && brightness >= 205;
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
  const offset = index * channels;
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

  if (touchesBackground) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const brightness = (red + green + blue) / 3;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (chroma <= 40 && brightness >= 160 && brightness <= 205) {
      data[offset + 3] = Math.min(data[offset + 3], Math.round(((205 - brightness) / 45) * 255));
    }
  }
}

let left = width;
let top = height;
let right = -1;
let bottom = -1;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * channels + 3] > 4) {
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

const padding = 6;
left = Math.max(0, left - padding);
top = Math.max(0, top - padding);
right = Math.min(width - 1, right + padding);
bottom = Math.min(height - 1, bottom + padding);
const cropWidth = right - left + 1;
const cropHeight = bottom - top + 1;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await sharp(data, { raw: { width, height, channels } })
  .extract({ left, top, width: cropWidth, height: cropHeight })
  .resize(1200, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(outputPath);

console.log(JSON.stringify({ input: inputPath, output: outputPath, source: { width, height }, crop: { left, top, width: cropWidth, height: cropHeight }, floodFilledPixels: queueEnd }));
