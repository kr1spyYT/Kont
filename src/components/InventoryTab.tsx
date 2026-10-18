import { Check, PackageOpen, Star, UserRound } from 'lucide-react';
import { useState } from 'react';
import { RARITY_LABELS } from '../data/items';
import { getQuickSellEligibleItems, getQuickSellValue, getResaleValue } from '../game/economy';
import { formatRubles } from '../utils/currency';
import { impact } from '../utils/haptics';
import { playClick } from '../utils/sound';
import { ClothingItem, InventoryItem, LicensePlateItem, LicensePlateRarity, LicensePlateSaleFilter, PlayerState, Rarity } from '../types/game';
import ItemIcon from './ItemIcon';
import LicensePlateDisplay from './LicensePlateDisplay';
import { getCarLicensePlateDisplay, getLicensePlateValuation, getSellableLicensePlates, LICENSE_PLATE_RARITIES, LICENSE_PLATE_RARITY_LABELS } from '../game/licensePlates';
import type { ActionResponse, GameAction } from '../types/server';
import { createId } from '../utils/id';

interface InventoryTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  onOpenGarage: () => void;
}

type InventoryFilter = 'all' | 'clothing' | 'car' | 'plates';

const rarityClasses: Record<Rarity, string> = {
  common: 'border-zinc-700 text-zinc-300',
  uncommon: 'border-emerald-400/50 text-emerald-200',
  rare: 'border-blue-400/50 text-blue-200',
  epic: 'border-fuchsia-400/50 text-fuchsia-200',
  legendary: 'border-amber-300/60 text-amber-100',
  mythic: 'border-rose-300/60 text-rose-100',
};

const rarityGlow: Record<Rarity, string> = {
  common: 'shadow-zinc-500/10',
  uncommon: 'shadow-emerald-500/20',
  rare: 'shadow-blue-500/20',
  epic: 'shadow-fuchsia-500/20',
  legendary: 'shadow-amber-400/25',
  mythic: 'shadow-rose-400/30',
};

const plateRarityClasses: Record<LicensePlateRarity, string> = {
  common: 'border-zinc-700 text-zinc-300',
  uncommon: 'border-emerald-400/50 text-emerald-200',
  rare: 'border-blue-400/50 text-blue-200',
  epic: 'border-fuchsia-400/50 text-fuchsia-200',
  legendary: 'border-amber-300/60 text-amber-100',
  mythic: 'border-rose-300/60 text-rose-100',
  secret: 'border-violet-300/60 text-violet-100',
};

const slotNames: Record<ClothingItem['slot'], string> = {
  head: 'Голова',
  torso: 'Верх',
  legs: 'Низ',
  shoes: 'Обувь',
  accessory: 'Аксессуар',
};

function InventoryCard({
  item,
  equipped,
  plateLabel,
  frameIds,
  onToggle,
  onSell,
}: {
  item: InventoryItem;
  equipped: boolean;
  plateLabel?: string;
  frameIds: readonly string[];
  onToggle: (item: InventoryItem) => void;
  onSell: (item: InventoryItem) => void;
}) {
  const car = item.type === 'car';
  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-[#111116] p-3 shadow-[0_18px_38px_rgba(0,0,0,0.34)] ${rarityClasses[item.rarity]} ${rarityGlow[item.rarity]}`}>
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/10 bg-[#09090b] p-2 sm:h-24 sm:w-24">
          <ItemIcon item={item} size="xl" showcase className="!h-full !w-full !max-h-full !max-w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 truncate text-sm font-black text-white">{item.name}</h3>
            <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${rarityClasses[item.rarity]}`}>
              {RARITY_LABELS[item.rarity]}
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-zinc-400">
            {item.serial.replace('/500', '')} <span className="text-zinc-700">·</span> {item.wear.toFixed(1)}%
            {car && <> <span className="text-zinc-700">·</span> {item.mileage.toLocaleString('ru-RU')} км</>}
          </p>
          {car ? (
            <div className="mt-2">
              <p className="mb-1 text-[8px] font-black uppercase tracking-wide text-zinc-500">Госномер</p>
              <LicensePlateDisplay plate={plateLabel} frameIds={frameIds} size="compact" />
            </div>
          ) : (
            <p className="mt-1 text-[10px] text-amber-200">
              {item.authenticity === 'unverified' ? '❓ Не проверен на легит' : item.authenticity === 'original' ? 'Оригинал' : 'Паль'}
              <span className="text-zinc-700"> · </span>{slotNames[item.slot]}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/25 px-2.5 py-2">
        <div>
          <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Рынок</p>
          <p className="mt-0.5 truncate text-[11px] font-black tabular-nums text-amber-100">{formatRubles(item.price)}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Респект</p>
          <p className="mt-0.5 truncate text-[11px] font-black tabular-nums text-amber-100">⭐ +{item.respect.toLocaleString('ru-RU')}</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onToggle(item)}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-black transition ${
            equipped
              ? 'border border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-rose-400/10 hover:text-rose-200'
              : 'bg-amber-400 text-[#151719] hover:bg-amber-300'
          }`}
        >
          {equipped ? <Check size={13} /> : <UserRound size={13} />}
          {equipped ? 'Снять' : car ? 'В профиль' : 'Надеть'}
        </button>
        <button
          type="button"
          disabled={equipped}
          onClick={() => onSell(item)}
          title={equipped ? 'Сначала снимите предмет с персонажа или уберите машину из профиля' : undefined}
          className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-2 py-2.5 text-[10px] font-black text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600"
        >
          {equipped ? 'Сначала снять' : `⚡ Продать за ${formatRubles(getQuickSellValue(item))}`}
        </button>
      </div>
    </article>
  );
}

function LicensePlateCard({ plate, installed, favorite, seasonFrame, installLabel, installDisabled, onInstall, onSell, onToggleFavorite }: {
  plate: LicensePlateItem;
  installed: boolean;
  favorite: boolean;
  seasonFrame: boolean;
  installLabel: string;
  installDisabled: boolean;
  onInstall: () => void;
  onSell: () => void;
  onToggleFavorite: () => void;
}) {
  const valuation = getLicensePlateValuation(plate.plate);
  return (
    <article className={`rounded-2xl border bg-[#111116] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.32)] ${plateRarityClasses[valuation.rarity]}`}>
      <div className="flex items-center gap-3">
        <LicensePlateDisplay plate={plate.plate} frameIds={seasonFrame ? ['season-01-vip'] : []} size="large" />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{seasonFrame ? 'SEASON 01 // VIP' : 'Номерной знак'}</p>
          <p className={`mt-1 text-[10px] font-black ${plateRarityClasses[valuation.rarity]}`}>{LICENSE_PLATE_RARITY_LABELS[valuation.rarity]} · ×{valuation.multiplier}</p>
          {valuation.specialTitle && <p className="mt-1 text-[10px] font-black text-violet-200">✨ {valuation.specialTitle}</p>}
          <p className="mt-1 text-[10px] font-bold text-zinc-400">{installed ? 'Установлен на машине' : favorite ? '⭐ Избранное · защищён от продажи' : 'В коллекции'}</p>
          <p className="mt-1 text-xs font-black text-white">{formatRubles(plate.price)}</p>
        </div>
        <button type="button" aria-label={favorite ? `Убрать ${plate.plate} из избранного` : `Добавить ${plate.plate} в избранное`} aria-pressed={favorite} onClick={onToggleFavorite} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${favorite ? 'border-amber-300/40 bg-amber-300/10 text-amber-200' : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-amber-200'}`}>
          <Star size={17} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={installDisabled} onClick={onInstall} className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2 py-2.5 text-[10px] font-black text-[#151719] hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
          <UserRound size={13} /> {installLabel}
        </button>
        <button type="button" disabled={installed || favorite} onClick={onSell} title={favorite ? 'Сначала уберите номер из избранного' : undefined} className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-2 py-2.5 text-[10px] font-black text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600">
          {installed ? 'Сначала снять' : favorite ? 'Снять избранное' : `Продать за ${formatRubles(getResaleValue(plate))}`}
        </button>
      </div>
    </article>
  );
}

export default function InventoryTab({ player, onAction, onOpenGarage }: InventoryTabProps) {
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [inventoryMessage, setInventoryMessage] = useState('');
  const [plateSaleFilter, setPlateSaleFilter] = useState<LicensePlateSaleFilter>('all');
  const [confirmPlateSale, setConfirmPlateSale] = useState(false);
  const [plateSalePending, setPlateSalePending] = useState(false);
  const [itemSaleCandidate, setItemSaleCandidate] = useState<InventoryItem>();
  const [junkSalePending, setJunkSalePending] = useState(false);
  const [confirmJunkSale, setConfirmJunkSale] = useState(false);
  const equippedIds = new Set(Object.values(player.equippedClothing).filter((id): id is string => Boolean(id)));
  if (player.activeCarId) equippedIds.add(player.activeCarId);
  const installedCarByPlate = new Map(
    player.inventory.flatMap((item) => item.type === 'car' && item.licensePlateId ? [[item.licensePlateId, item] as const] : []),
  );

  const toggleEquipment = (item: InventoryItem) => {
    setInventoryMessage('');
    impact('medium');
    playClick();
    if (item.type === 'car') {
      void onAction({ type: 'set-active-car', carId: item.id, requestId: createId('car-equip') });
      return;
    }
    void onAction({ type: 'equip-clothing', itemId: item.id, slot: item.slot, requestId: createId('clothing-equip') });
  };

  const sellFromInventory = (item: InventoryItem) => {
    if (equippedIds.has(item.id)) {
      setInventoryMessage('Сначала снимите предмет или уберите машину из профиля.');
      return;
    }
    setInventoryMessage('');
    setItemSaleCandidate(item);
  };

  const confirmItemSale = async () => {
    const item = itemSaleCandidate;
    if (!item) return;
    impact('medium');
    playClick();
    const response = await onAction({ type: 'quick-sell-item', itemId: item.id, requestId: createId('quick-sell-item') });
    if (response) setInventoryMessage(response.result?.message ?? `${item.name} быстро продан за ${formatRubles(getQuickSellValue(item))}.`);
    setItemSaleCandidate(undefined);
  };

  const sellJunk = async () => {
    if (junkSalePending) return;
    setJunkSalePending(true);
    try {
      const response = await onAction({ type: 'quick-sell-junk', requestId: createId('quick-sell-junk') });
      if (response) {
        setInventoryMessage(response.result?.message ?? `Продано предметов: ${response.result?.soldCount ?? eligibleJunk.length}.`);
        setConfirmJunkSale(false);
      } else setInventoryMessage('Продажа не выполнена. Проверь соединение и попробуй ещё раз.');
    } finally {
      setJunkSalePending(false);
    }
  };

  const togglePlateOnActiveCar = (plate: LicensePlateItem) => {
    const activeCar = player.inventory.find((item) => item.id === player.activeCarId && item.type === 'car');
    if (!activeCar || activeCar.type !== 'car') {
      setInventoryMessage('Сначала выбери машину в гараже, затем установи на неё номер.');
      return;
    }
    const removeFromActiveCar = activeCar.licensePlateId === plate.id;
    void onAction({ type: 'set-car-plate', carId: activeCar.id, plateId: removeFromActiveCar ? undefined : plate.id, requestId: createId('plate-install') }).then((response) => {
      if (response) setInventoryMessage(removeFromActiveCar ? `${plate.plate} снят с машины и возвращён в коллекцию.` : `${plate.plate} установлен на ${activeCar.name}.`);
    });
    impact('medium');
    playClick();
  };

  const sellPlate = (plate: LicensePlateItem) => {
    if (installedCarByPlate.has(plate.id)) {
      setInventoryMessage('Сначала сними номер с машины в гараже.');
      return;
    }
    if (player.favoriteLicensePlateIds.includes(plate.id)) {
      setInventoryMessage('Номер защищён избранным. Убери его из избранного, чтобы продать.');
      return;
    }
    impact('medium');
    playClick();
    void onAction({ type: 'sell-license-plate', plateId: plate.id, requestId: createId('sell-plate') }).then((response) => {
      if (response) setInventoryMessage(`${plate.plate} продан перекупу за ${formatRubles(getResaleValue(plate))}.`);
    });
  };

  const toggleFavoritePlate = (plate: LicensePlateItem) => {
    const favorite = !player.favoriteLicensePlateIds.includes(plate.id);
    void onAction({ type: 'set-license-plate-favorite', plateId: plate.id, favorite, requestId: createId('plate-favorite') }).then((response) => {
      if (response) setInventoryMessage(favorite ? `${plate.plate} защищён избранным.` : `${plate.plate} убран из избранного.`);
    });
  };

  const sellSelectedPlates = async () => {
    if (plateSalePending) return;
    const currentEligible = getSellableLicensePlates(player.licensePlates, new Set<string>(installedCarByPlate.keys()), plateSaleFilter, new Set(player.favoriteLicensePlateIds));
    if (!currentEligible.length) {
      setInventoryMessage('Нет свободных номеров для выбранной продажи.');
      setConfirmPlateSale(false);
      return;
    }
    setPlateSalePending(true);
    impact('medium');
    playClick();
    try {
      const response = await onAction({ type: 'sell-license-plates', rarity: plateSaleFilter, requestId: createId('sell-plates') });
      if (response) {
        setInventoryMessage(response.result?.message ?? `Продано номеров: ${currentEligible.length}.`);
        setConfirmPlateSale(false);
      } else {
        setInventoryMessage('Продажа не выполнена. Попробуй ещё раз.');
      }
    } catch {
      setInventoryMessage('Продажа не выполнена. Проверь соединение и попробуй ещё раз.');
    } finally {
      setPlateSalePending(false);
    }
  };

  const visibleItems = player.inventory.filter((item) => filter === 'all' || item.type === filter);
  const visiblePlates = filter === 'all' || filter === 'plates' ? player.licensePlates : [];
  const eligibleJunk = getQuickSellEligibleItems(player.inventory, equippedIds);
  const estimatedJunkProceeds = eligibleJunk.reduce((total, item) => total + getQuickSellValue(item), 0);
  const sellablePlates = getSellableLicensePlates(player.licensePlates, new Set<string>(installedCarByPlate.keys()), plateSaleFilter, new Set(player.favoriteLicensePlateIds));
  const estimatedBulkProceeds = sellablePlates.reduce((total, plate) => total + getResaleValue(plate), 0);
  const ownedCars = player.inventory.filter((item) => item.type === 'car');
  const activeCar = ownedCars.find((car) => car.id === player.activeCarId);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Private wardrobe · коллекция</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Инвентарь</h1>
          <p className="mt-1 text-xs text-zinc-500">Одежда, машины и коллекция номеров.</p>
        </div>
        <span className="shrink-0 rounded-lg border border-amber-300/15 bg-[#111116] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">
          {player.inventory.length} предметов · {player.licensePlates.length} номеров
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-xl border border-amber-300/15 bg-[#111116] p-1">
        {([
          ['all', 'Все'],
          ['clothing', 'Шмот 🧥'],
          ['car', 'Тачки 🚗'],
          ['plates', 'Номера 🔢'],
        ] as [InventoryFilter, string][]).map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`rounded-lg border px-2 py-2 text-[10px] font-black transition ${
              filter === id ? 'border-amber-300/25 bg-gradient-to-b from-amber-300/20 to-transparent text-amber-100' : 'border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {inventoryMessage && (
        <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          {inventoryMessage}
        </p>
      )}
      {itemSaleCandidate && (
        <div role="alertdialog" aria-label="Подтверждение быстрой продажи" className="rounded-2xl border border-rose-300/25 bg-rose-400/[0.06] p-3">
          <p className="text-xs font-bold text-white">Продать «{itemSaleCandidate.name}» за {formatRubles(getQuickSellValue(itemSaleCandidate))}? Начислится +10 XP сезона.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void confirmItemSale()} className="rounded-lg bg-rose-300 px-2 py-2.5 text-[10px] font-black text-[#17140c]">Подтвердить продажу</button>
            <button type="button" onClick={() => setItemSaleCandidate(undefined)} className="rounded-lg border border-zinc-700 px-2 py-2.5 text-[10px] font-black text-zinc-300">Оставить</button>
          </div>
        </div>
      )}
      {player.inventory.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-emerald-300/20 bg-[#111116] p-3" aria-label="Быстрая продажа хлама">
          <div><h2 className="text-sm font-black text-white">⚡ Быстрая продажа хлама</h2><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Только обычные и необычные вещи. Редкие, экипированные машины и автомобили с госномером будут оставлены.</p></div>
          <p className="text-[10px] font-bold text-emerald-100">К продаже: {eligibleJunk.length} · оценка {formatRubles(estimatedJunkProceeds)} ₽ · до +{eligibleJunk.length * 10} XP сезона</p>
          {!confirmJunkSale ? (
            <button type="button" disabled={!eligibleJunk.length || junkSalePending} onClick={() => setConfirmJunkSale(true)} className="w-full rounded-xl bg-emerald-300 px-3 py-3 text-xs font-black text-[#101612] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">Продать весь защищённый хлам</button>
          ) : (
            <div className="space-y-2 rounded-xl border border-rose-300/20 bg-rose-400/5 p-3" role="alertdialog" aria-label="Подтверждение массовой продажи">
              <p className="text-xs font-bold text-white">Подтвердить продажу {eligibleJunk.length} предметов за ≈ {formatRubles(estimatedJunkProceeds)}?</p>
              <div className="grid grid-cols-2 gap-2"><button type="button" disabled={junkSalePending} onClick={() => void sellJunk()} className="rounded-lg bg-rose-300 px-2 py-2.5 text-[10px] font-black text-[#17140c] disabled:opacity-50">{junkSalePending ? 'Продаём…' : 'Подтвердить'}</button><button type="button" disabled={junkSalePending} onClick={() => setConfirmJunkSale(false)} className="rounded-lg border border-zinc-700 px-2 py-2.5 text-[10px] font-black text-zinc-300 disabled:opacity-50">Отмена</button></div>
            </div>
          )}
        </section>
      )}
      {visiblePlates.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-300/20 bg-zinc-900/80 p-3" aria-label="Массовая продажа номеров">
          <div>
            <h2 className="text-sm font-black text-white">Быстрая продажа номеров</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Избранные и установленные номера защищены от продажи. Оценка примерная, итоговую сумму рассчитает сервер.</p>
          </div>
          <label className="block text-[10px] font-bold text-zinc-400">
            Какие номера продать?
            <select
              aria-label="Редкость номеров для продажи"
              value={plateSaleFilter}
              disabled={plateSalePending}
              onChange={(event) => { setPlateSaleFilter(event.target.value as LicensePlateSaleFilter); setConfirmPlateSale(false); }}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400 disabled:opacity-50"
            >
              <option value="all">Все редкости</option>
              {LICENSE_PLATE_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{LICENSE_PLATE_RARITY_LABELS[rarity]}</option>)}
            </select>
          </label>
          <p className="text-[10px] font-bold text-amber-100">Свободных к продаже: {sellablePlates.length} · оценка ≈ {formatRubles(estimatedBulkProceeds)}</p>
          {!confirmPlateSale ? (
            <button
              type="button"
              disabled={sellablePlates.length === 0 || plateSalePending}
              onClick={() => { setInventoryMessage(''); setConfirmPlateSale(true); }}
              className="w-full rounded-xl bg-amber-400 px-3 py-3 text-xs font-black text-[#151719] hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {plateSaleFilter === 'all' ? 'Продать все свободные номера' : `Продать номера: ${LICENSE_PLATE_RARITY_LABELS[plateSaleFilter]}`}
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-rose-300/20 bg-rose-400/5 p-3" role="alertdialog" aria-label="Подтверждение продажи номеров">
              <p className="text-xs font-bold text-white">Подтвердить продажу {sellablePlates.length} номеров за ≈ {formatRubles(estimatedBulkProceeds)}?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={plateSalePending} onClick={() => void sellSelectedPlates()} className="rounded-lg bg-rose-400 px-2 py-2.5 text-[10px] font-black text-[#151719] disabled:opacity-50">
                  {plateSalePending ? 'Продаём…' : 'Подтвердить'}
                </button>
                <button type="button" disabled={plateSalePending} onClick={() => setConfirmPlateSale(false)} className="rounded-lg border border-zinc-700 px-2 py-2.5 text-[10px] font-black text-zinc-300 disabled:opacity-50">
                  Отмена
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      {visibleItems.length || visiblePlates.length ? (
        <div className="space-y-2.5">
          {visibleItems.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              equipped={equippedIds.has(item.id)}
              plateLabel={item.type === 'car' ? getCarLicensePlateDisplay(item, player.licensePlates) : undefined}
              frameIds={player.licensePlateFrames}
              onToggle={toggleEquipment}
              onSell={sellFromInventory}
            />
          ))}
          {visiblePlates.map((plate) => {
            const installed = installedCarByPlate.get(plate.id);
            const isOnActiveCar = Boolean(activeCar && installed?.id === activeCar.id);
            return (
              <LicensePlateCard
                key={plate.id}
                plate={plate}
                installed={Boolean(installed)}
                favorite={player.favoriteLicensePlateIds.includes(plate.id)}
                seasonFrame={player.licensePlateFrames.includes('season-01-vip')}
                installLabel={!activeCar ? (ownedCars.length ? 'Выбрать машину' : 'Нет машины') : isOnActiveCar ? 'Снять' : installed ? 'Переставить' : 'Установить'}
                installDisabled={ownedCars.length === 0}
                onInstall={() => activeCar ? togglePlateOnActiveCar(plate) : onOpenGarage()}
                onSell={() => sellPlate(plate)}
                onToggleFavorite={() => toggleFavoritePlate(plate)}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-10 text-center">
          <div className="text-3xl">{filter === 'car' ? '🚘' : '📦'}</div>
          <p className="mt-2 text-sm font-bold text-zinc-300">Пока тут пусто</p>
          <p className="mt-1 text-xs text-zinc-500">Загляни в контейнеры за первым дропом.</p>
        </div>
      )}
    </section>
  );
}
