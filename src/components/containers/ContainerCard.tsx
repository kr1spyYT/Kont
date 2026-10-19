import { motion } from 'framer-motion';
import { Box, ChevronRight, Ticket } from 'lucide-react';
import type { Container } from '../../types/game';
import { formatRubles } from '../../utils/currency';
import GameImage from '../GameImage';

interface ContainerCardProps {
  container: Container;
  selected: boolean;
  disabled: boolean;
  shouldReduceMotion: boolean;
  cooldownText?: string;
  seasonTokens: number;
  onSelect: (container: Container) => void;
  onQuickOpen: (container: Container) => void;
  onSeasonOpen: (container: Container) => void;
}

const categoryLabel = (container: Container) =>
  container.category === 'clothing' ? 'ОДЕЖДА' : container.category === 'car' ? 'ТАЧКИ' : 'НОМЕРА';

const tierGlow: Record<number, string> = {
  1: 'from-sky-400/20 via-blue-500/5',
  2: 'from-violet-400/20 via-blue-500/5',
  3: 'from-amber-300/25 via-amber-500/5',
};

export default function ContainerCard({
  container,
  selected,
  disabled,
  shouldReduceMotion,
  cooldownText,
  seasonTokens,
  onSelect,
  onQuickOpen,
  onSeasonOpen,
}: ContainerCardProps) {
  const tier = container.tier ?? 1;
  const glow = tierGlow[tier] ?? tierGlow[1];

  return (
    <motion.article
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.16 }}
      className={`relative min-w-0 overflow-hidden rounded-2xl border bg-gradient-to-b from-[#17171b] to-[#0b0b0e] p-2.5 shadow-[0_14px_28px_rgba(0,0,0,0.32)] transition-colors ${selected ? 'border-amber-300/55 ring-1 ring-amber-300/15' : 'border-white/10 hover:border-amber-300/30'}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(container)}
        aria-label={`Выбрать контейнер ${container.name}`}
        aria-pressed={selected}
        className="block w-full min-w-0 text-left disabled:cursor-wait"
      >
        <div className="flex items-center justify-between gap-1">
          <span className="max-w-[68%] truncate rounded-full border border-white/10 bg-black/30 px-1.5 py-1 text-[7px] font-black tracking-wide text-zinc-300 sm:text-[8px]">
            {categoryLabel(container)}
          </span>
          <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-1.5 py-1 text-[8px] font-bold text-amber-100/90">
            Тир {tier}
          </span>
        </div>
        <div className="relative mx-auto mt-1.5 flex h-[92px] items-center justify-center sm:h-[116px]">
          <span aria-hidden="true" className={`absolute bottom-[13%] h-10 w-4/5 rounded-full bg-gradient-to-b ${glow} to-transparent blur-xl`} />
          <span aria-hidden="true" className="absolute bottom-[12%] h-2 w-[76%] rounded-[50%] border border-amber-100/25 bg-gradient-to-b from-[#9b814a] via-[#302718] to-[#0a0a0c] shadow-[0_5px_10px_rgba(0,0,0,0.8)]" />
          <GameImage
            source={container.image}
            icon={container.icon}
            alt={container.name}
            loading="eager"
            className="relative z-10 h-full w-full object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.82)]"
            fallback={<span aria-hidden="true" className="text-5xl">{container.icon}</span>}
          />
        </div>
        <p title={container.name} className="mt-1 min-h-8 line-clamp-2 text-[10px] font-extrabold leading-4 text-[#f3efe6] sm:text-xs">
          {container.name}
        </p>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuickOpen(container)}
        className="mt-2 flex min-h-9 w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-amber-300/30 bg-gradient-to-r from-[#5d4823] via-[#9c7930] to-[#59431f] px-1.5 text-[9px] font-black text-amber-50 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 sm:text-[10px]"
        aria-label={`Открыть ${container.name} за ${formatRubles(container.price)}`}
      >
        <Box size={13} className="shrink-0" />
        <span className="truncate">{cooldownText ? `${cooldownText}` : container.price === 0 ? 'Бесплатно' : formatRubles(container.price)}</span>
        <ChevronRight size={13} className="shrink-0 opacity-70" />
      </button>

      {seasonTokens > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSeasonOpen(container)}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200/15 bg-amber-300/[0.06] px-1.5 py-1.5 text-[8px] font-bold text-amber-100 transition hover:bg-amber-300/10 disabled:opacity-50"
        >
          <Ticket size={11} /> Сезонный билет · {seasonTokens}
        </button>
      )}
    </motion.article>
  );
}
