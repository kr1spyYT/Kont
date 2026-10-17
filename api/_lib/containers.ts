import { CONTAINERS } from '../../src/data/items.js';
import type { Container, ContainerDrop, ContainerType, Rarity } from '../../src/types/game.js';
import type { ContainerCatalog } from '../../src/types/server.js';
import type { PoolClient } from 'pg';

const containerTypes: ContainerType[] = ['clothing', 'car', 'plates'];
const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const clothingSlots = ['head', 'torso', 'legs', 'shoes', 'accessory'] as const;
const validImagePath = (image: string) =>
  (/^[a-zA-Z0-9_./-]+$/.test(image) && !image.split('/').includes('..'))
  || /^\/api\/assets\/[a-zA-Z0-9_-]{8,100}$/.test(image);

interface ContainerRow {
  id: string;
  title: string;
  type: ContainerType;
  tier: number;
  price: number;
  sort_order: number;
  description: string;
  icon: string;
  image: string;
  drops: ContainerDrop[];
}

const staticDefaults: Record<string, { tier: number; description: string; icon: string; image: string }> = {
  'second-hand-bale': { tier: 1, description: 'Винтажные находки и уличная классика.', icon: '🧥', image: 'containers/second.png' },
  'hype-box': { tier: 2, description: 'Громкие силуэты для главной улицы.', icon: '📦', image: 'containers/hype.png' },
  'tokyo-archive': { tier: 3, description: 'Архивная мода и редкие коллекционные вещи.', icon: '🗼', image: 'containers/archive.png' },
  'impound-lot': { tier: 1, description: 'Легенды дворов и первые проекты под восстановление.', icon: '🚧', image: 'containers/impound.png' },
  'japanese-auction': { tier: 2, description: 'Японские и европейские машины с характером.', icon: '🇯🇵', image: 'containers/jdm.png' },
  'dubai-transit': { tier: 3, description: 'Максимальный люкс, мощность и редкие номера.', icon: '🌆', image: 'containers/dubai.png' },
};

const toContainer = (row: ContainerRow): Container => ({
  id: row.id,
  order: Number(row.sort_order),
  tier: Number(row.tier),
  name: row.title,
  category: row.type,
  price: Number(row.price),
  description: row.description,
  icon: row.icon,
  image: row.image,
  contents: row.drops,
});

const assertValidDrops: (value: unknown, type: ContainerType) => asserts value is ContainerDrop[] = (value, type) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error('В списке выпадения должен быть хотя бы один предмет и не больше 100.');
  }
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`Предмет №${index + 1} должен быть JSON-объектом.`);
    }
    const drop = entry as Record<string, unknown>;
    if (typeof drop.name !== 'string' || !drop.name.trim() || drop.name.length > 100) {
      throw new Error(`У предмета №${index + 1} должно быть название до 100 символов.`);
    }
    if (typeof drop.icon !== 'string' || !drop.icon || drop.icon.length > 20) {
      throw new Error(`У предмета №${index + 1} должна быть короткая иконка.`);
    }
    if (typeof drop.image !== 'string' || drop.image.length > 300 || !validImagePath(drop.image)) {
      throw new Error(`Для предмета №${index + 1} отправь фото или укажи путь к изображению внутри игры.`);
    }
    if (!rarities.includes(drop.rarity as Rarity)) throw new Error(`Неизвестная редкость у предмета №${index + 1}.`);
    if (!Number.isSafeInteger(drop.basePrice) || Number(drop.basePrice) < 1 || Number(drop.basePrice) > 2_000_000_000) {
      throw new Error(`У предмета №${index + 1} укажи базовую цену от 1 до 2 000 000 000.`);
    }
    if (!Number.isSafeInteger(drop.respect) || Number(drop.respect) < 0 || Number(drop.respect) > 10_000_000) {
      throw new Error(`У предмета №${index + 1} укажи Респект от 0 до 10 000 000.`);
    }
    if (drop.weight !== undefined && (!Number.isFinite(drop.weight) || Number(drop.weight) <= 0 || Number(drop.weight) > 1_000_000)) {
      throw new Error(`Вес выпадения предмета №${index + 1} должен быть больше нуля.`);
    }
    if (type === 'clothing' && !clothingSlots.includes(drop.slot as typeof clothingSlots[number])) {
      throw new Error(`Для одежды №${index + 1} укажи слот: head, torso, legs, shoes или accessory.`);
    }
    if (type === 'car' && drop.slot !== undefined && drop.slot !== 'car') {
      throw new Error(`У автомобиля №${index + 1} должен быть слот car.`);
    }
  }
};

const getDatabaseType = (failure: unknown) => typeof failure === 'object' && failure !== null && 'code' in failure
  ? String((failure as { code?: unknown }).code)
  : '';

const throwTableHint = (failure: unknown): never => {
  const code = getDatabaseType(failure);
  if (code === '42P01' || code === '3F000') {
    throw new Error('Таблицы контейнеров не созданы. Выполни обновлённый db/schema.sql в Neon.');
  }
  throw failure;
};

export async function ensureContainerCatalog(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_containers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('clothing', 'car', 'plates')),
      tier INTEGER NOT NULL CHECK (tier > 0),
      price INTEGER NOT NULL CHECK (price >= 0),
      sort_order INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '📦',
      image TEXT NOT NULL DEFAULT 'containers/second.png',
      drops JSONB NOT NULL CHECK (jsonb_typeof(drops) = 'array'),
      deleted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_admin_sessions (
      telegram_id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  try {
    for (const container of CONTAINERS) {
      const metadata = staticDefaults[container.id];
      await client.query(
        `INSERT INTO game_containers (id, title, type, tier, price, sort_order, description, icon, image, drops)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          container.id,
          container.name,
          container.category,
          metadata.tier,
          container.price,
          container.order,
          metadata.description,
          metadata.icon,
          metadata.image,
          JSON.stringify(container.contents),
        ],
      );
    }
  } catch (failure) {
    return throwTableHint(failure);
  }
}

export async function listContainerCatalog(client: PoolClient): Promise<ContainerCatalog> {
  await ensureContainerCatalog(client);
  try {
    const { rows } = await client.query<ContainerRow>(
      'SELECT id, title, type, tier, price, sort_order, description, icon, image, drops FROM game_containers WHERE deleted_at IS NULL ORDER BY sort_order, id',
    );
    return rows.map(toContainer);
  } catch (failure) {
    return throwTableHint(failure);
  }
}

export interface SaveContainerInput {
  id: string;
  title: string;
  type: ContainerType;
  tier: number;
  price: number;
  sortOrder: number;
  description: string;
  icon: string;
  image: string;
  drops: ContainerDrop[];
}

export async function saveContainer(client: PoolClient, input: SaveContainerInput): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id) || input.id.length > 40) {
    throw new Error('ID контейнера должен быть в формате латиница-и-дефисы (например, premium-box).');
  }
  if (!input.title.trim() || input.title.length > 100) throw new Error('Название контейнера должно содержать до 100 символов.');
  if (!containerTypes.includes(input.type)) throw new Error('Тип должен быть clothing, car или plates.');
  if (!Number.isSafeInteger(input.tier) || input.tier < 1 || input.tier > 20) throw new Error('Тир должен быть от 1 до 20.');
  if (!Number.isSafeInteger(input.price) || input.price < 0 || input.price > 2_000_000_000) throw new Error('Цена должна быть от 0 до 2 000 000 000 ₽.');
  if (!Number.isSafeInteger(input.sortOrder)) throw new Error('Порядок должен быть целым числом.');
  if (!input.description || input.description.length > 300) throw new Error('Описание должно содержать до 300 символов.');
  if (!input.icon || input.icon.length > 20) throw new Error('Укажи короткую иконку.');
  if (!input.image || input.image.length > 300 || !validImagePath(input.image)) {
    throw new Error('Отправь фото контейнера или укажи путь к изображению внутри игры.');
  }
  assertValidDrops(input.drops, input.type);

  await ensureContainerCatalog(client);
  try {
    await client.query(
      `INSERT INTO game_containers (id, title, type, tier, price, sort_order, description, icon, image, drops)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, tier = EXCLUDED.tier,
         price = EXCLUDED.price, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description,
         icon = EXCLUDED.icon, image = EXCLUDED.image, drops = EXCLUDED.drops, deleted_at = NULL, updated_at = NOW()`,
      [input.id, input.title.trim(), input.type, input.tier, input.price, input.sortOrder, input.description, input.icon, input.image, JSON.stringify(input.drops)],
    );
  } catch (failure) {
    return throwTableHint(failure);
  }
}

export async function moveContainer(client: PoolClient, id: string, direction: -1 | 1): Promise<void> {
  await ensureContainerCatalog(client);
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(731004813)');
    const { rows } = await client.query<{ id: string; sort_order: number }>(
      'SELECT id, sort_order FROM game_containers WHERE deleted_at IS NULL ORDER BY sort_order, id FOR UPDATE',
    );
    const index = rows.findIndex((row) => row.id === id);
    const other = index + direction;
    if (index < 0 || other < 0 || other >= rows.length) {
      await client.query('COMMIT');
      return;
    }
    const first = rows[index];
    const second = rows[other];
    await client.query(
      'UPDATE game_containers SET sort_order = $1, updated_at = NOW() WHERE id = $2',
      [second.sort_order, first.id],
    );
    await client.query(
      'UPDATE game_containers SET sort_order = $1, updated_at = NOW() WHERE id = $2',
      [first.sort_order, second.id],
    );
    await client.query('COMMIT');
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
}

export async function deleteContainer(client: PoolClient, id: string): Promise<boolean> {
  await ensureContainerCatalog(client);
  const result = await client.query(
    'UPDATE game_containers SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
  return result.rowCount === 1;
}
