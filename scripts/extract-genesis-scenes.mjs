import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [inputPath, outputPath = 'public/assets/season/genesis/scenes'] = process.argv.slice(2);
if (!inputPath) {
  throw new Error('Usage: node scripts/extract-genesis-scenes.mjs <2x2-scene-sheet> [output-directory]');
}

const reference = { width: 1_672, height: 941 };
const sourcePath = path.resolve(inputPath);
const outputDir = path.resolve(outputPath);
const source = await sharp(sourcePath, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate().toBuffer();
const { width, height } = await sharp(source).metadata();
if (!width || !height || width < 4 || height < 4) {
  throw new Error('The scene sheet must be at least 4x4 pixels.');
}

// The supplied sheet has a 20px outer frame and narrow central gutters.
// Scale those measured insets so the same source can be supplied at another resolution.
const marginX = Math.round(20 * width / reference.width);
const marginY = Math.round(20 * height / reference.height);
const gutterX = Math.round(18 * width / reference.width);
const gutterY = Math.round(19 * height / reference.height);
const cellWidth = Math.floor((width - marginX * 2 - gutterX) / 2);
const cellHeight = Math.floor((height - marginY * 2 - gutterY) / 2);
if (cellWidth < 2 || cellHeight < 2) throw new Error('Could not determine four scene panels from the source dimensions.');

const panels = [
  { name: 'vault-bg.webp', column: 0, row: 0 },
  { name: 'garage-bg.webp', column: 1, row: 0 },
  { name: 'auction-bg.webp', column: 0, row: 1 },
  { name: 'profile-card-bg.webp', column: 1, row: 1 },
];

await fs.mkdir(outputDir, { recursive: true });
for (const panel of panels) {
  const left = marginX + panel.column * (cellWidth + gutterX);
  const top = marginY + panel.row * (cellHeight + gutterY);
  const cropWidth = Math.min(cellWidth, width - left);
  const cropHeight = Math.min(cellHeight, height - top);
  const outputFile = path.join(outputDir, panel.name);
  await sharp(source, { limitInputPixels: 40_000_000, failOn: 'error' })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: 1_600, height: 900, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(outputFile);
  const output = await sharp(outputFile).metadata();
  console.log(`${panel.name}: ${output.width}x${output.height}, ${(await fs.stat(outputFile)).size.toLocaleString('en-US')} bytes.`);
}

console.log(`Extracted ${panels.length} Genesis scenes from ${width}x${height} into ${outputDir}.`);
