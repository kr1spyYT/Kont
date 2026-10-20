import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BottomNav from './BottomNav';

describe('BottomNav', () => {
  it('keeps the main navigation focused on five game areas', () => {
    const markup = renderToStaticMarkup(createElement(BottomNav, {
      active: 'containers',
      onChange: () => undefined,
    }));

    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('Контейнеры');
    expect(markup).toContain('Инвентарь');
    expect(markup).toContain('Гараж');
    expect(markup).toContain('Аукцион');
    expect(markup).toContain('Сезон');
    expect(markup).not.toContain('Коллекция');
    expect(markup).not.toContain('Рынок');
    expect(markup).not.toContain('Прогресс');
    expect(markup).not.toContain('Ещё');
  });
});
