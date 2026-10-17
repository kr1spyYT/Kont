import sharp from 'sharp';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SOURCE_MAX_EDGE = 1_200;
const OUTPUT_SIZE = 320;
const IMAGE_PADDING = 20;
const BACKGROUND_TOLERANCE = 54;

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

function findUniformEdgeBackground(image: RgbaImage): [number, number, number] | undefined {
  const { data, info } = image;
  const right = info.width - 1;
  const bottom = info.height - 1;
  const cornerPoints = [
    [0, 0],
    [right, 0],
    [0, bottom],
    [right, bottom],
  ];
  const samples = cornerPoints.map(([x, y]) => {
    const offset = (y * info.width + x) * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  });
  const background = [0, 1, 2].map((channel) =>
    Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length));
  const consistent = samples.every((sample) =>
    Math.max(...sample.map((channel, index) => Math.abs(channel - background[index]))) <= 72);
  return consistent ? background as [number, number, number] : undefined;
}

function removeConnectedEdgeBackground(image: RgbaImage): Buffer {
  const { data, info } = image;
  const original = Buffer.from(data);
  const background = findUniformEdgeBackground(image);
  if (!background) return data;
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const addSeed = (index: number) => {
    if (visited[index]) return;
    const offset = index * info.channels;
    if (data[offset + 3] > 16 && colorDistance(data, offset, background) <= BACKGROUND_TOLERANCE) {
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
      if (data[offset + 3] <= 16 || colorDistance(data, offset, background) > BACKGROUND_TOLERANCE) continue;
      visited[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }

  if (!data.some((_, index) => index % info.channels === 3 && data[index] > 16)) return original;
  return data;
}

export async function processCatalogImage(input: Buffer): Promise<Buffer> {
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
  return sharp(cutout, { raw: raw.info })
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
    })
    .webp({ quality: 84, alphaQuality: 100, effort: 5 })
    .toBuffer();
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
