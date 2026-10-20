import type { PlayerState } from '../types/game';
import type { ActionResponse, GameAction, SeasonPassSnapshot } from '../types/server';
import type { SeasonTrack } from '../game/seasonPass';
import DailyMissions from './DailyMissions';
import SeasonTab from './SeasonTab';

export default function ProgressTab({
  player,
  onAction,
  isServerGame,
  season,
  loading,
  onSeasonChange,
  onClaim,
  onRefreshPlayer,
}: {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  isServerGame: boolean;
  season?: SeasonPassSnapshot;
  loading: boolean;
  onSeasonChange: (season: SeasonPassSnapshot) => void;
  onClaim: (level: number, track: SeasonTrack) => Promise<string>;
  onRefreshPlayer: () => Promise<void>;
}) {
  return (
    <section className="space-y-4">
      <SeasonTab
        isServerGame={isServerGame}
        season={season}
        loading={loading}
        onSeasonChange={onSeasonChange}
        onClaim={onClaim}
        onRefreshPlayer={onRefreshPlayer}
      />
      <DailyMissions player={player} onAction={onAction} />
    </section>
  );
}
