import type { PlayerState } from '../types/game';
import type { ActionResponse, GameAction } from '../types/server';
import InventoryTab from './InventoryTab';

export default function CollectionTab({
  player,
  onAction,
  onOpenContainers,
  onOpenGarage,
}: {
  player: PlayerState;
  onAction: (action: GameAction) => Promise<ActionResponse | undefined>;
  onOpenContainers: () => void;
  onOpenGarage: () => void;
}) {
  return <InventoryTab player={player} onAction={onAction} onOpenGarage={onOpenGarage} onOpenContainers={onOpenContainers} />;
}
