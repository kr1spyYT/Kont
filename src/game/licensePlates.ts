import type { CarItem, LicensePlateItem, LicensePlateRarity, LicensePlateSaleFilter, LicensePlateSpecialTitle } from '../types/game.js';
import { createId } from '../utils/id.js';

export const LICENSE_PLATE_BASE_PRICE = 5_000;
export const LICENSE_PLATE_SPIN_PRICE = 10_000;
export const LICENSE_PLATE_LETTERS = 'АВЕКМНОРСТУХ';

export const LICENSE_PLATE_CHANCES = {
  ordinary: 58,
  patterned: 25,
  knownSeries: 12,
  amr97: 3,
  legendary: 1,
  secret: 1,
} as const;

export const LICENSE_PLATE_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'secret'] as const satisfies readonly LicensePlateRarity[];

export const LICENSE_PLATE_RARITY_LABELS: Record<LicensePlateRarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
  mythic: 'Мифический',
  secret: 'Секретный',
};

export const LICENSE_PLATE_RARITY_MULTIPLIERS: Record<LicensePlateRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 5,
  epic: 12,
  legendary: 30,
  mythic: 75,
  secret: 250,
};

export const getEquippedLicensePlateFrameIds = (player: {
  licensePlateFrames?: readonly string[];
  equippedLicensePlateFrameId?: string | null;
}): string[] => {
  const ownedFrames = player.licensePlateFrames ?? [];
  const frameId = player.equippedLicensePlateFrameId === undefined
    ? ownedFrames[0]
    : player.equippedLicensePlateFrameId;
  return frameId && ownedFrames.includes(frameId) ? [frameId] : [];
};

export const grantLicensePlateFrame = (
  ownedFrames: readonly string[],
  equippedFrameId: string | null | undefined,
  newFrameId: string,
): { licensePlateFrames: string[]; equippedLicensePlateFrameId: string | null } => {
  const previousEquipped = equippedFrameId === undefined ? ownedFrames[0] : equippedFrameId;
  const licensePlateFrames = [...new Set([...ownedFrames, newFrameId])];
  const equippedLicensePlateFrameId = previousEquipped === undefined
    ? newFrameId
    : previousEquipped === null
      ? null
      : licensePlateFrames.includes(previousEquipped) ? previousEquipped : newFrameId;
  return { licensePlateFrames, equippedLicensePlateFrameId };
};

export const isLicensePlateRarity = (value: unknown): value is LicensePlateRarity =>
  typeof value === 'string' && LICENSE_PLATE_RARITIES.some((rarity) => rarity === value);

export const LICENSE_PLATE_REGION_CODES = [
  '01', '101', '02', '102', '702', '03', '103', '04', '05', '105', '06', '07', '08', '09', '109',
  '10', '11', '111', '12', '13', '113', '14', '15', '16', '116', '716', '17', '18', '118', '19',
  '20', '95', '21', '121', '22', '122', '222', '23', '93', '123', '193', '323', '24', '88', '124',
  '224', '25', '125', '725', '26', '126', '27', '28', '29', '30', '130', '31', '131', '32', '33',
  '34', '134', '35', '36', '136', '37', '38', '138', '39', '91', '139', '40', '41', '42', '142',
  '43', '44', '45', '46', '47', '147', '48', '49', '50', '90', '150', '190', '550', '750', '790',
  '51', '52', '152', '252', '53', '54', '154', '754', '55', '155', '56', '156', '57', '58', '158',
  '59', '159', '60', '61', '161', '761', '62', '63', '163', '763', '64', '164', '65', '66', '96',
  '196', '67', '68', '69', '169', '70', '71', '72', '172', '73', '173', '74', '174', '774', '75',
  '76', '176', '77', '97', '99', '177', '197', '199', '777', '797', '799', '977', '997', '78', '98',
  '178', '198', '778', '79', '80', '180', '81', '181', '82', '182', '83', '84', '184', '85', '185',
  '86', '186', '87', '89', '92', '192', '94', '188',
] as const;

export type SeriesCertainty = 'folklore' | 'regional' | 'federal';

export interface PlateSeriesInfo {
  series: string;
  region: string;
  certainty: SeriesCertainty;
  meaning: string;
  context: string;
  source: string;
}

const seriesEntries: PlateSeriesInfo[] = [
  { series: 'АМР', region: '97', certainty: 'federal', meaning: 'Историческая федеральная спецсерия; АМР97 — отдельная игровая престижная категория.', context: 'Москва · исторический статус серии не указывает на нынешнего владельца.', source: 'Nomer.Club, региональные источники' },
  ...['77', '99', '177'].map((region) => ({ series: 'ЕКХ', region, certainty: 'federal' as const, meaning: 'Исторически связывают с автопарком федеральных структур. «Еду как хочу» — народная легенда.', context: `Москва, код ${region} · историческая репутация серии.`, source: 'Nomer.Club; Autoreview; Fontanka' })),
  { series: 'ХКХ', region: '77', certainty: 'federal', meaning: 'Историческая спецсерия, связываемая с ФСБ.', context: 'Москва · не обозначает нынешнего владельца.', source: 'Nomer.Club, региональные источники' },
  { series: 'ХКХ', region: '99', certainty: 'federal', meaning: 'Историческая спецсерия, связываемая с ФСБ.', context: 'Москва · не обозначает нынешнего владельца.', source: 'Nomer.Club, региональные источники' },
  { series: 'ССС', region: '77', certainty: 'federal', meaning: 'Историческая серия Главного центра специальной связи.', context: 'Москва · связь, фельдъегерская и ведомственная история.', source: 'Nomer.Club, отраслевые источники' },
  { series: 'ЕРЕ', region: '177', certainty: 'federal', meaning: 'Серия, использовавшаяся депутатами Госдумы и функционерами партии «Единая Россия».', context: 'Москва · историческая ассоциация.', source: 'Nomer.Club, региональные источники' },
  { series: 'АМР', region: '77', certainty: 'folklore', meaning: 'Московская серия с репутацией «младшей сестры» АМР97; часть номеров со временем оказалась у частных владельцев.', context: 'Москва · трактовки о ведомственной принадлежности частично спорные.', source: 'Nomer.Club, один источник' },
  { series: 'ЕКХ', region: '71', certainty: 'folklore', meaning: 'Серию связывают с администрацией Тульской области; также известна московская легенда «Еду как хочу».', context: 'Тульская область · отдельная история от московской серии.', source: 'Nomer.Club, один источник; Newstula' },
  { series: 'ААА', region: '78', certainty: 'regional', meaning: 'Историческая серия администрации Санкт-Петербурга времён Анатолия Собчака.', context: 'Санкт-Петербург · серия Смольного.', source: 'Nomer.Club, региональные источники' },
  { series: 'ААА', region: '98', certainty: 'regional', meaning: 'Историческая серия администрации Санкт-Петербурга.', context: 'Санкт-Петербург · серия Смольного.', source: 'Nomer.Club, региональные источники' },
  { series: 'НВВ', region: '178', certainty: 'regional', meaning: 'Серия автопарка администрации губернатора и правительства Санкт-Петербурга.', context: 'Санкт-Петербург · введена при обновлении ведомственного автопарка.', source: 'Nomer.Club, региональные источники' },
  { series: 'ОКО', region: '98', certainty: 'regional', meaning: 'Серия прокуратуры и следственных органов Санкт-Петербурга и Ленинградской области.', context: 'Санкт-Петербург · региональная ведомственная история.', source: 'Nomer.Club, региональные источники' },
  { series: 'ООО', region: '78', certainty: 'regional', meaning: 'Историческая серия администрации губернатора Санкт-Петербурга.', context: 'Санкт-Петербург · позднее встречалась у разных владельцев.', source: 'Nomer.Club, региональные источники' },
  { series: 'ОСА', region: '98', certainty: 'regional', meaning: 'Серия, связываемая с управлением ГИБДД Санкт-Петербурга и Ленинградской области.', context: 'Санкт-Петербург · региональная ведомственная история.', source: 'Nomer.Club, региональные источники' },
  { series: 'ААА', region: '96', certainty: 'regional', meaning: 'Историческая серия правительства Свердловской области и муниципального автопарка Екатеринбурга.', context: 'Свердловская область · диапазоны номеров имели разное назначение.', source: 'Nomer.Club, региональные источники' },
  { series: 'ААА', region: '125', certainty: 'regional', meaning: 'Историческая серия прокуратуры Приморского края.', context: 'Приморский край · ведомственная репутация.', source: 'Nomer.Club, региональные источники' },
  { series: 'ЕЕЕ', region: '125', certainty: 'regional', meaning: 'Историческая серия, связываемая с УФСБ по Приморскому краю.', context: 'Приморский край · ведомственная репутация.', source: 'Nomer.Club, региональные источники' },
  { series: 'МВК', region: '125', certainty: 'regional', meaning: 'Историческая ведомственная серия УВД Приморского края.', context: 'Приморский край · региональная история.', source: 'Nomer.Club, региональные источники' },
  { series: 'МММ', region: '25', certainty: 'regional', meaning: 'Историческая серия депутатов Законодательного собрания Приморского края.', context: 'Приморский край · первые номера связывают с созывом 2002 года.', source: 'Nomer.Club, региональные источники' },
  { series: 'ННН', region: '25', certainty: 'regional', meaning: 'Историческая серия администрации Владивостока.', context: 'Приморский край · городская администрация.', source: 'Nomer.Club, региональные источники' },
  { series: 'ООО', region: '25', certainty: 'regional', meaning: 'Историческая серия администрации Приморского края.', context: 'Приморский край · региональная история.', source: 'Nomer.Club, региональные источники' },
  { series: 'ССС', region: '25', certainty: 'regional', meaning: 'Историческая серия администрации Приморского края.', context: 'Приморский край · в середине 2000-х считалась особенно статусной.', source: 'Nomer.Club, региональные источники' },
  { series: 'ААА', region: '52', certainty: 'regional', meaning: 'Историческая серия администрации Нижнего Новгорода и правительства области.', context: 'Нижегородская область · ведомственная репутация.', source: 'Nomer.Club, региональные источники' },
  { series: 'ННН', region: '52', certainty: 'regional', meaning: 'Серия подведомственных организаций администрации Нижегородской области.', context: 'Нижегородская область · региональная история.', source: 'Nomer.Club, региональные источники' },
  { series: 'ООО', region: '154', certainty: 'regional', meaning: 'Серия правительства Новосибирской области и мэрии Новосибирска.', context: 'Новосибирская область · выдавалась с конца 2013 года.', source: 'Nomer.Club, региональные источники' },
  { series: 'АРО', region: '61', certainty: 'regional', meaning: 'Историческая серия правительства Ростовской области.', context: 'Ростовская область · часть знаков позднее перешла частным владельцам.', source: 'Nomer.Club, региональные источники' },
  { series: 'РОС', region: '161', certainty: 'regional', meaning: 'Серия администрации Ростовской области, пришедшая на смену АРО.', context: 'Ростовская область · историческая региональная репутация.', source: 'Nomer.Club, региональные источники' },
  { series: 'КРК', region: '24', certainty: 'regional', meaning: 'Историческая серия администрации Красноярского края и Законодательного собрания.', context: 'Красноярский край · период губернатора Александра Хлопонина.', source: 'Nomer.Club, региональные источники' },
  { series: 'МКК', region: '24', certainty: 'regional', meaning: 'Историческая серия МВД Красноярского края.', context: 'Красноярский край · ведомственная история.', source: 'Nomer.Club, региональные источники' },
  { series: 'ТКА', region: '52', certainty: 'regional', meaning: 'Серия сотрудников полиции Нижегородской области.', context: 'Нижегородская область · региональная ведомственная история.', source: 'Nomer.Club, региональные источники' },
  { series: 'СНМ', region: '52', certainty: 'regional', meaning: '«Служу нижегородской милиции» — историческая серия, позднее переданная муниципальному транспорту.', context: 'Нижегородская область · ведомственная история.', source: 'Nomer.Club, региональные источники' },
];

const seriesCatalog = new Map(seriesEntries.map((entry) => [`${entry.series}:${entry.region}`, entry]));

export const ALL_LICENSE_PLATE_SERIES = LICENSE_PLATE_LETTERS.split('').flatMap((first) =>
  LICENSE_PLATE_LETTERS.split('').flatMap((second) =>
    LICENSE_PLATE_LETTERS.split('').map((third) => `${first}${second}${third}`),
  ),
);

const MOSCOW_AGGLOMERATION_CODES = new Set([
  '50', '77', '90', '97', '99', '150', '177', '190', '197', '199', '550', '750', '777', '790', '797', '799', '977', '997',
]);

export interface LicensePlateValuation {
  price: number;
  multiplier: number;
  seriesMultiplier: number;
  regionMultiplier: number;
  digitsMultiplier: number;
  specialAmr97: boolean;
  rarity: LicensePlateRarity;
  specialTitle?: LicensePlateSpecialTitle;
  seriesInfo?: PlateSeriesInfo;
  digits: string;
  series: string;
  region: string;
}

const isPatternedNumber = (digits: string) =>
  ['001', '007', '100', '012', '123', '234', '345', '456', '567', '678', '789', '987', '876', '765', '654', '543', '432', '321', '210'].includes(digits) ||
  /^(\d)\1\1$/.test(digits) || digits[0] === digits[2];

const latinToCyrillic: Record<string, string> = {
  A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х',
};

const normalizeLicensePlate = (plate: string) => plate
  .trim()
  .toLocaleUpperCase('ru-RU')
  .replace(/[ABEKMHOPCTYX]/g, (letter) => latinToCyrillic[letter] ?? letter)
  .replace(/\s+/g, '');

const secretPlateTitles: Record<string, LicensePlateSpecialTitle> = {
  'В777ВВ77': 'BIG BOSS',
  'А777АА97': 'ЛУДОМАН',
  'М999ММ99': 'ЛЕГЕНДА',
};

const secretPlateTemplates = [
  { series: 'ВВВ', digits: '777', region: '77' },
  { series: 'ААА', digits: '777', region: '97' },
  { series: 'МММ', digits: '999', region: '99' },
] as const;

export const getLicensePlateValuation = (plate: string): LicensePlateValuation => {
  const normalizedPlate = normalizeLicensePlate(plate);
  const match = normalizedPlate.match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})$/);
  if (!match) {
    return { price: LICENSE_PLATE_BASE_PRICE, multiplier: 1, seriesMultiplier: 1, regionMultiplier: 1, digitsMultiplier: 1, specialAmr97: false, rarity: 'common', digits: '', series: '', region: '' };
  }
  const [, firstLetter, digits, lastLetters, region] = match;
  const series = `${firstLetter}${lastLetters}`;
  const seriesInfo = seriesCatalog.get(`${series}:${region}`);
  const specialAmr97 = series === 'АМР' && region === '97';
  const specialTitle = secretPlateTitles[normalizedPlate];
  const allLettersMatch = series[0] === series[1] && series[1] === series[2];
  const repeatedLetters = new Set(series).size < series.length;
  const repeatedRegion = /^(\d)\1+$/.test(region);
  const premiumRegion = MOSCOW_AGGLOMERATION_CODES.has(region);
  const tripleDigits = /^(\d)\1\1$/.test(digits);
  const isSignatureLegend = normalizedPlate === 'Х777ХХ77';

  let rarity: LicensePlateRarity = 'common';
  if (specialTitle) rarity = 'secret';
  else if (isSignatureLegend || (tripleDigits && allLettersMatch && (premiumRegion || repeatedRegion))) rarity = 'legendary';
  else if (specialAmr97 || (tripleDigits && allLettersMatch)) rarity = 'mythic';
  else if ((tripleDigits && (repeatedLetters || premiumRegion)) || (isPatternedNumber(digits) && repeatedLetters && premiumRegion)) rarity = 'epic';
  else if (isPatternedNumber(digits) || (repeatedLetters && premiumRegion) || seriesInfo?.certainty === 'federal') rarity = 'rare';
  else if (repeatedLetters || repeatedRegion || premiumRegion || seriesInfo) rarity = 'uncommon';

  const seriesMultiplier = seriesInfo?.certainty === 'folklore' ? 1.25 : seriesInfo?.certainty === 'regional' ? 2 : seriesInfo?.certainty === 'federal' ? 3 : 1;
  const regionMultiplier = premiumRegion ? 2 : 1;
  const digitsMultiplier = isPatternedNumber(digits) ? 3 : 1;
  const multiplier = LICENSE_PLATE_RARITY_MULTIPLIERS[rarity];

  return {
    price: Math.round(LICENSE_PLATE_BASE_PRICE * multiplier),
    multiplier,
    seriesMultiplier: specialAmr97 ? 10 : seriesMultiplier,
    regionMultiplier: specialAmr97 ? 1 : regionMultiplier,
    digitsMultiplier: specialAmr97 ? 1 : digitsMultiplier,
    specialAmr97,
    rarity,
    specialTitle,
    seriesInfo,
    digits,
    series,
    region,
  };
};

export const getLicensePlateRarityReason = (plate: string): string => {
  const normalizedPlate = normalizeLicensePlate(plate);
  const match = normalizedPlate.match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})$/);
  if (!match) return 'Формат номера не распознан, поэтому используется обычный тир.';

  const [, firstLetter, digits, lastLetters, region] = match;
  const series = `${firstLetter}${lastLetters}`;
  const seriesInfo = seriesCatalog.get(`${series}:${region}`);
  const allLettersMatch = series[0] === series[1] && series[1] === series[2];
  const repeatedLetters = new Set(series).size < series.length;
  const repeatedRegion = /^(\d)\1+$/.test(region);
  const premiumRegion = MOSCOW_AGGLOMERATION_CODES.has(region);
  const tripleDigits = /^(\d)\1\1$/.test(digits);
  const patternedDigits = isPatternedNumber(digits);

  if (secretPlateTitles[normalizedPlate]) return 'Точное совпадение с одной из трёх секретных комбинаций.';
  if (normalizedPlate === 'Х777ХХ77') return 'Х777ХХ 77 — специальная сигнатурная легендарная комбинация.';
  if (tripleDigits && allLettersMatch && (premiumRegion || repeatedRegion)) return 'Три одинаковые цифры, три одинаковые буквы и сильный код региона.';
  if (series === 'АМР' && region === '97') return 'Особая серия АМР с кодом региона 97.';
  if (tripleDigits && allLettersMatch) return 'Три одинаковые цифры и три одинаковые буквы.';
  if ((tripleDigits && (repeatedLetters || premiumRegion)) || (patternedDigits && repeatedLetters && premiumRegion)) return 'Красивый числовой рисунок усилен повтором букв или престижным регионом.';
  if (patternedDigits) return 'Цифры образуют повтор, зеркальный рисунок или последовательность.';
  if (repeatedLetters && premiumRegion) return 'Повтор букв сочетается с престижным кодом региона.';
  if (seriesInfo?.certainty === 'federal') return 'У этой буквенной серии есть известная федеральная история.';
  if (repeatedLetters) return 'В буквенной серии повторяются символы.';
  if (repeatedRegion) return 'В коде региона повторяются цифры.';
  if (premiumRegion) return 'Использован престижный код региона.';
  if (seriesInfo) return 'У этой буквенной серии есть известная региональная история.';
  return 'Нет выраженного повтора, редкой серии или числового рисунка.';
};

export const getSellableLicensePlates = (
  plates: LicensePlateItem[],
  installedPlateIds: ReadonlySet<string>,
  rarity: LicensePlateSaleFilter,
  favoritePlateIds: ReadonlySet<string> = new Set<string>(),
): LicensePlateItem[] => plates.filter((plate) =>
  !installedPlateIds.has(plate.id) &&
  !favoritePlateIds.has(plate.id) &&
  (rarity === 'all' || getLicensePlateValuation(plate.plate).rarity === rarity),
);

const patternedPlateDigits = [
  '001', '007', '100',
  ...Array.from({ length: 9 }, (_, index) => String(index + 1).repeat(3)),
];

const randomIndex = (length: number) => Math.floor(Math.random() * length);
const randomDigits = () => String(randomIndex(999) + 1).padStart(3, '0');
const randomSeries = () => Array.from(
  { length: 3 },
  () => LICENSE_PLATE_LETTERS[randomIndex(LICENSE_PLATE_LETTERS.length)],
).join('');
const formatLicensePlate = (series: string, digits: string, region: string) =>
  `${series[0]}${digits}${series.slice(1)} ${region}`;

const createLegendaryLicensePlate = () => formatLicensePlate('ХХХ', '777', '77');
const createSecretLicensePlate = () => {
  const template = secretPlateTemplates[randomIndex(secretPlateTemplates.length)];
  return formatLicensePlate(template.series, template.digits, template.region);
};

const randomNonPatternedDigits = () => {
  let digits = randomDigits();
  while (isPatternedNumber(digits)) digits = randomDigits();
  return digits;
};

const knownSeriesEntries = seriesEntries.filter((entry) => !(entry.series === 'АМР' && entry.region === '97'));

const createOrdinaryLicensePlate = (): string => {
  while (true) {
    const series = randomSeries();
    const digits = randomDigits();
    const region = LICENSE_PLATE_REGION_CODES[randomIndex(LICENSE_PLATE_REGION_CODES.length)];
    if (isPatternedNumber(digits) || seriesCatalog.has(`${series}:${region}`)) continue;
    return formatLicensePlate(series, digits, region);
  }
};

const createPatternedLicensePlate = (): string => {
  const digits = patternedPlateDigits[randomIndex(patternedPlateDigits.length)];
  while (true) {
    const series = randomSeries();
    const region = LICENSE_PLATE_REGION_CODES[randomIndex(LICENSE_PLATE_REGION_CODES.length)];
    if (seriesCatalog.has(`${series}:${region}`)) continue;
    return formatLicensePlate(series, digits, region);
  }
};

const createKnownSeriesLicensePlate = (): string => {
  const entry = knownSeriesEntries[randomIndex(knownSeriesEntries.length)];
  return formatLicensePlate(entry.series, randomNonPatternedDigits(), entry.region);
};

const createAmr97LicensePlate = (): string =>
  formatLicensePlate('АМР', randomNonPatternedDigits(), '97');

export const createRandomLicensePlate = (): string => {
  const roll = Math.random() * 100;
  const secretThreshold = LICENSE_PLATE_CHANCES.secret;
  const legendaryThreshold = secretThreshold + LICENSE_PLATE_CHANCES.legendary;
  const amr97Threshold = legendaryThreshold + LICENSE_PLATE_CHANCES.amr97;
  const knownSeriesThreshold = amr97Threshold + LICENSE_PLATE_CHANCES.knownSeries;
  const patternedThreshold = knownSeriesThreshold + LICENSE_PLATE_CHANCES.patterned;

  if (roll < secretThreshold) return createSecretLicensePlate();
  if (roll < legendaryThreshold) return createLegendaryLicensePlate();
  if (roll < amr97Threshold) return createAmr97LicensePlate();
  if (roll < knownSeriesThreshold) return createKnownSeriesLicensePlate();
  if (roll < patternedThreshold) return createPatternedLicensePlate();
  return createOrdinaryLicensePlate();
};

export const createLicensePlateItem = (plate: string, id: string = createId('plate')): LicensePlateItem => ({
  id,
  plate,
  price: getLicensePlateValuation(plate).price,
});

export const isValidRussianLicensePlate = (plate: string): boolean => {
  const normalized = normalizeLicensePlate(plate);
  const match = normalized.match(/^([АВЕКМНОРСТУХ])\d{3}([АВЕКМНОРСТУХ]{2})(\d{2,3})$/);
  if (match) return LICENSE_PLATE_REGION_CODES.includes(match[3] as (typeof LICENSE_PLATE_REGION_CODES)[number]);
  return /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}$/.test(normalized);
};

export const getCarLicensePlateDisplay = (car: CarItem, plates: LicensePlateItem[]): string => {
  const ownedPlate = car.licensePlateId ? plates.find((plate) => plate.id === car.licensePlateId) : undefined;
  if (ownedPlate) return ownedPlate.plate;
  if (car.licensePlate && car.licensePlate !== '—') return car.licensePlate;
  return 'Без номера';
};
