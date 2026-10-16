import { useEffect, useState } from 'react';
import BottomNav, { AppSection, Tab } from './components/BottomNav';
import AuctionTab from './components/AuctionTab';
import ContainersTab from './components/ContainersTab';
import GarageTab from './components/GarageTab';
import Header from './components/Header';
import InventoryTab from './components/InventoryTab';
import MoreTab from './components/MoreTab';
import ProfileTab from './components/ProfileTab';
import { formatRubles } from './utils/currency';
import { MARKET_SEED } from './data/market';
import { loadPlayerState, loadSoundPreference, savePlayerState, saveSoundPreference } from './persistence/playerStorage';
import { setSoundEnabled } from './utils/sound';
import type { PlayerState } from './types/game';
import { withEquippedStats } from './game/player';

export default function App() {
  const [player, setPlayer] = useState<PlayerState>(loadPlayerState);
  const [active, setActive] = useState<AppSection>('containers');
  const [soundEnabled] = useState(loadSoundPreference);
  const [storageError, setStorageError] = useState('');

  const updatePlayer = (next: PlayerState) => setPlayer(withEquippedStats(next));
  useEffect(() => {
    try {
      savePlayerState(player);
      setStorageError('');
    } catch (error) {
      console.error('Не удалось сохранить состояние KONT в localStorage.', error);
      setStorageError('Не удалось сохранить прогресс. Проверь настройки хранилища браузера.');
    }
  }, [player]);

  useEffect(() => {
    setSoundEnabled(soundEnabled);
    try {
      saveSoundPreference(soundEnabled);
    } catch (error) {
      console.error('Не удалось сохранить настройку звука.', error);
    }
  }, [soundEnabled]);

  const topUpBalance = () => updatePlayer({ ...player, balance: player.balance + 1_000_000 });

  return (
    <div className="min-h-screen bg-[#151719] text-[#F2EFE8]">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-32">
        <Header
          player={player}
          onTopUp={topUpBalance}
          onProfileClick={() => setActive('profile')}
          profileOpen={active === 'profile'}
        />
        {storageError && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {storageError}
          </p>
        )}

        <main className="py-6">
          <div hidden={active !== 'containers'}>
            <ContainersTab player={player} onPlayerChange={updatePlayer} />
          </div>
          <div hidden={active !== 'inventory'}>
            <InventoryTab player={player} onPlayerChange={updatePlayer} />
          </div>
          <div hidden={active !== 'profile'}>
            <ProfileTab
              player={player}
              onPlayerChange={updatePlayer}
              onOpenInventory={() => setActive('inventory')}
            />
          </div>
          <div hidden={active !== 'garage'}>
            <GarageTab player={player} onPlayerChange={updatePlayer} />
          </div>
          <div hidden={active !== 'auction'}>
            <AuctionTab player={player} onPlayerChange={updatePlayer} botListings={MARKET_SEED} />
          </div>
          <div hidden={active !== 'more'}>
            <MoreTab />
          </div>
        </main>
        <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-700">
          KONT · {formatRubles(player.balance)}
        </div>
      </div>
      <BottomNav
        active={active}
        onChange={(tab: Tab) => setActive(tab)}
      />
    </div>
  );
}
