export type GenesisScene = 'vault' | 'garage' | 'auction' | 'profile';

const sceneImages: Record<GenesisScene, string> = {
  vault: '/assets/season/genesis/scenes/vault-bg.webp',
  garage: '/assets/season/genesis/scenes/garage-bg.webp',
  auction: '/assets/season/genesis/scenes/auction-bg.webp',
  profile: '/assets/season/genesis/scenes/profile-card-bg.webp',
};

export default function GenesisSceneBackdrop({ scene, className = '' }: { scene: GenesisScene; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 bg-cover bg-center ${className}`}
      style={{ backgroundImage: `url("${sceneImages[scene]}")` }}
    />
  );
}

export { sceneImages as GENESIS_SCENE_IMAGES };
