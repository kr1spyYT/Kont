import { useReducedMotion } from 'framer-motion';
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

interface ContainersTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  freeCaseAvailableAt?: string | null;
  containerCooldowns?: Record<string, string>;
  availableContainers?: Container[];
  catalogLoading?: boolean;
  catalogError?: string;
}

export default function ContainersTab({ player, onAction, freeCaseAvailableAt, containerCooldowns, availableContainers, catalogLoading = false, catalogError = '' }: ContainersTabProps) {
  const reducedMotion = useReducedMotion();
  const catalog = availableContainers ?? CONTAINERS;
  const [category, setCategory] = useState<ContainerType>('clothing');
  const [selectedContainer, setSelectedContainer] = useState<Container>();
  const [adCountdown, setAdCountdown] = useState<string>();
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [isSelling, setIsSelling] = useState(false);
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

  const performOpening = async (container: Container, free: boolean, useKey = false) => {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setNotice(free ? 'Получаем ежедневный контейнер…' : useKey ? 'Списываем ключ и резервируем приз…' : 'Списываем оплату и резервируем приз…');
    try {
      const response = await onAction({ type: 'open-container', containerId: container.id, free, ...(useKey ? { useKey: true } : {}), requestId: createId('open') });
      const item = response?.result?.item;
      if (!item) {
        if (response?.result?.plate) {
          setNotice(response.result.message ?? `Номер ${response.result.plate} добавлен в коллекцию.`);
          notification('success');
          setSelectedContainer(undefined);
          return;
        }
        setNotice('Не удалось открыть контейнер. Проверь соединение и попробуй ещё раз.');
        notification('error');
        playError();
        return;
      }
      setNotice('');
      setSaleError('');
      setSelectedContainer(undefined);
      reveal(container, item);
    } catch (error) {
      console.error('Не удалось открыть контейнер.', error);
      setNotice(error instanceof Error ? error.message : 'Не удалось открыть контейнер. Попробуй ещё раз.');
      notification('error');
      playError();
    } finally {
      actionPendingRef.current = false;
      if (free) setAdCountdown(undefined);
    }
  };

  const openSeasonCase = async (container: Container) => {
    if (actionPendingRef.current) return;
    actionPendingRef.current = true;
    setNotice('Открываем бесплатный сезонный кейс…');
    try {
      const response = await onAction({ type: 'open-season-case', containerId: container.id, requestId: createId('season-case') });
      const item = response?.result?.item;
      if (!item) {
        setNotice(response?.result?.message ?? 'Не удалось открыть сезонный кейс. Проверь билет и попробуй ещё раз.');
        return;
      }
      setNotice('');
      setSaleError('');
      setSelectedContainer(undefined);
      reveal(container, item);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось открыть сезонный кейс.');
    } finally {
      actionPendingRef.current = false;
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
    if (adCountdown || opening || cooldownRemaining(container) > 0) return;
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
    setSelectedContainer(container);
    impact('light');
    playClick();
  };

  const containers = [...catalog]
    .sort((first, second) => first.order - second.order)
    .filter((container) => container.category === category);
  const categories = [
    { id: 'clothing' as const, label: 'Одежда', icon: '👕' },
    { id: 'car' as const, label: 'Машины', icon: '🚘' },
    { id: 'plates' as const, label: 'Номера', icon: '🔢' },
  ];

  return (
    <section className="space-y-5">
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

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-amber-300/15 bg-[#111116] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {categories.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => {
              impact('light');
              playClick();
              setCategory(tab.id);
              setSelectedContainer(undefined);
            }}
            className={`rounded-xl border px-2 py-3 text-xs font-black tracking-wide transition focus:outline-none focus:ring-2 focus:ring-amber-300 ${
              category === tab.id
                ? 'border-amber-400/25 bg-gradient-to-b from-amber-400/15 to-transparent text-amber-100 shadow-inner shadow-amber-300/5'
                : 'border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'
            }`}
            aria-pressed={category === tab.id}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">
          {notice}
        </p>
      )}

      {catalogLoading && <p role="status" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-5 text-center text-xs text-zinc-400">Загружаем актуальные поставки…</p>}
      {catalogError && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-xs text-rose-200">{catalogError}</p>}
      {!catalogLoading && !catalogError && (
        <div className="space-y-4">
          {category === 'plates' && <LicensePlateRoulette player={player} onAction={onAction} />}
          {containers.map((container) => {
            const seasonTokens = player.seasonCaseTokens[container.id] ?? 0;
            return (
              <div key={container.id} className="space-y-2">
                <ContainerCard
                  container={container}
                  disabled={Boolean(opening || adCountdown)}
                  cooldownText={cooldownText(container)}
                  shouldReduceMotion={Boolean(reducedMotion)}
                  onSelect={selectContainer}
                />
                {seasonTokens > 0 && (
                  <button type="button" disabled={Boolean(opening || adCountdown)} onClick={() => void openSeasonCase(container)} className="w-full rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2.5 text-xs font-black text-amber-100 disabled:opacity-50">
                    🎁 Открыть сезонный кейс бесплатно · билетов: {seasonTokens}
                  </button>
                )}
              </div>
            );
          })}
          {!containers.length && category !== 'plates' && (
            <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">В этой категории пока нет контейнеров.</p>
          )}
        </div>
      )}

      <ContainerSelectionModal
        container={selectedContainer && !opening ? selectedContainer : undefined}
        adCountdown={adCountdown}
        notice={notice}
        freeAvailableAt={freeCaseAvailableAt === null ? undefined : freeCaseAvailableAt ?? (player.freeCaseOpenedAt && Date.now() - new Date(player.freeCaseOpenedAt).getTime() < 86_400_000 ? new Date(new Date(player.freeCaseOpenedAt).getTime() + 86_400_000).toISOString() : undefined)}
        cooldownText={selectedContainer ? cooldownText(selectedContainer) : undefined}
        keysAvailable={player.containerKeys}
        shouldReduceMotion={Boolean(reducedMotion)}
        onClose={() => setSelectedContainer(undefined)}
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
