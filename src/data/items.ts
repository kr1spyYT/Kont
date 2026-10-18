import { ClothingSlot, Container, ContainerDrop, ItemType, Rarity } from '../types/game.js';

/*
 * Как добавить контейнер или предмет:
 *
 * 1. Добавь контейнер в CONTAINERS и задай уникальный id и order.
 *    Меньший order показывается выше; чтобы поменять контейнеры местами,
 *    достаточно обменять их order.
 * 2. Добавь предмет в contents нужного контейнера. Файл изображения положи
 *    в public/items/, а в image укажи путь от корня сайта без начального слеша.
 *
 * Шаблон нового контейнера с предметом одежды (поля можно копировать):
 * {
 *   id: 'new-clothing-box',
 *   order: 7,
 *   name: 'Новый контейнер',
 *   category: 'clothing',
 *   price: 10_000,
 *   description: 'Описание контейнера.',
 *   icon: '📦',
 *   image: 'containers/new-box.png',
 *   contents: [
 *     clothing('Название вещи', '🧥', 'common', 1_000, 1, 'torso', 'items/new-item.png'),
 *   ],
 * },
 *
 * Для нового контейнера с автомобилями укажи category: 'car' и добавляй
 * предметы через car('Название автомобиля', '🚘', 'rare', 100_000, 10,
 * 'items/new-car.png'). Для одежды у clothing также задаётся слот:
 * head, torso, legs, shoes или accessory.
 */
const publicAssetUrl = (path: string) => path.replace(/^\/+/, '');

const clothing = (
  name: string,
  icon: string,
  rarity: Rarity,
  basePrice: number,
  respect: number,
  slot: ClothingSlot,
  image: string,
): ContainerDrop => ({ name, icon, rarity, basePrice, respect, slot, image: publicAssetUrl(image) });

const car = (
  name: string,
  icon: string,
  rarity: Rarity,
  basePrice: number,
  respect: number,
  image: string,
): ContainerDrop => ({ name, icon, rarity, basePrice, respect, image: publicAssetUrl(image) });

export const CONTAINERS: Container[] = [
  {
    id: 'second-hand-bale',
    order: 1,
    tier: 1,
    name: 'Тюк с Секонда · Бюджет',
    category: 'clothing',
    price: 1_700,
    description: 'Винтажные находки и уличная классика.',
    icon: '🧥',
    image: publicAssetUrl('/containers/second.png'),
    contents: [
      clothing('Кепка Carhartt', '🧢', 'common', 1_200, 2, 'head', '/items/carhartt-cap.png'),
      clothing('Худи Thrasher', '🔥', 'common', 1_800, 3, 'torso', '/items/thrasher-hoodie.png'),
      clothing('Потертые Vans Old Skool', '👟', 'common', 2_000, 3, 'shoes', '/items/vans-old-skool.png'),
      clothing('Олимпийка Adidas Vintage', '🧥', 'rare', 3_800, 7, 'torso', '/items/adidas-vintage.png'),
      clothing('Рюкзак Eastpak', '🎒', 'rare', 3_200, 6, 'accessory', '/items/eastpak-bag.png'),
      clothing('Очки с рынка', '🕶️', 'common', 900, 1, 'head', '/items/market-glasses.png'),
      clothing('Спортивки Adidas', '👖', 'common', 2_600, 4, 'legs', '/items/adidas-pants.png'),
      clothing('Джинсы Levi’s 501 с секонда', '👖', 'rare', 4_200, 8, 'legs', '/items/levis-501.png'),
    ],
  },
  {
    id: 'hype-box',
    order: 2,
    tier: 2,
    name: 'Хайп-Бокс · Стандарт',
    category: 'clothing',
    price: 18_000,
    description: 'Громкие силуэты для главной улицы.',
    icon: '📦',
    image: publicAssetUrl('/containers/hype.png'),
    contents: [
      clothing('Кроссовки Yeezy Boost 350', '👟', 'epic', 31_000, 42, 'shoes', '/items/yeezy-350.png'),
      clothing('Пуховик Trapstar', '🧥', 'epic', 27_000, 36, 'torso', '/items/trapstar-puffer.png'),
      clothing('Джинсы Supreme Baggy', '👖', 'rare', 18_000, 23, 'legs', '/items/supreme-jeans.png'),
      clothing('Худи Stussy 8-Ball', '🎱', 'rare', 21_000, 27, 'torso', '/items/stussy-8ball.png'),
      clothing('Очки Oakley', '🕶️', 'rare', 16_000, 19, 'head', '/items/oakley-glasses.png'),
      clothing('Сумка Goyard', '👜', 'legendary', 52_000, 76, 'accessory', '/items/goyard-bag.png'),
      clothing('Карго Stone Island', '🩳', 'epic', 38_000, 54, 'legs', '/items/stone-island-cargo.png'),
      clothing('Широкие джинсы Polar Skate Co.', '👖', 'rare', 24_000, 32, 'legs', '/items/polar-big-boy.png'),
    ],
  },
  {
    id: 'tokyo-archive',
    order: 3,
    tier: 3,
    name: 'Токийский Архив · Премиум',
    category: 'clothing',
    price: 118_000,
    description: 'Архивная мода и редкие коллекционные вещи.',
    icon: '🗼',
    image: publicAssetUrl('/containers/archive.png'),
    contents: [
      clothing('Кеды Rick Owens Geobasket', '🥾', 'legendary', 165_000, 230, 'shoes', '/items/rick-owens-geobasket.png'),
      clothing('Архивный бомбер Raf Simons Riot', '🧥', 'legendary', 240_000, 340, 'torso', '/items/raf-simons-riot.png'),
      clothing('Худи Balenciaga Heavy Metal', '🎸', 'epic', 118_000, 155, 'torso', '/items/balenciaga-hoodie.png'),
      clothing('Ремень и цепь Chrome Hearts (925 проба)', '⛓️', 'legendary', 310_000, 470, 'accessory', '/items/chrome-hearts-chain.png'),
      clothing('Ботинки Balenciaga Strike', '🥾', 'epic', 142_000, 188, 'shoes', '/items/balenciaga-strike.png'),
      clothing('Куртка Maison Margiela', '🧥', 'epic', 126_000, 165, 'torso', '/items/margiela-jacket.png'),
      clothing('Кожаные штаны Rick Owens', '🖤', 'legendary', 195_000, 280, 'legs', '/items/rick-owens-pants.png'),
      clothing('Джинсы Maison Margiela Painted', '👖', 'epic', 148_000, 205, 'legs', '/items/margiela-jeans.png'),
    ],
  },
  {
    id: 'impound-lot',
    order: 4,
    tier: 1,
    name: 'Штрафстоянка · Бюджет',
    category: 'car',
    price: 258_000,
    description: 'Легенды дворов и первые проекты под восстановление.',
    icon: '🚧',
    image: publicAssetUrl('/containers/impound.png'),
    contents: [
      car('ВАЗ-2107 (Боевая классика)', '🚘', 'common', 95_000, 8, '/items/vaz-2107.png'),
      car('Лада Приора (Бункер)', '🚗', 'common', 140_000, 12, '/items/lada-priora.png'),
      car('Toyota Mark II JZX90 (Турер В)', '🏎️', 'epic', 680_000, 90, '/items/toyota-mark2-jzx90.png'),
      car('Honda Civic EG', '🚙', 'rare', 310_000, 42, '/items/honda-civic-eg.png'),
      car('Старая BMW E34', '🚘', 'rare', 360_000, 50, '/items/bmw-e34.png'),
    ],
  },
  {
    id: 'japanese-auction',
    order: 5,
    tier: 2,
    name: 'Японский Аукцион · Стандарт',
    category: 'car',
    price: 1_295_000,
    description: 'Японские и европейские машины с характером.',
    icon: '🇯🇵',
    image: publicAssetUrl('/containers/jdm.png'),
    contents: [
      car('Toyota Camry 3.5 (Черная)', '🚙', 'rare', 1_150_000, 155, '/items/toyota-camry-v40.png'),
      car('Subaru Impreza WRX STI', '🏁', 'epic', 2_100_000, 310, '/items/subaru-wrx-sti.png'),
      car('BMW 5-Series E60', '🚘', 'rare', 1_050_000, 145, '/items/bmw-e60.png'),
      car('Nissan Silvia S15', '🏎️', 'epic', 2_350_000, 350, '/items/nissan-silvia-s15.png'),
      car('Toyota Prius 20 (Гибрид в идеале)', '🚕', 'common', 720_000, 90, '/items/toyota-prius-xw20.png'),
    ],
  },
  {
    id: 'dubai-transit',
    order: 6,
    tier: 3,
    name: 'Дубайский Транзит · Премиум',
    category: 'car',
    price: 15_800_000,
    description: 'Максимальный люкс, мощность и редкие номера.',
    icon: '🌆',
    image: publicAssetUrl('/containers/dubai.png'),
    contents: [
      car('BMW M5 F90 Competition', '🏎️', 'legendary', 12_500_000, 1_600, '/items/bmw-m5-f90.png'),
      car('Mercedes-AMG G63 (Гелик)', '🚙', 'legendary', 15_800_000, 1_950, '/items/mercedes-g63.png'),
      car('Porsche 911 GT3 RS', '🏁', 'legendary', 22_000_000, 2_700, '/items/porsche-911-gt3rs.png'),
      car('Nissan GT-R R35 Nismo', '🏎️', 'epic', 11_200_000, 1_420, '/items/nissan-gtr-r35.png'),
      car('Lamborghini Urus', '🚘', 'legendary', 19_500_000, 2_350, '/items/lamborghini-urus.png'),
    ],
  },
];

const ITEM_IMAGE_BY_NAME = new Map(
  CONTAINERS.flatMap((container) => container.contents.map((item) => [item.name, item.image] as const)),
);

export const getItemImage = (name: string): string | undefined => ITEM_IMAGE_BY_NAME.get(name);

export const CONTAINER_CATEGORIES: { id: ItemType; label: string; icon: string }[] = [
  { id: 'clothing', label: 'ШМОТ (3)', icon: '🧥' },
  { id: 'car', label: 'ТАЧКИ (3)', icon: '🚗' },
];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'ОБЫЧНЫЙ',
  uncommon: 'НЕОБЫЧНЫЙ',
  rare: 'РЕДКИЙ',
  epic: 'ЭПИЧЕСКИЙ',
  legendary: 'ЛЕГЕНДАРНЫЙ',
  mythic: 'МИФИЧЕСКИЙ',
};

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 30,
  rare: 15,
  epic: 6,
  legendary: 2,
  mythic: 1,
};

export const getClothingSlot = (name: string): ClothingSlot =>
  CONTAINERS.flatMap((container) => container.contents)
    .find((drop) => drop.name === name && drop.slot !== undefined)?.slot ?? 'accessory';

export const pickDrop = (container: Container): ContainerDrop => {
  const getWeight = (item: ContainerDrop) => item.weight ?? RARITY_WEIGHTS[item.rarity];
  const totalWeight = container.contents.reduce((sum, item) => sum + getWeight(item), 0);
  let ticket = Math.random() * totalWeight;
  const drop =
    container.contents.find((item) => {
      ticket -= getWeight(item);
      return ticket < 0;
    }) ?? container.contents[container.contents.length - 1];

  return drop;
};
