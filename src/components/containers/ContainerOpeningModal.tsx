import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { RARITY_LABELS } from '../../data/items';
import type { InventoryItem, Rarity } from '../../types/game';
import { formatRubles } from '../../utils/currency';
import { getQuickSellValue } from '../../game/economy';
import GameImage from '../GameImage';
import ItemIcon from '../ItemIcon';
import { rarityStyles } from './containerConfig';
import type { OpeningState } from './useContainerOpening';

const RARITY_GLOW: Record<Rarity, string> = {
  common: 'rgb(226 232 240 / 82%)',
  uncommon: 'rgb(226 232 240 / 82%)',
  rare: 'rgb(167 139 250 / 88%)',
  epic: 'rgb(167 139 250 / 88%)',
  legendary: 'rgb(251 191 36 / 92%)',
  mythic: 'rgb(251 191 36 / 92%)',
};

const HIT_SPARKS = Array.from({ length: 8 }, (_, index) => index);
const DUST_PARTICLES = Array.from({ length: 6 }, (_, index) => index);

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
  shouldReduceMotion: boolean;
  isSelling?: boolean;
  saleError?: string;
  onHit: () => void;
  onClose: () => void;
  onKeep: (item: InventoryItem) => void;
  onSell: (item: InventoryItem) => void;
}

export default function ContainerOpeningModal({
  opening,
  shouldReduceMotion,
  isSelling = false,
  saleError = '',
  onHit,
  onClose,
  onKeep,
  onSell,
}: ContainerOpeningModalProps) {
  const isResult = opening?.phase === 'result';
  const canHit = Boolean(opening && ['idle', 'hit1', 'hit2'].includes(opening.phase) && !opening.isHitAnimating);
  const hitPrompt = opening?.phase === 'idle'
    ? 'Нажми, чтобы ударить'
    : opening?.phase === 'hit1'
      ? 'Второй удар · 2 из 3'
      : opening?.phase === 'hit2'
        ? 'Последний удар · 3 из 3'
        : opening?.phase === 'hit3'
          ? 'Пломба треснула'
          : opening?.phase === 'revealing'
            ? 'Контейнер открывается…'
            : 'Контейнер открыт';

  return (
    <AnimatePresence>
      {opening && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 px-3 py-4 backdrop-blur-sm sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reveal-title"
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-700/90 bg-[#111114] p-4 text-center shadow-[0_24px_90px_rgba(0,0,0,0.72)] sm:p-5"
          >
            {isResult && (
              <button
                type="button"
                onClick={onClose}
                disabled={isSelling}
                className="absolute right-3 top-3 z-40 rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
                aria-label="Закрыть результат"
              >
                <X size={18} />
              </button>
            )}

            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">{opening.container.name}</p>
            <h2 id="reveal-title" className="mt-2 text-xl font-black text-white sm:text-2xl">
              {isResult ? 'Твой дроп!' : 'Открой контейнер тремя ударами'}
            </h2>
            {!isResult && <p className="mt-1 text-xs text-zinc-500">Награда уже определена, осталось сорвать пломбу</p>}

            <button
              type="button"
              onClick={onHit}
              disabled={!canHit}
              className={`container-break-scene group relative ${isResult ? 'my-2' : 'my-4'} flex w-full select-none flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 px-3 py-3 shadow-[inset_0_0_36px_rgba(0,0,0,0.75)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-100`}
              data-phase={opening.phase}
              data-rarity={opening.item.rarity}
              style={{
                '--break-glow': RARITY_GLOW[opening.item.rarity],
                height: isResult ? 'clamp(8rem, 22vh, 10rem)' : 'clamp(15rem, 44vh, 21rem)',
              } as CSSProperties}
              aria-label={canHit ? `${opening.container.name}. ${hitPrompt}` : hitPrompt}
            >
              <span className="container-break-scene__glow" aria-hidden="true" />
              <span className="container-break-scene__seam" aria-hidden="true" />
              <span className="container-break-scene__case relative z-10 flex h-[78%] w-full items-center justify-center">
                <GameImage
                  source={opening.container.image}
                  icon={opening.container.icon}
                  alt={opening.container.name}
                  loading="eager"
                  className="max-h-full max-w-[86%] object-contain drop-shadow-[0_22px_30px_rgba(0,0,0,0.76)]"
                  fallback={<span className="text-7xl" aria-hidden="true">{opening.container.icon}</span>}
                />
              </span>
              <span className="container-break-scene__flash" aria-hidden="true" />
              {HIT_SPARKS.map((index) => (
                <span
                  key={`spark-${index}`}
                  className="container-break-spark"
                  style={{ '--spark-angle': `${index * 45}deg` } as CSSProperties}
                  aria-hidden="true"
                />
              ))}
              {DUST_PARTICLES.map((index) => (
                <span
                  key={`dust-${index}`}
                  className="container-break-dust"
                  style={{ left: `${22 + index * 11}%`, top: `${34 + (index % 2) * 19}%` }}
                  aria-hidden="true"
                />
              ))}
              <span className="absolute inset-x-0 bottom-3 z-40 flex justify-center px-3">
                <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] font-bold tracking-wide text-zinc-200 backdrop-blur-sm sm:text-xs">
                  {hitPrompt}
                </span>
              </span>
            </button>

            <AnimatePresence mode="wait">
              {isResult && (
                <motion.div
                  key="drop-result"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: 'easeOut' }}
                >
                  <div className={`mt-2 rounded-2xl border p-3 sm:p-4 ${rarityStyles[opening.item.rarity]}`}>
                    <ItemIcon item={opening.item} size="xl" className="mx-auto h-20 w-28 sm:h-24 sm:w-32" />
                    <p className="mt-2 text-lg font-black text-white">{opening.item.name}</p>
                    <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${rarityStyles[opening.item.rarity]}`}>
                      {RARITY_LABELS[opening.item.rarity]}
                    </span>
                    <ItemDetails item={opening.item} />
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
                    <span>+{opening.item.respect} респекта</span>
                  </div>
                  {saleError && <p role="status" className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{saleError}</p>}
                  <div className="sticky bottom-0 z-50 -mx-4 mt-4 grid grid-cols-2 gap-2 border-t border-white/10 bg-[#111114]/95 px-4 pb-1 pt-3 backdrop-blur-md sm:-mx-5 sm:px-5">
                    <button
                      type="button"
                      onClick={() => onKeep(opening.item)}
                      disabled={isSelling}
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2 py-3 text-xs font-black text-[#151719] transition hover:bg-amber-300 disabled:opacity-50"
                    >
                      <Check size={15} />
                      В {opening.item.type === 'car' ? 'гараж' : 'инвентарь'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSell(opening.item)}
                      disabled={isSelling}
                      className="min-h-12 rounded-xl border border-amber-300/30 bg-amber-300/10 px-2 py-2 text-[11px] font-black text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-wait disabled:opacity-50"
                    >
                      {isSelling ? 'Продаём…' : <>⚡ Продать сразу<br />за {formatRubles(getQuickSellValue(opening.item))} · +10 XP</>}
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
