import { Award, Crown } from 'lucide-react';
import { OWNER_RANK_TITLE } from '../game/ranks';

const rankStyles: Record<string, string> = {
  'Новое лицо': 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  'Искатель находок': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  'Свой человек': 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  'Мастер поставок': 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  'Легенда района': 'border-amber-300/50 bg-amber-300/10 text-amber-100 shadow-sm shadow-amber-300/10',
  [OWNER_RANK_TITLE]: 'border-yellow-300/60 bg-yellow-300/15 text-yellow-100 shadow-sm shadow-yellow-300/15',
};

interface RankBadgeProps {
  title: string;
  compact?: boolean;
  fullText?: boolean;
  showIcon?: boolean;
}

export default function RankBadge({ title, compact = false, fullText = false, showIcon = true }: RankBadgeProps) {
  const OwnerIcon = title === OWNER_RANK_TITLE ? Crown : Award;

  return (
    <span
      title={title}
      aria-label={`Звание: ${title}`}
      className={`inline-flex items-center gap-1 rounded-full border font-black leading-none ${rankStyles[title] ?? 'border-amber-300/40 bg-amber-300/10 text-amber-100'} ${fullText ? 'min-w-fit max-w-none shrink-0 overflow-visible' : 'min-w-0 max-w-full shrink overflow-hidden'} ${compact ? fullText ? 'px-1 py-1 text-[6px] tracking-normal' : 'px-1.5 py-1 text-[7px] tracking-wide' : 'px-2 py-1.5 text-[9px] tracking-wide'}`}
    >
      {showIcon && <OwnerIcon size={compact ? 9 : 11} strokeWidth={2.5} className="shrink-0" />}
      <span className={fullText ? 'whitespace-nowrap' : 'truncate'}>{title}</span>
    </span>
  );
}
