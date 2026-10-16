export const formatRubles = (amount: number): string =>
  `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
