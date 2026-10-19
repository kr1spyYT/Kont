import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Container } from '../../types/game';
import ContainerSelectionModal from './ContainerSelectionModal';

const container: Container = {
  id: 'test-case', order: 1, tier: 1, name: 'Тестовый контейнер', category: 'clothing', price: 1_500,
  description: 'Содержимое засекречено', icon: '📦', image: '', contents: [],
};

const renderModal = (openingPending: boolean) => renderToStaticMarkup(createElement(ContainerSelectionModal, {
  container,
  notice: '',
  openingPending,
  keysAvailable: 1,
  shouldReduceMotion: false,
  onClose: () => undefined,
  onPaidOpen: () => undefined,
  onKeyOpen: () => undefined,
  onFreeOpen: () => undefined,
}));

describe('ContainerSelectionModal server-pending state', () => {
  it('shows a server verification status and disables repeat opening while waiting', () => {
    const markup = renderModal(true);

    expect(markup).toContain('Проверяем открытие на сервере');
    expect(markup).toContain('Открываем на сервере');
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('does not show a pending status before the player starts an opening', () => {
    expect(renderModal(false)).not.toContain('Проверяем открытие на сервере');
  });
});
