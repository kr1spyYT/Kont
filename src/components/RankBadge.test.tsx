import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RankBadge from './RankBadge';

describe('RankBadge full header title', () => {
  it('keeps the complete rank title visible in the compact header variant', () => {
    const markup = renderToStaticMarkup(createElement(RankBadge, {
      title: 'Владелец LootLand',
      compact: true,
      fullText: true,
      showIcon: false,
    }));

    expect(markup).toContain('Владелец LootLand');
    expect(markup).toContain('whitespace-nowrap');
    expect(markup).toContain('overflow-visible');
    expect(markup).not.toContain('truncate');
  });
});
