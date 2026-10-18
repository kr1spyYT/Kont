import sharp from 'sharp';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SOURCE_MAX_EDGE = 1_200;
const OUTPUT_SIZE = 320;
const IMAGE_PADDING = 20;
const BACKGROUND_TOLERANCE = 32;
const BACKGROUND_EDGE_SAMPLE_TOLERANCE = 44;

type RgbColor = [number, number, number];

interface BackgroundModel {
  topLeft: RgbColor;
  topRight: RgbColor;
  bottomLeft: RgbColor;
  bottomRight: RgbColor;
}

interface RgbaImage {
  data: Buffer;
  info: { width: number; height: number; channels: number };
}

const colorDistance = (data: Buffer, offset: number, color: readonly number[]) =>
  Math.max(
    Math.abs(data[offset] - color[0]),
    Math.abs(data[offset + 1] - color[1]),
    Math.abs(data[offset + 2] - color[2]),
  );

function sampleCorner(image: RgbaImage, fromRight: boolean, fromBottom: boolean): RgbColor | undefined {
  const { data, info } = image;
  const patchSize = Math.max(2, Math.min(8, Math.floor(Math.min(info.width, info.height) / 24)));
  const startX = fromRight ? info.width - patchSize : 0;
  const startY = fromBottom ? info.height - patchSize : 0;
  const samples: number[][] = [];

  for (let y = startY; y < Math.min(startY + patchSize, info.height); y += 1) {
    for (let x = startX; x < Math.min(startX + patchSize, info.width); x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (info.channels > 3 && data[offset + 3] <= 16) continue;
      samples.push([data[offset], data[offset + 1], data[offset + 2]]);
    }
  }

  if (!samples.length) return undefined;
  return [0, 1, 2].map((channel) =>
    Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length)) as RgbColor;
}

function getBackgroundModel(image: RgbaImage): BackgroundModel | undefined {
  const topLeft = sampleCorner(image, false, false);
  const topRight = sampleCorner(image, true, false);
  const bottomLeft = sampleCorner(image, false, true);
  const bottomRight = sampleCorner(image, true, true);
  return topLeft && topRight && bottomLeft && bottomRight
    ? { topLeft, topRight, bottomLeft, bottomRight }
    : undefined;
}

function expectedBackgroundAt(model: BackgroundModel, x: number, y: number, width: number, height: number): RgbColor {
  const horizontal = width > 1 ? x / (width - 1) : 0;
  const vertical = height > 1 ? y / (height - 1) : 0;
  return [0, 1, 2].map((channel) => {
    const top = model.topLeft[channel] * (1 - horizontal) + model.topRight[channel] * horizontal;
    const bottom = model.bottomLeft[channel] * (1 - horizontal) + model.bottomRight[channel] * horizontal;
    return Math.round(top * (1 - vertical) + bottom * vertical);
  }) as RgbColor;
}

function backgroundModelFitsEdges(image: RgbaImage, model: BackgroundModel): boolean {
  const { data, info } = image;
  const step = Math.max(1, Math.floor(Math.max(info.width, info.height) / 128));
  const sides = [
    Array.from({ length: info.width }, (_, x) => [x, 0] as const),
    Array.from({ length: info.width }, (_, x) => [x, info.height - 1] as const),
    Array.from({ length: info.height }, (_, y) => [0, y] as const),
    Array.from({ length: info.height }, (_, y) => [info.width - 1, y] as const),
  ];
  let totalMatches = 0;
  let totalSamples = 0;
  let matchingSides = 0;

  for (const side of sides) {
    let sideMatches = 0;
    let sideSamples = 0;
    for (let position = 0; position < side.length; position += step) {
      const [x, y] = side[position];
      const offset = (y * info.width + x) * info.channels;
      if (info.channels > 3 && data[offset + 3] <= 16) continue;
      sideSamples += 1;
      if (colorDistance(data, offset, expectedBackgroundAt(model, x, y, info.width, info.height)) <= BACKGROUND_EDGE_SAMPLE_TOLERANCE) {
        sideMatches += 1;
      }
    }
    if (sideSamples > 0) {
      totalSamples += sideSamples;
      totalMatches += sideMatches;
      if (sideMatches / sideSamples >= 0.45) matchingSides += 1;
    }
  }

  return totalSamples > 0 && totalMatches / totalSamples >= 0.62 && matchingSides >= 2;
}

function removeConnectedEdgeBackground(image: RgbaImage): Buffer {
  const { data, info } = image;
  const original = Buffer.from(data);
  if (info.channels < 4) return data;
  const background = getBackgroundModel(image);
  if (!background || !backgroundModelFitsEdges(image, background)) return data;
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const addSeed = (index: number) => {
    if (visited[index]) return;
    const offset = index * info.channels;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (data[offset + 3] > 16 && colorDistance(data, offset, expectedBackgroundAt(background, x, y, info.width, info.height)) <= BACKGROUND_TOLERANCE) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < info.width; x += 1) {
    addSeed(x);
    addSeed((info.height - 1) * info.width + x);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    addSeed(y * info.width);
    addSeed(y * info.width + info.width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    data[index * info.channels + 3] = 0;
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < info.width ? index + 1 : -1,
      y > 0 ? index - info.width : -1,
      y + 1 < info.height ? index + info.width : -1,
    ];
    for (const neighbor of neighbors) {
      if (neighbor < 0 || visited[neighbor]) continue;
      const offset = neighbor * info.channels;
      const nextX = neighbor % info.width;
      const nextY = Math.floor(neighbor / info.width);
      if (data[offset + 3] <= 16 || colorDistance(data, offset, expectedBackgroundAt(background, nextX, nextY, info.width, info.height)) > BACKGROUND_TOLERANCE) continue;
      visited[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }

  let visiblePixels = 0;
  for (let index = 3; index < data.length; index += info.channels) {
    if (data[index] > 16) visiblePixels += 1;
  }
  if (!visiblePixels) return original;
  return data;
}

export async function processCatalogImage(input: Buffer, outputFormat: 'webp' | 'png' = 'webp'): Promise<Buffer> {
  if (!input.length || input.length > MAX_UPLOAD_BYTES) throw new Error('Размер картинки должен быть от 1 байта до 10 МБ.');
  const source = sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate();
  const metadata = await source.metadata();
  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new Error('Поддерживаются изображения JPEG, PNG и WebP.');
  }
  const raw = await source
    .resize(SOURCE_MAX_EDGE, SOURCE_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cutout = removeConnectedEdgeBackground(raw);
  const normalized = sharp(cutout, { raw: raw.info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .resize(OUTPUT_SIZE - IMAGE_PADDING * 2, OUTPUT_SIZE - IMAGE_PADDING * 2, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: IMAGE_PADDING,
      bottom: IMAGE_PADDING,
      left: IMAGE_PADDING,
      right: IMAGE_PADDING,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  return outputFormat === 'png'
    ? normalized.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    : normalized.webp({ quality: 84, alphaQuality: 100, effort: 5 }).toBuffer();
}

export async function processCatalogSpriteSheet(input: Buffer, itemCount: number): Promise<Buffer[]> {
  if (!input.length || input.length > MAX_UPLOAD_BYTES) throw new Error('Размер картинки должен быть от 1 байта до 10 МБ.');
  if (!Number.isSafeInteger(itemCount) || itemCount < 1 || itemCount > 100) {
    throw new Error('Укажи от 1 до 100 предметов на спрайт-листе.');
  }

  const oriented = await sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate().toBuffer();
  const source = sharp(oriented, { limitInputPixels: 40_000_000, failOn: 'error' });
  const metadata = await source.metadata();
  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new Error('Поддерживаются изображения JPEG, PNG и WebP.');
  }
  if (!metadata.width || !metadata.height || metadata.width < 5 || metadata.height < Math.ceil(itemCount / 5)) {
    throw new Error('Размер спрайт-листа слишком мал для указанного количества ячеек.');
  }

  const columns = 5;
  const rows = Math.ceil(itemCount / columns);
  const cellWidth = Math.floor(metadata.width / columns);
  const cellHeight = Math.floor(metadata.height / rows);
  return Promise.all(Array.from({ length: itemCount }, async (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * cellWidth;
    const top = row * cellHeight;
    const width = column === columns - 1 ? metadata.width - left : cellWidth;
    const height = row === rows - 1 ? metadata.height - top : cellHeight;
    const cell = await sharp(oriented, { limitInputPixels: 40_000_000, failOn: 'error' })
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    return processCatalogImage(cell);
  }));
}
