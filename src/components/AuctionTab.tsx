import { ArrowDownUp, BadgeCheck, Gavel, ShoppingCart, Tag, TrendingUp } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import ItemIcon from './ItemIcon';
import LicensePlateDisplay from './LicensePlateDisplay';
import { RARITY_LABELS } from '../data/items';
import { getResaleValue } from '../game/economy';
import { formatRubles } from '../utils/currency';
import { LicensePlateRarity, PlayerState, Rarity } from '../types/game';
import type { ActionResponse, GameAction, MarketListing } from '../types/server';
import RankBadge from './RankBadge';
import { impact, notification } from '../utils/haptics';
import { playClick, playError, playWin } from '../utils/sound';
import { getCarLicensePlateDisplay, getLicensePlateValuation, LICENSE_PLATE_RARITY_LABELS } from '../game/licensePlates';
import PlayerAvatar from './PlayerAvatar';
import GenesisSceneBackdrop from './GenesisSceneBackdrop';

interface AuctionTabProps {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  marketListings?: MarketListing[];
  onOpenProfile: (telegramId: string) => void;
}

const rarityClasses: Record<Rarity, string> = {
  common: 'border-zinc-700 text-zinc-300',
  uncommon: 'border-emerald-400/40 text-emerald-200',
  rare: 'border-blue-400/40 text-blue-200',
  epic: 'border-fuchsia-400/40 text-fuchsia-200',
  legendary: 'border-amber-300/50 text-amber-100',
  mythic: 'border-rose-300/60 text-rose-100',
};

export default function AuctionTab({ player, onAction, marketListings, onOpenProfile }: AuctionTabProps) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [notice, setNotice] = useState('');
  const [listingScope, setListingScope] = useState<'all' | 'buy' | 'mine'>('all');
  const [category, setCategory] = useState<'all' | 'clothing' | 'car' | 'plates'>('all');
  const [rarity, setRarity] = useState<LicensePlateRarity | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'cheapest' | 'expensive'>('newest');
  const [search, setSearch] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const listings = useMemo<MarketListing[]>(
    () => marketListings ?? player.auctionListings.map((listing) => ({ ...listing, isMine: true })).sort((a, b) => b.listedAt.localeCompare(a.listedAt)),
    [marketListings, player.auctionListings],
  );
  const marketAskingTotal = listings.reduce((total, listing) => total + listing.askingPrice, 0);
  const ownListingCount = listings.filter((listing) => listing.isMine).length;
  const filteredListings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    const from = priceFrom ? Number(priceFrom) : 0;
    const to = priceTo ? Number(priceTo) : Number.POSITIVE_INFINITY;
    return listings.filter((listing) => {
      const item = listing.item;
      const matchesCategory = category === 'all' || (item.type === 'plate' ? category === 'plates' : item.type === category);
      return (listingScope === 'all' || (listingScope === 'mine' ? listing.isMine === true : listing.isMine !== true)) &&
        matchesCategory &&
        (rarity === 'all' || item.rarity === rarity) &&
        (!query || item.name.toLocaleLowerCase('ru-RU').includes(query)) &&
        listing.askingPrice >= from &&
        listing.askingPrice <= to;
    }).sort((first, second) => sort === 'cheapest'
      ? first.askingPrice - second.askingPrice
      : sort === 'expensive'
        ? second.askingPrice - first.askingPrice
        : second.listedAt.localeCompare(first.listedAt));
  }, [category, listings, listingScope, priceFrom, priceTo, rarity, search, sort]);

  const buyListing = (listing: MarketListing) => {
    if (listing.isMine === false && player.balance < listing.askingPrice) {
      setNotice(`Не хватает ${formatRubles(listing.askingPrice - player.balance)} для покупки.`);
      notification('error');
      playError();
      return;
    }
    impact('heavy');
    playClick();
    void onAction({ type: 'buy-listing', listingId: listing.id, requestId: `buy-${listing.id}-${Date.now()}` }).then((response) => {
      if (!response) {
        setNotice(`Не удалось купить лот «${listing.item.name}». Попробуй обновить рынок.`);
        notification('error');
        playError();
        return;
      }
      setNotice(response.result?.message ?? `Лот «${listing.item.name}» куплен у ${listing.seller}.`);
      notification('success');
      playWin();
    });
  };

  const listItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const [assetType, assetId] = selectedItemId.split(':', 2);
    const item = assetType === 'item' ? player.inventory.find((entry) => entry.id === assetId) : undefined;
    const plate = assetType === 'plate' ? player.licensePlates.find((entry) => entry.id === assetId) : undefined;
    const assetName = item?.name ?? plate?.plate;
    const price = Number(askingPrice);
    if (!assetName) {
      setNotice('Лот больше не найден в коллекции. Обнови форму.');
      return;
    }
    if (!Number.isSafeInteger(price) || price < 1) {
      setNotice('Укажи целую цену в рублях больше нуля.');
      return;
    }
    if (item) {
      const equipped = player.activeCarId === item.id || Object.values(player.equippedClothing).includes(item.id);
      if (equipped) {
        setNotice('Сначала сними вещь или убери автомобиль из профиля.');
        return;
      }
    }
    if (plate && (player.favoriteLicensePlateIds.includes(plate.id) || player.inventory.some((entry) => entry.type === 'car' && entry.licensePlateId === plate.id))) {
      setNotice('Сначала убери номер из избранного или сними его с машины.');
      return;
    }

    impact('medium');
    playClick();
    const action: GameAction = item
      ? { type: 'list-item', itemId: item.id, askingPrice: price, requestId: `list-${item.id}-${Date.now()}` }
      : { type: 'list-license-plate', plateId: plate!.id, askingPrice: price, requestId: `list-plate-${plate!.id}-${Date.now()}` };
    void onAction(action).then((response) => {
      if (!response) {
        setNotice(`Не удалось выставить «${assetName}». Проверь избранное и попробуй ещё раз.`);
        notification('error');
        playError();
        return;
      }
      setSelectedItemId('');
      setAskingPrice('');
      setNotice(`«${assetName}» выставлен на рынок за ${formatRubles(price)}.`);
      notification('success');
    });
  };

  const withdrawListing = (listing: MarketListing) => {
    impact('light');
    playClick();
    void onAction({ type: 'cancel-listing', listingId: listing.id, requestId: `cancel-${listing.id}-${Date.now()}` }).then((response) => {
      if (response) setNotice(`Лот «${listing.item.name}» снят с торгов и возвращён в инвентарь.`);
      else setNotice(`Не удалось снять лот «${listing.item.name}». Попробуй ещё раз.`);
    });
  };

  const [selectedAssetType, selectedAssetId] = selectedItemId.split(':', 2);
  const selectedItem = selectedAssetType === 'item' ? player.inventory.find((item) => item.id === selectedAssetId) : undefined;
  const selectedPlate = selectedAssetType === 'plate' ? player.licensePlates.find((plate) => plate.id === selectedAssetId) : undefined;
  const selectedPrice = selectedItem ?? selectedPlate;

  return (
    <section className="space-y-5">
      <header className="relative isolate overflow-hidden rounded-[26px] border border-amber-400/25 bg-[#09090b] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)] sm:p-5">
        <GenesisSceneBackdrop scene="auction" className="opacity-55" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#09090b]/95 via-[#09090b]/76 to-[#09090b]/36" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#09090b]/75 via-transparent to-black/15" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <p className="rounded-full border border-amber-300/25 bg-black/40 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-amber-100">Genesis · Members only</p>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/25 bg-black/50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-100"><i className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.85)]" /> LIVE</span>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300/85">Закрытый клуб перекупов</p>
              <h1 className="mt-1 text-[21px] font-black tracking-tight text-[#f6f2e8] sm:text-2xl">Аукцион / Рынок</h1>
            </div>
            <img src="/assets/season/genesis/rewards/auction-gavel.webp" alt="" aria-hidden="true" className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]" />
          </div>
          <p className="mt-1 max-w-[20rem] text-[11px] leading-relaxed text-zinc-300/80">Проверенные лоты игроков. Выбирай предмет, смотри цену, торгуйся.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/40 px-2.5 py-2">
              <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Лоты</p><p className="mt-1 text-sm font-black tabular-nums text-white">{listings.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 px-2.5 py-2">
              <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Мои</p><p className="mt-1 text-sm font-black tabular-nums text-white">{ownListingCount}</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-black/40 px-2.5 py-2">
              <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Спрос · ₽</p><p className="mt-1 truncate text-[11px] font-black tabular-nums text-amber-100" title={formatRubles(marketAskingTotal)}>{formatRubles(marketAskingTotal)}</p>
            </div>
          </div>
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
          {notice}
        </p>
      )}

      <div className="rounded-2xl border border-amber-300/15 bg-[#111116] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Как пользоваться рынком</p>
        <ol className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-zinc-400">
          <li><strong className="text-zinc-200">Купить:</strong> выбери лот и подтверди цену, предмет придёт в коллекцию.</li>
          <li><strong className="text-zinc-200">Продать:</strong> выбери вещь, машину или номер и укажи цену. Избранные и установленные номера защищены.</li>
          <li><strong className="text-zinc-200">Передумал:</strong> открой «Мои лоты» и сними объявление, лот вернётся в коллекцию.</li>
        </ol>
      </div>

      <form onSubmit={listItem} className="rounded-2xl border border-amber-300/20 bg-[#111116] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 text-amber-200">
            <Tag size={17} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Выставить свой лот</h2>
            <p className="text-[10px] text-zinc-500">Выбери вещь, машину или свободный номер. Лот вернётся при снятии.</p>
          </div>
        </div>
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-zinc-500" htmlFor="auction-item">
          Предмет
        </label>
        <select
          id="auction-item"
          value={selectedItemId}
          onChange={(event) => {
            const value = event.target.value;
            setSelectedItemId(value);
            const [kind, id] = value.split(':', 2);
            const selected = kind === 'item' ? player.inventory.find((item) => item.id === id) : player.licensePlates.find((plate) => plate.id === id);
            setAskingPrice(selected ? String(selected.price) : '');
          }}
          className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-amber-400"
        >
          <option value="">Выбери вещь, машину или номер</option>
          {player.inventory.map((item) => {
            const equipped = player.activeCarId === item.id || Object.values(player.equippedClothing).includes(item.id);
            return <option key={`item-${item.id}`} value={`item:${item.id}`} disabled={equipped}>{item.name} · {formatRubles(item.price)}{equipped ? ' · надето' : ''}</option>;
          })}
          {player.licensePlates.map((plate) => {
            const installed = player.inventory.some((item) => item.type === 'car' && item.licensePlateId === plate.id);
            const favorite = player.favoriteLicensePlateIds.includes(plate.id);
            return <option key={`plate-${plate.id}`} value={`plate:${plate.id}`} disabled={installed || favorite}>{plate.plate} · номер · {formatRubles(plate.price)}{installed ? ' · на машине' : favorite ? ' · избранное' : ''}</option>;
          })}
        </select>
        {selectedPrice && (
          <p className="mt-1.5 text-[10px] text-zinc-500">
            Быстрый ориентир перекупа: {formatRubles(getResaleValue(selectedPrice))}
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
          Показано {filteredListings.length} из {listings.length}
        </span>
      </div>

      <div className="space-y-3 rounded-2xl border border-amber-300/15 bg-[#111116] p-3 shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
        <div role="group" aria-label="Показать лоты" className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-black/30 p-1">
          {([
            ['all', 'Все лоты'],
            ['buy', 'Купить'],
            ['mine', 'Мои лоты'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={listingScope === value} onClick={() => setListingScope(value)} className={`rounded-lg px-1.5 py-2 text-[9px] font-black transition ${listingScope === value ? 'bg-amber-400 text-[#151719]' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-zinc-800 bg-black/30 p-1">
          {([
            ['all', 'Все'],
            ['clothing', 'Шмот 🧥'],
            ['car', 'Тачки 🚗'],
            ['plates', 'Номера 🔢'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-lg px-2 py-2 text-[10px] font-black transition ${category === value ? 'bg-amber-400 text-[#151719]' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[8px] font-black uppercase tracking-wide text-zinc-500">
            Редкость
            <select value={rarity} onChange={(event) => setRarity(event.target.value as LicensePlateRarity | 'all')} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-[10px] font-semibold normal-case text-white outline-none focus:border-amber-400">
              <option value="all">Все редкости</option>
              {(Object.keys(RARITY_LABELS) as Rarity[]).map((value) => <option key={value} value={value}>{RARITY_LABELS[value]}</option>)}
              <option value="secret">{LICENSE_PLATE_RARITY_LABELS.secret}</option>
            </select>
          </label>
          <label className="text-[8px] font-black uppercase tracking-wide text-zinc-500">
            Сортировка
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-[10px] font-semibold normal-case text-white outline-none focus:border-amber-400">
              <option value="newest">Новые</option>
              <option value="cheapest">Дешевле</option>
              <option value="expensive">Дороже</option>
            </select>
          </label>
        </div>
        <label className="block text-[8px] font-black uppercase tracking-wide text-zinc-500">
          Быстрый поиск
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название предмета" className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs font-medium normal-case text-white outline-none placeholder:text-zinc-600 focus:border-amber-400" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[8px] font-black uppercase tracking-wide text-zinc-500">
            Цена от · ₽
            <input type="number" min="0" value={priceFrom} onChange={(event) => setPriceFrom(event.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-amber-400" />
          </label>
          <label className="text-[8px] font-black uppercase tracking-wide text-zinc-500">
            Цена до · ₽
            <input type="number" min="0" value={priceTo} onChange={(event) => setPriceTo(event.target.value)} placeholder="Без лимита" className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-amber-400" />
          </label>
        </div>
      </div>

      {filteredListings.length ? (
        <div className="space-y-3">
          {filteredListings.map((listing) => (
            <article
              key={listing.id}
              className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#101015] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.4)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-black text-zinc-300">
                  <PlayerAvatar photoUrl={listing.sellerAvatarUrl} name={listing.seller} className="h-6 w-6 text-[9px]" />
                  {listing.sellerId ? (
                    <button type="button" onClick={() => onOpenProfile(listing.sellerId!)} className="flex min-w-0 items-center gap-1.5 truncate text-left hover:text-amber-200">
                      {listing.sellerTitle && <RankBadge title={listing.sellerTitle} compact />}
                      <span className="truncate">{listing.seller}</span>
                    </button>
                  ) : <span>{listing.sellerTitle && <RankBadge title={listing.sellerTitle} compact />}{listing.seller}</span>}
                  {listing.isMine && <span className="text-amber-200">· ТВОЙ ЛОТ</span>}
                </span>
                <span className="shrink-0 text-[9px] text-zinc-600">
                  {new Date(listing.listedAt).toLocaleDateString('ru-RU')}
                </span>
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-3.5">
                <div className={`relative flex h-20 ${listing.item.type === 'plate' ? 'w-[104px] p-1' : 'w-20 p-2'} shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-200/10 bg-[#09090b] shadow-[inset_0_1px_12px_rgba(0,0,0,0.55)] sm:h-24 ${listing.item.type === 'plate' ? 'sm:w-[124px]' : 'sm:w-24'}`}>
                  <img src="/assets/season/genesis/rewards/verified-seal.webp" alt="Проверенный лот" aria-hidden="true" loading="lazy" className="pointer-events-none absolute right-0.5 top-0.5 z-20 h-7 w-7 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)]" />
                  {listing.item.type === 'plate' ? (
                    <LicensePlateDisplay plate={listing.item.plate} frameIds={listing.licensePlateFrameIds ?? (listing.isMine ? player.licensePlateFrames : [])} size="tiny" />
                  ) : <ItemIcon item={listing.item} size="xl" showcase className="!h-full !w-full !max-h-full !max-w-full" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-white">{listing.item.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${rarityClasses[listing.item.rarity === 'secret' ? 'mythic' : listing.item.rarity]}`}>
                      {listing.item.type === 'plate' ? LICENSE_PLATE_RARITY_LABELS[listing.item.rarity] : RARITY_LABELS[listing.item.rarity]}
                    </span>
                    {listing.item.type === 'plate' ? (
                      <span className="font-mono text-[9px] text-zinc-500">Госномер · ×{getLicensePlateValuation(listing.item.plate).multiplier}</span>
                    ) : (
                      <span className="font-mono text-[9px] text-zinc-500">{listing.item.serial.replace('/500', '')} · {listing.item.wear.toFixed(1)}%</span>
                    )}
                  </div>
                  {listing.item.type === 'plate' ? (
                    <p className="mt-1 text-[9px] text-violet-200">Номерная коллекция</p>
                  ) : listing.item.type === 'car' ? (
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      <LicensePlateDisplay plate={getCarLicensePlateDisplay(listing.item, listing.isMine ? player.licensePlates : [])} frameIds={listing.licensePlateFrameIds ?? (listing.isMine ? player.licensePlateFrames : [])} size="tiny" />
                      <span className="text-[9px] text-amber-200">{listing.item.mileage.toLocaleString('ru-RU')} км</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-[9px] text-zinc-400">{listing.item.authenticity === 'original' ? '✅ Оригинал' : listing.item.authenticity === 'fake' ? '❌ Паль' : '❓ Не проверен'}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-300/20 bg-gradient-to-r from-amber-400/10 via-black/25 to-black/25 px-3 py-2.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Цена лота</span>
                <strong className="text-base font-black tabular-nums text-amber-100">{formatRubles(listing.askingPrice)}</strong>
              </div>

              {listing.isMine ? (
                <button
                  type="button"
                  onClick={() => withdrawListing(listing)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-black text-zinc-200 hover:bg-zinc-700"
                >
                  <ArrowDownUp size={14} /> Снять лот · вернуть в коллекцию
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => buyListing(listing)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-black text-[#151719] transition hover:bg-amber-300"
                >
                  <ShoppingCart size={15} /> Купить за {formatRubles(listing.askingPrice)}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-xs text-zinc-500">
          {listings.length ? (listingScope === 'mine' ? 'У тебя пока нет лотов с такими фильтрами.' : 'По выбранным фильтрам лотов нет.') : 'Лотов пока нет. Выставь вещь, машину или номер из коллекции.'}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-[10px] leading-relaxed text-zinc-500">
        <BadgeCheck size={14} className="mt-0.5 shrink-0 text-amber-300" />
        Лоты игроков публикуются на общем серверном рынке. Оплата и передача предмета проходят одной транзакцией.
      </p>
    </section>
  );
}
