import { BadgeCheck, Share2, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RARITY_LABELS } from '../data/items';
import { calculateEquippedStats } from '../game/player';
import { formatRubles } from '../utils/currency';
import { impact } from '../utils/haptics';
import { playClick } from '../utils/sound';
import { ClothingItem, ClothingSlot, InventoryItem, PlayerState, Rarity } from '../types/game';
import ItemIcon from './ItemIcon';
import type { ActionResponse, GameAction, SeasonPassSnapshot } from '../types/server';
import { createId } from '../utils/id';
import { OWNER_RANK_TITLE, rankProgressForXp } from '../game/ranks';
import PlayerAvatar from './PlayerAvatar';
import { ProfileMemberCard, ProfileOutfitShowcase } from './ProfileShowcase';

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

const rarityClasses: Record<Rarity, string> = {
  common: 'border-zinc-700 text-zinc-300',
  uncommon: 'border-emerald-400/50 text-emerald-200',
  rare: 'border-blue-400/50 text-blue-200',
  epic: 'border-fuchsia-400/50 text-fuchsia-200',
  legendary: 'border-amber-300/60 text-amber-100',
  mythic: 'border-rose-300/60 text-rose-100',
};

const SLOT_LABELS: Record<ClothingSlot, string> = {
  head: 'Голова',
  torso: 'Верх',
  legs: 'Низ',
  shoes: 'Обувь',
  accessory: 'Аксессуар',
};

const slotName = (slot: ClothingSlot) => SLOT_LABELS[slot];

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
    () => Object.values(player.equippedClothing)
      .map((itemId) => player.inventory.find(
        (candidate): candidate is ClothingItem => candidate.id === itemId && candidate.type === 'clothing',
      ))
      .filter((item): item is ClothingItem => item !== undefined),
    [player.equippedClothing, player.inventory],
  );

  const collectionTopThree = useMemo(
    () => [...player.inventory].sort((first, second) => second.price - first.price).slice(0, 3),
    [player.inventory],
  );
  const collectionValue = player.inventory.reduce((total, item) => total + item.price, 0) +
    player.licensePlates.reduce((total, plate) => total + plate.price, 0);
  const collectionCount = player.inventory.length + player.licensePlates.length;
  const outfitValue = equippedItems.reduce((total, item) => total + item.price, 0) + (stats.activeCar?.price ?? 0);
  const shareText = `Мой образ в LootLand: ${equippedItems.length}/5 слотов · гараж ${stats.activeCar?.name ?? 'пешеход'} · коллекция ${formatRubles(collectionValue)} · Респект ${player.respect.toLocaleString('ru-RU')}`;

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

      <ProfileMemberCard
        name={playerName}
        avatarUrl={avatarUrl ?? player.avatarUrl}
        rankTitle={rankTitle}
        rankPosition={rankPosition}
        xp={player.xp ?? 0}
        seasonName={season?.season?.name}
        seasonLevel={season?.level}
        isPremiumPass={season?.isPremiumPass}
        collectionCount={collectionCount}
        collectionValue={collectionValue}
        respect={player.respect}
        balance={player.balance}
      />
      {season?.season && <p className="-mt-3 text-right text-[8px] font-semibold text-zinc-400">VIP Pass: {season.season.premiumPriceStars} XTR</p>}

      <section className="rounded-2xl border border-amber-300/15 bg-[#111116] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.26)]">
        <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
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
        </div>
      </section>

      <ProfileOutfitShowcase clothing={equippedItems} car={stats.activeCar} plates={player.licensePlates} />
      <p className="-mt-2 text-right text-[10px] font-semibold text-zinc-500">Стоимость надетого: <span className="text-amber-200">{formatRubles(outfitValue)}</span></p>

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
          <Share2 size={16} /> Поделиться профилем
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
              <h2 id="share-title" className="mt-2 text-2xl font-black text-white">Мой образ</h2>
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
                    <p className="mt-1 text-sm font-black text-orange-200">{player.respect.toLocaleString('ru-RU')}</p>
                  </div>
                </div>
                <p className="mt-3 truncate text-[10px] text-zinc-500">Машина: {stats.activeCar?.name ?? 'Пока не выбрана'}</p>
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
