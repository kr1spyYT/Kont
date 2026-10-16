import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
import type { ActionResponse, GameAction, MarketListing, PlayerSnapshot } from './types/server';
import { withEquippedStats, STARTING_PLAYER } from './game/player';
import { applyLocalAction } from './game/localActions';
import { createId } from './utils/id';
import { rankForXp } from './game/ranks';
import { getDemoUser, importServerSave, isServerGame, loadServerMarket, loadServerPlayer, sendServerAction } from './api/client';

export default function App() {
  const [player, setPlayer] = useState<PlayerState>(() => isServerGame ? STARTING_PLAYER : loadPlayerState());
  const [active, setActive] = useState<AppSection>('containers');
  const [soundEnabled] = useState(loadSoundPreference);
  const [storageError, setStorageError] = useState('');
  const [serverLoading, setServerLoading] = useState(isServerGame);
  const [serverError, setServerError] = useState('');
  const [serverSnapshot, setServerSnapshot] = useState<PlayerSnapshot>();
  const [marketListings, setMarketListings] = useState<MarketListing[]>();
  const [ownerImportBusy, setOwnerImportBusy] = useState(false);
  const demoUser = useMemo(getDemoUser, []);

  const acceptSnapshot = useCallback((snapshot: PlayerSnapshot) => {
    setServerSnapshot(snapshot);
    setPlayer(withEquippedStats({ ...snapshot.player, xp: snapshot.xp }));
  }, []);

  const initializeServerGame = useCallback(async () => {
    setServerLoading(true);
    setServerError('');
    try {
      const snapshot = await loadServerPlayer();
      acceptSnapshot(snapshot);
      if (!snapshot.ownerImportPending) {
        try {
          setMarketListings(await loadServerMarket());
        } catch (error) {
          setServerError(error instanceof Error ? error.message : 'Не удалось загрузить общий рынок.');
        }
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Не удалось подключиться к серверной игре.');
    } finally {
      setServerLoading(false);
    }
  }, [acceptSnapshot]);

  useEffect(() => {
    if (isServerGame) void initializeServerGame();
  }, [initializeServerGame]);

  useEffect(() => {
    if (isServerGame) return;
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

  const runAction = useCallback(async (action: GameAction): Promise<ActionResponse | undefined> => {
    try {
      const response = isServerGame
        ? await sendServerAction(action)
        : applyLocalAction(player, action, demoUser);
      setPlayer(withEquippedStats({ ...response.snapshot.player, xp: response.snapshot.xp }));
      if (isServerGame) setServerSnapshot(response.snapshot);
      setServerError('');
      if (isServerGame && ['list-item', 'cancel-listing', 'buy-listing', 'buy-bot-listing'].includes(action.type)) {
        try {
          setMarketListings(await loadServerMarket());
        } catch (error) {
          setServerError(error instanceof Error ? `Действие выполнено, но рынок не обновился: ${error.message}` : 'Действие выполнено, но рынок не обновился.');
        }
      }
      return response;
    } catch (error) {
      console.error(`KONT action failed (${action.type}).`, error);
      const message = error instanceof Error ? error.message : 'Действие не выполнено. Попробуй ещё раз.';
      setServerError(message);
      return undefined;
    }
  }, [player, demoUser]);

  const topUpBalance = () => {
    void runAction({ type: 'top-up-owner', requestId: createId('owner-topup') });
  };

  const exportLocalSave = () => {
    const contents = JSON.stringify({ ...player, exportedAt: new Date().toISOString(), format: 'kont-save-v1' }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kont-save-v1.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const importOwnerFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setOwnerImportBusy(true);
    setServerError('');
    try {
      const save: unknown = JSON.parse(await file.text());
      const snapshot = await importServerSave(save);
      acceptSnapshot(snapshot);
      setMarketListings(await loadServerMarket().catch(() => []));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Не удалось перенести сохранение.');
    } finally {
      setOwnerImportBusy(false);
    }
  };

  const startNewGame = async () => {
    setOwnerImportBusy(true);
    const response = await runAction({ type: 'start-new-game', requestId: createId('new-game') });
    if (response) {
      setMarketListings(await loadServerMarket().catch(() => []));
      setServerError('');
    }
    setOwnerImportBusy(false);
  };

  const rankTitle = serverSnapshot?.rankTitle ?? rankForXp(player.xp ?? 0);
  const playerName = serverSnapshot
    ? [serverSnapshot.telegramUser.firstName, serverSnapshot.telegramUser.lastName].filter(Boolean).join(' ') || 'Игрок'
    : [demoUser.firstName, demoUser.lastName].filter(Boolean).join(' ') || 'Игрок';

  if (isServerGame && serverLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#151719] p-6 text-center text-[#F2EFE8]"><p className="text-sm font-bold text-amber-200">Подключаем профиль и серверное сохранение…</p></main>;
  }

  if (isServerGame && !serverSnapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#151719] p-5 text-[#F2EFE8]">
        <section className="w-full max-w-sm rounded-3xl border border-[#34383C] bg-[#202326] p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">KONT · серверная игра</p>
          <h1 className="mt-2 text-xl font-black">Не удалось войти</h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-zinc-400">{serverError || 'Открой игру через Telegram-бота.'}</p>
          <button type="button" onClick={() => void initializeServerGame()} className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-[#151719]">Повторить подключение</button>
        </section>
      </main>
    );
  }

  if (isServerGame && serverSnapshot?.ownerImportPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#151719] p-5 text-[#F2EFE8]">
        <section className="w-full max-w-sm rounded-3xl border border-[#34383C] bg-[#202326] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Первый вход · владелец</p>
          <h1 className="mt-2 text-2xl font-black">Перенести прогресс?</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">На localhost:5177 открой профиль и скачай локальное сохранение. Импорт разрешён один раз и заменит стартовый профиль в базе. Можно также начать новую игру.</p>
          {serverError && <p role="alert" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">{serverError}</p>}
          <label className={`mt-5 flex cursor-pointer items-center justify-center rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-[#151719] ${ownerImportBusy ? 'opacity-50' : ''}`}>
            {ownerImportBusy ? 'Импортируем…' : 'Выбрать файл сохранения'}
            <input type="file" accept="application/json,.json" disabled={ownerImportBusy} onChange={(event) => void importOwnerFile(event)} className="sr-only" />
          </label>
          <button type="button" disabled={ownerImportBusy} onClick={() => void startNewGame()} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-300 disabled:opacity-50">Начать новую игру</button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#151719] text-[#F2EFE8]">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-32">
        <Header
          player={player}
          onTopUp={topUpBalance}
          onProfileClick={() => setActive('profile')}
          profileOpen={active === 'profile'}
          rankTitle={rankTitle}
          playerName={playerName}
          canTopUp={serverSnapshot?.isOwner === true}
        />
        {(storageError || serverError) && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {serverError || storageError}
          </p>
        )}

        <main className="py-6">
          <div hidden={active !== 'containers'}><ContainersTab player={player} onAction={runAction} freeCaseAvailableAt={isServerGame ? serverSnapshot?.freeCaseAvailableAt ?? null : undefined} /></div>
          <div hidden={active !== 'inventory'}><InventoryTab player={player} onAction={runAction} onOpenGarage={() => setActive('garage')} /></div>
          <div hidden={active !== 'profile'}>
            <ProfileTab
              player={player}
              onAction={runAction}
              onOpenInventory={() => setActive('inventory')}
              rankTitle={rankTitle}
              playerName={playerName}
              onExportSave={!isServerGame ? exportLocalSave : undefined}
            />
          </div>
          <div hidden={active !== 'garage'}><GarageTab player={player} onAction={runAction} /></div>
          <div hidden={active !== 'auction'}>
            <AuctionTab player={player} onAction={runAction} botListings={MARKET_SEED} marketListings={marketListings} />
          </div>
          <div hidden={active !== 'more'}><MoreTab /></div>
        </main>
        <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-700">
          {isServerGame ? 'KONT · Telegram · серверное сохранение' : `KONT · демо · ${formatRubles(player.balance)}`}
        </div>
      </div>
      <BottomNav active={active} onChange={(tab: Tab) => setActive(tab)} />
    </div>
  );
}
