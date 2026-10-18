import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Container, InventoryItem, Rarity } from '../../types/game';
import type { OpeningState } from './useContainerOpening';
import ContainerOpeningModal from './ContainerOpeningModal';

const container: Container = {
  id: 'test-case',
  order: 1,
  tier: 1,
  name: 'Тестовый контейнер',
  category: 'clothing',
  price: 1_500,
  description: 'Тестовый предмет',
  icon: '📦',
  image: '/assets/test-case.webp',
  contents: [],
};

const item: InventoryItem = {
  id: 'test-item',
  name: 'Тестовое худи',
  type: 'clothing',
  rarity: 'legendary',
  icon: '👕',
  image: '/items/test-item.webp',
  price: 1_200,
  basePrice: 1_500,
  respect: 5,
  serial: '#001/500',
  wear: 82.5,
  createdAt: '2026-10-18T00:00:00.000Z',
  containerId: container.id,
  slot: 'torso',
  authenticity: '***',
};

const makeOpening = (
  phase: OpeningState['phase'],
  rarity: Rarity = item.rarity,
  isHitAnimating = false,
): OpeningState => ({
  container,
  item: { ...item, rarity },
  phase,
  sequenceId: 1,
  isHitAnimating,
});

const renderModal = (
  phase: OpeningState['phase'],
  rarity: Rarity = item.rarity,
  isHitAnimating = false,
) => renderToStaticMarkup(createElement(ContainerOpeningModal, {
  opening: makeOpening(phase, rarity, isHitAnimating),
  shouldReduceMotion: false,
  onHit: () => undefined,
  onClose: () => undefined,
  onKeep: () => undefined,
  onSell: () => undefined,
}));

describe('Container Break reveal modal', () => {
  it('shows the existing case artwork and the first-hit prompt before the reward', () => {
    const markup = renderModal('idle');

    expect(markup).toContain('data-phase="idle"');
    expect(markup).toContain('src="/assets/test-case.webp"');
    expect(markup).toContain('Нажми, чтобы ударить');
    expect(markup).toContain('container-break-scene__floor');
    expect(markup).toContain('container-break-scene__burst');
    expect(markup).not.toContain('container-break-scene__seam');
    expect(markup).not.toContain('Твой дроп!');
  });

  it('shows the server-awarded item and existing keep/sell actions after the reveal', () => {
    const markup = renderModal('result');

    expect(markup).toContain('container-break-reward');
    expect(markup).toContain('data-rarity="legendary"');
    expect(markup).not.toContain('data-phase="result"');
    expect(markup).not.toContain('container-break-scene');
    expect(markup).toContain('Тестовое худи');
    expect(markup).toContain('ЛЕГЕНДАРНЫЙ');
    expect(markup).toContain('item-icon-art--showcase');
    expect(markup).toContain('💰');
    expect(markup).toContain('Респект');
    expect(markup).toContain('В инвентарь');
    expect(markup).toContain('Продать сразу');
    expect(markup).toContain('sticky bottom-0');
  });

  it.each([
    ['common', 'rgb(226 232 240 / 82%)'],
    ['epic', 'rgb(167 139 250 / 88%)'],
    ['legendary', 'rgb(251 191 36 / 92%)'],
  ] as const)('uses the matching reveal glow for %s rarity', (rarity, glow) => {
    const markup = renderModal('idle', rarity);

    expect(markup).toContain(`data-rarity="${rarity}"`);
    expect(markup).toContain(glow);
  });

  it('locks the strike button while the current hit animates', () => {
    const markup = renderModal('hit1', 'rare', true);

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Второй удар · 2 из 3');
  });
});
