import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Check, X } from 'lucide-react';
import { useEffect, type CSSProperties } from 'react';
import { RARITY_LABELS } from '../../data/items';
import type { InventoryItem, Rarity } from '../../types/game';
import { formatRubles } from '../../utils/currency';
import { getQuickSellValue } from '../../game/economy';
import GameImage from '../GameImage';
import ItemIcon from '../ItemIcon';
import LicensePlateDisplay from '../LicensePlateDisplay';
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

const RARITY_SURFACE_GLOW: Record<Rarity, string> = {
  common: 'rgb(148 163 184 / 12%)',
  uncommon: 'rgb(16 185 129 / 14%)',
  rare: 'rgb(59 130 246 / 15%)',
  epic: 'rgb(168 85 247 / 16%)',
  legendary: 'rgb(245 158 11 / 17%)',
  mythic: 'rgb(239 68 68 / 18%)',
};

const RARITY_DOT: Record<Rarity, string> = {
  common: 'bg-slate-400',
  uncommon: 'bg-emerald-400',
  rare: 'bg-blue-400',
  epic: 'bg-purple-400',
  legendary: 'bg-amber-400',
  mythic: 'bg-rose-400',
};

const RARITY_CONFETTI_COLORS: Record<Rarity, string[]> = {
  common: ['#cbd5e1', '#94a3b8'],
  uncommon: ['#6ee7b7', '#34d399'],
  rare: ['#60a5fa', '#a78bfa'],
  epic: ['#e879f9', '#a78bfa', '#818cf8'],
  legendary: ['#fef08a', '#fbbf24', '#f97316'],
  mythic: ['#fda4af', '#fb7185', '#c084fc'],
};

const RARITY_CONFETTI: Record<Rarity, { count: number; spread: number; velocity: number }> = {
  common: { count: 0, spread: 0, velocity: 0 },
  uncommon: { count: 0, spread: 0, velocity: 0 },
  rare: { count: 22, spread: 62, velocity: 24 },
  epic: { count: 36, spread: 76, velocity: 30 },
  legendary: { count: 95, spread: 100, velocity: 42 },
  mythic: { count: 130, spread: 115, velocity: 50 },
};

const RARITY_SPARK_COUNT: Record<Rarity, number> = {
  common: 0,
  uncommon: 0,
  rare: 8,
  epic: 12,
  legendary: 16,
  mythic: 18,
};

const REWARD_SPARKS = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2;
  return {
    left: `${50 + Math.cos(angle) * 43}%`,
    top: `${46 + Math.sin(angle) * 42}%`,
    x: `${Math.cos(angle) * (22 + (index % 3) * 8)}px`,
    y: `${Math.sin(angle) * (22 + (index % 3) * 8)}px`,
  };
});

const RARITY_WIN_INTENSITY: Record<Rarity, number> = {
  common: 0.85,
  uncommon: 0.95,
  rare: 1.1,
  epic: 1.25,
  legendary: 1.5,
  mythic: 1.8,
};

const RARITY_HAPTIC: Record<Rarity, 'light' | 'medium' | 'heavy' | 'rigid'> = {
  common: 'light',
  uncommon: 'light',
  rare: 'medium',
  epic: 'heavy',
  legendary: 'rigid',
  mythic: 'rigid',
};

const ENERGY_SPARKS = [
  { left: '27%', top: '34%', x: '-16px', y: '-14px' },
  { left: '73%', top: '34%', x: '16px', y: '-14px' },
  { left: '23%', top: '49%', x: '-20px', y: '0px' },
  { left: '77%', top: '49%', x: '20px', y: '0px' },
  { left: '29%', top: '64%', x: '-16px', y: '14px' },
  { left: '71%', top: '64%', x: '16px', y: '14px' },
  { left: '40%', top: '30%', x: '-6px', y: '-18px' },
  { left: '60%', top: '30%', x: '6px', y: '-18px' },
] as const;

const ENERGY_PARTICLES = [
  { left: '37%', top: '38%', x: '-24px', y: '-18px' },
  { left: '63%', top: '38%', x: '24px', y: '-18px' },
  { left: '33%', top: '52%', x: '-28px', y: '1px' },
  { left: '67%', top: '52%', x: '28px', y: '1px' },
  { left: '39%', top: '64%', x: '-20px', y: '20px' },
  { left: '61%', top: '64%', x: '20px', y: '20px' },
] as const;

function ItemDetails({ item, frameIds }: { item: InventoryItem; frameIds: readonly string[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-left">
      <div className="rounded-xl bg-black/20 p-2.5">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Серия</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-white">{item.serial}</p>
      </div>
      {item.type === 'car' && (
        <div className="rounded-xl bg-black/20 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Состояние</p>
          <p className="mt-0.5 text-sm font-bold text-white">
            {item.wear.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </p>
        </div>
      )}
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
            <LicensePlateDisplay plate={item.licensePlate} frameIds={frameIds} size="large" className="mt-0.5" />
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
  licensePlateFrameIds?: readonly string[];
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
  licensePlateFrameIds = [],
  onHit,
  onClose,
  onKeep,
  onSell,
}: ContainerOpeningModalProps) {
  const isResult = opening?.phase === 'result';
  const canHit = Boolean(opening && ['idle', 'hit1', 'hit2'].includes(opening.phase) && !opening.isHitAnimating);
  const canQuickSell = Boolean(opening
    && !(opening.item.type === 'car' && (opening.item.licensePlateId || opening.item.licensePlate)));
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

  useEffect(() => {
    if (!isResult || shouldReduceMotion || !opening) return;
    const burst = RARITY_CONFETTI[opening.item.rarity];
    if (burst.count === 0) return;
    confetti({
      particleCount: burst.count,
      spread: burst.spread,
      startVelocity: burst.velocity,
      origin: { x: 0.5, y: 0.62 },
      colors: RARITY_CONFETTI_COLORS[opening.item.rarity],
      ticks: opening.item.rarity === 'rare' || opening.item.rarity === 'epic' ? 90 : 150,
      disableForReducedMotion: true,
    });
  }, [isResult, opening?.sequenceId, opening?.item.rarity, shouldReduceMotion]);

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

            <AnimatePresence mode="wait" initial={false}>
              {isResult ? (
                <motion.div
                  key="reward-card"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, y: 86, rotate: -5 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 260, damping: 16, mass: 0.8 }}
                >
                  <div
                    className={`container-break-reward container-break-reward__card relative isolate my-4 flex min-h-[20rem] flex-col items-center overflow-hidden rounded-2xl border border-amber-300/20 bg-[#0e0e12] px-3 pb-3 pt-2 ${shouldReduceMotion ? 'container-break-reward--reduced' : ''}`}
                    data-rarity={opening.item.rarity}
                    style={{
                      '--break-glow': RARITY_GLOW[opening.item.rarity],
                      '--reward-glow': RARITY_SURFACE_GLOW[opening.item.rarity],
                    } as CSSProperties}
                  >
                    <span aria-hidden="true" className="container-break-reward__flash pointer-events-none absolute inset-0" />
                    {REWARD_SPARKS.slice(0, RARITY_SPARK_COUNT[opening.item.rarity]).map((spark, index) => (
                      <span
                        key={`reward-spark-${index}`}
                        aria-hidden="true"
                        className="container-break-reward__spark"
                        style={{
                          left: spark.left,
                          top: spark.top,
                          '--reward-spark-x': spark.x,
                          '--reward-spark-y': spark.y,
                        } as CSSProperties}
                      />
                    ))}
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-500/10 via-transparent to-transparent" />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-14 left-1/2 h-28 w-56 -translate-x-1/2 rounded-full blur-2xl"
                      style={{ background: `radial-gradient(ellipse at center, ${RARITY_SURFACE_GLOW[opening.item.rarity]}, transparent 72%)` }}
                    />
                    <div className="relative z-10 h-52 w-full">
                      <span aria-hidden="true" className="container-break-reward__rays absolute left-1/2 top-[38%] h-56 w-56" />
                      <img
                        src="/assets/season/genesis/rewards/unboxing-podium.webp"
                        alt=""
                        aria-hidden="true"
                        loading="eager"
                        className="pointer-events-none absolute -bottom-[68px] left-1/2 z-[1] h-[250px] w-[250px] -translate-x-1/2 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.82)]"
                      />
                      <motion.div
                        initial={shouldReduceMotion ? false : { y: 86, scale: 0.5, rotate: -9 }}
                        animate={shouldReduceMotion ? { y: 0, scale: 1, rotate: 0 } : { y: 0, scale: 1, rotate: 0 }}
                        transition={shouldReduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 300, damping: 13, mass: 0.75, delay: 0.04 }}
                        className="container-break-reward__item absolute bottom-[72px] left-1/2 z-10"
                        style={{ marginLeft: '-61px' }}
                      >
                        <span className="container-break-reward__shine-wrap relative block h-[122px] w-[122px]">
                          <ItemIcon item={opening.item} size="xxl" className="!h-[122px] !w-[122px] !bg-transparent !bg-none !border-0 !shadow-none" />
                          <span aria-hidden="true" className="container-break-reward__shine" />
                        </span>
                      </motion.div>
                    </div>
                    <motion.p
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.22, delay: shouldReduceMotion ? 0 : 0.32 }}
                      className="relative z-10 mt-2 text-lg font-black text-white"
                    >
                      {opening.item.name}
                    </motion.p>
                    <motion.div
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.22, delay: shouldReduceMotion ? 0 : 0.48 }}
                      className="relative z-10 mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-bold"
                    >
                      <span className="text-emerald-200">💰 {formatRubles(opening.item.price)}</span>
                      <span className="text-amber-200">⭐ +{opening.item.respect.toLocaleString('ru-RU')} Респект</span>
                    </motion.div>
                    <motion.span
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 7, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.2, delay: shouldReduceMotion ? 0 : 0.63 }}
                      className={`relative z-10 mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-wider ${rarityStyles[opening.item.rarity]}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${RARITY_DOT[opening.item.rarity]}`} aria-hidden="true" />
                      {RARITY_LABELS[opening.item.rarity]}
                    </motion.span>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="energy-impact"
                  type="button"
                  onClick={onHit}
                  disabled={!canHit}
                  className="container-break-scene group relative my-4 flex w-full select-none flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 px-3 py-3 shadow-[inset_0_0_36px_rgba(0,0,0,0.75)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-100"
                  data-phase={opening.phase}
                  data-rarity={opening.item.rarity}
                  style={{
                    '--break-glow': RARITY_GLOW[opening.item.rarity],
                    height: 'clamp(15rem, 44vh, 21rem)',
                  } as CSSProperties}
                  aria-label={canHit ? `${opening.container.name}. ${hitPrompt}` : hitPrompt}
                >
                  <span className="container-break-scene__glow" aria-hidden="true" />
                  <span className="container-break-scene__floor" aria-hidden="true" />
                  <span className="container-break-scene__case relative z-10 flex h-[78%] w-full items-center justify-center">
                    {opening.container.tier === 3 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 z-0 h-[82%] w-[94%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.06) 48%, transparent 74%)' }}
                      />
                    )}
                    <GameImage
                      source={opening.container.image}
                      icon={opening.container.icon}
                      alt={opening.container.name}
                      loading="eager"
                      className={`relative z-10 max-h-full max-w-[86%] object-contain ${opening.container.tier === 3 ? 'drop-shadow-[0_16px_24px_rgba(0,0,0,0.85)]' : 'drop-shadow-[0_22px_30px_rgba(0,0,0,0.76)]'}`}
                      fallback={<span className="text-7xl" aria-hidden="true">{opening.container.icon}</span>}
                    />
                  </span>
                  <span className="container-break-scene__white-flash" aria-hidden="true" />
                  <span className="container-break-scene__burst" aria-hidden="true" />
                  <span className="container-break-scene__darken" aria-hidden="true" />
                  {ENERGY_SPARKS.map((spark, index) => (
                    <span
                      key={`spark-${index}`}
                      className="container-break-spark"
                      style={{
                        left: spark.left,
                        top: spark.top,
                        '--particle-x': spark.x,
                        '--particle-y': spark.y,
                      } as CSSProperties}
                      aria-hidden="true"
                    />
                  ))}
                  {ENERGY_PARTICLES.map((particle, index) => (
                    <span
                      key={`particle-${index}`}
                      className="container-break-particle"
                      style={{
                        left: particle.left,
                        top: particle.top,
                        '--particle-x': particle.x,
                        '--particle-y': particle.y,
                      } as CSSProperties}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="absolute inset-x-0 bottom-3 z-50 flex flex-col items-center justify-center gap-2 px-3">
                    <span className="container-break-scene__pips flex items-center gap-1.5" aria-label={`${opening.phase === 'idle' ? 0 : opening.phase === 'hit1' ? 1 : opening.phase === 'hit2' ? 2 : 3} из 3 ударов`}>
                      {[1, 2, 3].map((pip) => {
                        const completed = opening.phase === 'hit1' ? pip <= 1
                          : opening.phase === 'hit2' ? pip <= 2
                            : opening.phase === 'hit3' || opening.phase === 'revealing' ? true
                              : false;
                        return <span key={pip} className={`container-break-scene__pip ${completed ? 'container-break-scene__pip--filled' : ''}`} aria-hidden="true" />;
                      })}
                    </span>
                    <span className={`container-break-scene__prompt container-break-scene__prompt--${opening.phase} rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] font-bold tracking-wide text-zinc-200 backdrop-blur-sm sm:text-xs`}>
                      {hitPrompt}
                    </span>
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            {isResult && (
              <div>
                <div className="rounded-2xl border border-white/10 bg-[#0c0c0e] p-2.5 sm:p-3">
                  <ItemDetails item={opening.item} frameIds={licensePlateFrameIds} />
                </div>
                {saleError && <p role="status" className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{saleError}</p>}
                <div className={`sticky bottom-0 z-50 -mx-4 mt-4 grid ${canQuickSell ? 'grid-cols-2' : 'grid-cols-1'} gap-2 border-t border-white/10 bg-[#111114]/95 px-4 pb-1 pt-3 backdrop-blur-md sm:-mx-5 sm:px-5`}>
                  <button
                    type="button"
                    onClick={() => onKeep(opening.item)}
                    disabled={isSelling}
                    className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-2 py-3 text-xs font-black text-[#151719] transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    <Check size={15} />
                    В {opening.item.type === 'car' ? 'гараж' : 'инвентарь'}
                  </button>
                  {canQuickSell ? (
                    <button
                      type="button"
                      onClick={() => onSell(opening.item)}
                      disabled={isSelling}
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-amber-300/35 bg-gradient-to-b from-amber-300/15 to-amber-300/5 px-2 py-2 text-amber-50 transition hover:bg-amber-300/20 disabled:cursor-wait disabled:opacity-50"
                    >
                      {!isSelling && <img src="/assets/season/genesis/rewards/quicksell-bolt.webp" alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain drop-shadow-[0_2px_5px_rgba(245,158,11,0.35)]" />}
                      <span className="text-[10px] font-black leading-tight">{isSelling ? 'Продаём…' : <>Продать сразу<br />за {formatRubles(getQuickSellValue(opening.item))} · +10 XP</>}</span>
                    </button>
                  ) : (
                    <p role="note" className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[10px] font-semibold leading-relaxed text-zinc-400">
                      {opening.item.type === 'car' && (opening.item.licensePlateId || opening.item.licensePlate)
                        ? 'Чтобы продать машину, сначала сними с неё госномер.'
                        : 'Сначала сними предмет с персонажа или убери машину из профиля, чтобы продать.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
