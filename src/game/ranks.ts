export const RANKS = [
  { xp: 0, title: 'Новое лицо' },
  { xp: 100, title: 'Искатель находок' },
  { xp: 500, title: 'Свой человек' },
  { xp: 1_500, title: 'Мастер поставок' },
  { xp: 4_000, title: 'Легенда района' },
] as const;

export const OWNER_RANK_TITLE = 'Владелец KONT';

export const rankForXp = (xp: number): string =>
  [...RANKS].reverse().find((rank) => xp >= rank.xp)?.title ?? RANKS[0].title;

export const rankProgressForXp = (xp: number) => {
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const currentRank = [...RANKS].reverse().find((rank) => safeXp >= rank.xp) ?? RANKS[0];
  const nextRank = RANKS.find((rank) => rank.xp > safeXp);
  const xpToNext = nextRank ? nextRank.xp - safeXp : 0;
  const progress = nextRank
    ? Math.min(100, Math.max(0, ((safeXp - currentRank.xp) / (nextRank.xp - currentRank.xp)) * 100))
    : 100;

  return { currentRank, nextRank, xpToNext, progress };
};
