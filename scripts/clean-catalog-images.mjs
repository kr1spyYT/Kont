import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';
import { processCatalogImage } from '../api/_lib/image-processing.ts';

const { Pool } = pg;
const root = fileURLToPath(new URL('..', import.meta.url));
const staticItemsDirectory = join(root, 'public', 'items');
const args = new Set(process.argv.slice(2));
const applyChanges = args.has('--apply');
const staticOnly = args.has('--static-only');
const databaseOnly = args.has('--db-only');

if (staticOnly && databaseOnly) throw new Error('Выбери только один режим: --static-only или --db-only.');
if (args.has('--help')) {
  console.log('Usage: node --experimental-strip-types scripts/clean-catalog-images.mjs [--apply] [--static-only|--db-only]');
  console.log('Без --apply выполняется dry-run без записи изменений.');
  process.exit(0);
}

const imageDataUrl = /^data:image\/(?:webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/i;
const processedImages = new Map();

async function processImage(input) {
  const digest = createHash('sha256').update(input).digest('hex');
  const cached = processedImages.get(digest);
  if (cached) return cached;
  const result = await processCatalogImage(input);
  processedImages.set(digest, result);
  return result;
}

async function isAlreadyNormalizedPng(input) {
  const metadata = await sharp(input, { failOn: 'error' }).metadata();
  if (metadata.width !== 320 || metadata.height !== 320) return false;
  const { data, info } = await sharp(input, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let x = 0; x < info.width; x += 1) {
    if (data[(x * info.channels) + 3] > 16) return false;
    const bottom = ((info.height - 1) * info.width + x) * info.channels;
    if (data[bottom + 3] > 16) return false;
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    if (data[(y * info.width) * info.channels + 3] > 16) return false;
    const right = (y * info.width + info.width - 1) * info.channels;
    if (data[right + 3] > 16) return false;
  }
  return true;
}

async function cleanStaticCatalog() {
  const files = (await readdir(staticItemsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  let normalized = 0;
  let changed = 0;
  let totalOriginalBytes = 0;
  let totalOutputBytes = 0;

  for (const name of files) {
    const filePath = join(staticItemsDirectory, name);
    const input = await readFile(filePath);
    totalOriginalBytes += input.length;
    if (await isAlreadyNormalizedPng(input)) {
      normalized += 1;
      totalOutputBytes += input.length;
      continue;
    }
    const output = await processCatalogImage(input, 'png');
    changed += 1;
    totalOutputBytes += output.length;
    if (!applyChanges) continue;

    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, output, { flag: 'wx' });
      await rename(temporaryPath, filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  console.log(`Static catalog: ${files.length} PNG, ${changed} need cleanup, ${normalized} already normalized.`);
  console.log(`Static image bytes: ${totalOriginalBytes.toLocaleString('en-US')} before, ${totalOutputBytes.toLocaleString('en-US')} after processing.`);
  if (changed && !applyChanges) console.log('Dry-run only. Add --apply to write normalized PNG files.');
}

async function processDataUrl(source) {
  if (typeof source !== 'string') return source;
  const match = imageDataUrl.exec(source);
  if (!match) return source;
  const processed = await processImage(Buffer.from(match[1], 'base64'));
  return `data:image/webp;base64,${processed.toString('base64')}`;
}

async function cleanDatabaseImages() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    if (databaseOnly) throw new Error('Для миграции БД в окружении отсутствует DATABASE_URL или POSTGRES_URL.');
    console.log('Database: skipped; no DATABASE_URL or POSTGRES_URL is available to this process.');
    return;
  }

  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  let counts = { assets: 0, items: 0, containers: 0 };
  try {
    if (applyChanges) await client.query('BEGIN');

    const lockClause = applyChanges ? ' FOR UPDATE' : '';
    const assets = await client.query('SELECT id, content_type, image_data FROM game_assets ORDER BY id' + lockClause);
    for (const asset of assets.rows) {
      if (asset.content_type !== 'image/webp') continue;
      const output = await processImage(Buffer.from(asset.image_data));
      if (applyChanges && !output.equals(Buffer.from(asset.image_data))) {
        await client.query('UPDATE game_assets SET image_data = $2 WHERE id = $1', [asset.id, output]);
      }
      counts.assets += 1;
    }

    const items = await client.query("SELECT id, image FROM game_items WHERE image LIKE 'data:image/%' ORDER BY id" + lockClause);
    for (const item of items.rows) {
      const nextImage = await processDataUrl(item.image);
      if (nextImage !== item.image) {
        if (applyChanges) await client.query('UPDATE game_items SET image = $2, updated_at = NOW() WHERE id = $1', [item.id, nextImage]);
        counts.items += 1;
      }
    }

    const containers = await client.query('SELECT id, image, drops FROM game_containers ORDER BY id' + lockClause);
    for (const container of containers.rows) {
      const nextImage = await processDataUrl(container.image);
      const drops = typeof container.drops === 'string' ? JSON.parse(container.drops) : container.drops;
      let dropsChanged = false;
      const nextDrops = await Promise.all((Array.isArray(drops) ? drops : []).map(async (drop) => {
        if (!drop || typeof drop !== 'object') return drop;
        let nextDrop = drop;
        for (const field of ['image', 'imageUrl', 'icon']) {
          const nextSource = await processDataUrl(nextDrop[field]);
          if (nextSource !== nextDrop[field]) {
            nextDrop = { ...nextDrop, [field]: nextSource };
            dropsChanged = true;
          }
        }
        return nextDrop;
      }));
      if (nextImage !== container.image || dropsChanged) {
        if (applyChanges) {
          await client.query(
            'UPDATE game_containers SET image = $2, drops = $3::jsonb, updated_at = NOW() WHERE id = $1',
            [container.id, nextImage, JSON.stringify(nextDrops)],
          );
        }
        counts.containers += 1;
      }
    }

    if (applyChanges) await client.query('COMMIT');
    console.log(`Database images: ${counts.assets} WebP assets scanned, ${counts.items} catalog items and ${counts.containers} containers/drops need or received normalization.`);
    if (!applyChanges) console.log('Database dry-run only. Add --apply to write changes transactionally.');
  } catch (error) {
    if (applyChanges) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (!databaseOnly) await cleanStaticCatalog();
if (!staticOnly) await cleanDatabaseImages();
if (!applyChanges) console.log('No files or database rows were changed.');
