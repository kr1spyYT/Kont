import { ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
import { formatRubles } from '../utils/currency';
import { getLicensePlateValuation, LICENSE_PLATE_RARITY_LABELS } from '../game/licensePlates';
import type { ActionResponse, GameAction, PublicPlayerProfile } from '../types/server';
import ItemIcon from './ItemIcon';
import { ProfileMemberCard, ProfileOutfitShowcase } from './ProfileShowcase';
import LicensePlateDisplay from './LicensePlateDisplay';
import { getCarLicensePlateDisplay } from '../game/licensePlates';

interface PublicProfileModalProps {
  profile?: PublicPlayerProfile;
  loading: boolean;
  error: string;
  balance: number;
  onClose: () => void;
  onBuy: (action: GameAction) => Promise<ActionResponse | undefined>;
}

export default function PublicProfileModal({ profile, loading, error, balance, onClose, onBuy }: PublicProfileModalProps) {
  const [buyingId, setBuyingId] = useState('');
  const [boughtIds, setBoughtIds] = useState<string[]>([]);
  const buyListing = async (listing: PublicPlayerProfile['activeListings'][number]) => {
    setBuyingId(listing.id);
    const result = await onBuy({ type: 'buy-listing', listingId: listing.id, requestId: `buy-${listing.id}-${Date.now()}` });
    setBuyingId('');
    if (result) setBoughtIds((ids) => [...ids, listing.id]);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="public-profile-title" className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[#34383C] bg-[#151719] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3.5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">LootLand · игрок</p>
            <h2 id="public-profile-title" className="text-lg font-black text-white">Профиль игрока</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть профиль" className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 text-zinc-400 hover:text-white"><X size={17} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {loading && <p className="py-12 text-center text-xs text-zinc-500">Загружаем профиль…</p>}
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-200">{error}</p>}
          {profile && (
            <>
              <ProfileMemberCard
                name={profile.username ? `@${profile.username}` : profile.displayName}
                avatarUrl={profile.avatarUrl}
                rankTitle={profile.rankTitle}
                rankPosition={profile.rankPosition}
                xp={profile.xp}
                collectionCount={profile.collectionCount}
                collectionValue={profile.collectionValue}
                respect={profile.respect}
              />
              <ProfileOutfitShowcase
                clothing={profile.equippedClothing}
                car={profile.activeCar}
                plates={profile.licensePlates}
                frameIds={profile.licensePlateFrames ?? []}
              />

              <section className="rounded-2xl border border-[#34383C] bg-[#202326] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Аукцион</p><h3 className="mt-1 text-sm font-black text-white">Активные лоты</h3></div>
                  <span className="rounded-lg border border-zinc-700 px-2 py-1 text-[9px] font-black text-zinc-400">{profile.activeListings.length}</span>
                </div>
                {profile.activeListings.length ? (
                  <div className="mt-3 space-y-2">
                    {profile.activeListings.filter((listing) => !boughtIds.includes(listing.id)).map((listing) => (
                      <div key={listing.id} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/20 p-2">
                        <div className={`grid h-12 ${listing.item.type === 'plate' ? 'w-[92px]' : 'w-12'} shrink-0 place-items-center rounded-lg bg-zinc-900 p-1`}>
                          {listing.item.type === 'plate' ? <LicensePlateDisplay plate={listing.item.plate} frameIds={profile.licensePlateFrames ?? []} size="tiny" /> : <ItemIcon item={listing.item} size="md" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-black text-white">{listing.item.name}</p>
                          {listing.item.type === 'plate' && <p className="mt-0.5 text-[8px] font-bold text-violet-200">{LICENSE_PLATE_RARITY_LABELS[getLicensePlateValuation(listing.item.plate).rarity]}</p>}
                          {listing.item.type === 'car' && <LicensePlateDisplay plate={getCarLicensePlateDisplay(listing.item, profile.licensePlates)} frameIds={profile.licensePlateFrames ?? []} size="tiny" className="mt-1" />}
                          <p className="mt-1 text-[9px] font-black text-amber-200">{formatRubles(listing.askingPrice)}</p>
                        </div>
                        {listing.isMine ? <span className="text-[8px] font-black text-zinc-500">ТВОЙ ЛОТ</span> : (
                          <button type="button" disabled={balance < listing.askingPrice || buyingId === listing.id} onClick={() => void buyListing(listing)} className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-2 text-[9px] font-black text-[#151719] disabled:opacity-40">
                            <ShoppingCart size={12} /> Купить
                          </button>
                        )}
                      </div>
                    ))}
                    {!profile.activeListings.some((listing) => !boughtIds.includes(listing.id)) && <p className="py-3 text-center text-[10px] text-zinc-500">Активных лотов нет.</p>}
                  </div>
                ) : <p className="py-4 text-center text-[10px] text-zinc-500">Активных лотов нет.</p>}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
