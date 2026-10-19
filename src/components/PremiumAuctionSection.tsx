import { BadgeCheck, Clock3, Gavel, Wallet } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import type { ActionResponse, GameAction, PremiumAuctionLot } from '../types/server';
import type { PlayerState } from '../types/game';
import { getInventorySaleCategory, getLicensePlateSaleCategory } from '../game/economy';
import { getCarLicensePlateDisplay, getEquippedLicensePlateFrameIds, getLicensePlateValuation, LICENSE_PLATE_RARITY_LABELS } from '../game/licensePlates';
import { RARITY_LABELS } from '../data/items';
import { createId } from '../utils/id';
import { formatRubles } from '../utils/currency';
import ItemIcon from './ItemIcon';
import LicensePlateDisplay from './LicensePlateDisplay';
import PlayerAvatar from './PlayerAvatar';
import RankBadge from './RankBadge';

interface PremiumAuctionSectionProps {
  player: PlayerState;
  premiumLots?: PremiumAuctionLot[];
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  onOpenProfile: (telegramId: string) => void;
}

const premiumDurations = [6, 24, 48, 72, 168];
const premiumRarityClasses: Record<string, string> = {
  common: 'border-zinc-700 text-zinc-300',
  uncommon: 'border-emerald-400/40 text-emerald-200',
  rare: 'border-blue-400/40 text-blue-200',
  epic: 'border-fuchsia-400/40 text-fuchsia-200',
  legendary: 'border-amber-300/50 text-amber-100',
  mythic: 'border-rose-300/60 text-rose-100',
  secret: 'border-rose-300/60 text-rose-100',
};

export default function PremiumAuctionSection({ player, premiumLots = [], onAction, onOpenProfile }: PremiumAuctionSectionProps) {
  const [selectedAsset, setSelectedAsset] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const frameIds = getEquippedLicensePlateFrameIds(player);
  const premiumItems = useMemo(() => player.inventory.filter((item) => {
    const category = getInventorySaleCategory(item);
    const equipped = player.activeCarId === item.id || Object.values(player.equippedClothing).includes(item.id);
    return !equipped && !(item.type === 'car' && (item.licensePlateId || item.licensePlate))
      && (category === 'limited' || category === 'elite_cars');
  }), [player]);
  const premiumPlates = useMemo(() => player.licensePlates.filter((plate) =>
    getLicensePlateSaleCategory(getLicensePlateValuation(plate.plate).rarity) === 'rare_plates'
    && !player.favoriteLicensePlateIds.includes(plate.id)
    && !player.inventory.some((item) => item.type === 'car' && item.licensePlateId === plate.id),
  ), [player]);

  const submitListing = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const [kind, id] = selectedAsset.split(':', 2);
    const price = Number(startingPrice);
    if (!Number.isSafeInteger(price) || price < 1 || price > 2_000_000_000) {
      setNotice('Укажи целую стартовую цену от 1 до 2 000 000 000 ₽.');
      return;
    }
    const action: GameAction | undefined = kind === 'item' && premiumItems.some((item) => item.id === id)
      ? { type: 'premium-list-item', itemId: id, startingPrice: price, durationHours, requestId: createId('premium-list') }
      : kind === 'plate' && premiumPlates.some((plate) => plate.id === id)
        ? { type: 'premium-list-license-plate', plateId: id, startingPrice: price, durationHours, requestId: createId('premium-list') }
        : undefined;
    if (!action) {
      setNotice('Этот актив больше нельзя выставить. Обнови коллекцию.');
      return;
    }
    void onAction(action).then((response) => {
      if (response) {
        setSelectedAsset('');
        setStartingPrice('');
        setNotice(response.result?.message ?? 'Премиальный лот опубликован.');
      } else setNotice('Не удалось выставить лот. Проверь коллекцию и попробуй ещё раз.');
    });
  };

  const submitBid = (lot: PremiumAuctionLot) => {
    const amount = Number(bidAmounts[lot.id] ?? String(lot.currentBid ? lot.currentBid + 1 : lot.startingPrice));
    const availableBalance = player.balance + (lot.isHighestBidder ? lot.currentBid ?? 0 : 0);
    if (!Number.isSafeInteger(amount) || amount < lot.startingPrice || amount > 2_000_000_000) {
      setNotice('Ставка должна быть целым числом не ниже стартовой цены.');
      return;
    }
    if (lot.currentBid !== undefined && amount <= lot.currentBid) {
      setNotice(`Новая ставка должна быть выше ${formatRubles(lot.currentBid)}.`);
      return;
    }
    if (availableBalance < amount) {
      setNotice(`Не хватает ${formatRubles(amount - availableBalance)}. Твоя предыдущая ставка учтена как эскроу.`);
      return;
    }
    void onAction({ type: 'premium-bid', lotId: lot.id, amount, requestId: createId('premium-bid') }).then((response) => {
      setNotice(response?.result?.message ?? 'Ставка не принята. Обнови рынок и проверь баланс.');
    });
  };

  const cancelLot = (lot: PremiumAuctionLot) => {
    void onAction({ type: 'premium-cancel-lot', lotId: lot.id, requestId: createId('premium-cancel') }).then((response) => {
      setNotice(response?.result?.message ?? 'Лот нельзя снять после появления ставок.');
    });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-amber-400/25 bg-[#101015] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.3)]">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-400/10 text-amber-200"><Gavel size={19} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">Отдельная витрина коллекций</p>
          <h2 className="mt-0.5 text-sm font-black text-white">Премиальный аукцион</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Лимитированные вещи, элитные машины и редкие номера. Ставка резервируется до завершения торгов; при перебивании деньги возвращаются. Комиссии нет.</p>
        </div>
      </header>

      {notice && <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] text-amber-100">{notice}</p>}

      <form onSubmit={submitListing} className="grid gap-2 rounded-xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto] sm:items-end">
        <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
          Коллекционный актив
          <select value={selectedAsset} onChange={(event) => {
            const value = event.target.value;
            setSelectedAsset(value);
            const [kind, id] = value.split(':', 2);
            const asset = kind === 'item' ? premiumItems.find((item) => item.id === id) : premiumPlates.find((plate) => plate.id === id);
            setStartingPrice(asset ? String(asset.price) : '');
          }} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2.5 text-xs font-medium normal-case text-white outline-none focus:border-amber-400">
            <option value="">Выбери предмет</option>
            {premiumItems.map((item) => <option key={item.id} value={`item:${item.id}`}>{item.name} · {formatRubles(item.price)} · {item.saleCategory === 'elite_cars' ? 'Элитный автомобиль' : 'Лимитированный'}</option>)}
            {premiumPlates.map((plate) => <option key={plate.id} value={`plate:${plate.id}`}>{plate.plate} · {formatRubles(plate.price)} · Редкий номер</option>)}
          </select>
        </label>
        <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
          Старт · ₽
          <input type="number" min="1" max="2000000000" step="1" inputMode="numeric" value={startingPrice} onChange={(event) => setStartingPrice(event.target.value)} placeholder="Цена старта" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-amber-400" />
        </label>
        <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
          Длительность
          <select value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2.5 text-xs font-semibold normal-case text-white outline-none focus:border-amber-400">
            {premiumDurations.map((hours) => <option key={hours} value={hours}>{hours === 168 ? '7 дней' : `${hours} ч.`}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!selectedAsset || !startingPrice} className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2.5 text-[10px] font-black text-[#151719] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"><Gavel size={14} /> Выставить</button>
        {!premiumItems.length && !premiumPlates.length && <p className="text-[9px] text-zinc-500 sm:col-span-4">Пока нет доступных коллекционных активов для премиального аукциона.</p>}
      </form>

      {premiumLots.length ? <div className="space-y-2">
        {premiumLots.map((lot) => {
          const rarity = lot.item.rarity;
          const rarityLabel = lot.item.type === 'plate'
            ? LICENSE_PLATE_RARITY_LABELS[lot.item.rarity]
            : RARITY_LABELS[lot.item.rarity];
          const currentBid = lot.currentBid;
          const minimumBid = currentBid === undefined ? lot.startingPrice : currentBid + 1;
          return (
            <article key={lot.id} className="overflow-hidden rounded-xl border border-amber-300/15 bg-[#0b0b0e] p-3">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => onOpenProfile(lot.sellerId)} className="flex min-w-0 items-center gap-1.5 text-left text-[10px] font-bold text-zinc-300 hover:text-amber-200">
                  <PlayerAvatar photoUrl={lot.sellerAvatarUrl} name={lot.seller} className="h-6 w-6 text-[9px]" />
                  {lot.sellerTitle && <RankBadge title={lot.sellerTitle} compact />}
                  <span className="truncate">{lot.seller}</span>
                </button>
                <span className="shrink-0 text-[9px] text-zinc-500">до {new Date(lot.endsAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <div className="relative grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-amber-300/15 bg-black/50 p-1.5">
                  <img src="/assets/season/genesis/rewards/verified-seal.webp" alt="Премиальный лот" className="absolute right-0 top-0 z-10 h-6 w-6 object-contain" />
                  {lot.item.type === 'plate' ? <LicensePlateDisplay plate={lot.item.plate} frameIds={lot.licensePlateFrameIds ?? []} size="tiny" /> : <ItemIcon item={lot.item} size="lg" showcase className="!h-full !w-full !max-h-full !max-w-full" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xs font-black text-white">{lot.item.name}</h3>
                  <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${premiumRarityClasses[rarity] ?? premiumRarityClasses.common}`}>{rarityLabel}</span>
                  {lot.item.type === 'plate' && <p className="mt-1 font-mono text-[9px] text-zinc-500">×{getLicensePlateValuation(lot.item.plate).multiplier}</p>}
                  {lot.item.type === 'car' && <div className="mt-1 flex flex-wrap items-center gap-1.5"><LicensePlateDisplay plate={getCarLicensePlateDisplay(lot.item, [])} frameIds={lot.licensePlateFrameIds ?? []} size="tiny" /><span className="text-[9px] text-amber-200">{lot.item.mileage.toLocaleString('ru-RU')} км</span></div>}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"><span className="text-zinc-500">Старт</span><p className="mt-0.5 font-black tabular-nums text-zinc-200">{formatRubles(lot.startingPrice)}</p></div>
                <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-2"><span className="text-zinc-500">Текущая ставка</span><p className="mt-0.5 font-black tabular-nums text-amber-100">{currentBid === undefined ? 'Пока нет' : formatRubles(currentBid)}</p></div>
              </div>
              {lot.isMine ? (
                <button type="button" disabled={currentBid !== undefined} onClick={() => cancelLot(lot)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-[10px] font-black text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{currentBid === undefined ? 'Снять лот и вернуть актив' : 'Есть ставка · лот нельзя снять'}</button>
              ) : (
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <label className="sr-only" htmlFor={`premium-bid-${lot.id}`}>Твоя ставка в рублях</label>
                  <div className="relative"><Wallet size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" /><input id={`premium-bid-${lot.id}`} type="number" min={minimumBid} max="2000000000" step="1" inputMode="numeric" value={bidAmounts[lot.id] ?? String(minimumBid)} onChange={(event) => setBidAmounts((current) => ({ ...current, [lot.id]: event.target.value }))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2.5 pl-8 pr-2 text-xs font-bold text-white outline-none focus:border-amber-400" /></div>
                  <button type="button" onClick={() => submitBid(lot)} className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2.5 text-[10px] font-black text-[#151719] hover:bg-amber-300"><Gavel size={14} /> Ставка</button>
                </div>
              )}
              <p className="mt-1.5 flex items-center gap-1 text-[9px] text-zinc-500"><Clock3 size={11} /> Минимум {formatRubles(minimumBid)} · средства лидера заблокированы в эскроу</p>
              {lot.isHighestBidder && <p className="mt-1 text-[9px] font-bold text-emerald-300">Ты лидируешь. Перебитая ставка вернётся автоматически.</p>}
            </article>
          );
        })}
      </div> : <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-[10px] text-zinc-500">Активных премиальных лотов пока нет.</div>}

      <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-zinc-500"><BadgeCheck size={12} className="mt-0.5 shrink-0 text-amber-300" />Предмет резервируется на время торгов. При ставке деньги списываются в escrow; если ставку перебьют, сумма автоматически вернётся. Победитель и выплата продавцу фиксируются одной транзакцией.</p>
    </section>
  );
}
