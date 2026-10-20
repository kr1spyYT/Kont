import { useReducedMotion } from 'framer-motion';
import { Box, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CONTAINERS } from '../data/items';
import type { Container, ContainerType, InventoryItem, PlayerState } from '../types/game';
import type { ActionResponse, GameAction } from '../types/server';
import { formatRubles } from '../utils/currency';
import { impact, notification } from '../utils/haptics';
import { playClick, playError } from '../utils/sound';
import ContainerCard from './containers/ContainerCard';
import ContainerOpeningModal from './containers/ContainerOpeningModal';
import ContainerSelectionModal from './containers/ContainerSelectionModal';
import { useContainerOpening } from './containers/useContainerOpening';
import LicensePlateRoulette from './containers/LicensePlateRoulette';
import { createId } from '../utils/id';
import { preloadContainerImages } from './containers/preloadContainerImages';
import GenesisSceneBackdrop from './GenesisSceneBackdrop';
import { getEquippedLicensePlateFrameIds } from '../game/licensePlates';
import GameImage from './GameImage';

interface ContainersTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  freeCaseAvailableAt?: string | null;
  containerCooldowns?: Record<string, string>;
  availableContainers?: Container[];
  catalogLoading?: boolean;
  catalogError?: string;
}

export type ContainerFilter = 'all' | ContainerType;

export const filterContainers = (catalog: Container[], filter: ContainerFilter, premiumOnly = false): Container[] =>
  [...catalog]
    .sort((first, second) => first.order - second.order)
    .filter((container) => {
      if (filter === 'plates') return false;
      return (filter === 'all' || container.category === filter) && (!premiumOnly || (container.tier ?? 1) >= 3);
    });

const filterTabs: { id: ContainerFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'clothing', label: 'Одежда' },
  { id: 'car', label: 'Тачки' },
];

export default function ContainersTab({ player, onAction, freeCaseAvailableAt, containerCooldowns, availableContainers, catalogLoading = false, catalogError = '' }: ContainersTabProps) {
  const reducedMotion = useReducedMotion();
  const catalog = availableContainers ?? CONTAINERS;
  const [category, setCategory] = useState<ContainerFilter>('all');
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [adCountdown, setAdCountdown] = useState<string>();
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [isSelling, setIsSelling] = useState(false);
  const [openingPending, setOpeningPending] = useState(false);
  const [saleError, setSaleError] = useState('');
  const { opening, reveal, hit, closeOpening } = useContainerOpening(Boolean(reducedMotion));
  const adIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const actionPendingRef = useRef(false);
  const salePendingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(interval);
      if (adIntervalRef.current) clearInterval(adIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!catalogLoading && !catalogError) preloadContainerImages(catalog);
  }, [catalog, catalogError, catalogLoading]);

  const cooldownRemaining = (container: Container): number => {
    const availableAt = containerCooldowns?.[container.id];
    if (!availableAt) return 0;
    const remaining = Date.parse(availableAt) - now;
    return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
  };

  const cooldownText = (container: Container): string | undefined => {
    const remaining = cooldownRemaining(container);
    if (!remaining) return undefined;
    const totalMinutes = Math.max(1, Math.ceil(remaining / 60_000));
    const days = Math.floor(totalMinutes / 1_440);
    const hours = Math.floor((totalMinutes % 1_440) / 60);
    const minutes = totalMinutes % 60;
    return days ? `${days}д ${hours}ч` : hours ? `${hours}ч ${minutes}м` : `${minutes}м`;
  };

  const containers = filterContainers(catalog, category, premiumOnly);
  const selectedContainer = containers.find((container) => container.id === selectedContainerId) ?? containers[0];
  const localFreeCaseAvailableAt = player.freeCaseOpenedAt
    ? new Date(new Date(player.freeCaseOpenedAt).getTime() + 86_400_000).toISOString()
    : undefined;
  const dailyFreeCaseAvailableAt = freeCaseAvailableAt === null ? undefined : freeCaseAvailableAt ?? localFreeCaseAvailableAt;
  const dailyFreeRemaining = dailyFreeCaseAvailableAt
    ? Math.max(0, Date.parse(dailyFreeCaseAvailableAt) - now)
    : 0;
  const dailyFreeMinutes = Math.ceil(dailyFreeRemaining / 60_000);
  const dailyFreeTimer = dailyFreeRemaining > 0
    ? `${Math.floor(dailyFreeMinutes / 1_440) ? `${Math.floor(dailyFreeMinutes / 1_440)}д ` : ''}${Math.floor((dailyFreeMinutes % 1_440) / 60)}ч ${dailyFreeMinutes % 60}м`
    : '';

  const performOpening = async (container: Container, free: boolean, useKey = false) => {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setOpeningPending(true);
    setNotice('');
    try {
      const response = await onAction({ type: 'open-container', containerId: container.id, free, ...(useKey ? { useKey: true } : {}), requestId: createId('open') });
      const item = response?.result?.item;
      if (!item) {
        if (response?.result?.plate) {
          setNotice(response.result.message ?? `Номер ${response.result.plate} добавлен в коллекцию.`);
          notification('success');
          setSelectionOpen(false);
          return;
        }
        setNotice('Не удалось открыть контейнер. Проверь соединение и попробуй ещё раз.');
        notification('error');
        playError();
        return;
      }
      setNotice('');
      setSaleError('');
      setSelectionOpen(false);
      reveal(container, item);
    } catch (error) {
      console.error('Не удалось открыть контейнер.', error);
      setNotice(error instanceof Error ? error.message : 'Не удалось открыть контейнер. Попробуй ещё раз.');
      notification('error');
      playError();
    } finally {
      actionPendingRef.current = false;
      setOpeningPending(false);
      if (free) setAdCountdown(undefined);
    }
  };

  const openSeasonCase = async (container: Container) => {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setOpeningPending(true);
    setNotice('');
    try {
      const response = await onAction({ type: 'open-season-case', containerId: container.id, requestId: createId('season-case') });
      const item = response?.result?.item;
      if (!item) {
        setNotice(response?.result?.message ?? 'Не удалось открыть сезонный кейс. Проверь билет и попробуй ещё раз.');
        return;
      }
      setNotice('');
      setSaleError('');
      setSelectionOpen(false);
      reveal(container, item);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось открыть сезонный кейс.');
    } finally {
      actionPendingRef.current = false;
      setOpeningPending(false);
    }
  };

  const beginPaidOpening = async (container: Container) => {
    if (cooldownRemaining(container) > 0) return;
    if (player.balance < container.price) {
      setNotice(`Недостаточно средств: нужно ещё ${formatRubles(container.price - player.balance)}.`);
      notification('error');
      playError();
      return;
    }
    setNotice('');
    impact('medium');
    playClick();
    await performOpening(container, false);
  };

  const beginKeyOpening = async (container: Container) => {
    if (cooldownRemaining(container) > 0 || player.containerKeys < 1) return;
    setNotice('');
    impact('medium');
    playClick();
    await performOpening(container, false, true);
  };

  const startAd = (container: Container) => {
    if (adCountdown || opening || cooldownRemaining(container) > 0 || dailyFreeRemaining > 0) return;
    setNotice('');
    impact('light');
    playClick();
    let seconds = 3;
    setAdCountdown(`${seconds} сек`);
    const interval = setInterval(() => {
      seconds -= 1;
      if (seconds === 0) {
        clearInterval(interval);
        adIntervalRef.current = undefined;
        setAdCountdown('Проверяем…');
        void performOpening(container, true).catch((error) => {
          console.error('Не удалось открыть бесплатный контейнер.', error);
          setNotice('Не удалось открыть контейнер. Проверь соединение и попробуй ещё раз.');
          setAdCountdown(undefined);
          notification('error');
          playError();
        });
      } else {
        setAdCountdown(`${seconds} сек`);
      }
    }, 1000);
    adIntervalRef.current = interval;
  };

  const keepItem = (_item: InventoryItem) => {
    impact('medium');
    playClick();
    closeOpening();
  };

  const sellItem = async (item: InventoryItem) => {
    if (salePendingRef.current) return;
    salePendingRef.current = true;
    setIsSelling(true);
    setSaleError('');
    impact('medium');
    playClick();
    try {
      const response = await onAction({ type: 'quick-sell-item', itemId: item.id, requestId: createId('quick-sell') });
      if (response) closeOpening();
      else setSaleError('Продажа не завершилась. Предмет остался в коллекции.');
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : 'Не удалось продать предмет. Попробуй ещё раз.');
      notification('error');
      playError();
    } finally {
      salePendingRef.current = false;
      setIsSelling(false);
    }
  };

  const selectContainer = (container: Container) => {
    setNotice('');
    setSelectedContainerId(container.id);
    setSelectionOpen(true);
    impact('light');
    playClick();
  };

  const changeFilter = (nextFilter: ContainerFilter) => {
    impact('light');
    playClick();
    setCategory(nextFilter);
    const nextContainers = filterContainers(catalog, nextFilter, premiumOnly);
    setSelectedContainerId(nextContainers[0]?.id ?? '');
    setSelectionOpen(false);
  };

  return (
    <section className="space-y-4">
      <div className="relative isolate overflow-hidden rounded-[26px] border border-amber-400/25 bg-[#0b0b0e] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.42)] sm:p-5">
        <GenesisSceneBackdrop scene="vault" className="opacity-60" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#09090b]/95 via-[#09090b]/70 to-[#09090b]/18" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#09090b]/85 via-transparent to-black/10" />
        <div className="relative z-10 flex min-h-[128px] flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <p className="rounded-full border border-amber-300/25 bg-black/35 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-amber-100/90">Genesis · Private vault</p>
            <span className="shrink-0 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[9px] font-bold text-zinc-200/80">{catalog.length} контейнеров</span>
          </div>
          <div className="max-w-[18rem]">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300/85">Закрытый VIP-терминал</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#f6f2e8] sm:text-[28px]">Контейнеры</h1>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-300/80">Выбери поставку и открой свою следующую редкую находку.</p>
          </div>
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Фильтр контейнеров">
        {filterTabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => changeFilter(tab.id)}
            className={`shrink-0 rounded-xl border px-3 py-2.5 text-[10px] font-black tracking-wide transition focus:outline-none focus:ring-2 focus:ring-amber-300 sm:text-xs ${category === tab.id ? 'border-amber-400/25 bg-gradient-to-b from-amber-400/15 to-transparent text-amber-100 shadow-inner shadow-amber-300/5' : 'border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'}`}
            aria-pressed={category === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={premiumOnly}
          onClick={() => setPremiumOnly((current) => !current)}
          className={`rounded-full border px-3 py-2 text-[9px] font-black transition ${premiumOnly ? 'border-amber-300/35 bg-amber-300/10 text-amber-100' : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-200'}`}
        >
          {premiumOnly ? 'Только тир 3 · Вкл' : 'Показать только тир 3'}
        </button>
        <button
          type="button"
          aria-pressed={category === 'plates'}
          onClick={() => changeFilter('plates')}
          className={`rounded-full border px-3 py-2 text-[9px] font-black transition ${category === 'plates' ? 'border-amber-300/35 bg-amber-300/10 text-amber-100' : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-200'}`}
        >
          Номерная рулетка
        </button>
      </div>

      {notice && <p role="status" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">{notice}</p>}
      {catalogLoading && <p role="status" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-5 text-center text-xs text-zinc-400">Загружаем актуальные поставки…</p>}
      {catalogError && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-xs text-rose-200">{catalogError}</p>}
      {!catalogLoading && !catalogError && (
        <div className="space-y-4">
          {category === 'plates' ? (
            <LicensePlateRoulette player={player} onAction={onAction} />
          ) : selectedContainer ? (
            <>
              <section className="relative isolate overflow-hidden rounded-3xl border border-[#d4af37]/35 bg-gradient-to-b from-[#1c160e] via-[#111115] to-[#0a0a0d] p-4 shadow-[0_22px_55px_rgba(0,0,0,0.5)] sm:p-5" aria-label="Выбранный контейнер">
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(212,175,55,0.22),transparent_65%)]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#09090b] via-[#09090b]/35 to-transparent" />
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <span className="rounded-full border border-amber-300/25 bg-black/40 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-amber-100/90">{selectedContainer.category === 'clothing' ? 'Одежда' : selectedContainer.category === 'car' ? 'Тачки' : 'Номера'} · Тир {selectedContainer.tier}</span>
                  <span className="shrink-0 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[9px] font-bold text-zinc-300">{selectedContainer.contents.length} предметов</span>
                </div>
                {selectedContainer.id === 'second-hand-bale' && selectedContainer.category === 'clothing' && (
                  <div className="relative z-10 mt-2 flex justify-center">
                    <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${dailyFreeRemaining > 0 ? 'border-zinc-600 bg-black/45 text-zinc-300' : 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100'}`}>
                      {dailyFreeRemaining > 0 ? `Ежедневно · таймер ${dailyFreeTimer}` : 'Бесплатно · доступно'}
                    </span>
                  </div>
                )}
                <div className="relative z-10 mx-auto mt-2 flex h-40 items-center justify-center sm:h-44">
                  <span aria-hidden="true" className="absolute bottom-[12%] h-10 w-[62%] rounded-[50%] bg-amber-400/25 blur-xl" />
                  <span aria-hidden="true" className="absolute bottom-[10%] h-2.5 w-[58%] rounded-[50%] border border-amber-100/35 bg-gradient-to-b from-[#b99a60] via-[#322818] to-[#111116] shadow-[0_8px_15px_rgba(0,0,0,0.85)]" />
                  <GameImage source={selectedContainer.image} icon={selectedContainer.icon} alt={selectedContainer.name} loading="eager" className="relative z-10 h-full w-full object-contain drop-shadow-[0_20px_28px_rgba(0,0,0,0.9)] transition-transform duration-300" fallback={<span aria-hidden="true" className="text-7xl">{selectedContainer.icon}</span>} />
                </div>
                <div className="relative z-10 mt-1 text-center">
                  <h2 className="text-lg font-black leading-tight tracking-tight text-[#f5f0e6] sm:text-xl">{selectedContainer.name}</h2>
                  <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-zinc-400 sm:text-xs">{selectedContainer.description}</p>
                </div>
                <div className="relative z-10 mt-3 flex h-12 overflow-hidden rounded-2xl border border-[#d4af37]/45 bg-[#141418] p-1 shadow-lg">
                  <button type="button" disabled={Boolean(opening || adCountdown)} onClick={() => selectContainer(selectedContainer)} className="flex min-w-0 flex-[7] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8c6d2c] via-[#cfa84c] to-[#9a7730] px-2 text-[11px] font-black uppercase tracking-wider text-white shadow-inner transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 sm:text-sm">
                    <Box size={16} className="shrink-0" />
                    <span className="truncate">{cooldownText(selectedContainer) ? `Доступно через ${cooldownText(selectedContainer)}` : selectedContainer.price === 0 ? 'Открыть бесплатно' : 'Открыть'}</span>
                  </button>
                  <button type="button" disabled={Boolean(opening || adCountdown)} onClick={() => selectContainer(selectedContainer)} className="flex min-w-0 flex-[3] items-center justify-center whitespace-nowrap px-2 text-right text-[10px] font-extrabold tabular-nums text-[#f3d47c] transition hover:bg-white/[0.04] disabled:opacity-60 sm:px-3 sm:text-xs" aria-label={`Открыть ${selectedContainer.name} за ${formatRubles(selectedContainer.price)}`}>
                    {selectedContainer.price === 0 ? '0 ₽' : formatRubles(selectedContainer.price)}
                  </button>
                </div>
                {selectedContainer.id === 'second-hand-bale' && selectedContainer.category === 'clothing' && (
                  <button
                    type="button"
                    disabled={Boolean(opening || adCountdown || dailyFreeRemaining > 0 || cooldownRemaining(selectedContainer) > 0)}
                    onClick={() => startAd(selectedContainer)}
                    className="relative z-10 mt-2 flex min-h-10 w-full items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-[10px] font-black text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adCountdown ? `Ежедневный кейс · ${adCountdown}` : dailyFreeRemaining > 0 ? `Ежедневный кейс · ${dailyFreeTimer}` : 'Открыть ежедневный кейс бесплатно'}
                  </button>
                )}
                {(player.seasonCaseTokens[selectedContainer.id] ?? 0) > 0 && (
                  <button type="button" disabled={Boolean(opening || adCountdown)} onClick={() => void openSeasonCase(selectedContainer)} className="relative z-10 mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-[10px] font-black text-amber-100 transition hover:bg-amber-300/15 disabled:opacity-50 sm:text-xs">
                    <ChevronDown size={14} /> Открыть сезонный кейс бесплатно · билетов: {player.seasonCaseTokens[selectedContainer.id]}
                  </button>
                )}
              </section>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Список контейнеров">
                {containers.map((container) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    selected={container.id === selectedContainer.id}
                    disabled={Boolean(opening || adCountdown)}
                    cooldownText={cooldownText(container)}
                    shouldReduceMotion={Boolean(reducedMotion)}
                    seasonTokens={player.seasonCaseTokens[container.id] ?? 0}
                    onSelect={(choice) => { setSelectedContainerId(choice.id); impact('light'); playClick(); }}
                    onQuickOpen={selectContainer}
                    onSeasonOpen={(choice) => void openSeasonCase(choice)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">В этой категории пока нет контейнеров.</p>
          )}
        </div>
      )}

      <ContainerSelectionModal
        container={selectionOpen && selectedContainer && !opening ? selectedContainer : undefined}
        adCountdown={adCountdown}
        notice={notice}
        openingPending={openingPending}
        freeAvailableAt={dailyFreeCaseAvailableAt}
        cooldownText={selectedContainer ? cooldownText(selectedContainer) : undefined}
        keysAvailable={player.containerKeys}
        shouldReduceMotion={Boolean(reducedMotion)}
        onClose={() => setSelectionOpen(false)}
        onPaidOpen={beginPaidOpening}
        onKeyOpen={beginKeyOpening}
        onFreeOpen={startAd}
      />

      <ContainerOpeningModal
        opening={opening}
        licensePlateFrameIds={getEquippedLicensePlateFrameIds(player)}
        shouldReduceMotion={Boolean(reducedMotion)}
        isSelling={isSelling}
        saleError={saleError}
        onHit={hit}
        onClose={closeOpening}
        onKeep={keepItem}
        onSell={sellItem}
      />
    </section>
  );
}