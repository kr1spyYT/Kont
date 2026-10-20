import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomNav, { AppSection, Tab } from './components/BottomNav';
import AuctionTab from './components/AuctionTab';
import CollectionTab from './components/CollectionTab';
import ContainersTab from './components/ContainersTab';
import GarageTab from './components/GarageTab';
import Header from './components/Header';
import ProfileTab from './components/ProfileTab';
import LeaderboardModal from './components/LeaderboardModal';
import PublicProfileModal from './components/PublicProfileModal';
import GameUpdateModal from './components/GameUpdateModal';
import ProgressTab from './components/ProgressTab';
import SettingsModal from './components/SettingsModal';
import { formatRubles } from './utils/currency';
import { loadHapticsPreference, loadMusicPreference, loadMusicVolume, loadPlayerState, loadSoundPreference, saveHapticsPreference, saveMusicPreference, saveMusicVolume, savePlayerState, saveSoundPreference } from './persistence/playerStorage';
import { notification, setHapticsEnabled } from './utils/haptics';
import { playWin, setBackgroundMusicVolume, setSoundEnabled, startBackgroundMusic, stopBackgroundMusic } from './utils/sound';
import type { ClothingItem, Container, PlayerState } from './types/game';
import type { ActionResponse, GameAction, GameUpdate, LeaderboardEntry, MarketSnapshot, PlayerSnapshot, PublicPlayerProfile, SeasonPassSnapshot } from './types/server';
import { calculateEquippedStats, withEquippedStats, STARTING_PLAYER } from './game/player';
import { applyLocalAction } from './game/localActions';
import { applyOptimisticAction, getOptimisticResourceKey } from './game/optimisticActions';
import { getEquippedLicensePlateFrameIds } from './game/licensePlates';
import { createId } from './utils/id';
import { rankForXp } from './game/ranks';
import type { SeasonTrack } from './game/seasonPass';
import { claimServerSeasonReward, getDemoUser, isServerGame, loadServerContainers, loadServerLeaderboard, loadServerMarket, loadServerPlayer, loadServerPublicProfile, loadServerSeason, loadUnseenGameUpdates, markGameUpdateSeen, sendServerAction } from './api/client';

export default function App() {
  const [player, setPlayer] = useState<PlayerState>(() => isServerGame ? STARTING_PLAYER : loadPlayerState());
  const [active, setActive] = useState<AppSection>('containers');
  const [soundEnabled, setSoundEnabledState] = useState(loadSoundPreference);
  const [musicEnabled, setMusicEnabled] = useState(loadMusicPreference);
  const [musicVolume, setMusicVolume] = useState(loadMusicVolume);
  const [hapticsEnabled, setHapticsEnabledState] = useState(loadHapticsPreference);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [serverLoading, setServerLoading] = useState(isServerGame);
  const [serverError, setServerError] = useState('');
  const [serverSnapshot, setServerSnapshot] = useState<PlayerSnapshot>();
  const [serverContainers, setServerContainers] = useState<Container[]>();
  const [containerCatalogError, setContainerCatalogError] = useState('');
  const [marketData, setMarketData] = useState<MarketSnapshot>();
  const [seasonPass, setSeasonPass] = useState<SeasonPassSnapshot>();
  const [seasonLoading, setSeasonLoading] = useState(isServerGame);
  const [marketToast, setMarketToast] = useState('');
  const [rankPosition, setRankPosition] = useState(isServerGame ? 0 : 1);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [publicProfileId, setPublicProfileId] = useState('');
  const [publicProfile, setPublicProfile] = useState<PublicPlayerProfile>();
  const [publicProfileLoading, setPublicProfileLoading] = useState(false);
  const [publicProfileError, setPublicProfileError] = useState('');
  const [unseenGameUpdates, setUnseenGameUpdates] = useState<GameUpdate[]>([]);
  const [acknowledgingUpdate, setAcknowledgingUpdate] = useState(false);
  const [announcementError, setAnnouncementError] = useState('');
  const profileRequest = useRef(0);
  const marketSalesSeen = useRef<Set<string>>();
  const marketToastTimeout = useRef<number>();
  const snapshotRevision = useRef(0);
  const confirmedSnapshot = useRef<PlayerSnapshot>();
  const actionRevision = useRef(0);
  const lastAppliedActionRevision = useRef(0);
  const pendingServerActions = useRef(new Set<string>());
  const pendingOptimisticResources = useRef(new Set<string>());
  const needsPlayerReconciliation = useRef(false);
  const [splashVisible, setSplashVisible] = useState(isServerGame);
  const [splashFading, setSplashFading] = useState(false);
  const demoUser = useMemo(getDemoUser, []);

  const acceptSnapshot = useCallback((snapshot: PlayerSnapshot) => {
    confirmedSnapshot.current = snapshot;
    setServerSnapshot(snapshot);
    setPlayer(withEquippedStats({ ...snapshot.player, xp: snapshot.xp }));
  }, []);

  const refreshServerPlayer = useCallback(async () => {
    if (pendingServerActions.current.size > 0) return;
    const revision = snapshotRevision.current;
    try {
      const snapshot = await loadServerPlayer();
      if (snapshotRevision.current === revision) {
        acceptSnapshot(snapshot);
        setSeasonPass((current) => current ? { ...current, isPremiumPass: snapshot.isPremiumPass } : current);
        setServerError('');
      }
    } catch (error) {
      console.error('Не удалось синхронизировать профиль с сервером.', error);
    }
  }, [acceptSnapshot]);

  const acceptMarketData = useCallback((data: MarketSnapshot) => {
    setMarketData(data);
    if (!marketSalesSeen.current) {
      marketSalesSeen.current = new Set(data.sales.map((sale) => sale.listingId));
      return;
    }
    const seenSales = marketSalesSeen.current;
    const sale = data.sales.find((entry) => !seenSales.has(entry.listingId));
    if (!sale) return;
    seenSales.add(sale.listingId);
    setMarketToast(`Продан лот «${sale.itemName}»: +${formatRubles(sale.askingPrice)} зачислено на баланс.`);
    notification('success');
    playWin();
    if (marketToastTimeout.current !== undefined) window.clearTimeout(marketToastTimeout.current);
    marketToastTimeout.current = window.setTimeout(() => setMarketToast(''), 5_000);
    void refreshServerPlayer();
  }, [refreshServerPlayer]);

  const initializeServerGame = useCallback(async () => {
    setServerLoading(true);
    setServerError('');
    try {
      const snapshot = await loadServerPlayer();
      acceptSnapshot(snapshot);
      try {
        setUnseenGameUpdates(await loadUnseenGameUpdates());
        setAnnouncementError('');
      } catch (error) {
        console.error('Не удалось загрузить объявления об обновлениях.', error);
      }
      try {
        acceptMarketData(await loadServerMarket());
      } catch (error) {
        setServerError(error instanceof Error ? error.message : 'Не удалось загрузить общий рынок.');
      }
      try {
        setServerContainers(await loadServerContainers());
        setContainerCatalogError('');
      } catch (error) {
        setContainerCatalogError(error instanceof Error ? error.message : 'Не удалось загрузить каталог поставок.');
      }
      try {
        setSeasonPass(await loadServerSeason());
      } catch (error) {
        console.error('Не удалось загрузить сезонный пропуск.', error);
      } finally {
        setSeasonLoading(false);
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Не удалось подключиться к серверной игре.');
    } finally {
      setServerLoading(false);
    }
  }, [acceptMarketData, acceptSnapshot]);

  const refreshContainers = useCallback(async () => {
    if (!isServerGame) return;
    try {
      setServerContainers(await loadServerContainers());
      setContainerCatalogError('');
    } catch (error) {
      setContainerCatalogError(error instanceof Error ? error.message : 'Не удалось обновить каталог поставок.');
    }
  }, []);

  const refreshMarket = useCallback(async () => {
    if (!isServerGame) return;
    try {
      acceptMarketData(await loadServerMarket());
    } catch (error) {
      setServerError(error instanceof Error ? `Не удалось обновить рынок: ${error.message}` : 'Не удалось обновить рынок.');
    }
  }, [acceptMarketData]);

  useEffect(() => {
    if (isServerGame) void initializeServerGame();
  }, [initializeServerGame]);

  useEffect(() => {
    if (!isServerGame || !serverSnapshot) return;
    const interval = window.setInterval(() => void refreshServerPlayer(), 5_000);
    return () => window.clearInterval(interval);
  }, [refreshServerPlayer, serverSnapshot !== undefined]);

  useEffect(() => {
    if (!isServerGame || !serverSnapshot) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshMarket();
    };
    refreshWhenVisible();
    const interval = window.setInterval(refreshWhenVisible, active === 'market' ? 3_000 : 10_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [active, refreshMarket, serverSnapshot !== undefined]);

  useEffect(() => {
    if (!isServerGame || active !== 'containers' || !serverSnapshot) return;
    const interval = window.setInterval(() => void refreshContainers(), 5_000);
    return () => window.clearInterval(interval);
  }, [active, refreshContainers, serverSnapshot !== undefined]);

  useEffect(() => () => {
    if (marketToastTimeout.current !== undefined) window.clearTimeout(marketToastTimeout.current);
  }, []);

  useEffect(() => {
    if (!isServerGame || !serverSnapshot) return;
    let cancelled = false;
    const refreshRank = () => {
      void loadServerLeaderboard('respect').then((result) => {
        if (!cancelled) setRankPosition(result.currentPosition);
      }).catch((error: unknown) => {
        if (!cancelled) console.error('Не удалось обновить место игрока в рейтинге.', error);
      });
    };
    refreshRank();
    const interval = window.setInterval(refreshRank, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [serverSnapshot?.player.respect]);

  useEffect(() => {
    if (!serverSnapshot || !splashVisible) return;
    setSplashFading(true);
    const timeout = window.setTimeout(() => setSplashVisible(false), 700);
    return () => window.clearTimeout(timeout);
  }, [serverSnapshot, splashVisible]);

  useEffect(() => {
    if (isServerGame) return;
    try {
      savePlayerState(player);
      setStorageError('');
    } catch (error) {
      console.error('Не удалось сохранить состояние LootLand в localStorage.', error);
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

  useEffect(() => {
    setHapticsEnabled(hapticsEnabled);
    try {
      saveHapticsPreference(hapticsEnabled);
    } catch (error) {
      console.error('Не удалось сохранить настройку вибрации.', error);
    }
  }, [hapticsEnabled]);

  useEffect(() => {
    setBackgroundMusicVolume(musicVolume);
    try {
      saveMusicVolume(musicVolume);
    } catch (error) {
      console.error('Не удалось сохранить громкость фоновой музыки.', error);
    }
  }, [musicVolume]);

  useEffect(() => {
    try {
      saveMusicPreference(musicEnabled);
    } catch (error) {
      console.error('Не удалось сохранить настройку фоновой музыки.', error);
    }
    if (!musicEnabled) {
      stopBackgroundMusic();
      return;
    }
    const resumeOnInteraction = () => {
      void startBackgroundMusic().catch((error: unknown) => {
        console.error('Не удалось запустить фоновую музыку.', error);
      });
    };
    resumeOnInteraction();
    window.addEventListener('pointerdown', resumeOnInteraction);
    window.addEventListener('keydown', resumeOnInteraction);
    return () => {
      window.removeEventListener('pointerdown', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
    };
  }, [musicEnabled]);

  const runAction = useCallback(async (action: GameAction): Promise<ActionResponse | undefined> => {
    if (isServerGame && !serverSnapshot) return undefined;
    const resourceKey = isServerGame ? getOptimisticResourceKey(action) : undefined;
    if (resourceKey && pendingOptimisticResources.current.has(resourceKey)) return undefined;

    const requestRevision = isServerGame ? ++actionRevision.current : 0;
    const pendingActionToken = `${action.requestId}:${requestRevision}`;
    if (isServerGame) {
      pendingServerActions.current.add(pendingActionToken);
      if (resourceKey) pendingOptimisticResources.current.add(resourceKey);
      snapshotRevision.current += 1;
    }
    const projectedPlayer = isServerGame && resourceKey
      ? applyOptimisticAction(player, action, serverContainers ?? [])
      : undefined;
    if (projectedPlayer) setPlayer(withEquippedStats({ ...projectedPlayer, xp: player.xp ?? 0 }));

    try {
      const response = isServerGame
        ? await sendServerAction(action)
        : applyLocalAction(player, action, demoUser);
      if (isServerGame) {
        if (requestRevision === actionRevision.current && requestRevision >= lastAppliedActionRevision.current) {
          lastAppliedActionRevision.current = requestRevision;
          snapshotRevision.current += 1;
          acceptSnapshot(response.snapshot);
        } else {
          needsPlayerReconciliation.current = true;
        }
      } else {
        setPlayer(withEquippedStats({ ...response.snapshot.player, xp: response.snapshot.xp }));
      }
      if (!isServerGame || requestRevision === actionRevision.current) setServerError('');
      if (isServerGame && ['open-container', 'open-season-case', 'quick-sell-item', 'quick-sell-junk', 'equip-clothing'].includes(action.type)) {
        try { setSeasonPass(await loadServerSeason()); } catch (error) { console.error('Не удалось обновить сезонный прогресс.', error); }
      }
      if (isServerGame && (['list-item', 'list-license-plate', 'cancel-listing', 'buy-listing'].includes(action.type) || action.type.startsWith('premium-'))) {
        try {
          acceptMarketData(await loadServerMarket());
        } catch (error) {
          setServerError(error instanceof Error ? `Действие выполнено, но рынок не обновился: ${error.message}` : 'Действие выполнено, но рынок не обновился.');
        }
      }
      return response;
    } catch (error) {
      console.error(`LootLand action failed (${action.type}).`, error);
      const isNetworkIssue = error instanceof TypeError || (error instanceof Error && ['AbortError', 'NetworkError'].includes(error.name));
      const message = isNetworkIssue
        ? 'Сервер не ответил после повтора. Проверяем сохранённое состояние…'
        : error instanceof Error ? error.message : 'Действие не выполнено. Попробуй ещё раз.';
      setServerError(message);
      if (isServerGame) {
        needsPlayerReconciliation.current = true;
        if (projectedPlayer) {
          const confirmed = confirmedSnapshot.current ?? serverSnapshot;
          if (confirmed) acceptSnapshot(confirmed);
        }
      }
      return undefined;
    } finally {
      if (isServerGame) {
        pendingServerActions.current.delete(pendingActionToken);
        if (resourceKey) pendingOptimisticResources.current.delete(resourceKey);
        if (pendingServerActions.current.size === 0 && needsPlayerReconciliation.current) {
          needsPlayerReconciliation.current = false;
          void refreshServerPlayer();
        }
      }
    }
  }, [player, demoUser, serverSnapshot, serverContainers, acceptMarketData, acceptSnapshot, refreshServerPlayer]);

  const topUpBalance = () => {
    void runAction({ type: 'top-up-owner', requestId: createId('owner-topup') });
  };

  const claimSeasonReward = useCallback(async (level: number, track: SeasonTrack) => {
    const response = await claimServerSeasonReward(level, track);
    setSeasonPass(response.snapshot);
    await refreshServerPlayer();
    return response.message;
  }, [refreshServerPlayer]);

  const acknowledgeUpdate = async (updateId: string) => {
    if (acknowledgingUpdate) return;
    setAcknowledgingUpdate(true);
    setAnnouncementError('');
    try {
      await markGameUpdateSeen(updateId);
      setUnseenGameUpdates((current) => current.filter((entry) => entry.id !== updateId));
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : 'Не удалось сохранить отметку о прочтении.');
    } finally {
      setAcknowledgingUpdate(false);
    }
  };

  const demoLeaderboardEntry: LeaderboardEntry = useMemo(() => ({
    telegramId: demoUser.id,
    displayName: [demoUser.firstName, demoUser.lastName].filter(Boolean).join(' ') || 'Игрок',
    username: demoUser.username,
    avatarUrl: demoUser.photoUrl,
    xp: player.xp ?? 0,
    respect: player.respect,
    collectionValue: player.inventory.reduce((total, item) => total + item.price, 0) + player.licensePlates.reduce((total, plate) => total + plate.price, 0),
    collectionCount: player.inventory.length + player.licensePlates.length,
    rankTitle: rankForXp(player.xp ?? 0),
    position: 1,
  }), [demoUser, player]);

  const openPublicProfile = useCallback(async (telegramId: string) => {
    const requestId = ++profileRequest.current;
    setPublicProfileId(telegramId);
    setPublicProfile(undefined);
    setPublicProfileError('');
    setPublicProfileLoading(true);
    try {
      if (isServerGame) {
        const profile = await loadServerPublicProfile(telegramId);
        if (profileRequest.current === requestId) setPublicProfile(profile);
      } else if (telegramId === demoUser.id) {
        const stats = calculateEquippedStats(player);
        const equippedClothing = Object.values(player.equippedClothing)
          .map((itemId) => player.inventory.find((item): item is ClothingItem => item.id === itemId && item.type === 'clothing'))
          .filter((item): item is ClothingItem => item !== undefined);
        const profile: PublicPlayerProfile = {
          telegramId: demoUser.id,
          displayName: [demoUser.firstName, demoUser.lastName].filter(Boolean).join(' ') || 'Игрок',
          username: demoUser.username,
          avatarUrl: demoUser.photoUrl,
          xp: player.xp ?? 0,
          respect: player.respect,
          collectionValue: demoLeaderboardEntry.collectionValue,
          collectionCount: demoLeaderboardEntry.collectionCount,
          rankTitle: rankForXp(player.xp ?? 0),
          rankPosition: 1,
          isPremiumPass: false,
          equippedClothing,
          activeCar: stats.activeCar,
          licensePlates: player.licensePlates,
          licensePlateFrames: getEquippedLicensePlateFrameIds(player),
          activeListings: player.auctionListings.map((listing) => ({ ...listing, sellerId: demoUser.id, isMine: true, sellerAvatarUrl: demoUser.photoUrl })),
        };
        if (profileRequest.current === requestId) setPublicProfile(profile);
      } else {
        if (profileRequest.current === requestId) setPublicProfileError('В демо-режиме доступны только локальные профили.');
      }
    } catch (error) {
      if (profileRequest.current === requestId) setPublicProfileError(error instanceof Error ? error.message : 'Не удалось загрузить профиль игрока.');
    } finally {
      if (profileRequest.current === requestId) setPublicProfileLoading(false);
    }
  }, [demoLeaderboardEntry, demoUser, player]);

  const rankTitle = serverSnapshot?.rankTitle ?? rankForXp(player.xp ?? 0);
  const playerName = serverSnapshot
    ? [serverSnapshot.telegramUser.firstName, serverSnapshot.telegramUser.lastName].filter(Boolean).join(' ') || 'Игрок'
    : [demoUser.firstName, demoUser.lastName].filter(Boolean).join(' ') || 'Игрок';

  if (isServerGame && !serverSnapshot && !serverLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#09090b] p-5 text-[#F6F2E8]">
        <section className="w-full max-w-sm rounded-3xl border border-amber-300/20 bg-[#111116] p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">LootLand · серверная игра</p>
          <h1 className="mt-2 text-xl font-black">Не удалось войти</h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-zinc-400">{serverError || 'Открой игру через Telegram-бота.'}</p>
          <button type="button" onClick={() => void initializeServerGame()} className="mt-5 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-[#111116]">Повторить подключение</button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#F6F2E8]">
      {splashVisible && (
        <div
          role="status"
          aria-label="Загрузка LootLand"
          className={`kont-splash fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden transition-opacity duration-700 ease-out ${splashFading ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        >
          <div className="kont-splash-glow" aria-hidden="true" />
          <div className="relative flex w-full max-w-xs flex-col items-center px-8">
            <h1 className="kont-splash-logo">LootLand</h1>
            <div className="kont-splash-progress mt-10" aria-hidden="true">
              <span />
            </div>
            <p className="mt-4 text-[9px] font-medium uppercase tracking-[0.42em] text-white/45">Загрузка</p>
          </div>
        </div>
      )}
      {marketToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-xl border border-emerald-300/30 bg-[#111116] px-4 py-3 text-center text-xs font-bold text-emerald-100 shadow-2xl shadow-black/40"
        >
          {marketToast}
        </div>
      )}
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-32">
        <Header
          player={player}
          onTopUp={topUpBalance}
          onProfileClick={() => setActive('profile')}
          onSettingsClick={() => setSettingsOpen(true)}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          profileOpen={active === 'profile'}
          rankTitle={rankTitle}
          playerName={playerName}
          canTopUp={serverSnapshot?.isOwner === true}
          loading={isServerGame && serverLoading}
        />
        {(storageError || serverError) && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {serverError || storageError}
          </p>
        )}

        <main className="py-6">
          {active === 'containers' && (
            <ContainersTab
              player={player}
              onAction={runAction}
              freeCaseAvailableAt={isServerGame ? serverSnapshot?.freeCaseAvailableAt ?? null : undefined}
              containerCooldowns={isServerGame ? serverSnapshot?.containerCooldowns : undefined}
              availableContainers={isServerGame ? serverContainers : undefined}
              catalogLoading={isServerGame && serverLoading}
              catalogError={containerCatalogError}
              onRetryCatalog={() => void refreshContainers()}
            />
          )}
          {active === 'collection' && (
            <CollectionTab
              player={player}
              onAction={runAction}
              onOpenContainers={() => setActive('containers')}
              onOpenGarage={() => setActive('garage')}
            />
          )}
          {active === 'garage' && (
            <GarageTab
              player={player}
              onAction={runAction}
              onOpenContainers={() => setActive('containers')}
              onOpenProfile={() => setActive('profile')}
              rankPosition={rankPosition}
            />
          )}
          {active === 'profile' && (
            <ProfileTab
              player={player}
              onAction={runAction}
              onOpenInventory={() => setActive('collection')}
              onOpenSeason={() => setActive('progress')}
              rankTitle={rankTitle}
              playerName={playerName}
              rankPosition={rankPosition}
              avatarUrl={serverSnapshot?.telegramUser.photoUrl ?? demoUser.photoUrl}
              season={seasonPass}
              isPremiumPass={serverSnapshot?.isPremiumPass ?? seasonPass?.isPremiumPass}
            />
          )}
          {active === 'progress' && (
            <ProgressTab
              player={player}
              onAction={runAction}
              isServerGame={isServerGame}
              season={seasonPass}
              loading={seasonLoading}
              onSeasonChange={setSeasonPass}
              onClaim={claimSeasonReward}
              onRefreshPlayer={refreshServerPlayer}
            />
          )}
          {active === 'market' && (
            <AuctionTab
              player={player}
              onAction={runAction}
              marketListings={marketData?.listings}
              premiumLots={marketData?.premiumLots}
              onOpenProfile={(telegramId) => void openPublicProfile(telegramId)}
            />
          )}
        </main>
        <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-700">
          {isServerGame ? 'LOOTLAND · TELEGRAM · СЕРВЕРНОЕ СОХРАНЕНИЕ' : `LootLand · демо · ${formatRubles(player.balance)}`}
        </div>
      </div>
      <BottomNav active={active} onChange={(tab: Tab) => setActive(tab)} />
      {settingsOpen && (
        <SettingsModal
          musicEnabled={musicEnabled}
          musicVolume={musicVolume}
          soundEnabled={soundEnabled}
          hapticsEnabled={hapticsEnabled}
          onMusicChange={(enabled) => {
            if (enabled) {
              void startBackgroundMusic().catch((error: unknown) => {
                console.error('Не удалось запустить фоновую музыку.', error);
              });
            } else {
              stopBackgroundMusic();
            }
            setMusicEnabled(enabled);
          }}
          onMusicVolumeChange={setMusicVolume}
          onSoundChange={setSoundEnabledState}
          onHapticsChange={setHapticsEnabledState}
          onOpenLeaderboard={() => {
            setSettingsOpen(false);
            setLeaderboardOpen(true);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {leaderboardOpen && (
        <LeaderboardModal
          isServerGame={isServerGame}
          demoEntry={demoLeaderboardEntry}
          onClose={() => setLeaderboardOpen(false)}
          onOpenProfile={(telegramId) => {
            setLeaderboardOpen(false);
            void openPublicProfile(telegramId);
          }}
        />
      )}
      {publicProfileId && (
        <PublicProfileModal
          profile={publicProfile}
          loading={publicProfileLoading}
          error={publicProfileError}
          balance={player.balance}
          onClose={() => {
            profileRequest.current += 1;
            setPublicProfileId('');
            setPublicProfile(undefined);
          }}
          onBuy={runAction}
        />
      )}
      {isServerGame && unseenGameUpdates[0] && (
        <GameUpdateModal
          update={unseenGameUpdates[0]}
          busy={acknowledgingUpdate}
          error={announcementError}
          onAcknowledge={() => void acknowledgeUpdate(unseenGameUpdates[0].id)}
        />
      )}
    </div>
  );
}
