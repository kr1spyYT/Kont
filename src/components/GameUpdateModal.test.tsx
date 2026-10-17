import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GameUpdateModal from './GameUpdateModal';

describe('GameUpdateModal', () => {
  it('shows an update and a single acknowledgement action', () => {
    const markup = renderToStaticMarkup(createElement(GameUpdateModal, {
      update: { id: 'update-1', title: 'Новый рынок', body: 'Добавили быстрый поиск.', publishedAt: '2026-10-17T00:00:00.000Z' },
      busy: false,
      error: '',
      onAcknowledge: () => undefined,
    }));

    expect(markup).toContain('Новый рынок');
    expect(markup).toContain('Добавили быстрый поиск.');
    expect(markup).toContain('Понятно, продолжить');
    expect(markup).toContain('больше не появится');
  });
});
