import { Check, MoreHorizontal, PackageOpen, Star, UserRound, Zap } from 'lucide-react';
import { useState } from 'react';
import { RARITY_LABELS } from '../data/items';
import { getQuickSellEligibleItems, getQuickSellValue, getResaleValue } from '../game/economy';
import { formatRubles } from '../utils/currency';
import { impact } from '../utils/haptics';
import { playClick } from '../utils/sound';
import type { ClothingItem, InventoryItem, LicensePlateItem, LicensePlateRarity, LicensePlateSaleFilter, PlayerState, Rarity } from '../types/game';
import ItemIcon from './ItemIcon';
import LicensePlateDisplay from './LicensePlateDisplay';
import { getCarLicensePlateDisplay, getEquippedLicensePlateFrameIds, getLicensePlateValuation, getSellableLicensePlates, LICENSE_PLATE_RARITIES, LICENSE_PLATE_RARITY_LABELS } from '../game/licensePlates';
import type { ActionResponse, GameAction } from '../types/server';
import { createId } from '../utils/id';

interface InventoryTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  onOpenGarage: () => void;
  onOpenContainers?: () => void;
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

const raritySurface: Record<Rarity, string> = {
  common: 'border-zinc-700 bg-gradient-to-b from-zinc-800/65 to-[#0c0c0f]',
  uncommon: 'border-emerald-400/45 bg-gradient-to-b from-emerald-950/65 to-[#0c0c0f]',
  rare: 'border-blue-400/50 bg-gradient-to-b from-blue-950/60 to-[#0c0c0f]',
  epic: 'border-fuchsia-400/55 bg-gradient-to-b from-fuchsia-950/55 to-[#0c0c0f]',
  legendary: 'border-[#d4af37]/65 bg-gradient-to-b from-[#231b0c] to-[#0c0c0f]',
  mythic: 'border-rose-400/60 bg-gradient-to-b from-rose-950/60 to-[#0c0c0f]',
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

function InventoryCard({ item, equipped, saleBlocked, plateLabel, frameIds, onToggle, onSell }: {
  item: InventoryItem;
  equipped: boolean;
  saleBlocked: boolean;
  plateLabel?: string;
  frameIds: readonly string[];
  onToggle: (item: InventoryItem) => void;
  onSell: (item: InventoryItem) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const car = item.type === 'car';
  return (
    <article className={`relative min-w-0 overflow-hidden rounded-2xl border p-2 shadow-[0_14px_28px_rgba(0,0,0,0.34)] ${raritySurface[item.rarity]} ${rarityGlow[item.rarity]}`}>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-[#0e0e12]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(212,175,55,0.12),transparent_68%)]" />
        <ItemIcon item={item} size="xxl" showcase className="!h-full !w-full !max-h-full !max-w-full !rounded-xl !border-0 !shadow-none" />
        <span className={`absolute left-1.5 top-1.5 z-10 shrink-0 whitespace-nowrap rounded-full border bg-black/75 px-2 py-1 text-[8px] font-extrabold uppercase leading-none tracking-wider backdrop-blur ${rarityClasses[item.rarity]}`}>
          {RARITY_LABELS[item.rarity]}
        </span>
        {equipped && (
          <span aria-label="НАДЕТО" title="НАДЕТО" className="absolute bottom-1.5 left-1.5 z-10 whitespace-nowrap rounded-full border border-[#d4af37]/50 bg-black/75 px-1.5 py-0.5 text-[8px] font-bold leading-none text-amber-100">
            • НАДЕТО
          </span>
        )}
      </div>
      <div className="mt-2 min-w-0">
        <h3 title={item.name} className="truncate text-[10px] font-black leading-4 text-white sm:text-[11px]">{item.name}</h3>
        <div className="mt-0.5 flex items-center justify-between gap-1 text-[8px] font-bold text-zinc-400">
          <span className="truncate text-amber-100/90">{formatRubles(item.price)}</span>
          <span className="shrink-0 text-zinc-400">⭐ {item.respect.toLocaleString('ru-RU')}</span>
        </div>
        {item.type === 'car' ? (
          <div className="mt-1.5 flex min-w-0 flex-col items-start gap-1">
            <span className="text-[7px] font-bold tabular-nums text-zinc-500">{item.mileage.toLocaleString('ru-RU')} км</span>
            <LicensePlateDisplay plate={plateLabel} frameIds={frameIds} size="tiny" className="max-w-full scale-[0.82] origin-left" />
          </div>
        ) : (
          <p className="mt-1.5 truncate text-[7px] font-bold text-zinc-500">{slotNames[item.slot]}</p>
        )}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_30px] gap-1">
        <button type="button" disabled={equipped || saleBlocked} onClick={() => onSell(item)} title={equipped ? 'Сначала снимите предмет с персонажа или уберите машину из профиля' : saleBlocked ? 'Сначала снимите госномер с машины' : `Быстрая продажа за ${formatRubles(getQuickSellValue(item))}`} className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-amber-300/25 bg-gradient-to-b from-amber-300/15 to-transparent px-1.5 py-2 text-[9px] font-black text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600">
          <Zap size={11} className="shrink-0" /> Продать
        </button>
        <button type="button" aria-label={`Действия: ${item.name}`} aria-expanded={actionsOpen} onClick={() => setActionsOpen((current) => !current)} className="grid place-items-center rounded-lg border border-white/10 bg-black/30 text-zinc-300 transition hover:border-amber-300/30 hover:text-amber-100">
          <MoreHorizontal size={16} />
        </button>
      </div>
      {actionsOpen && (
        <button type="button" onClick={() => { onToggle(item); setActionsOpen(false); }} className={`mt-1.5 flex min-h-8 w-full items-center justify-center gap-1 rounded-lg px-1.5 text-[9px] font-black transition ${equipped ? 'border border-amber-300/25 bg-amber-300/10 text-amber-100' : 'bg-amber-400 text-[#151719] hover:bg-amber-300'}`}>
          {equipped ? <Check size={11} /> : <UserRound size={11} />}
          {equipped ? 'Снять' : car ? 'В профиль' : 'Надеть'}
        </button>
      )}
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const valuation = getLicensePlateValuation(plate.plate);
  return (
    <article className={`relative min-w-0 overflow-hidden rounded-2xl border bg-gradient-to-b from-[#17171b] to-[#0c0c0f] p-2 shadow-[0_14px_28px_rgba(0,0,0,0.34)] ${plateRarityClasses[valuation.rarity]}`}>
      <div className="flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0e0e12] px-1">
        <LicensePlateDisplay plate={plate.plate} frameIds={seasonFrame ? ['season-01-vip'] : []} size="tiny" className="max-w-full" />
        <div className="max-w-full text-center">
          <p className="truncate text-[8px] font-black uppercase tracking-wide text-zinc-500">{seasonFrame ? 'SEASON 01 // VIP' : 'Номерной знак'}</p>
          <p className={`mt-0.5 truncate text-[8px] font-black ${plateRarityClasses[valuation.rarity]}`}>{LICENSE_PLATE_RARITY_LABELS[valuation.rarity]} · ×{valuation.multiplier}</p>
        </div>
      </div>
      <div className="mt-2 min-w-0">
        <p title={plate.plate} className="truncate text-[10px] font-black text-white">{plate.plate}</p>
        <p className="mt-0.5 truncate text-[8px] font-bold text-amber-100/90">{formatRubles(plate.price)}</p>
        {valuation.specialTitle && <p className="mt-1 truncate text-[7px] font-black text-violet-200">✦ {valuation.specialTitle}</p>}
        <p className="mt-1 truncate text-[7px] font-bold text-zinc-500">{installed ? 'На машине' : favorite ? '⭐ Избранное' : 'В коллекции'}</p>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_30px] gap-1">
        <button type="button" disabled={installed || favorite} onClick={onSell} title={favorite ? 'Сначала уберите номер из избранного' : installed ? 'Сначала снимите номер с машины' : `Продать за ${formatRubles(getResaleValue(plate))}`} className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-amber-300/25 bg-amber-300/10 px-1 py-2 text-[9px] font-black text-amber-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600">
          <Zap size={11} className="shrink-0" /> Продать
        </button>
        <button type="button" aria-label={`Действия для номера ${plate.plate}`} aria-expanded={actionsOpen} onClick={() => setActionsOpen((current) => !current)} className="grid place-items-center rounded-lg border border-white/10 bg-black/30 text-zinc-300 hover:text-amber-100">
          <MoreHorizontal size={16} />
        </button>
      </div>
      {actionsOpen && (
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          <button type="button" disabled={installDisabled} onClick={() => { onInstall(); setActionsOpen(false); }} className="rounded-lg bg-amber-400 px-1 py-2 text-[7px] font-black text-[#151719] disabled:bg-zinc-800 disabled:text-zinc-500">{installLabel}</button>
          <button type="button" onClick={() => { onToggleFavorite(); setActionsOpen(false); }} className={`flex items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-[7px] font-black ${favorite ? 'border-amber-300/40 bg-amber-300/10 text-amber-100' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>
            <Star size={9} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Снять' : 'Избранное'}
          </button>
        </div>
      )}
    </article>
  );
}

export default function InventoryTab({ player, onAction, onOpenGarage, onOpenContainers }: InventoryTabProps) {
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
    if (item.type === 'car' && (item.licensePlateId || item.licensePlate)) {
      setInventoryMessage('Сначала снимите госномер с машины.');
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

  const eligibleJunk = getQuickSellEligibleItems(player.inventory, equippedIds);
  const estimatedJunkProceeds = eligibleJunk.reduce((total, item) => total + getQuickSellValue(item), 0);

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
      } else setInventoryMessage('Продажа не выполнена. Попробуй ещё раз.');
    } catch {
      setInventoryMessage('Продажа не выполнена. Проверь соединение и попробуй ещё раз.');
    } finally {
      setPlateSalePending(false);
    }
  };

  const visibleItems = player.inventory.filter((item) => filter === 'all' || item.type === filter);
  const visiblePlates = filter === 'all' || filter === 'plates' ? player.licensePlates : [];
  const installedCarIds = new Set(player.inventory.flatMap((item) => item.type === 'car' && item.licensePlateId ? [item.licensePlateId] : []));
  const sellablePlates = getSellableLicensePlates(player.licensePlates, installedCarIds, plateSaleFilter, new Set(player.favoriteLicensePlateIds));
  const estimatedBulkProceeds = sellablePlates.reduce((total, plate) => total + getResaleValue(plate), 0);
  const ownedCars = player.inventory.filter((item) => item.type === 'car');
  const activeCar = ownedCars.find((car) => car.id === player.activeCarId);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">&gt; ИНВЕНТАРЬ</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Витрина коллекции</h1>
          <p className="mt-1 text-[10px] text-zinc-500 sm:text-xs">Одежда, машины и коллекция номеров.</p>
        </div>
        <span className="max-w-[45%] shrink-0 rounded-xl border border-amber-300/15 bg-[#111116] px-2 py-1.5 text-right text-[8px] font-bold leading-relaxed text-zinc-300 sm:px-2.5 sm:text-[10px]">
          {player.inventory.length} предметов <span className="text-zinc-600">•</span> {player.licensePlates.length} номеров
        </span>
      </header>

      <div className="grid grid-cols-4 gap-1 rounded-xl border border-amber-300/15 bg-[#111116] p-1" aria-label="Фильтры инвентаря">
        {([
          ['all', 'Все'],
          ['clothing', 'Одежда'],
          ['car', 'Машины'],
          ['plates', 'Номера'],
        ] as [InventoryFilter, string][]).map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`min-w-0 truncate rounded-lg border px-1.5 py-2.5 text-[9px] font-black transition sm:px-2 sm:text-[10px] ${filter === id ? 'border-amber-300/25 bg-gradient-to-b from-amber-300/20 to-transparent text-amber-100' : 'border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {inventoryMessage && <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">{inventoryMessage}</p>}
      {itemSaleCandidate && (
        <div role="alertdialog" aria-label="Подтверждение быстрой продажи" className="rounded-2xl border border-rose-300/25 bg-rose-400/[0.06] p-3">
          <p className="text-xs font-bold text-white">Продать «{itemSaleCandidate.name}» за {formatRubles(getQuickSellValue(itemSaleCandidate))}? Начислится +10 XP сезона.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void confirmItemSale()} className="rounded-lg bg-rose-300 px-2 py-2.5 text-[10px] font-black text-[#17140c]">Подтвердить продажу</button>
            <button type="button" onClick={() => setItemSaleCandidate(undefined)} className="rounded-lg border border-zinc-700 px-2 py-2.5 text-[10px] font-black text-zinc-300">Оставить</button>
          </div>
        </div>
      )}

      {visibleItems.length || visiblePlates.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Предметы коллекции">
          {visibleItems.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              equipped={equippedIds.has(item.id)}
              saleBlocked={item.type === 'car' && Boolean(item.licensePlateId || item.licensePlate)}
              plateLabel={item.type === 'car' ? getCarLicensePlateDisplay(item, player.licensePlates) : undefined}
              frameIds={getEquippedLicensePlateFrameIds(player)}
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
                seasonFrame={getEquippedLicensePlateFrameIds(player).includes('season-01-vip')}
                installLabel={!activeCar ? (ownedCars.length ? 'Выбрать' : 'Нет авто') : isOnActiveCar ? 'Снять' : installed ? 'Переставить' : 'Установить'}
                installDisabled={ownedCars.length === 0}
                onInstall={() => activeCar ? togglePlateOnActiveCar(plate) : onOpenGarage()}
                onSell={() => sellPlate(plate)}
                onToggleFavorite={() => toggleFavoritePlate(plate)}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center">
          <div className="text-2xl font-mono font-black text-amber-200/70">{filter === 'car' ? '01' : filter === 'plates' ? 'RUS' : '00'}</div>
          <p className="mt-2 text-sm font-bold text-zinc-300">Пока тут пусто</p>
          <p className="mt-1 text-xs text-zinc-500">Загляни в контейнеры за первым дропом.</p>
          {onOpenContainers && <button type="button" onClick={onOpenContainers} className="mt-3 rounded-lg bg-amber-300 px-3 py-2 text-[10px] font-black text-[#17140c]">К контейнерам</button>}
        </div>
      )}

      {player.inventory.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-300/25 bg-gradient-to-br from-[#20190d] via-[#111116] to-[#0c0c0f] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.3)]" aria-label="Быстрая продажа хлама">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><PackageOpen size={17} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-black text-white sm:text-sm">⚡ Быстрая продажа</h2>
              <p className="mt-0.5 text-[9px] leading-relaxed text-zinc-400 sm:text-[10px]">Продай любые неэкипированные вещи и машины без номера по 100% базовой цены.</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-2">
            <span className="text-[9px] font-bold text-zinc-400 sm:text-[10px]">Доступно: {eligibleJunk.length} предметов</span>
            <span className="shrink-0 text-[10px] font-black tabular-nums text-amber-100 sm:text-xs">+ {formatRubles(estimatedJunkProceeds)}</span>
          </div>
          {!confirmJunkSale ? (
            <button type="button" disabled={!eligibleJunk.length || junkSalePending} onClick={() => setConfirmJunkSale(true)} className="w-full rounded-xl bg-gradient-to-r from-[#8c6d2c] via-[#cfa84c] to-[#9a7730] px-3 py-2.5 text-[10px] font-black text-white shadow-inner transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-zinc-800 disabled:via-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 sm:text-xs">Продать всё</button>
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
            <select aria-label="Редкость номеров для продажи" value={plateSaleFilter} disabled={plateSalePending} onChange={(event) => { setPlateSaleFilter(event.target.value as LicensePlateSaleFilter); setConfirmPlateSale(false); }} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400 disabled:opacity-50">
              <option value="all">Все редкости</option>
              {LICENSE_PLATE_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{LICENSE_PLATE_RARITY_LABELS[rarity]}</option>)}
            </select>
          </label>
          <p className="text-[10px] font-bold text-amber-100">Свободных к продаже: {sellablePlates.length} · оценка ≈ {formatRubles(estimatedBulkProceeds)}</p>
          {!confirmPlateSale ? (
            <button type="button" disabled={sellablePlates.length === 0 || plateSalePending} onClick={() => { setInventoryMessage(''); setConfirmPlateSale(true); }} className="w-full rounded-xl bg-amber-400 px-3 py-3 text-xs font-black text-[#151719] hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
              {plateSaleFilter === 'all' ? 'Продать все свободные номера' : `Продать номера: ${LICENSE_PLATE_RARITY_LABELS[plateSaleFilter]}`}
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-rose-300/20 bg-rose-400/5 p-3" role="alertdialog" aria-label="Подтверждение продажи номеров">
              <p className="text-xs font-bold text-white">Подтвердить продажу {sellablePlates.length} номеров за ≈ {formatRubles(estimatedBulkProceeds)}?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={plateSalePending} onClick={() => void sellSelectedPlates()} className="rounded-lg bg-rose-400 px-2 py-2.5 text-[10px] font-black text-[#151719] disabled:opacity-50">{plateSalePending ? 'Продаём…' : 'Подтвердить'}</button>
                <button type="button" disabled={plateSalePending} onClick={() => setConfirmPlateSale(false)} className="rounded-lg border border-zinc-700 px-2 py-2.5 text-[10px] font-black text-zinc-300 disabled:opacity-50">Отмена</button>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
