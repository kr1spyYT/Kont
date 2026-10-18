import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GameImage, { isRenderableImageSource } from './GameImage';
import ItemIcon from './ItemIcon';

describe('GameImage', () => {
  it('accepts data URLs, web URLs, app paths, and image files', () => {
    expect(isRenderableImageSource('data:image/webp;base64,AQID')).toBe(true);
    expect(isRenderableImageSource('https://cdn.example.test/item.webp')).toBe(true);
    expect(isRenderableImageSource('/api/assets/asset_test_123')).toBe(true);
    expect(isRenderableImageSource('items/custom-item.png')).toBe(true);
    expect(isRenderableImageSource('javascript:alert(1)')).toBe(false);
  });

  it('renders a catalog data URL as an img in the item icon', () => {
    const source = 'data:image/webp;base64,AQID';
    const markup = renderToStaticMarkup(createElement(ItemIcon, {
      name: 'Кастомная кепка',
      type: 'clothing',
      image: source,
    }));

    expect(markup).toContain('<img');
    expect(markup).toContain(`src="${source}"`);
    expect(markup).toContain('alt=""');
  });

  it('renders an image source supplied through imageUrl or icon', () => {
    const imageUrlMarkup = renderToStaticMarkup(createElement(GameImage, {
      alt: 'Предмет',
      imageUrl: 'https://cdn.example.test/item.webp',
    }));
    const iconMarkup = renderToStaticMarkup(createElement(GameImage, {
      alt: 'Предмет',
      icon: 'data:image/webp;base64,AQID',
    }));

    expect(imageUrlMarkup).toContain('<img');
    expect(imageUrlMarkup).toContain('https://cdn.example.test/item.webp');
    expect(iconMarkup).toContain('<img');
    expect(iconMarkup).toContain('data:image/webp;base64,AQID');
  });

  it('supports eager loading for container artwork', () => {
    const markup = renderToStaticMarkup(createElement(GameImage, {
      alt: 'Контейнер',
      source: '/containers/test.webp',
      loading: 'eager',
    }));

    expect(markup).toContain('loading="eager"');
  });

  it('renders a fallback when an image is missing', () => {
    const markup = renderToStaticMarkup(createElement(GameImage, {
      alt: 'Контейнер',
      fallback: createElement('span', null, '📦'),
    }));

    expect(markup).toContain('📦');
    expect(markup).not.toContain('<img');
  });
});
