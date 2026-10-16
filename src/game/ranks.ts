export const RANKS = [
  { xp: 0, title: 'Новое лицо' },
  { xp: 100, title: 'Искатель находок' },
  { xp: 500, title: 'Свой человек' },
  { xp: 1_500, title: 'Мастер поставок' },
  { xp: 4_000, title: 'Легенда района' },
] as const;

export const rankForXp = (xp: number): string =>
  [...RANKS].reverse().find((rank) => xp >= rank.xp)?.title ?? RANKS[0].title;
