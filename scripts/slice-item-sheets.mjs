import { access, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'public', 'items');

const sheets = [
  {
    name: 'sheet1',
    columns: 3,
    rows: 3,
    items: [
      'carhartt-cap.png',
      'thrasher-hoodie.png',
      'vans-old-skool.png',
      'adidas-vintage.png',
      'eastpak-bag.png',
      'market-glasses.png',
      'adidas-pants.png',
      'levis-501.png',
      'yeezy-350.png',
    ],
  },
  {
    name: 'sheet2',
    columns: 3,
    rows: 3,
    items: [
      'trapstar-puffer.png',
      'supreme-jeans.png',
      'stussy-8ball.png',
      'oakley-glasses.png',
      'goyard-bag.png',
      'stone-island-cargo.png',
      'polar-big-boy.png',
      'rick-owens-geobasket.png',
      'raf-simons-riot.png',
    ],
  },
  {
    name: 'sheet3',
    columns: 3,
    rows: 3,
    items: [
      'balenciaga-hoodie.png',
      'chrome-hearts-chain.png',
      'balenciaga-strike.png',
      'margiela-jacket.png',
      'rick-owens-pants.png',
      'margiela-jeans.png',
      'vaz-2107.png',
      'lada-priora.png',
      'toyota-mark2-jzx90.png',
    ],
  },
  {
    name: 'sheet4',
    columns: 3,
    rows: 3,
    items: [
      'honda-civic-eg.png',
      'bmw-e34.png',
      'toyota-camry-v40.png',
      'subaru-wrx-sti.png',
      'bmw-e60.png',
      'nissan-silvia-s15.png',
      'toyota-prius-xw20.png',
      'bmw-m5-f90.png',
      'mercedes-g63.png',
    ],
  },
  {
    name: 'sheet5',
    columns: 3,
    rows: 1,
    items: ['porsche-911-gt3rs.png', 'nissan-gtr-r35.png', 'lamborghini-urus.png'],
  },
];

async function findSheet(name) {
  for (const filename of [`${name}.jpg`, `${name}.jpg.jpg`]) {
    const filePath = path.join(projectRoot, filename);
    try {
      await access(filePath);
      return filePath;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Не найден ${name}.jpg или ${name}.jpg.jpg в корне проекта.`);
}

function removeExteriorBlack(buffer, width, height, channels) {
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  const addIfBlack = (x, y) => {
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * channels;
    if (buffer[offset] >= 12 || buffer[offset + 1] >= 12 || buffer[offset + 2] >= 12) return;
    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    addIfBlack(x, 0);
    addIfBlack(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addIfBlack(0, y);
    addIfBlack(width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    buffer[pixelIndex * channels + 3] = 0;

    if (x > 0) addIfBlack(x - 1, y);
    if (x + 1 < width) addIfBlack(x + 1, y);
    if (y > 0) addIfBlack(x, y - 1);
    if (y + 1 < height) addIfBlack(x, y + 1);
  }
}

function findVisibleBounds(buffer, width, height, channels) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (buffer[(y * width + x) * channels + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error('После удаления внешнего фона предмет не найден.');
  }

  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function processCell(sheetPath, sheet, row, column, outputPath) {
  const metadata = await sharp(sheetPath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Не удалось прочитать ${sheetPath}`);

  const cellWidth = metadata.width / sheet.columns;
  const cellHeight = metadata.height / sheet.rows;
  const insetX = Math.round(cellWidth * 0.03);
  const insetY = Math.round(cellHeight * 0.03);
  const left = Math.round(column * cellWidth) + insetX;
  const top = Math.round(row * cellHeight) + insetY;
  const width = Math.round((column + 1) * cellWidth) - Math.round(column * cellWidth) - insetX * 2;
  const height = Math.round((row + 1) * cellHeight) - Math.round(row * cellHeight) - insetY * 2;

  const { data, info } = await sharp(sheetPath)
    .extract({ left, top, width, height })
    .removeAlpha()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  removeExteriorBlack(data, info.width, info.height, info.channels);
  const bounds = findVisibleBounds(data, info.width, info.height, info.channels);
  const cropped = await sharp(data, { raw: info })
    .extract(bounds)
    .png()
    .toBuffer();

  await sharp(cropped)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .resize(288, 288, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: 16,
      bottom: 16,
      left: 16,
      right: 16,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath);
}

const outputs = [];
for (const sheet of sheets) {
  const sheetPath = await findSheet(sheet.name);
  for (let index = 0; index < sheet.items.length; index += 1) {
    const row = Math.floor(index / sheet.columns);
    const column = index % sheet.columns;
    const filename = sheet.items[index];
    const outputPath = path.join(outputDirectory, filename);
    await processCell(sheetPath, sheet, row, column, outputPath);
    outputs.push({ filename, sheet: `${sheet.name}.jpg`, row, column });
    console.log(`${sheet.name} [${row},${column}] -> ${filename}`);
  }
}

const provenancePath = path.join(outputDirectory, 'ATTRIBUTION.json');
try {
  await rm(provenancePath);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

await writeFile(
  path.join(outputDirectory, 'SPRITES.json'),
  `${JSON.stringify(outputs, null, 2)}\n`,
);
console.log(`Нарезано изображений: ${outputs.length}`);
