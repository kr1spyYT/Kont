import type { PoolClient } from 'pg';
import type { Container, ContainerDrop, InventoryItem, Rarity } from '../../src/types/game.js';
import { isSupportedImageSource, materializeImageSources } from './imageAssets.js';

export interface CatalogItem {
  id: string;
  type: 'clothing' | 'car';
  name: string;
  icon: string;
  image: string;
  rarity: Rarity;
  basePrice: number;
  respect: number;
  slot?: ContainerDrop['slot'] | 'car';
}

interface CatalogItemRow {
  id: string;
  type: CatalogItem['type'];
  name: string;
  icon: string;
  image: string;
  rarity: Rarity;
  base_price: number;
  respect: number;
  slot: CatalogItem['slot'] | null;
}

const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const clothingSlots: NonNullable<ContainerDrop['slot']>[] = ['head', 'torso', 'legs', 'shoes', 'accessory'];

function toCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    icon: row.icon,
    image: row.image,
    rarity: row.rarity,
    basePrice: Number(row.base_price),
    respect: Number(row.respect),
    ...(row.slot ? { slot: row.slot } : {}),
  };
}

export async function ensureCatalogItemTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('clothing', 'car')),
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      image TEXT NOT NULL,
      rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
      base_price INTEGER NOT NULL CHECK (base_price > 0),
      respect INTEGER NOT NULL DEFAULT 0 CHECK (respect >= 0),
      slot TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS game_items_type_name_idx ON game_items (type, name)');
}

const selectItemFields = `id, type, name, icon, image, rarity, base_price, respect, slot`;

export async function listCatalogItems(client: PoolClient): Promise<CatalogItem[]> {
  await ensureCatalogItemTable(client);
  const { rows } = await client.query<CatalogItemRow>(
    `SELECT ${selectItemFields} FROM game_items ORDER BY type, name, created_at DESC`,
  );
  return rows.map(toCatalogItem);
}

export async function getCatalogItem(client: PoolClient, id: string): Promise<CatalogItem | undefined> {
  await ensureCatalogItemTable(client);
  const { rows } = await client.query<CatalogItemRow>(
    `SELECT ${selectItemFields} FROM game_items WHERE id = $1`,
    [id],
  );
  return rows[0] ? toCatalogItem(rows[0]) : undefined;
}

const normalizeCatalogName = (name: string) => name.trim().toLocaleLowerCase('ru-RU');

export async function hydrateMissingInventoryImages(client: PoolClient, inventory: InventoryItem[]): Promise<InventoryItem[]> {
  const missing = inventory.filter((item) => !isSupportedImageSource(item.image ?? ''));
  if (!missing.length) return inventory;

  await ensureCatalogItemTable(client);
  const clothingNames = [...new Set(missing.filter((item) => item.type === 'clothing').map((item) => item.name.trim()))];
  const carNames = [...new Set(missing.filter((item) => item.type === 'car').map((item) => item.name.trim()))];
  const { rows } = await client.query<CatalogItemRow>(
    `SELECT ${selectItemFields} FROM game_items
     WHERE (type = 'clothing' AND name = ANY($1::text[]))
        OR (type = 'car' AND name = ANY($2::text[]))
     ORDER BY updated_at DESC, created_at DESC`,
    [clothingNames, carNames],
  );
  if (!rows.length) return inventory;

  const images = await materializeImageSources(client, rows.map((row) => row.image));
  const catalogByName = new Map<string, CatalogItem>();
  rows.forEach((row, index) => {
    const item = toCatalogItem({ ...row, image: images[index] ?? row.image });
    const key = `${item.type}:${normalizeCatalogName(item.name)}`;
    if (!catalogByName.has(key) && isSupportedImageSource(item.image)) catalogByName.set(key, item);
  });

  return inventory.map((item) => {
    if (isSupportedImageSource(item.image ?? '')) return item;
    const catalogItem = catalogByName.get(`${item.type}:${normalizeCatalogName(item.name)}`);
    return catalogItem ? { ...item, image: catalogItem.image, icon: item.icon || catalogItem.icon } : item;
  });
}

export async function saveCatalogItem(client: PoolClient, item: CatalogItem): Promise<void> {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(item.id)) throw new Error('ID предмета имеет неверный формат.');
  if (!['clothing', 'car'].includes(item.type)) throw new Error('Выбери одежду или автомобиль.');
  if (!item.name.trim() || item.name.length > 100) throw new Error('Название должно содержать до 100 символов.');
  if (!item.icon.trim() || item.icon.length > 20) throw new Error('Добавь короткую эмодзи-иконку.');
  if (!isSupportedImageSource(item.image)) throw new Error('Изображение не прошло обработку.');
  if (!rarities.includes(item.rarity)) throw new Error('Выбери редкость из предложенного списка.');
  if (!Number.isSafeInteger(item.basePrice) || item.basePrice < 1 || item.basePrice > 2_000_000_000) {
    throw new Error('Базовая цена должна быть целым числом от 1 до 2 000 000 000 ₽.');
  }
  if (!Number.isSafeInteger(item.respect) || item.respect < 0 || item.respect > 10_000_000) {
    throw new Error('Респект должен быть целым числом от 0 до 10 000 000.');
  }
  if (item.type === 'clothing' && !clothingSlots.includes(item.slot as NonNullable<ContainerDrop['slot']>)) {
    throw new Error('Выбери слот одежды.');
  }
  if (item.type === 'car' && item.slot !== 'car') throw new Error('У автомобиля должен быть слот car.');
  await ensureCatalogItemTable(client);
  const [image] = await materializeImageSources(client, [item.image]);
  await client.query(
    `INSERT INTO game_items (id, type, name, icon, image, rarity, base_price, respect, slot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, name = EXCLUDED.name, icon = EXCLUDED.icon,
       image = EXCLUDED.image, rarity = EXCLUDED.rarity, base_price = EXCLUDED.base_price,
       respect = EXCLUDED.respect, slot = EXCLUDED.slot, updated_at = NOW()`,
    [item.id, item.type, item.name.trim(), item.icon.trim(), image, item.rarity, item.basePrice, item.respect, item.slot ?? null],
  );
}

export async function deleteCatalogItem(client: PoolClient, id: string): Promise<void> {
  await client.query('BEGIN');
  try {
    const references = await client.query<{ id: string }>(
      `SELECT id FROM game_containers
       WHERE deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(drops) AS entry
           WHERE entry->>'catalogItemId' = $1
         )
       LIMIT 1`,
      [id],
    );
    if (references.rowCount) throw new Error('Сначала убери предмет из всех контейнеров, затем повтори удаление.');
    const result = await client.query('DELETE FROM game_items WHERE id = $1', [id]);
    if (result.rowCount !== 1) throw new Error('Предмет уже удалён или не найден.');
    await client.query('COMMIT');
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
}

export async function attachCatalogItemsToContainers(client: PoolClient, containers: Container[]): Promise<Container[]> {
  await ensureCatalogItemTable(client);
  const { rows } = await client.query<CatalogItemRow>(`SELECT ${selectItemFields} FROM game_items`);
  const images = await materializeImageSources(client, rows.map((row) => row.image));
  const items = new Map(rows.map((row, index) => [row.id, toCatalogItem({ ...row, image: images[index] })]));
  return containers.map((container) => ({
    ...container,
    contents: container.contents.flatMap((drop) => {
      if (!drop.catalogItemId) return [drop];
      const item = items.get(drop.catalogItemId);
      if (!item || (container.category !== 'plates' && item.type !== container.category)) return [];
      return [{
        ...drop,
        name: item.name,
        icon: item.icon,
        image: item.image,
        rarity: item.rarity,
        basePrice: item.basePrice,
        respect: item.respect,
        ...(item.slot ? { slot: item.slot === 'car' ? undefined : item.slot } : {}),
      }];
    }),
  }));
}
