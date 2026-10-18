import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CarFront, CheckCircle2, Clock3, Gauge, Hammer, Search, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ItemIcon from './ItemIcon';
import LicensePlateDisplay from './LicensePlateDisplay';
import GenesisSceneBackdrop from './GenesisSceneBackdrop';
import { RARITY_LABELS } from '../data/items';
import {
  getQuickSellEligibleItems,
  getQuickSellValue,
  LEGIT_CHECK_PRICE,
} from '../game/economy';
import { formatRubles } from '../utils/currency';
import { CarItem, ClothingItem, InventoryItem, LicensePlateItem, PlayerState, Rarity } from '../types/game';
import { impact, notification } from '../utils/haptics';
import { playClick, playError, playWin } from '../utils/sound';
import { getCarLicensePlateDisplay } from '../game/licensePlates';
import type { ActionResponse, GameAction } from '../types/server';
import { createId } from '../utils/id';

interface GarageTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
}

type WorkshopModal =
  | { kind: 'detail'; itemId: string; seconds: number }
  | { kind: 'legit'; itemId: string; seconds: number; free: boolean }
  | { kind: 'mileage'; itemId: string };

const rarityClasses: Record<Rarity, string> = {
  common: 'border-zinc-700 text-zinc-300',
  uncommon: 'border-emerald-400/40 text-emerald-200',
  rare: 'border-blue-400/40 text-blue-200',
  epic: 'border-fuchsia-400/40 text-fuchsia-200',
  legendary: 'border-amber-300/50 text-amber-100',
  mythic: 'border-rose-300/60 text-rose-100',
};

function ItemCard({
  item,
  isEquipped,
  onOpenModal,
  onPaidLegitCheck,
  onSell,
  plateLabel,
  plateFrameIds = [],
  availablePlates = [],
  onPlateChange,
}: {
  item: InventoryItem;
  isEquipped: boolean;
  onOpenModal: (modal: WorkshopModal) => void;
  onPaidLegitCheck: (itemId: string) => void;
  onSell: (item: InventoryItem) => void;
  plateLabel?: string;
  plateFrameIds?: readonly string[];
  availablePlates?: LicensePlateItem[];
  onPlateChange?: (carId: string, plateId?: string) => void;
}) {
  if (item.type === 'car') {
    const damaged = item.wear < 100;
    return (
      <article className={`overflow-hidden rounded-2xl border bg-[#111116] shadow-[0_18px_38px_rgba(0,0,0,0.36)] ${rarityClasses[item.rarity]}`}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#19171a] to-[#0c0c10] p-4">
          <div className="relative flex min-w-0 items-start gap-3.5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/10 bg-[#09090b] p-2 sm:h-24 sm:w-24">
              <ItemIcon item={item} size="xl" showcase className="!h-full !w-full !max-h-full !max-w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-base font-black text-white">{item.name}</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${rarityClasses[item.rarity]}`}>
                  {RARITY_LABELS[item.rarity]}
                </span>
              </div>
              <LicensePlateDisplay plate={plateLabel ?? item.licensePlate} frameIds={plateFrameIds} size="compact" className="mt-1.5" />
              <p className="mt-1 text-[11px] text-zinc-300">{item.mileage.toLocaleString('ru-RU')} км · Float: {item.wear.toFixed(1)}%</p>
              {item.mileageRolledBack && (
                <span className="mt-2 inline-flex rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-black text-emerald-200">
                  ✅ Пробег скручен удачно
                </span>
              )}
              {item.mileageTampered && (
                <span className="mt-2 inline-flex rounded-lg border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[9px] font-black text-rose-200">
                  ⚠️ Скручен пробег / Палево
                </span>
              )}
              {isEquipped && <p className="mt-1 text-[9px] font-bold text-amber-200">🚘 Выбрана в профиле</p>}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3">
          <label className="block text-[9px] font-bold uppercase tracking-wide text-zinc-500" htmlFor={`plate-${item.id}`}>
            Номер машины
            <select
              id={`plate-${item.id}`}
              value={item.licensePlateId ?? ''}
              onChange={(event) => onPlateChange?.(item.id, event.target.value || undefined)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2.5 text-xs font-mono font-bold text-white outline-none focus:border-amber-400"
            >
              <option value="">Без номера</option>
              {availablePlates.map((plate) => <option key={plate.id} value={plate.id}>{plate.plate}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2.5">
            <span className="text-[10px] text-zinc-400">Рыночная стоимость</span>
          <strong className="text-sm font-black text-[#83B88A]">{formatRubles(item.price)}</strong>
          </div>
          <button
            type="button"
            disabled={!damaged}
            onClick={() => {
              impact('medium');
              playClick();
              onOpenModal({ kind: 'detail', itemId: item.id, seconds: 3 });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-3 text-xs font-black text-[#151719] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Hammer size={15} /> {damaged ? '🔧 Детейлинг и Ремонт (Реклама 🎬)' : 'Кузов как новый · 100%'}
          </button>
          <button
            type="button"
            disabled={Boolean(item.mileageRolledBack || item.mileageTampered)}
            onClick={() => {
              impact('medium');
              playClick();
              onOpenModal({ kind: 'mileage', itemId: item.id });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/5 px-3 py-3 text-xs font-black text-amber-100 transition hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Gauge size={15} />
            {item.mileageRolledBack ? 'Пробег уже скручен' : item.mileageTampered ? 'Палево: попытка исчерпана' : '🎛 Скрутить пробег'}
          </button>
          <button
            type="button"
            disabled={isEquipped}
            onClick={() => onSell(item)}
            className="w-full rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] font-black text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:text-zinc-600"
          >
            {isEquipped ? 'Убери из профиля, чтобы продать' : `⚡ Продать за ${formatRubles(getQuickSellValue(item))}`}
          </button>
        </div>
      </article>
    );
  }

  const unverified = item.authenticity === 'unverified';
  return (
    <article className={`rounded-2xl border bg-[#111116] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.3)] ${item.authenticity === 'fake' ? 'border-rose-400/40' : rarityClasses[item.rarity]}`}>
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/10 bg-[#09090b] p-2 sm:h-24 sm:w-24">
          <ItemIcon item={item} size="xl" showcase className="!h-full !w-full !max-h-full !max-w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-sm font-black text-white">{item.name}</h2>
            <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${rarityClasses[item.rarity]}`}>
              {RARITY_LABELS[item.rarity]}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">{item.serial.replace('/500', '')} · Состояние {item.wear.toFixed(1)}%</p>
          <p className={`mt-1 text-[10px] font-bold ${item.authenticity === 'fake' ? 'text-rose-300' : item.authenticity === 'original' ? 'text-emerald-200' : 'text-amber-200'}`}>
            {item.authenticity === 'unverified' ? '❓ Не проверен на легит' : item.authenticity === 'original' ? '✅ Оригинал' : '❌ Паль'}
          </p>
          {isEquipped && <p className="mt-1 text-[9px] font-bold text-amber-200">Надета в профиле · {item.slot}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-2">
        <span className="text-[10px] text-zinc-400">Рыночная стоимость</span>
        <strong className="text-sm font-black text-[#83B88A]">{formatRubles(item.price)}</strong>
      </div>
      {unverified && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              impact('light');
              playClick();
              onOpenModal({ kind: 'legit', itemId: item.id, seconds: 3, free: true });
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2 py-2.5 text-[10px] font-black text-[#151719]"
          >
            <Search size={13} /> Проверить · реклама
          </button>
          <button
            type="button"
            className="rounded-xl border border-amber-300/25 bg-amber-300/5 px-2 py-2.5 text-[10px] font-black text-amber-100 disabled:opacity-40"
            onClick={() => {
              impact('light');
              playClick();
              onPaidLegitCheck(item.id);
            }}
          >
            Проверить за {formatRubles(LEGIT_CHECK_PRICE)}
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={isEquipped}
        onClick={() => onSell(item)}
        className="mt-2 w-full rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-[10px] font-black text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:text-zinc-600"
      >
        {isEquipped ? 'Сначала сними в профиле' : `⚡ Продать за ${formatRubles(getQuickSellValue(item))}`}
      </button>
    </article>
  );
}

export default function GarageTab({ player, onAction }: GarageTabProps) {
  const [modal, setModal] = useState<WorkshopModal>();
  const [slider, setSlider] = useState(0);
  const [sliderDirection, setSliderDirection] = useState(1);
  const [notice, setNotice] = useState('');
  const [saleCandidate, setSaleCandidate] = useState<InventoryItem>();
  const [confirmBulkSale, setConfirmBulkSale] = useState(false);
  const [bulkSalePending, setBulkSalePending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const sliderValueRef = useRef(0);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  useEffect(() => {
    if (modal?.kind !== 'detail' && modal?.kind !== 'legit') return;
    if (modal.seconds <= 0) {
      const finishTimer = window.setTimeout(() => {
        if (modal.kind === 'detail') finishDetailing(modal.itemId);
        else finishLegitCheck(modal.itemId, modal.free);
      }, 400);
      return () => window.clearTimeout(finishTimer);
    }
    const timer = window.setTimeout(() => setModal({ ...modal, seconds: modal.seconds - 1 }), 1_000);
    return () => window.clearTimeout(timer);
  }, [modal]);

  useEffect(() => {
    if (modal?.kind !== 'mileage') return;
    intervalRef.current = setInterval(() => {
      const next = sliderValueRef.current + sliderDirection * 2;
      if (next >= 100) {
        sliderValueRef.current = 100;
        setSlider(100);
        setSliderDirection(-1);
      } else if (next <= 0) {
        sliderValueRef.current = 0;
        setSlider(0);
        setSliderDirection(1);
      } else {
        sliderValueRef.current = next;
        setSlider(next);
      }
    }, 45);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [modal?.kind, sliderDirection]);

  async function finishDetailing(itemId: string) {
    const response = await onAction({ type: 'workshop', itemId, operation: 'detail', requestId: createId('workshop-detail') });
    if (!response) {
      setNotice('Детейлинг не завершён. Попробуй ещё раз.');
      setModal(undefined);
      return;
    }
    setNotice(response.result?.message ?? 'Детейлинг завершён: состояние кузова 100%, рыночная стоимость обновлена.');
    notification('success');
    playWin();
    setModal(undefined);
  }

  async function finishLegitCheck(itemId: string, free: boolean) {
    const response = await onAction({ type: 'workshop', itemId, operation: 'legit', free, requestId: createId('workshop-legit') });
    if (!response) {
      setNotice('Проверка не выполнена. Проверь соединение и попробуй ещё раз.');
      setModal(undefined);
      return;
    }
    const original = response.result?.success === true;
    setNotice(response.result?.message ?? (original ? 'Экспертиза пройдена: оригинал, стоимость выросла.' : 'Экспертиза выявила паль — цена снижена.'));
    notification(original ? 'success' : 'warning');
    if (original) playWin();
    else playError();
    setModal(undefined);
  }

  const startPaidLegitCheck = (itemId: string) => {
    if (player.balance < LEGIT_CHECK_PRICE) {
      setNotice(`Недостаточно средств: нужно ${formatRubles(LEGIT_CHECK_PRICE)}.`);
      notification('error');
      playError();
      return;
    }
    setNotice('');
    impact('medium');
    playClick();
    setModal({ kind: 'legit', itemId, seconds: 1, free: false });
  };

  const startMileageGame = (itemId: string) => {
    setNotice('');
    impact('medium');
    playClick();
    setSlider(0);
    sliderValueRef.current = 0;
    setSliderDirection(1);
    setModal({ kind: 'mileage', itemId });
  };

  const stopMileageGame = () => {
    if (modal?.kind !== 'mileage') return;
    const itemId = modal.itemId;
    const skillScore = sliderValueRef.current;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = undefined;
    setModal(undefined);
    setNotice('Проверяем результат скрутки пробега…');
    void onAction({ type: 'workshop', itemId, operation: 'mileage', skillScore, requestId: createId('workshop-mileage') }).then((response) => {
      if (!response) {
        setNotice('Не удалось применить результат скрутки. Проверь соединение и попробуй ещё раз.');
        notification('error');
        playError();
        return;
      }
      const success = response.result?.success === true;
      setNotice(response.result?.message ?? (success
        ? 'Чистая работа! Пробег теперь 15 000 км, стоимость выросла на 20%.'
        : 'Промах: появилось палево, цена машины снижена.'));
      if (success) {
        notification('success');
        playWin();
      } else {
        notification('error');
        playError();
      }
    });
  };

  const sellItem = (item: InventoryItem) => {
    const equipped = player.activeCarId === item.id || Object.values(player.equippedClothing).includes(item.id);
    if (equipped) {
      setNotice('Предмет экипирован. Сначала убери его из профиля.');
      return;
    }
    setNotice('');
    setSaleCandidate(item);
  };

  const confirmItemSale = async () => {
    if (!saleCandidate) return;
    impact('medium');
    playClick();
    const response = await onAction({ type: 'quick-sell-item', itemId: saleCandidate.id, requestId: createId('garage-quick-sale') });
    if (response) setNotice(response.result?.message ?? `${saleCandidate.name} продан за ${formatRubles(getQuickSellValue(saleCandidate))}.`);
    setSaleCandidate(undefined);
  };

  const sellJunk = async () => {
    if (bulkSalePending) return;
    setBulkSalePending(true);
    try {
      const response = await onAction({ type: 'quick-sell-junk', requestId: createId('garage-bulk-sale') });
      if (response) {
        setNotice(response.result?.message ?? 'Хлам продан.');
        setConfirmBulkSale(false);
      } else setNotice('Массовая продажа не выполнена. Попробуй ещё раз.');
    } finally {
      setBulkSalePending(false);
    }
  };

  const cars = player.inventory.filter((item): item is CarItem => item.type === 'car');
  const clothes = player.inventory.filter((item): item is ClothingItem => item.type === 'clothing');
  const activeCar = cars.find((item) => item.id === player.activeCarId);
  const equippedIds = new Set([...Object.values(player.equippedClothing).filter((id): id is string => Boolean(id)), ...(player.activeCarId ? [player.activeCarId] : [])]);
  const eligibleJunk = getQuickSellEligibleItems(player.inventory, equippedIds);
  const estimatedJunkProceeds = eligibleJunk.reduce((total, item) => total + getQuickSellValue(item), 0);

  const changeCarPlate = (carId: string, plateId?: string) => {
    const plate = player.licensePlates.find((entry) => entry.id === plateId);
    const car = cars.find((entry) => entry.id === carId);
    void onAction({ type: 'set-car-plate', carId, plateId, requestId: createId('garage-plate') }).then((response) => {
      if (response) setNotice(plate ? `${plate.plate} установлен на ${car?.name ?? 'машину'}.` : 'Номер снят и возвращён в инвентарь.');
    });
    impact('medium');
    playClick();
  };

  const modalItem = modal ? player.inventory.find((item) => item.id === modal.itemId) : undefined;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Подземный детейлинг-бокс</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Гараж / Мастерская</h1>
        <p className="mt-1 text-xs text-zinc-400">Детейлинг, номера и проверка коллекции.</p>
      </div>

      <section aria-label="Главный бокс гаража" className="relative isolate overflow-hidden rounded-[26px] border border-amber-400/25 bg-[#09090b] shadow-[0_18px_48px_rgba(0,0,0,0.48)]">
        <GenesisSceneBackdrop scene="garage" className="opacity-60" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#09090b]/28 via-[#09090b]/30 to-[#09090b]/95" />
        <div aria-hidden="true" className="absolute inset-x-[12%] bottom-7 h-10 rounded-[50%] border border-amber-200/30 bg-amber-200/10 shadow-[0_0_35px_rgba(214,171,93,0.2)]" />
        <div className="relative z-10 flex min-h-[250px] flex-col items-center justify-between px-4 py-4 text-center">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="rounded-full border border-amber-300/25 bg-black/45 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-amber-100">Genesis · Detail bay</span>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-black/45 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-100"><i className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.85)]" /> READY</span>
          </div>
          {activeCar ? (
            <div className="flex flex-1 flex-col items-center justify-center py-2">
              <ItemIcon item={activeCar} size="xxl" className="!h-36 !w-36 !max-h-full !max-w-full !border-0 !bg-transparent !bg-none !shadow-none" />
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200/80">В боксе · выбранный автомобиль</p>
              <h2 className="mt-1 max-w-full truncate text-base font-black text-white">{activeCar.name}</h2>
              <LicensePlateDisplay plate={getCarLicensePlateDisplay(activeCar, player.licensePlates)} frameIds={player.licensePlateFrames} size="large" className="mt-2" />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              <CarFront size={38} className="text-amber-100/55" />
              <p className="mt-3 text-sm font-black text-white">Бокс ждёт твою машину</p>
              <p className="mt-1 max-w-[16rem] text-[10px] leading-relaxed text-zinc-300/75">Выбери автомобиль в коллекции, и он появится в центре детейлинг-студии.</p>
            </div>
          )}
          <p className="text-[8px] font-bold uppercase tracking-[0.24em] text-zinc-300/55">Titanium detailing · private service</p>
        </div>
      </section>

      {notice && (
        <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
          {notice}
        </p>
      )}
      {saleCandidate && (
        <div role="alertdialog" aria-label="Подтверждение быстрой продажи" className="rounded-2xl border border-rose-300/25 bg-rose-400/[0.06] p-3">
          <p className="text-xs font-bold text-white">Продать «{saleCandidate.name}» за {formatRubles(getQuickSellValue(saleCandidate))}? Начислится +10 XP сезона.</p>
          <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => void confirmItemSale()} className="rounded-lg bg-rose-300 px-2 py-2.5 text-[10px] font-black text-[#17140c]">Подтвердить</button><button type="button" onClick={() => setSaleCandidate(undefined)} className="rounded-lg border border-zinc-700 px-2 py-2.5 text-[10px] font-black text-zinc-300">Оставить</button></div>
        </div>
      )}
      {player.inventory.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-emerald-300/20 bg-zinc-900/80 p-3" aria-label="Быстрая продажа хлама из гаража и инвентаря">
          <div><h2 className="text-sm font-black text-white">⚡ Быстро слить хлам</h2><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Сюда входят обычные и необычные предметы. Редкие вещи, выбранные машины и машины с номерами не продаются.</p></div>
          <p className="text-[10px] font-bold text-emerald-100">К продаже: {eligibleJunk.length} · ≈ {formatRubles(estimatedJunkProceeds)} ₽ · +{eligibleJunk.length * 10} XP сезона</p>
          {!confirmBulkSale ? <button type="button" disabled={!eligibleJunk.length || bulkSalePending} onClick={() => setConfirmBulkSale(true)} className="w-full rounded-xl bg-emerald-300 px-3 py-3 text-xs font-black text-[#101612] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">Продать весь хлам</button> : (
            <div role="alertdialog" aria-label="Подтверждение массовой продажи" className="rounded-xl border border-rose-300/20 bg-rose-400/5 p-3"><p className="text-xs font-bold text-white">Продать {eligibleJunk.length} предметов за ≈ {formatRubles(estimatedJunkProceeds)}?</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={bulkSalePending} onClick={() => void sellJunk()} className="rounded-lg bg-rose-300 px-2 py-2.5 text-[10px] font-black text-[#17140c]">{bulkSalePending ? 'Продаём…' : 'Подтвердить'}</button><button type="button" disabled={bulkSalePending} onClick={() => setConfirmBulkSale(false)} className="rounded-lg border border-zinc-700 px-2 py-2.5 text-[10px] font-black text-zinc-300">Отмена</button></div></div>
          )}
        </section>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-300/10 text-amber-200">🚘</span>
          Тачки
        </div>
        <span className="text-xs font-black text-amber-200">{cars.length}</span>
      </div>
      {cars.length ? (
        <div className="space-y-3">
          {cars.map((item) => {
            const assignedElsewhere = new Set(cars.filter((car) => car.id !== item.id && car.licensePlateId).map((car) => car.licensePlateId));
            return (
            <ItemCard
              key={item.id}
              item={item}
              isEquipped={player.activeCarId === item.id}
              onOpenModal={setModal}
              onPaidLegitCheck={startPaidLegitCheck}
              onSell={sellItem}
              plateLabel={getCarLicensePlateDisplay(item, player.licensePlates)}
              plateFrameIds={player.licensePlateFrames}
              availablePlates={player.licensePlates.filter((plate) => plate.id === item.licensePlateId || !assignedElsewhere.has(plate.id))}
              onPlateChange={changeCarPlate}
            />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center">
          <div className="text-4xl">🛞</div>
          <p className="mt-2 text-sm font-bold text-zinc-300">В гараже пока пусто</p>
          <p className="mt-1 text-xs text-zinc-500">Выбей первую машину в контейнерах и приезжай на сервис.</p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#83B88A]/10 text-[#83B88A]">👕</span>
          Шмот на легит-чек
        </div>
        <span className="text-xs font-black text-[#83B88A]">{clothes.length}</span>
      </div>
      {clothes.length ? (
        <div className="space-y-3">
          {clothes.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isEquipped={Object.values(player.equippedClothing).includes(item.id)}
              onOpenModal={setModal}
              onPaidLegitCheck={startPaidLegitCheck}
              onSell={sellItem}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-4 text-center text-xs text-zinc-500">
          Одежды для проверки пока нет.
        </p>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workshop-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="relative w-full max-w-sm rounded-3xl border border-[#34383C] bg-[#202326] p-5 text-center shadow-2xl shadow-black/30"
            >
              <button
                type="button"
                onClick={() => setModal(undefined)}
                className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                aria-label="Закрыть мастерскую"
              >
                <X size={17} />
              </button>

              {modalItem && (
                <div className="mb-4 flex items-center justify-center gap-3 rounded-2xl border border-white/5 bg-black/20 p-2">
                  <ItemIcon item={modalItem} size="lg" />
                  <div className="min-w-0 text-left">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Предмет мастерской</p>
                    <p className="truncate text-xs font-black text-white">{modalItem.name}</p>
                  </div>
                </div>
              )}

              {(modal.kind === 'detail' || modal.kind === 'legit') && (
                <>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-400/10">
                    {modal.kind === 'detail' ? <Hammer size={30} className="text-amber-200" /> : <ShieldCheck size={30} className="text-amber-200" />}
                  </div>
                  <h2 id="workshop-title" className="mt-4 text-xl font-black text-white">
                    {modal.kind === 'detail' ? 'Детейлинг в процессе' : 'Проверка мастерской'}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    {modal.kind === 'detail' ? 'Мастер очищает кузов и восстанавливает состояние.' : 'Эксперт проверяет бирки, швы и происхождение вещи.'}
                  </p>
                  <div className="my-5 flex items-center justify-center gap-2 text-3xl font-black tabular-nums text-amber-200">
                    <Clock3 size={22} /> {modal.seconds > 0 ? `${modal.seconds} сек` : 'Готово'}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <motion.div
                      className="h-full rounded-full bg-amber-400"
                      initial={{ width: '0%' }}
                      animate={{ width: `${((3 - modal.seconds) / 3) * 100}%` }}
                    />
                  </div>
                  <p className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-zinc-500">
                    {modal.seconds === 0
                      ? <><CheckCircle2 size={13} className="text-emerald-300" /> Применяем результат…</>
                      : 'Осталось немного — не закрывай окно.'}
                  </p>
                </>
              )}

              {modal.kind === 'mileage' && (
                <>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-400/10">
                    <Gauge size={31} className="text-amber-200" />
                  </div>
                  <h2 id="workshop-title" className="mt-4 text-xl font-black text-white">Поймай зелёную зону</h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">Останови указатель между 40% и 60%. Точное попадание — пробег 15 000 км и х2 к цене.</p>
                  <div className="relative mt-7 h-5 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
                    <div className="absolute inset-y-0 left-[40%] w-[20%] bg-emerald-400/40 shadow-[0_0_18px_rgba(52,211,153,0.45)]" />
                    <motion.div
                      className="absolute -top-1 h-7 w-1 rounded-full bg-white shadow-[0_0_12px_white]"
                      animate={{ left: `calc(${slider}% - 2px)` }}
                      transition={{ duration: 0, ease: 'linear' }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] font-bold text-zinc-500">
                    <span>0%</span><span className="text-emerald-300">ЦЕЛЬ 40–60%</span><span>100%</span>
                  </div>
                  <p className="my-4 font-mono text-3xl font-black tabular-nums text-white">{slider}%</p>
                  <button
                    type="button"
                    onClick={stopMileageGame}
              className="w-full rounded-xl bg-amber-400 px-3 py-4 text-base font-black text-[#151719] shadow-lg shadow-black/20"
                  >
                    СТОП
                  </button>
                  <div className="mt-3 flex items-center justify-center gap-1 text-[9px] text-rose-300">
                    <AlertTriangle size={12} /> Один шанс на эту машину
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
