import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { RefObject } from 'react';
import ItemIcon from '../ItemIcon';
import { RARITY_LABELS } from '../../data/items';
import { formatRubles } from '../../utils/currency';
import { getQuickSellValue } from '../../game/economy';
import type { ContainerDrop, InventoryItem } from '../../types/game';
import { rarityStyles, tapeRarityStyles } from './containerConfig';
import type { OpeningState } from './useContainerOpening';

function ItemDetails({ item }: { item: InventoryItem }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-left">
      <div className="rounded-xl bg-black/20 p-2.5">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Серия</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-white">{item.serial}</p>
      </div>
      <div className="rounded-xl bg-black/20 p-2.5">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Состояние</p>
        <p className="mt-0.5 text-sm font-bold text-white">
          {item.wear.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
        </p>
      </div>
      {item.type === 'clothing' ? (
        <div className="col-span-2 rounded-xl bg-black/20 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Легит-чек</p>
          <p className="mt-0.5 text-sm font-semibold text-amber-200">❓ Не проверен на легит</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-black/20 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Пробег</p>
            <p className="mt-0.5 text-sm font-bold text-white">{item.mileage.toLocaleString('ru-RU')} км</p>
          </div>
          <div className="rounded-xl bg-black/20 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Госномер</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-white">{item.licensePlate ?? 'Без номера'}</p>
          </div>
        </>
      )}
      <div className="col-span-2 flex items-center justify-between rounded-xl bg-black/20 p-2.5">
        <span className="text-xs text-zinc-400">Оценка с учётом состояния</span>
        <span className="text-sm font-black text-emerald-200">{formatRubles(item.price)}</span>
      </div>
    </div>
  );
}

interface ContainerOpeningModalProps {
  opening?: OpeningState;
  viewportRef: RefObject<HTMLDivElement>;
  tapeRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onKeep: (item: InventoryItem) => void;
  onSell: (item: InventoryItem) => void;
}

export default function ContainerOpeningModal({
  opening,
  viewportRef,
  tapeRef,
  onClose,
  onKeep,
  onSell,
}: ContainerOpeningModalProps) {
  return (
    <AnimatePresence>
      {opening && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reveal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className="relative max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-5 text-center"
          >
            {opening.phase === 'revealed' && (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                aria-label="Закрыть результат"
              >
                <X size={18} />
              </button>
            )}
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">{opening.container.name}</p>
            <h2 id="reveal-title" className="mt-2 text-xl font-black text-white">
              {opening.phase === 'spinning' ? 'Вскрываем…' : 'Твой дроп!'}
            </h2>
            <div
              ref={viewportRef}
              className="relative my-4 flex h-36 w-full items-center overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e12] shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]"
              aria-label="Рулетка дропа"
            >
              <div ref={tapeRef} className="absolute inset-y-0 left-0 flex h-full items-center will-change-transform">
                {opening.tape.map((card, index) => {
                  const rarityStyle = tapeRarityStyles[card.drop.rarity];
                  const isWinningCard = card.isWinner && opening.phase !== 'spinning';
                  const item: ContainerDrop & { category: 'clothing' | 'car'; containerId: string } = {
                    ...card.drop,
                    category: opening.container.category === 'car' ? 'car' : 'clothing',
                    containerId: opening.container.id,
                  };
                  return (
                    <div
                      key={`${index}-${card.drop.name}`}
                      className={`relative mx-[4px] flex h-[112px] w-[116px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border bg-[#15171e] p-2.5 transition-transform duration-300 ${
                        isWinningCard
                          ? 'scale-105 animate-pulse border-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.45)]'
                          : 'border-white/10'
                      }`}
                    >
                      <div
                        className={`pointer-events-none absolute inset-0 m-auto h-12 w-12 rounded-full blur-xl ${rarityStyle.glow}`}
                        aria-hidden="true"
                      />
                      <ItemIcon
                        item={item}
                        size="lg"
                        className="relative z-10 my-auto h-20 w-20 max-h-full max-w-full"
                      />
                      <div className={`absolute inset-x-0 bottom-0 h-1.5 w-full ${rarityStyle.strip}`} />
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-[#0d0e12] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-[#0d0e12] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[2px] -translate-x-1/2 bg-amber-400 shadow-[0_0_12px_#fbbf24]" />
              <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-amber-400" />
              <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 -translate-x-1/2 border-x-[7px] border-b-[8px] border-x-transparent border-b-amber-400" />
            </div>

            <AnimatePresence mode="wait">
              {opening.phase === 'revealed' && (
                <motion.div
                  key="drop-result"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <div className={`mt-3 rounded-2xl border p-4 ${rarityStyles[opening.item.rarity]}`}>
                    <ItemIcon item={opening.item} size="xl" className="mx-auto h-24 w-32" />
                    <p className="mt-3 text-lg font-black text-white">{opening.item.name}</p>
                    <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${rarityStyles[opening.item.rarity]}`}>
                      {RARITY_LABELS[opening.item.rarity]}
                    </span>
                    <ItemDetails item={opening.item} />
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
                    <span>+{opening.item.respect} респекта</span>
                    <span className="text-zinc-700">·</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onKeep(opening.item)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2 py-3 text-xs font-black text-[#151719] transition hover:bg-amber-300"
                    >
                      <Check size={15} />
                      В {opening.item.type === 'car' ? 'гараж' : 'инвентарь'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSell(opening.item)}
                      className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-2 py-3 text-[11px] font-black text-amber-100 transition hover:bg-amber-300/20"
                    >
                      ⚡ Продать сразу<br />за {formatRubles(getQuickSellValue(opening.item))} · +10 XP
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
