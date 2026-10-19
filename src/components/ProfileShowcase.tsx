import { CarFront, Crown, UserRound } from 'lucide-react';
import type { CarItem, ClothingItem, ClothingSlot, LicensePlateItem, Rarity } from '../types/game';
import { RARITY_LABELS } from '../data/items';
import { getCarLicensePlateDisplay } from '../game/licensePlates';
import { formatRubles } from '../utils/currency';
import GameImage, { isRenderableImageSource } from './GameImage';
import LicensePlateDisplay from './LicensePlateDisplay';
import PlayerAvatar from './PlayerAvatar';
import RankBadge from './RankBadge';

const PROFILE_ASSET_ROOT = '/assets/profile';

export const PROFILE_SLOT_ART: Record<ClothingSlot, string> = {
  head: `${PROFILE_ASSET_ROOT}/pedestal_head.webp`,
  torso: `${PROFILE_ASSET_ROOT}/pedestal_top.webp`,
  legs: `${PROFILE_ASSET_ROOT}/pedestal_bottom.webp`,
  shoes: `${PROFILE_ASSET_ROOT}/pedestal_shoes.webp`,
  accessory: `${PROFILE_ASSET_ROOT}/pedestal_accessory.webp`,
};

const profileSlots: { id: ClothingSlot; label: string }[] = [
  { id: 'head', label: 'Голова' },
  { id: 'torso', label: 'Верх' },
  { id: 'legs', label: 'Низ' },
  { id: 'shoes', label: 'Обувь' },
  { id: 'accessory', label: 'Аксессуар' },
];

const raritySurface: Record<Rarity, string> = {
  common: 'border-slate-300/25 shadow-[0_0_14px_rgba(148,163,184,0.08)]',
  uncommon: 'border-emerald-400/35 shadow-[0_0_14px_rgba(16,185,129,0.10)]',
  rare: 'border-blue-400/40 shadow-[0_0_16px_rgba(59,130,246,0.12)]',
  epic: 'border-fuchsia-400/45 shadow-[0_0_16px_rgba(168,85,247,0.14)]',
  legendary: 'border-amber-300/55 shadow-[0_0_18px_rgba(245,158,11,0.16)]',
  mythic: 'border-rose-400/55 shadow-[0_0_18px_rgba(239,68,68,0.16)]',
};

const rarityText: Record<Rarity, string> = {
  common: 'text-slate-300',
  uncommon: 'text-emerald-300',
  rare: 'text-blue-300',
  epic: 'text-fuchsia-300',
  legendary: 'text-amber-200',
  mythic: 'text-rose-300',
};

export interface ProfileMemberCardProps {
  name: string;
  avatarUrl?: string;
  rankTitle: string;
  rankPosition?: number;
  xp?: number;
  seasonName?: string;
  seasonLevel?: number;
  isPremiumPass?: boolean;
  collectionCount: number;
  collectionValue: number;
  respect: number;
  balance?: number;
}

export function ProfileMemberCard({
  name,
  avatarUrl,
  rankTitle,
  rankPosition,
  xp,
  seasonName,
  seasonLevel,
  isPremiumPass = false,
  collectionCount,
  collectionValue,
  respect,
  balance,
}: ProfileMemberCardProps) {
  const displayName = name.trim() || 'Игрок';
  const tertiaryStat = balance === undefined
    ? { label: 'Респект', value: respect.toLocaleString('ru-RU') }
    : { label: 'Баланс ₽', value: formatRubles(balance) };

  return (
    <article className={`relative isolate overflow-hidden rounded-[26px] border bg-[#09090b] shadow-[0_22px_54px_rgba(0,0,0,0.52)] ${isPremiumPass ? 'border-amber-300/40 shadow-[0_22px_54px_rgba(0,0,0,0.52),0_0_24px_rgba(245,158,11,0.10)]' : 'border-slate-300/20'}`}>
      <img
        src={`${PROFILE_ASSET_ROOT}/vip_member_card.webp`}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-5 h-[132%] w-[57%] object-contain object-right opacity-55 [mask-image:linear-gradient(90deg,transparent_0%,black_48%,black_100%)]"
        loading="eager"
      />
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${isPremiumPass ? 'bg-gradient-to-r from-[#09090b]/95 via-[#09090b]/83 to-[#09090b]/42' : 'bg-gradient-to-r from-[#09090b]/98 via-[#09090b]/90 to-[#09090b]/60'}`} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090b]/65 via-transparent to-black/20" />
      <div className="relative z-10 p-3.5 sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`shrink-0 rounded-[19px] p-[2px] ${isPremiumPass ? 'bg-gradient-to-br from-amber-100 via-amber-500 to-[#4a2d0c] shadow-[0_0_22px_rgba(245,158,11,0.3)]' : 'bg-gradient-to-br from-slate-300/60 via-slate-500/35 to-slate-800/80'}`}>
            <PlayerAvatar photoUrl={avatarUrl} name={displayName} className="h-14 w-14 rounded-[17px] border border-black/70 bg-[#101014] text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-200/85">LOOTLAND // BLACK MEMBER</p>
            <h2 className="mt-1 truncate text-sm font-black text-white sm:text-base">{displayName}</h2>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              <RankBadge title={rankTitle} />
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[7px] font-black tracking-[0.08em] ${isPremiumPass ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
                {isPremiumPass ? <Crown size={10} /> : <UserRound size={10} />}
                {isPremiumPass ? 'S1 // VIP PASS' : 'ИГРОК // FREE PASS'}
              </span>
            </div>
            <p className="mt-1 truncate text-[8px] font-semibold text-zinc-300/75">
              {rankPosition ? `Рейтинг #${rankPosition}` : 'Профиль игрока'}
              {xp !== undefined ? ` · ${xp.toLocaleString('ru-RU')} XP` : ''}
              {seasonName ? ` · ${seasonName}${seasonLevel ? ` · уровень ${seasonLevel}` : ''}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="min-w-0 rounded-xl border border-white/10 bg-black/48 px-2 py-2">
            <p className="truncate text-[7px] font-black uppercase tracking-wide text-zinc-400">В коллекции</p>
            <p className="mt-1 truncate text-[10px] font-black tabular-nums text-amber-100 sm:text-xs">{collectionCount.toLocaleString('ru-RU')}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-amber-300/20 bg-black/48 px-2 py-2">
            <p className="truncate text-[7px] font-black uppercase tracking-wide text-zinc-400">Ценность</p>
            <p className="mt-1 truncate text-[10px] font-black tabular-nums text-amber-100 sm:text-xs" title={formatRubles(collectionValue)}>{formatRubles(collectionValue)}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-black/48 px-2 py-2">
            <p className="truncate text-[7px] font-black uppercase tracking-wide text-zinc-400">{tertiaryStat.label}</p>
            <p className="mt-1 truncate text-[10px] font-black tabular-nums text-amber-100 sm:text-xs" title={tertiaryStat.value}>{tertiaryStat.value}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProfileOutfitShowcase({ clothing, car, plates, frameIds = [] }: {
  clothing: ClothingItem[];
  car?: CarItem;
  plates: LicensePlateItem[];
  frameIds?: readonly string[];
}) {
  const equippedBySlot = new Map(clothing.map((item) => [item.slot, item]));

  return (
    <section className="rounded-2xl border border-amber-300/20 bg-[#101014] p-2.5 shadow-[0_16px_34px_rgba(0,0,0,0.32)] sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-200/70">Витрина экипировки</p>
          <h2 className="mt-0.5 text-sm font-black text-white">Активный образ</h2>
        </div>
        <span className="shrink-0 rounded-lg border border-amber-300/25 bg-amber-300/5 px-2 py-1 text-[9px] font-black tabular-nums text-amber-100">{clothing.length}/5</span>
      </div>

      <div className="mt-2.5 grid w-full grid-cols-5 gap-1.5 sm:gap-2">
        {profileSlots.map((slot) => {
          const item = equippedBySlot.get(slot.id);
          const slotImage = PROFILE_SLOT_ART[slot.id];
          return (
            <article
              key={slot.id}
              className={`min-w-0 overflow-hidden rounded-xl border bg-[#111116] px-1 py-1.5 text-center ${item ? raritySurface[item.rarity] : 'border-zinc-800/90'}`}
            >
              <p className="truncate text-[7px] font-black uppercase tracking-wide text-zinc-400 sm:text-[8px]">{slot.label}</p>
              <div className="relative mt-1 aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-b from-white/[0.025] to-black/20">
                {!item ? (
                  <img src={slotImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain" loading="eager" />
                ) : isRenderableImageSource(item.image) ? (
                  <>
                    <img
                      src={`${PROFILE_ASSET_ROOT}/pedestal_base.webp`}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 z-0 h-[34%] w-full object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.75)]"
                      loading="eager"
                    />
                    <GameImage
                      source={item.image}
                      alt={item.name}
                      loading="eager"
                      className="absolute inset-x-0 top-[2%] z-10 h-[78%] w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] animate-fade-in"
                      fallback={<img src={slotImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain opacity-65" />}
                    />
                  </>
                ) : (
                  <img src={slotImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain opacity-80" loading="eager" />
                )}
              </div>
              <p className="mt-1 truncate text-[7px] font-bold leading-tight text-zinc-200 sm:text-[8px]" title={item?.name ?? 'Пусто'}>{item?.name ?? 'Пусто'}</p>
              {item && <p className={`mt-0.5 truncate text-[6px] font-black leading-tight tracking-wide sm:text-[7px] ${rarityText[item.rarity]}`}>{RARITY_LABELS[item.rarity]}</p>}
            </article>
          );
        })}
      </div>

      <section className="relative mt-3 overflow-hidden rounded-2xl border border-amber-300/25 bg-[#0b0b0e] p-2.5 sm:p-3">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-28 w-36 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] items-center gap-1.5 sm:gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.16em] text-amber-200/75"><CarFront size={12} /> Главная машина</p>
            {car ? (
              <>
                <h3 className="mt-1 truncate text-[11px] font-black text-white sm:text-sm" title={car.name}>{car.name}</h3>
                <LicensePlateDisplay plate={getCarLicensePlateDisplay(car, plates)} frameIds={frameIds} size="compact" className="mt-1.5" />
                <p className="mt-0.5 text-[8px] text-zinc-400 sm:text-[9px]">{car.mileage.toLocaleString('ru-RU')} км</p>
              </>
            ) : (
              <p className="mt-2 text-[9px] font-semibold leading-relaxed text-zinc-400 sm:text-[10px]">В гараже пусто</p>
            )}
          </div>
          <div className="relative flex h-[154px] min-w-0 items-end justify-center sm:h-[180px]">
            <img
              src={`${PROFILE_ASSET_ROOT}/empty_car_podium.webp`}
              alt=""
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 z-0 h-[88px] w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.85)] sm:h-[104px]"
              loading="eager"
            />
            {car && (
              <GameImage
                source={car.image}
                alt={car.name}
                loading="eager"
                className="absolute bottom-[34px] z-10 h-[118px] w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)] sm:bottom-[40px] sm:h-[140px]"
                fallback={<span className="absolute bottom-12 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[7px] font-semibold text-zinc-400">Изображение недоступно</span>}
              />
            )}
            {!car && <span className="absolute bottom-5 z-10 rounded-lg border border-white/10 bg-black/65 px-2 py-1 text-[7px] font-semibold text-zinc-400">В гараже пусто</span>}
          </div>
        </div>
      </section>
    </section>
  );
}

export { PROFILE_ASSET_ROOT };
