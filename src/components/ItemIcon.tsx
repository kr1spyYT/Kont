import { useId } from 'react';
import { ClothingSlot, ItemType, Rarity } from '../types/game';
import GameImage from './GameImage';

export type ItemIconSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface ItemIconData {
  id?: string;
  name?: string;
  type?: ItemType;
  category?: ItemType;
  slot?: ClothingSlot | 'car';
  rarity?: Rarity;
  icon?: string;
  image?: string;
  imageUrl?: string;
  containerId?: string;
}

interface ItemIconProps extends ItemIconData {
  item?: ItemIconData;
  size?: ItemIconSize;
  className?: string;
  showcase?: boolean;
}

const sizes: Record<ItemIconSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
  xxl: 'h-36 w-36 sm:h-44 sm:w-44',
};

const rarityGlows: Record<Rarity, string> = {
  common: 'rgba(148,163,184,0.10)',
  uncommon: 'rgba(16,185,129,0.12)',
  rare: 'rgba(59,130,246,0.14)',
  epic: 'rgba(168,85,247,0.16)',
  legendary: 'rgba(245,158,11,0.18)',
  mythic: 'rgba(239,68,68,0.20)',
};

const palettes = [
  ['#62e8f4', '#1483ba', '#15324e'],
  ['#f472b6', '#9639be', '#361b54'],
  ['#f9c76b', '#b85731', '#502b36'],
  ['#9de18a', '#418d72', '#173b45'],
  ['#e4e7eb', '#74839e', '#273047'],
  ['#f3a4d7', '#b74d8c', '#522d58'],
];

interface GraphicIds {
  mainId: string;
  highlightId: string;
  shadowId: string;
}

const getPalette = (item: ItemIconData): string[] => {
  const seed = `${item.id ?? ''}${item.name ?? ''}${item.containerId ?? ''}`;
  const hash = Array.from(seed).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  const palette = [...palettes[hash % palettes.length]];
  if (item.rarity === 'legendary') {
    return ['#ffd976', '#dc8b39', '#51273c'];
  }
  if (item.rarity === 'mythic') {
    return ['#fda4af', '#e11d48', '#4c0519'];
  }
  if (item.rarity === 'epic') {
    return [palette[0], '#9a53cf', '#34214f'];
  }
  return palette;
};

const inferSlot = (item: ItemIconData): ClothingSlot | 'car' => {
  if ((item.type ?? item.category) === 'car' || item.slot === 'car') return 'car';
  if (item.slot) return item.slot;
  const name = (item.name ?? '').toLocaleLowerCase('ru-RU');
  if (/кед|кроссов|ботин|обув|vans|yeezy|geobasket|sneaker/.test(name)) return 'shoes';
  if (/джинс|карго|штаны|спортивк|брюк|denim/.test(name)) return 'legs';
  if (/кепк|шапк|очки|cap|glasses/.test(name)) return 'head';
  if (/рюкзак|сумк|цеп|ремень|belt|bag/.test(name)) return 'accessory';
  return 'torso';
};

function ClothingArt({
  slot,
  name,
  colors,
  ids,
}: {
  slot: ClothingSlot | 'car';
  name: string;
  colors: string[];
  ids: GraphicIds;
}) {
  const loweredName = name.toLocaleLowerCase('ru-RU');
  const isCap = slot === 'head' && /кепк|cap/.test(loweredName);
  const isGlasses = slot === 'head' && !isCap;
  const isBag = slot === 'accessory' && /рюкзак|сумк|bag/.test(loweredName);
  const isBelt = slot === 'accessory' && /ремень|belt/.test(loweredName);
  const isPuffer = /пухов|puffer|down/.test(loweredName);
  const isBomber = /бомбер|куртк|jacket|leather/.test(loweredName);

  if (slot === 'shoes') {
    return (
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M25 74 38 66 47 39Q51 34 58 39L70 57 103 67Q120 72 128 84L130 94Q128 99 119 100H36Q24 98 22 91Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2" />
        <path d="M37 77 49 73 57 61 69 74 88 79 99 86 48 86Z" fill={colors[1]} stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
        <path d="m48 74 18 9m-11-14 18 10m-8-14 17 10" fill="none" stroke="#f4f2ff" strokeWidth="2.5" />
        <path d="M30 91q42 5 96 0v6q-3 6-12 6H38q-9-1-8-7Z" fill="#e7ecf2" stroke="#8c9bad" strokeWidth="1.5" />
        <path d="m47 46 8-3 10 15-12 8Z" fill={`url(#${ids.highlightId})`} opacity=".7" />
        <path d="m97 73 15 7-6 6-14-6Z" fill={colors[0]} opacity=".82" />
        <circle cx="39" cy="68" r="3" fill="#fff" opacity=".8" />
      </g>
    );
  }

  if (slot === 'legs') {
    return (
      <g strokeLinejoin="round">
        <path d="m47 22 29 2 9 7-5 31 8 39q-10 9-25 2L51 68 40 99q-11 7-22-1l13-39 8-30Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2" />
        <path d="m47 27 11 5 1 31-12 29-7 2 9-34-6-25Z" fill={colors[2]} opacity=".75" />
        <path d="m76 29 10 3-5 31 8 36-8 3-8-39Z" fill={colors[1]} opacity=".68" />
        <path d="M45 36h34M57 29l3 34m4-31-1 32" stroke="rgba(255,255,255,.33)" strokeWidth="1.6" fill="none" />
        <path d="M34 50h19l-2 14H31Zm31 1h18l-1 13H64Z" fill={colors[1]} stroke="rgba(255,255,255,.38)" strokeWidth="1.4" />
        <path d="m37 52 13 1m16 0 12 1" stroke="#fff" opacity=".45" strokeWidth="1.5" />
        <path d="M55 26h24l-1 5H55Z" fill="#d9c393" stroke="#fff0ba" strokeWidth="1" />
        <path d="m77 32 13 35" stroke="#e9c87c" strokeWidth="2.3" />
      </g>
    );
  }

  if (slot === 'head' && isGlasses) {
    return (
      <g strokeLinejoin="round">
        <path d="M17 49q15-10 34-3l6 8 6-8q20-7 34 3l-4 24q-2 10-15 10-15 0-17-19l-5-1q-3 20-18 20-13 0-15-10Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="3" />
        <path d="M23 53q13-6 23-2l5 5q-1 22-13 22-12 0-15-25Zm48-2q12-4 22 2l-4 25q-3 5-9 5-13 0-14-22Z" fill="#10182b" fillOpacity=".88" stroke="#d6f3ff" strokeWidth="1.5" />
        <path d="m27 56 13-3m35 0 12 3m-35 5 10 1" stroke="#fff" strokeWidth="2" opacity=".7" />
        <path d="m28 70 10 7m42-17 9-5" stroke={colors[0]} strokeWidth="2" opacity=".75" />
        <circle cx="55" cy="57" r="2" fill="#fff" />
      </g>
    );
  }

  if (slot === 'head' || isCap) {
    return (
      <g strokeLinejoin="round">
        <path d="M26 67q2-34 33-39 31 1 38 38l-12 7H32Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2.5" />
        <path d="M59 29q-3 24-2 43h27q-4-34-25-43Z" fill={colors[1]} opacity=".7" />
        <path d="M28 67q24-8 56-3 16 3 23 12-5 9-20 9H36q-16-1-20-8Z" fill={`url(#${ids.highlightId})`} stroke="#e7e8ec" strokeOpacity=".7" strokeWidth="2" />
        <path d="M35 66q20-7 42-3" fill="none" stroke="#fff" strokeWidth="2" opacity=".6" />
        <path d="M47 54q12-9 24 0l-3 11H50Z" fill="#f3bd5b" stroke="#fff0bb" strokeWidth="1.5" />
        <circle cx="59" cy="59" r="3" fill="#fff" />
      </g>
    );
  }

  if (slot === 'accessory') {
    if (isBag) {
      return (
        <g strokeLinejoin="round">
          <path d="M46 37q1-22 19-22 20 0 21 23" fill="none" stroke="#e9d7bc" strokeWidth="5" />
          <path d="m36 42 19-10 32 5 13 17-8 46q-23 11-57 0l-8-43Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2.5" />
          <path d="m47 42 4 50 37 1 4-39-14-12Z" fill={colors[1]} opacity=".76" />
          <path d="m36 59 54-5m-49 29 49-2" stroke="#fff" strokeWidth="2" opacity=".42" />
          <rect x="53" y="64" width="28" height="17" rx="4" fill="#dfc388" stroke="#fff1c8" strokeWidth="1.5" />
          <path d="M59 70h16m-14 5h12" stroke="#765331" strokeWidth="2" />
          <circle cx="44" cy="50" r="3" fill="#f7e2ae" />
        </g>
      );
    }
    if (isBelt) {
      return (
        <g strokeLinejoin="round">
          <path d="M16 45q52-13 126 3l-5 29Q73 66 18 76Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="3" />
          <path d="m31 49 5 22m12-25 5 24m48-15 5 21m14-19 5 21" stroke="#fff" strokeWidth="2" opacity=".48" />
          <path d="m73 49 22 3-3 17-23-3Z" fill="#e8c46d" stroke="#fff0b9" strokeWidth="2" />
          <path d="m77 54 11 2-2 7-11-2Z" fill="#282331" stroke="#b78746" strokeWidth="1.5" />
          <path d="m43 48 4-7m45 29 5 6" stroke="#fff" strokeWidth="2" />
        </g>
      );
    }
    return (
      <g fill="none" strokeLinejoin="round">
        <path d="M32 27q28 21 57 0l24 40q-7 27-39 27-36 0-49-27Z" stroke="#c7d2df" strokeWidth="8" />
        <path d="M32 27q28 21 57 0l24 40q-7 27-39 27-36 0-49-27Z" stroke={`url(#${ids.mainId})`} strokeWidth="4" />
        <path d="M57 55 67 39l10 16 17 3-12 12 3 17-18-8-16 9 3-18-13-12Z" fill={`url(#${ids.highlightId})`} stroke="#fff1bd" strokeWidth="2" />
        <path d="m64 50 5-7 5 8 9 3-7 7 1 9-9-4-8 5 2-9-6-6Z" fill="#fff" opacity=".58" />
        <circle cx="69" cy="60" r="3" fill="#fff" />
      </g>
    );
  }

  const collarPath = isBomber ? 'M43 37 60 45 77 37' : 'M45 35q15 18 30 0';
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M44 24 60 31 76 24l24 10 18 23-15 13-12-10 6 43H23l6-43-12 10L3 57l18-23Z" transform="translate(7 0)" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2.5" />
      <path d="M52 28q8 18 16 0l7 8-5 15H46l-5-15Z" fill={isBomber ? colors[2] : '#252438'} stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
      <path d={collarPath} fill="none" stroke="#e7eaf1" strokeWidth="2" />
      <path d="M61 46v52m-6-38h12" stroke="#e5e7eb" strokeWidth="2" opacity=".85" />
      {isPuffer ? (
        <g fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="2">
          <path d="M31 49q29 9 58 0" /><path d="M29 64q32 10 62 0" /><path d="M27 79q34 9 66 0" />
        </g>
      ) : (
        <g fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2">
          <path d="m34 44 11 49m42-49L76 93" /><path d="M44 62h12m12 0h11" />
        </g>
      )}
      <path d="M50 57q10-8 20 0v15H50Z" fill={colors[2]} opacity=".8" />
      <path d="m54 62 6-5 7 5-7 6Z" fill={`url(#${ids.highlightId})`} stroke="#fff" strokeWidth="1" />
      <path d="M27 97q33 8 67 0l-2 8H29Z" fill={colors[2]} stroke="rgba(255,255,255,.28)" strokeWidth="1" />
    </g>
  );
}

function CarArt({
  name,
  containerId,
  colors,
  ids,
}: {
  name: string;
  containerId?: string;
  colors: string[];
  ids: GraphicIds;
}) {
  const seed = `${containerId ?? ''} ${name}`.toLocaleLowerCase('ru-RU');
  const tier = /dubai|f90|g63|gt3|urus|nismo/.test(seed) ? 3 : /japanese|jdm|silvia|sti|e60|camry/.test(seed) ? 2 : 1;
  const isSuv = /гелик|g63|urus|suv/.test(seed);
  const accent = tier === 3 ? '#ffd56a' : tier === 2 ? '#67e8f9' : '#f8c849';

  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="80" cy="99" rx="57" ry="8" fill={accent} opacity=".22" filter={`url(#${ids.shadowId})`} />
      {tier === 2 && <path d="m98 35 30-8-3 11-29 4" fill={colors[2]} stroke={colors[0]} strokeWidth="2" />}
      {tier === 3 && <path d="M33 82h99l-8 10H36Z" fill={accent} opacity=".55" />}
      {isSuv ? (
        <path d="m25 75 5-28q2-9 12-11l10-17q3-5 10-5h31q8 1 12 8l12 18q14 4 18 18l4 24q-4 7-15 8H34q-12-2-9-15Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2.5" />
      ) : tier === 1 ? (
        <path d="m17 77 4-18q2-9 14-13l18-20q5-5 15-5h31q10 0 16 8l15 19q12 5 16 17l-2 14q-5 7-17 7H33q-13-1-16-9Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2.5" />
      ) : (
        <path d="m14 78 7-13q3-8 17-11l21-22q7-6 20-6h18q10 0 17 8l15 20q13 5 18 17l-1 13q-6 7-19 7H31q-13-1-17-13Z" fill={`url(#${ids.mainId})`} stroke={colors[0]} strokeWidth="2.5" />
      )}
      <path d={isSuv ? 'm45 42 11-19q2-3 7-3h29q5 0 8 5l12 17Z' : tier === 1 ? 'm45 47 14-18q4-4 12-4h27q6 0 11 7l10 15Z' : 'm46 53 18-20q5-4 15-4h11q9 0 14 7l12 17Z'} fill="#132438" stroke="#b9e9f8" strokeWidth="1.5" />
      <path d={isSuv ? 'm77 22 1 21m19-20 6 21' : 'm77 27-1 23m19-23 5 24'} stroke="#c2e8f3" strokeWidth="1.3" opacity=".75" />
      <path d="m30 63 18-3m-9 7 11-1" stroke="#fff" strokeWidth="2" opacity=".5" />
      <path d="m132 68 10 3-1 7-11-1Z" fill={accent} stroke="#fff4b1" strokeWidth="1.5" filter={`url(#${ids.shadowId})`} />
      <path d="m22 69 7-2 1 8-8 2Z" fill={accent} opacity=".9" />
      <path d="m56 82 25 3m-25 4h50" stroke={accent} strokeWidth="2.4" opacity=".9" />
      <path d="M28 80q0-15 14-15 15 0 15 15v8H29Zm71 0q0-15 15-15 14 0 14 15v8h-29Z" fill="#11131a" stroke="#96a4b8" strokeWidth="2" />
      <circle cx="43" cy="81" r="8" fill="#30394a" stroke="#dbe4eb" strokeWidth="2" />
      <circle cx="114" cy="81" r="8" fill="#30394a" stroke="#dbe4eb" strokeWidth="2" />
      <circle cx="43" cy="81" r="3" fill={accent} /><circle cx="114" cy="81" r="3" fill={accent} />
      <path d="m35 81 16 1m-8-8v15m63-8h16m-8-8v15" stroke="#dbe4eb" strokeWidth="1.3" opacity=".8" />
      {tier === 1 && <path d="m53 91 8 3m38-3-8 3" stroke="#f16e64" strokeWidth="3" />}
      {tier === 3 && <path d="m57 96 6 3m31-3-6 3" stroke={accent} strokeWidth="3.5" />}
      <path d="m23 60 19-3m74 1 13 4" stroke="#fff" strokeWidth="1.5" opacity=".56" />
    </g>
  );
}

export default function ItemIcon({
  item,
  id,
  name,
  type,
  category,
  slot,
  rarity,
  icon,
  image,
  imageUrl,
  containerId,
  size = 'md',
  className = '',
  showcase = false,
}: ItemIconProps) {
  const generatedId = useId().replace(/:/g, '');
  const data: ItemIconData = {
    ...item,
    id: id ?? item?.id,
    name: name ?? item?.name ?? 'Предмет',
    type: type ?? item?.type,
    category: category ?? item?.category,
    slot: slot ?? item?.slot,
    rarity: rarity ?? item?.rarity ?? 'common',
    icon: icon ?? item?.icon,
    image: image ?? item?.image,
    imageUrl: imageUrl ?? item?.imageUrl,
    containerId: containerId ?? item?.containerId,
  };
  const colors = getPalette(data);
  const itemType = data.type ?? data.category;
  const inferredSlot = inferSlot(data);
  const glow = rarityGlows[data.rarity ?? 'common'];
  const ids = {
    mainId: `${generatedId}-main`,
    highlightId: `${generatedId}-highlight`,
    shadowId: `${generatedId}-shadow`,
  };

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${sizes[size]} ${showcase ? 'rounded-2xl border border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.42)]' : ''} ${className}`}
      style={{
        backgroundColor: '#0e0e12',
        backgroundImage: `linear-gradient(to top, ${glow} 0%, transparent 68%)`,
      }}
      aria-hidden="true"
    >
      {showcase && (
        <span
          className="item-icon-pedestal pointer-events-none absolute inset-x-[12%] bottom-[6%] z-[1] h-[16%] rounded-[50%]"
          style={{ background: `radial-gradient(ellipse at center, ${glow} 0%, transparent 72%)` }}
        />
      )}
      <GameImage
        source={data.image}
        imageUrl={data.imageUrl}
        icon={data.icon}
        alt=""
        className={`relative z-10 h-full w-full max-h-full max-w-full object-contain ${showcase ? 'item-icon-art--showcase drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)]' : 'drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]'}`}
        fallback={(
          data.icon
            ? <span className="relative z-10 flex h-full w-full items-center justify-center text-6xl drop-shadow-[0_8px_12px_rgba(0,0,0,0.75)]" role="img" aria-label={data.name}>{data.icon}</span>
            : (
              <svg viewBox="0 0 160 120" className="relative z-10 h-full w-full max-h-full max-w-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.75)]">
                <defs>
                  <linearGradient id={ids.mainId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={colors[0]} />
                    <stop offset="53%" stopColor={colors[1]} />
                    <stop offset="100%" stopColor={colors[2]} />
                  </linearGradient>
                  <linearGradient id={ids.highlightId} x1="0" y1="0" x2="0.9" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity=".95" />
                    <stop offset="100%" stopColor={colors[0]} stopOpacity=".08" />
                  </linearGradient>
                  <radialGradient id={`${generatedId}-gloss`} cx="32%" cy="18%" r="88%">
                    <stop offset="0%" stopColor="#fff" stopOpacity=".5" />
                    <stop offset="45%" stopColor="#fff" stopOpacity=".08" />
                    <stop offset="100%" stopColor="#080b13" stopOpacity=".25" />
                  </radialGradient>
                  <filter id={ids.shadowId} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3" />
                  </filter>
                </defs>
                <g>
                  {itemType === 'car'
                    ? <CarArt name={data.name ?? ''} containerId={data.containerId} colors={colors} ids={ids} />
                    : <ClothingArt slot={inferredSlot} name={data.name ?? ''} colors={colors} ids={ids} />}
                </g>
                <path d="M9 18Q57-4 116 11" fill="none" stroke={`url(#${generatedId}-gloss)`} strokeWidth="2" opacity=".7" />
              </svg>
            )
        )}
      />
    </span>
  );
}
