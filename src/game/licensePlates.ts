import type { CarItem, LicensePlateItem } from '../types/game';

export const LICENSE_PLATE_BASE_PRICE = 5_000;
export const LICENSE_PLATE_SPIN_PRICE = 10_000;
export const LICENSE_PLATE_LETTERS = 'АВЕКМНОРСТУХ';

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
  seriesInfo?: PlateSeriesInfo;
  digits: string;
  series: string;
  region: string;
}

const isPatternedNumber = (digits: string) =>
  ['001', '007', '100'].includes(digits) || (/^(\d)\1\1$/.test(digits) && digits[0] !== '0');

export const getLicensePlateValuation = (plate: string): LicensePlateValuation => {
  const match = plate.trim().match(/^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})\s?(\d{2,3})$/);
  if (!match) {
    return { price: LICENSE_PLATE_BASE_PRICE, multiplier: 1, seriesMultiplier: 1, regionMultiplier: 1, digitsMultiplier: 1, specialAmr97: false, digits: '', series: '', region: '' };
  }
  const [, firstLetter, digits, lastLetters, region] = match;
  const series = `${firstLetter}${lastLetters}`;
  const seriesInfo = seriesCatalog.get(`${series}:${region}`);
  const specialAmr97 = series === 'АМР' && region === '97';
  const seriesMultiplier = seriesInfo?.certainty === 'folklore' ? 1.25 : seriesInfo?.certainty === 'regional' ? 2 : seriesInfo?.certainty === 'federal' ? 3 : 1;
  const regionMultiplier = MOSCOW_AGGLOMERATION_CODES.has(region) ? 2 : 1;
  const digitsMultiplier = isPatternedNumber(digits) ? 3 : 1;
  const multiplier = specialAmr97 ? 10 : seriesMultiplier * regionMultiplier * digitsMultiplier;

  return {
    price: Math.round(LICENSE_PLATE_BASE_PRICE * multiplier),
    multiplier,
    seriesMultiplier: specialAmr97 ? 10 : seriesMultiplier,
    regionMultiplier: specialAmr97 ? 1 : regionMultiplier,
    digitsMultiplier: specialAmr97 ? 1 : digitsMultiplier,
    specialAmr97,
    seriesInfo,
    digits,
    series,
    region,
  };
};

export const createRandomLicensePlate = (): string => {
  const pickLetter = () => LICENSE_PLATE_LETTERS[Math.floor(Math.random() * LICENSE_PLATE_LETTERS.length)];
  const digits = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  const region = LICENSE_PLATE_REGION_CODES[Math.floor(Math.random() * LICENSE_PLATE_REGION_CODES.length)];
  return `${pickLetter()}${digits}${pickLetter()}${pickLetter()} ${region}`;
};

export const createLicensePlateItem = (plate: string, id: string = crypto.randomUUID()): LicensePlateItem => ({
  id,
  plate,
  price: getLicensePlateValuation(plate).price,
});

export const isValidRussianLicensePlate = (plate: string): boolean => {
  const normalized = plate.trim();
  const match = normalized.match(/^([АВЕКМНОРСТУХ])\d{3}([АВЕКМНОРСТУХ]{2})\s?(\d{2,3})$/);
  if (match) return LICENSE_PLATE_REGION_CODES.includes(match[3] as (typeof LICENSE_PLATE_REGION_CODES)[number]);
  return /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}$/.test(normalized);
};

export const getCarLicensePlateDisplay = (car: CarItem, plates: LicensePlateItem[]): string => {
  const ownedPlate = car.licensePlateId ? plates.find((plate) => plate.id === car.licensePlateId) : undefined;
  if (ownedPlate) return ownedPlate.plate;
  if (car.licensePlate && car.licensePlate !== '—') return car.licensePlate;
  return 'Без номера';
};
