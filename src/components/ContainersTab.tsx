import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { CONTAINERS } from '../data/items';
import type { Container, InventoryItem, ItemType, PlayerState } from '../types/game';
import { formatRubles } from '../utils/currency';
import { getResaleValue } from '../game/economy';
import { impact, notification } from '../utils/haptics';
import { playClick, playError } from '../utils/sound';
import ContainerCard from './containers/ContainerCard';
import ContainerOpeningModal from './containers/ContainerOpeningModal';
import ContainerSelectionModal from './containers/ContainerSelectionModal';
import { useContainerOpening } from './containers/useContainerOpening';
import LicensePlateRoulette from './containers/LicensePlateRoulette';

interface ContainersTabProps {
  player: PlayerState;
  onPlayerChange: (player: PlayerState) => void;
}

export default function ContainersTab({ player, onPlayerChange }: ContainersTabProps) {
  const reducedMotion = useReducedMotion();
  const [category, setCategory] = useState<ItemType | 'plates'>('clothing');
  const [selectedContainer, setSelectedContainer] = useState<Container>();
  const [adCountdown, setAdCountdown] = useState<string>();
  const [notice, setNotice] = useState('');
  const { opening, viewportRef, tapeRef, reveal, closeOpening } = useContainerOpening();
  const adIntervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => () => {
    if (adIntervalRef.current) clearInterval(adIntervalRef.current);
  }, []);

  const beginPaidOpening = (container: Container) => {
    if (player.balance < container.price) {
      setNotice(`Недостаточно средств: нужно ещё ${formatRubles(container.price - player.balance)}.`);
      notification('error');
      playError();
      return;
    }
    setNotice('');
    impact('medium');
    playClick();
    setSelectedContainer(undefined);
    onPlayerChange({ ...player, balance: player.balance - container.price });
    reveal(container);
  };

  const startAd = (container: Container) => {
    if (adCountdown || opening) return;
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
        setAdCountdown(undefined);
        setSelectedContainer(undefined);
        reveal(container);
      } else {
        setAdCountdown(`${seconds} сек`);
      }
    }, 1000);
    adIntervalRef.current = interval;
  };

  const keepItem = (item: InventoryItem) => {
    impact('medium');
    playClick();
    onPlayerChange({
      ...player,
      inventory: [...player.inventory, item],
      respect: player.respect + item.respect,
    });
    closeOpening();
  };

  const sellItem = (item: InventoryItem) => {
    impact('medium');
    playClick();
    onPlayerChange({ ...player, balance: player.balance + getResaleValue(item) });
    closeOpening();
  };

  const selectContainer = (container: Container) => {
    setNotice('');
    setSelectedContainer(container);
    impact('light');
    playClick();
  };

  const containers = [...CONTAINERS]
    .sort((first, second) => first.order - second.order)
    .filter((container) => container.category === category);
  const categories = [
    { id: 'clothing' as const, label: 'Одежда', icon: '👕' },
    { id: 'car' as const, label: 'Машины', icon: '🚘' },
    { id: 'plates' as const, label: 'Номера', icon: '🔢' },
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Поставки с улиц</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Контейнеры</h1>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs font-bold text-zinc-400">
          6 лотов
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-1.5">
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
            className={`rounded-xl px-2 py-3 text-xs font-black tracking-wide transition focus:outline-none focus:ring-2 focus:ring-amber-300 ${
              category === tab.id
                ? 'bg-amber-400/10 text-amber-100 shadow-inner shadow-amber-300/5'
                : 'text-zinc-500 hover:text-zinc-200'
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

      {category === 'plates' ? (
        <LicensePlateRoulette player={player} onPlayerChange={onPlayerChange} />
      ) : (
        <div className="space-y-4">
          {containers.map((container) => (
            <ContainerCard
              key={container.id}
              container={container}
              disabled={Boolean(opening || adCountdown)}
              shouldReduceMotion={Boolean(reducedMotion)}
              onSelect={selectContainer}
            />
          ))}
        </div>
      )}

      <ContainerSelectionModal
        container={selectedContainer && !opening ? selectedContainer : undefined}
        adCountdown={adCountdown}
        notice={notice}
        shouldReduceMotion={Boolean(reducedMotion)}
        onClose={() => setSelectedContainer(undefined)}
        onPaidOpen={beginPaidOpening}
        onFreeOpen={startAd}
      />

      <ContainerOpeningModal
        opening={opening}
        viewportRef={viewportRef}
        tapeRef={tapeRef}
        onClose={closeOpening}
        onKeep={keepItem}
        onSell={sellItem}
      />
    </section>
  );
}
