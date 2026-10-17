import type { Rarity } from '../../types/game';

export const rarityStyles: Record<Rarity, string> = {
  common: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
  uncommon: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  rare: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  epic: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
  legendary: 'border-amber-300/50 bg-amber-300/10 text-amber-100',
  mythic: 'border-rose-300/60 bg-rose-400/15 text-rose-100',
};

export const tapeRarityStyles: Record<Rarity, { glow: string; strip: string }> = {
  common: { glow: 'bg-zinc-400/10', strip: 'bg-zinc-400' },
  uncommon: { glow: 'bg-emerald-400/10', strip: 'bg-emerald-400 shadow-[0_0_10px_#34d399]' },
  rare: { glow: 'bg-blue-500/15', strip: 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' },
  epic: { glow: 'bg-purple-500/15', strip: 'bg-purple-500 shadow-[0_0_10px_#a855f7]' },
  legendary: { glow: 'bg-amber-400/15', strip: 'bg-amber-400 shadow-[0_0_12px_#fbbf24]' },
  mythic: { glow: 'bg-rose-400/20', strip: 'bg-rose-400 shadow-[0_0_14px_#fb7185]' },
};

export const containerLooks: Record<string, {
  tier: string;
  tierNumber: number;
  art: string;
  fallback: string;
  badge: string;
  icon: string;
  button: string;
  secret: string;
}> = {
  'second-hand-bale': {
    tier: 'LOW-TIER',
    tierNumber: 1,
    art: '📦',
    fallback: 'from-amber-300/30 via-orange-500/20 to-amber-950/70 shadow-[0_0_35px_rgba(251,146,60,0.35)]',
    badge: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
    icon: 'border-amber-300/25 from-amber-500/25 to-orange-800/40 text-amber-100',
    button: 'from-amber-500 to-orange-600 text-zinc-950',
    secret: 'Внутри винтажные находки и уличная база.',
  },
  'hype-box': {
    tier: 'MID-TIER HYPE',
    tierNumber: 2,
    art: '👟',
    fallback: 'from-stone-300/20 via-stone-500/15 to-zinc-950/70',
    badge: 'border-stone-300/25 bg-stone-300/5 text-stone-200',
    icon: 'border-stone-300/25 from-stone-300/15 via-zinc-800/30 to-zinc-950 text-stone-100',
    button: 'from-amber-400 to-amber-500 text-zinc-950',
    secret: 'Внутри громкие бренды и редкий streetwear.',
  },
  'tokyo-archive': {
    tier: 'HIGH-TIER GRAIL',
    tierNumber: 3,
    art: '🗼',
    fallback: 'from-emerald-300/15 via-emerald-900/20 to-emerald-950/70',
    badge: 'border-emerald-300/25 bg-emerald-300/5 text-emerald-200',
    icon: 'border-emerald-300/25 from-emerald-400/10 to-emerald-950/30 text-emerald-100',
    button: 'from-amber-400 to-amber-500 text-zinc-950',
    secret: 'Внутри архивные дропы Deadstock 100%.',
  },
  'impound-lot': {
    tier: 'IMPOUND · INDUSTRIAL',
    tierNumber: 1,
    art: '🚧',
    fallback: 'from-yellow-300/35 via-orange-500/20 to-yellow-950/70 shadow-[0_0_35px_rgba(234,179,8,0.4)]',
    badge: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
    icon: 'border-yellow-400/35 from-yellow-400/20 to-orange-700/20 text-yellow-100',
    button: 'from-yellow-400 to-orange-600 text-zinc-950',
    secret: 'Внутри машины с характером и историей.',
  },
  'japanese-auction': {
    tier: 'AUCTION JAPAN',
    tierNumber: 2,
    art: '🏎️',
    fallback: 'from-slate-300/20 via-blue-900/20 to-blue-950/70',
    badge: 'border-slate-300/25 bg-slate-300/5 text-slate-200',
    icon: 'border-slate-300/25 from-slate-300/15 to-blue-950/30 text-slate-100',
    button: 'from-amber-400 to-amber-500 text-zinc-950',
    secret: 'Внутри легенды JDM и редкий импорт.',
  },
  'dubai-transit': {
    tier: 'LUXURY IMPORT',
    tierNumber: 3,
    art: '🌆',
    fallback: 'from-amber-200/35 via-yellow-500/20 to-amber-950/70 shadow-[0_0_35px_rgba(245,158,11,0.4)]',
    badge: 'border-amber-200/45 bg-amber-200/10 text-amber-100',
    icon: 'border-amber-200/45 from-amber-300/25 via-yellow-500/15 to-zinc-900 text-amber-100',
    button: 'from-amber-200 to-amber-600 text-zinc-950',
    secret: 'Внутри сверхредкий премиум-класс.',
  },
};
