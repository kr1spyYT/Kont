import { ArrowDownUp, BadgeCheck, Gavel, ShoppingCart, Tag, TrendingUp } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import ItemIcon from './ItemIcon';
import { RARITY_LABELS } from '../data/items';
import { getResaleValue } from '../game/economy';
import { formatRubles } from '../utils/currency';
import { AuctionListing, PlayerState, Rarity } from '../types/game';
import type { ActionResponse, GameAction, MarketListing } from '../types/server';
import { impact, notification } from '../utils/haptics';
import { playClick, playError, playWin } from '../utils/sound';
import { getCarLicensePlateDisplay } from '../game/licensePlates';

interface AuctionTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  botListings: AuctionListing[];
  marketListings?: MarketListing[];
}

const rarityClasses: Record<Rarity, string> = {
  common: 'border-zinc-700 text-zinc-300',
  rare: 'border-blue-400/40 text-blue-200',
  epic: 'border-fuchsia-400/40 text-fuchsia-200',
  legendary: 'border-amber-300/50 text-amber-100',
};

export default function AuctionTab({ player, onAction, botListings, marketListings }: AuctionTabProps) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [notice, setNotice] = useState('');
  const listings = useMemo<MarketListing[]>(
    () => marketListings ?? [
      ...player.auctionListings,
      ...botListings.filter((listing) => !player.closedMarketListingIds.includes(listing.id)),
    ].sort((a, b) => b.listedAt.localeCompare(a.listedAt)),
    [marketListings, botListings, player.auctionListings, player.closedMarketListingIds],
  );

  const buyListing = (listing: MarketListing) => {
    if (!listing.isPlayerListing && player.balance < listing.askingPrice) {
      setNotice(`Не хватает ${formatRubles(listing.askingPrice - player.balance)} для покупки.`);
      notification('error');
      playError();
      return;
    }
    impact('heavy');
    playWin();
    notification('success');
    const action = listing.isPlayerListing
      ? { type: 'buy-listing' as const, listingId: listing.id, requestId: `buy-${listing.id}-${Date.now()}` }
      : { type: 'buy-bot-listing' as const, listingId: listing.id, requestId: `buy-${listing.id}-${Date.now()}` };
    void onAction(action).then((response) => {
      if (response) setNotice(response.result?.message ?? `Лот «${listing.item.name}» куплен у ${listing.seller}.`);
    });
  };

  const listItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const item = player.inventory.find((entry) => entry.id === selectedItemId);
    const price = Number(askingPrice);
    if (!item) {
      setNotice('Предмет больше не найден в инвентаре. Обнови форму.');
      return;
    }
    if (!Number.isSafeInteger(price) || price < 1) {
      setNotice('Укажи целую цену в рублях больше нуля.');
      return;
    }
    const equipped =
      player.activeCarId === item.id ||
      Object.values(player.equippedClothing).includes(item.id);
    if (equipped) {
      setNotice('Сначала сними вещь или убери автомобиль из профиля.');
      return;
    }

    impact('medium');
    playClick();
    void onAction({ type: 'list-item', itemId: item.id, askingPrice: price, requestId: `list-${item.id}-${Date.now()}` }).then((response) => {
      if (!response) return;
      setSelectedItemId('');
      setAskingPrice('');
      setNotice(`«${item.name}» выставлен на рынок за ${formatRubles(price)}.`);
    });
  };

  const withdrawListing = (listing: MarketListing) => {
    impact('light');
    playClick();
    void onAction({ type: 'cancel-listing', listingId: listing.id, requestId: `cancel-${listing.id}-${Date.now()}` }).then((response) => {
      if (response) setNotice(`Лот «${listing.item.name}» снят с торгов и возвращён в инвентарь.`);
    });
  };

  const selectedItem = player.inventory.find((item) => item.id === selectedItemId);

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Игроки · сделки · лоты</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Аукцион / Рынок</h1>
          <p className="mt-1 text-xs text-zinc-500">Живой рынок редких шмоток и тачек.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-2 text-xs font-black text-emerald-200">
          <TrendingUp size={14} /> LIVE
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
          {notice}
        </p>
      )}

      <form onSubmit={listItem} className="rounded-2xl border border-[#34383C] bg-[#202326] p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 text-amber-200">
            <Tag size={17} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Выставить свой лот</h2>
            <p className="text-[10px] text-zinc-500">Укажи цену — предмет уйдёт из инвентаря до снятия с торгов.</p>
          </div>
        </div>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-zinc-500" htmlFor="auction-item">
          Предмет
        </label>
        <select
          id="auction-item"
          value={selectedItemId}
          onChange={(event) => {
            const id = event.target.value;
            setSelectedItemId(id);
            const selected = player.inventory.find((item) => item.id === id);
            setAskingPrice(selected ? String(selected.price) : '');
          }}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-amber-400"
        >
          <option value="">Выбери предмет из инвентаря</option>
          {player.inventory.map((item) => {
            const equipped =
              player.activeCarId === item.id ||
              Object.values(player.equippedClothing).includes(item.id);
            return (
              <option key={item.id} value={item.id} disabled={equipped}>
                {item.name} · {formatRubles(item.price)}{equipped ? ' · надето' : ''}
              </option>
            );
          })}
        </select>
        {selectedItem && (
          <p className="mt-1.5 text-[10px] text-zinc-500">
            Быстрый ориентир перекупа: {formatRubles(getResaleValue(selectedItem))}
          </p>
        )}
        <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-zinc-500" htmlFor="auction-price">
          Твоя цена · ₽
        </label>
        <input
          id="auction-price"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={askingPrice}
          onChange={(event) => setAskingPrice(event.target.value)}
          placeholder="Например, 85 000"
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={!selectedItemId || !askingPrice}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-3 text-sm font-black text-[#151719] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Gavel size={16} /> Выставить на торги
        </button>
      </form>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Сделки на районе</p>
          <h2 className="mt-1 text-lg font-black text-white">Лоты рынка</h2>
        </div>
        <span className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-[10px] font-bold text-zinc-400">
          {listings.length} лотов
        </span>
      </div>

      {listings.length ? (
        <div className="space-y-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className={`overflow-hidden rounded-2xl border bg-zinc-900/80 p-3 shadow-lg ${
                listing.isPlayerListing ? 'border-amber-300/30' : rarityClasses[listing.item.rarity]
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-black text-zinc-300">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400/10">
                    {listing.isPlayerListing ? '😎' : '👤'}
                  </span>
                  {listing.sellerTitle && <span className="shrink-0 text-amber-300">{listing.sellerTitle}</span>}
                  {listing.seller}
                  {listing.isPlayerListing && <span className="text-amber-200">· ТВОЙ ЛОТ</span>}
                </span>
                <span className="shrink-0 text-[9px] text-zinc-600">
                  {new Date(listing.listedAt).toLocaleDateString('ru-RU')}
                </span>
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-3.5">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[#111318] p-2 sm:h-24 sm:w-24">
                  <ItemIcon item={listing.item} size="xl" className="!h-full !w-full !max-h-full !max-w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-white">{listing.item.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${rarityClasses[listing.item.rarity]}`}>
                      {RARITY_LABELS[listing.item.rarity]}
                    </span>
                    <span className="font-mono text-[9px] text-zinc-500">
                      {listing.item.serial.replace('/500', '')} · {listing.item.wear.toFixed(1)}%
                    </span>
                  </div>
                  {listing.item.type === 'car' ? (
                    <p className="mt-1 text-[9px] text-amber-200">
                      {getCarLicensePlateDisplay(listing.item, player.licensePlates)} · {listing.item.mileage.toLocaleString('ru-RU')} км
                    </p>
                  ) : (
                    <p className="mt-1 text-[9px] text-zinc-400">
                      {listing.item.authenticity === 'original' ? '✅ Оригинал' : listing.item.authenticity === 'fake' ? '❌ Паль' : '❓ Не проверен'}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-black/20 px-3 py-2.5">
                <span className="text-[10px] text-zinc-500">Цена продавца</span>
                <strong className="text-sm font-black text-[#83B88A]">{formatRubles(listing.askingPrice)}</strong>
              </div>

              {listing.isPlayerListing && (listing.isMine ?? !marketListings) ? (
                <button
                  type="button"
                  onClick={() => withdrawListing(listing)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-black text-zinc-200 hover:bg-zinc-700"
                >
                  <ArrowDownUp size={14} /> Снять лот · вернуть в инвентарь
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => buyListing(listing)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-black text-[#151719] transition hover:bg-amber-300"
                >
                  <ShoppingCart size={15} /> Купить лот
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-xs text-zinc-500">
          Лотов пока нет. Выставь первый предмет из инвентаря.
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-[10px] leading-relaxed text-zinc-500">
        <BadgeCheck size={14} className="mt-0.5 shrink-0 text-amber-300" />
        Лоты игроков публикуются на общем серверном рынке. Оплата и передача предмета проходят одной транзакцией.
      </p>
    </section>
  );
}
