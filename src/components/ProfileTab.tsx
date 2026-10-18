import { BadgeCheck, CarFront, Cpu, Crown, Share2, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RARITY_LABELS } from '../data/items';
import { calculateEquippedStats } from '../game/player';
import { formatRubles } from '../utils/currency';
import { impact } from '../utils/haptics';
import { playClick } from '../utils/sound';
import { CarItem, ClothingItem, ClothingSlot, InventoryItem, LicensePlateItem, PlayerState, Rarity } from '../types/game';
import ItemIcon from './ItemIcon';
import { getCarLicensePlateDisplay } from '../game/licensePlates';
import type { ActionResponse, GameAction, SeasonPassSnapshot } from '../types/server';
import { createId } from '../utils/id';
import RankBadge from './RankBadge';
import { OWNER_RANK_TITLE, rankProgressForXp } from '../game/ranks';
import PlayerAvatar from './PlayerAvatar';
import GenesisSceneBackdrop from './GenesisSceneBackdrop';

interface ProfileTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  onOpenInventory: () => void;
  rankTitle: string;
  playerName: string;
  rankPosition: number;
  avatarUrl?: string;
  season?: SeasonPassSnapshot;
}

const slots: { id: ClothingSlot; label: string; icon: string }[] = [
  { id: 'head', label: 'Голова', icon: '🧢' },
  { id: 'torso', label: 'Верх', icon: '🧥' },
  { id: 'legs', label: 'Низ', icon: '👖' },
  { id: 'shoes', label: 'Обувь', icon: '👟' },
  { id: 'accessory', label: 'Аксессуар', icon: '🎒' },
];

const rarityClasses: Record<Rarity, string> = {
  common: 'border-zinc-700 text-zinc-300',
  uncommon: 'border-emerald-400/50 text-emerald-200',
  rare: 'border-blue-400/50 text-blue-200',
  epic: 'border-fuchsia-400/50 text-fuchsia-200',
  legendary: 'border-amber-300/60 text-amber-100',
  mythic: 'border-rose-300/60 text-rose-100',
};

const slotName = (slot: ClothingSlot) => slots.find((entry) => entry.id === slot)?.label ?? 'Одежда';

function ClothingSlotCard({ slot, item }: { slot: (typeof slots)[number]; item?: ClothingItem }) {
  return (
    <div className={`min-w-0 rounded-xl border bg-[#0e0e12] p-2 ${item ? rarityClasses[item.rarity] : 'border-zinc-800 text-zinc-600'}`}>
      <div className="flex items-center justify-center gap-0.5">
        <span className="truncate text-[8px] font-black uppercase tracking-wide">{slot.label}</span>
      </div>
      <div className="mt-1 flex h-12 items-center justify-center">
        {item ? <ItemIcon item={item} size="md" /> : <span className="text-xl opacity-35" aria-hidden="true">{slot.icon}</span>}
      </div>
      <p className="mt-1 truncate text-center text-[8px] font-bold text-zinc-400" title={item?.name ?? 'Свободно'}>
        {item?.name ?? 'Свободно'}
      </p>
    </div>
  );
}

function VehicleCard({ car, licensePlates }: { car?: CarItem; licensePlates: LicensePlateItem[] }) {
  return (
    <div className={`relative mt-3 overflow-hidden rounded-2xl border p-3 ${car ? `${rarityClasses[car.rarity]} bg-[#0c0c10]/90` : 'border-zinc-800 bg-[#0c0c10]/70 text-zinc-500'}`}>
      {car ? (
        <>
          <ItemIcon item={car} size="xl" className="absolute -right-3 -top-5 opacity-15" />
          <div className="relative flex items-center gap-3.5">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[#111318] p-2">
              <ItemIcon item={car} size="xl" className="!h-full !w-full !max-h-full !max-w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">Сейчас в гараже</p>
              <p className="truncate text-sm font-black text-white">{car.name}</p>
              <p className="font-mono text-[10px] text-zinc-400">{getCarLicensePlateDisplay(car, licensePlates)} · {car.wear.toFixed(1)}%</p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <CarFront size={28} className="shrink-0 opacity-30" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em]">В гараже пока пусто</p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-400">Первую машину можно выбить в контейнерах.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturedItem({ item, rank }: { item?: InventoryItem; rank: number }) {
  return (
    <article className={`relative min-w-0 overflow-hidden rounded-2xl border bg-[#111116] p-2 shadow-[0_16px_30px_rgba(0,0,0,0.3)] ${item ? rarityClasses[item.rarity] : 'border-zinc-800'}`}>
      <div className="relative grid h-[92px] place-items-center overflow-hidden rounded-xl border border-white/5 bg-gradient-to-b from-[#19171a] to-[#09090b]">
        {item ? <ItemIcon item={item} size="lg" showcase className="!h-[76px] !w-[76px] !max-h-full !max-w-full !border-0 !bg-transparent !bg-none !shadow-none" /> : <span className="text-2xl text-zinc-600">◇</span>}
        <span className={`absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md border text-[8px] font-black ${rank === 1 ? 'border-amber-300/50 bg-amber-300/15 text-amber-100' : 'border-white/15 bg-black/40 text-zinc-300'}`}>#{rank}</span>
      </div>
      {item ? (
        <>
          <p className="mt-2 truncate text-[10px] font-black text-white" title={item.name}>{item.name}</p>
          <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wide text-zinc-500">{item.type === 'car' ? 'Автомобиль' : `${RARITY_LABELS[item.rarity]} · ${slotName(item.slot)}`}</p>
          <p className="mt-1.5 truncate text-[10px] font-black tabular-nums text-amber-100">{formatRubles(item.price)}</p>
        </>
      ) : (
        <p className="mt-2 text-center text-[8px] font-semibold text-zinc-600">Место свободно</p>
      )}
    </article>
  );
}

export default function ProfileTab({ player, onAction, onOpenInventory, rankTitle, playerName, rankPosition, avatarUrl, season }: ProfileTabProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const stats = calculateEquippedStats(player);
  const rankProgress = rankProgressForXp(player.xp ?? 0);
  const isOwnerRank = rankTitle === OWNER_RANK_TITLE;

  const equippedItems = useMemo(
    () => slots.flatMap((slot) => {
      const itemId = player.equippedClothing[slot.id];
      const item = player.inventory.find(
        (candidate): candidate is ClothingItem => candidate.id === itemId && candidate.type === 'clothing',
      );
      return item ? [item] : [];
    }),
    [player.equippedClothing, player.inventory],
  );

  const collectionTopThree = useMemo(
    () => [...player.inventory].sort((first, second) => second.price - first.price).slice(0, 3),
    [player.inventory],
  );
  const passLabel = season ? (season.isPremiumPass ? 'VIP PASS' : 'FREE PASS') : 'SEASON PASS';
  const collectionValue = player.inventory.reduce((total, item) => total + item.price, 0) +
    player.licensePlates.reduce((total, plate) => total + plate.price, 0);
  const collectionCount = player.inventory.length + player.licensePlates.length;
  const outfitValue = equippedItems.reduce((total, item) => total + item.price, 0) + (stats.activeCar?.price ?? 0);
  const shareText = `Мой лук в LootLand: ${equippedItems.length}/5 слотов · гараж ${stats.activeCar?.name ?? 'пешеход'} · коллекция ${formatRubles(collectionValue)} · Респект ${player.respect.toLocaleString('ru-RU')}`;

  const shareOutfit = async () => {
    try {
      impact('light');
      playClick();
      if (navigator.share) {
        await navigator.share({ title: 'Мой лук в LootLand', text: shareText });
        setShareMessage('Визитка отправлена.');
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareMessage('Описание лука скопировано. Можно отправить друзьям.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Не удалось поделиться визиткой LootLand.', error);
      setShareMessage('Не получилось отправить автоматически — сделай скриншот этой визитки.');
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300/80">Genesis · Black member dossier</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Профиль</h1>
      </div>

      <article className="relative isolate overflow-hidden rounded-[28px] border border-amber-400/30 bg-[#09090b] shadow-[0_22px_54px_rgba(0,0,0,0.5)]">
        <GenesisSceneBackdrop scene="profile" className="opacity-50" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#09090b]/94 via-[#09090b]/79 to-[#09090b]/40" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#09090b]/95 via-transparent to-black/20" />
        <div className="relative z-10 p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <PlayerAvatar photoUrl={avatarUrl} name={playerName} className="h-14 w-14 shrink-0 rounded-2xl border border-amber-300/40 text-lg shadow-[0_0_24px_rgba(214,171,93,0.16)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-200/80">LOOTLAND // BLACK MEMBER</p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <RankBadge title={rankTitle} />
                <p className="min-w-0 truncate text-sm font-black text-white">{playerName || 'Игрок'}</p>
              </div>
              <p className="mt-1 truncate text-[9px] font-bold text-zinc-300/65">🏆 {rankPosition ? `#${rankPosition} в рейтинге` : 'Рейтинг игрока'} · {(player.xp ?? 0).toLocaleString('ru-RU')} XP</p>
            </div>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/35 bg-black/50 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" aria-label="Карбоновый членский чип">
              <Cpu size={22} strokeWidth={1.5} />
            </div>
          </div>

          {season?.season && (
            <div className="mt-4 flex items-end justify-between gap-2 border-t border-amber-100/15 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-300/35 bg-gradient-to-br from-amber-200/20 to-black/40 text-amber-100"><Crown size={17} /></div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Сезон {season.season.name} · уровень {season.level}/30</p>
                  <p className="mt-0.5 truncate text-[10px] font-bold text-amber-100">{season.season.name}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[8px] font-black tracking-[0.14em] ${season.isPremiumPass ? 'border-amber-300/55 bg-amber-300/15 text-amber-100' : 'border-white/20 bg-black/50 text-zinc-200'}`}>{passLabel}</span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-xl border border-white/10 bg-black/45 px-2 py-2">
              <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400">Баланс ₽</p>
              <p className="mt-1 truncate text-[10px] font-black tabular-nums text-white" title={formatRubles(player.balance)}>{formatRubles(player.balance)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/45 px-2 py-2">
              <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400">Респект</p>
              <p className="mt-1 truncate text-[10px] font-black tabular-nums text-amber-100">{player.respect.toLocaleString('ru-RU')}</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-black/45 px-2 py-2">
              <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400">Коллекция</p>
              <p className="mt-1 truncate text-[10px] font-black tabular-nums text-amber-100" title={formatRubles(collectionValue)}>{formatRubles(collectionValue)}</p>
            </div>
          </div>
          {season?.season && <p className="mt-2 text-right text-[8px] font-semibold text-zinc-300/65">Цена VIP Pass: {season.season.premiumPriceStars} ⭐ XTR</p>}

          <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wide">
              <span className="text-zinc-400">{isOwnerRank ? 'Особое звание' : rankProgress.nextRank ? 'До следующего звания' : 'Максимальный ранг'}</span>
              <span className="shrink-0 text-amber-200">{isOwnerRank ? 'Владелец LootLand' : rankProgress.nextRank ? `ещё ${rankProgress.xpToNext.toLocaleString('ru-RU')} XP` : 'достигнут'}</span>
            </div>
            {!isOwnerRank && (
              <>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/70" role="progressbar" aria-label="Прогресс до следующего звания" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rankProgress.progress)}>
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-300 to-amber-100 transition-[width]" style={{ width: `${rankProgress.progress}%` }} />
                </div>
                <p className="mt-1.5 truncate text-[9px] font-semibold text-zinc-300/60">
                  {rankProgress.nextRank
                    ? `Следующее: ${rankProgress.nextRank.title} · ${rankProgress.nextRank.xp.toLocaleString('ru-RU')} XP`
                    : 'Все звания получены'}
                </p>
              </>
            )}
            {isOwnerRank && <p className="mt-1.5 text-[9px] font-semibold text-zinc-300/60">Уникальное звание не зависит от опыта.</p>}
          </div>
        </div>
      </article>

      <section className="rounded-2xl border border-amber-300/15 bg-[#111116] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.26)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Текущий образ</p>
            <h2 className="mt-1 text-sm font-black text-white">Экипировка и машина</h2>
          </div>
          <span className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-2 py-1 text-[10px] font-black tabular-nums text-amber-200">
            {equippedItems.length}/5
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${equippedItems.length * 20}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 min-[390px]:grid-cols-5">
          {slots.map((slot) => (
            <ClothingSlotCard
              key={slot.id}
              slot={slot}
              item={equippedItems.find((item) => item.slot === slot.id)}
            />
          ))}
        </div>
        <VehicleCard car={stats.activeCar} licensePlates={player.licensePlates} />
        <p className="mt-2 text-right text-[10px] font-semibold text-zinc-500">Стоимость надетого: <span className="text-amber-200">{formatRubles(outfitValue)}</span></p>
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Витрина · {collectionCount} предметов</p>
            <h2 className="mt-1 text-lg font-black text-white">Топ-3 по стоимости</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              impact('light');
              playClick();
              onOpenInventory();
            }}
            className="shrink-0 rounded-lg border border-amber-300/20 bg-amber-300/5 px-2.5 py-2 text-[10px] font-black text-amber-100 transition hover:bg-amber-300/10"
          >
            В инвентарь
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <FeaturedItem key={collectionTopThree[index]?.id ?? `empty-${index + 1}`} item={collectionTopThree[index]} rank={index + 1} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/15 bg-[#111116] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.26)]">
        <div className="flex items-center gap-2">
          <BadgeCheck size={17} className="text-amber-300" />
          <h2 className="text-sm font-black text-white">Бонус сета</h2>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-zinc-800 bg-black/20 px-3 py-3">
          <Sparkles size={15} className={stats.hasFullSet ? 'mt-0.5 shrink-0 text-amber-300' : 'mt-0.5 shrink-0 text-zinc-600'} />
          <p className="text-[10px] leading-relaxed text-zinc-400">
            {stats.hasFullSet ? '+20% к респекту за полный комплект активен!' : `Надень все 5 слотов одежды (${equippedItems.length}/5), чтобы получить +20% к респекту.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            impact('light');
            playClick();
            setShareMessage('');
            setShareOpen(true);
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-3 text-sm font-black text-[#151719] shadow-lg shadow-black/20 transition hover:bg-amber-300"
        >
          <Share2 size={16} /> Похвастаться луком 🔥
        </button>
      </section>

      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-title"
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-300/25 bg-[#0e0e12] p-5 shadow-2xl shadow-black/50">
            <button
              type="button"
              onClick={() => setShareOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
              aria-label="Закрыть визитку"
            >
              <X size={17} />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">LootLand · LOOKBOOK</p>
              <h2 id="share-title" className="mt-2 text-2xl font-black text-white">Мой лук 🔥</h2>
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-[#151719] p-4">
                <div className="flex items-center gap-3">
                  <PlayerAvatar photoUrl={avatarUrl} name={playerName} className="h-14 w-14 rounded-2xl text-lg" />
                  <div>
                    <p className="font-black text-white">Уличный стиль</p>
                    <p className="text-[10px] text-zinc-500">{equippedItems.length}/5 слотов экипировано</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {equippedItems.length ? equippedItems.map((item) => (
                    <span key={item.id} className={`inline-flex items-center gap-1 rounded-full border bg-black/20 py-1 pl-1 pr-2.5 text-[10px] font-bold ${rarityClasses[item.rarity]}`}>
                      <ItemIcon item={item} size="sm" className="h-5 w-5" /> {slotName(item.slot)}
                    </span>
                  )) : <span className="text-xs text-zinc-500">Собираю свой первый сет…</span>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-black/30 p-2.5">
                    <p className="text-[9px] uppercase text-zinc-500">Лук + гараж</p>
                    <p className="mt-1 text-sm font-black text-amber-200">{formatRubles(outfitValue)}</p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2.5">
                    <p className="text-[9px] uppercase text-zinc-500">Респект</p>
                    <p className="mt-1 text-sm font-black text-orange-200">🔥 {player.respect.toLocaleString('ru-RU')}</p>
                  </div>
                </div>
                <p className="mt-3 truncate text-[10px] text-zinc-500">🚗 {stats.activeCar?.name ?? 'Пока без тачки'}</p>
              </div>
              {shareMessage && <p role="status" className="mt-3 text-center text-xs text-amber-200">{shareMessage}</p>}
              <button
                type="button"
                onClick={shareOutfit}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-3 text-sm font-black text-[#151719]"
              >
                <Share2 size={15} /> Поделиться визиткой
              </button>
              <p className="mt-2 text-center text-[9px] text-zinc-600">Можно сделать скриншот этой карточки и отправить в чат.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
