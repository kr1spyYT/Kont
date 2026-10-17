import { Check, PackageOpen, UserRound } from 'lucide-react';
import { useState } from 'react';
import { RARITY_LABELS } from '../data/items';
import { getResaleValue } from '../game/economy';
import { formatRubles } from '../utils/currency';
import { impact } from '../utils/haptics';
import { playClick } from '../utils/sound';
import { ClothingItem, InventoryItem, LicensePlateItem, PlayerState, Rarity } from '../types/game';
import ItemIcon from './ItemIcon';
import { getCarLicensePlateDisplay } from '../game/licensePlates';
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
  onToggle,
  onSell,
}: {
  item: InventoryItem;
  equipped: boolean;
  plateLabel?: string;
  onToggle: (item: InventoryItem) => void;
  onSell: (item: InventoryItem) => void;
}) {
  const car = item.type === 'car';
  return (
    <article className={`rounded-2xl border bg-zinc-900/80 p-3 shadow-lg ${rarityClasses[item.rarity]} ${rarityGlow[item.rarity]}`}>
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[#111318] p-2 sm:h-24 sm:w-24">
          <ItemIcon item={item} size="xl" className="!h-full !w-full !max-h-full !max-w-full" />
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
            <p className="mt-1 text-[10px] text-amber-200">Госномер: {plateLabel ?? 'Без номера'}</p>
          ) : (
            <p className="mt-1 text-[10px] text-amber-200">
              {item.authenticity === 'unverified' ? '❓ Не проверен на легит' : item.authenticity === 'original' ? 'Оригинал' : 'Паль'}
              <span className="text-zinc-700"> · </span>{slotNames[item.slot]}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-2 text-[10px]">
        <span className="text-orange-200">🔥 +{item.respect.toLocaleString('ru-RU')} респекта</span>
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
          {equipped ? 'Сначала снять' : `Слить за ${formatRubles(getResaleValue(item))}`}
        </button>
      </div>
    </article>
  );
}

function LicensePlateCard({ plate, installed, installLabel, installDisabled, onInstall, onSell }: {
  plate: LicensePlateItem;
  installed: boolean;
  installLabel: string;
  installDisabled: boolean;
  onInstall: () => void;
  onSell: () => void;
}) {
  return (
    <article className="rounded-2xl border border-amber-300/35 bg-[#202326] p-3 shadow-lg shadow-black/10">
      <div className="flex items-center gap-3">
        <div className="grid h-12 min-w-[126px] place-items-center rounded-lg border-[3px] border-[#a5a9a8] bg-[#f4f3ee] px-2 font-mono text-[14px] font-black tracking-wide text-[#16191b]">
          {plate.plate}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Номерной знак</p>
          <p className="mt-1 text-[10px] font-bold text-amber-200">{installed ? 'Установлен' : 'В коллекции'}</p>
          <p className="mt-1 text-xs font-black text-white">{formatRubles(plate.price)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={installDisabled} onClick={onInstall} className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2 py-2.5 text-[10px] font-black text-[#151719] hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
          <UserRound size={13} /> {installLabel}
        </button>
        <button type="button" disabled={installed} onClick={onSell} className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-2 py-2.5 text-[10px] font-black text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600">
          {installed ? 'Сначала снять' : `Продать за ${formatRubles(getResaleValue(plate))}`}
        </button>
      </div>
    </article>
  );
}

export default function InventoryTab({ player, onAction, onOpenGarage }: InventoryTabProps) {
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [inventoryMessage, setInventoryMessage] = useState('');
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
    impact('medium');
    playClick();
    void onAction({ type: 'sell-item', itemId: item.id, requestId: createId('sell-item') }).then((response) => {
      if (response) setInventoryMessage(`${item.name} продан перекупу за ${formatRubles(getResaleValue(item))}.`);
    });
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
    impact('medium');
    playClick();
    void onAction({ type: 'sell-license-plate', plateId: plate.id, requestId: createId('sell-plate') }).then((response) => {
      if (response) setInventoryMessage(`${plate.plate} продан перекупу за ${formatRubles(getResaleValue(plate))}.`);
    });
  };

  const visibleItems = player.inventory.filter((item) => filter === 'all' || item.type === filter);
  const visiblePlates = filter === 'all' || filter === 'plates' ? player.licensePlates : [];
  const ownedCars = player.inventory.filter((item) => item.type === 'car');
  const activeCar = ownedCars.find((car) => car.id === player.activeCarId);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Коллекция игрока</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Инвентарь</h1>
          <p className="mt-1 text-xs text-zinc-500">Одежда, машины и коллекция номеров.</p>
        </div>
        <span className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-[10px] font-bold text-zinc-400">
          {player.inventory.length} предметов · {player.licensePlates.length} номеров
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1">
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
            className={`rounded-lg px-2 py-2 text-[10px] font-black transition ${
              filter === id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-200'
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
      {visibleItems.length || visiblePlates.length ? (
        <div className="space-y-2.5">
          {visibleItems.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              equipped={equippedIds.has(item.id)}
              plateLabel={item.type === 'car' ? getCarLicensePlateDisplay(item, player.licensePlates) : undefined}
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
                installLabel={!activeCar ? (ownedCars.length ? 'Выбрать машину' : 'Нет машины') : isOnActiveCar ? 'Снять' : installed ? 'Переставить' : 'Установить'}
                installDisabled={ownedCars.length === 0}
                onInstall={() => activeCar ? togglePlateOnActiveCar(plate) : onOpenGarage()}
                onSell={() => sellPlate(plate)}
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
