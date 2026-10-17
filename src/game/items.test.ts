import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTAINERS, pickDrop } from '../data/items';

afterEach(() => vi.restoreAllMocks());

describe('container drop weights', () => {
  it('uses the configured relative chance weights', () => {
    const container = {
      ...CONTAINERS[0],
      contents: [
        { ...CONTAINERS[0].contents[0], name: 'Weighted low', weight: 1 },
        { ...CONTAINERS[0].contents[1], name: 'Weighted high', weight: 3 },
      ],
    };
    const random = vi.spyOn(Math, 'random');

    random.mockReturnValue(0.2);
    expect(pickDrop(container).name).toBe('Weighted low');

    random.mockReturnValue(0.3);
    expect(pickDrop(container).name).toBe('Weighted high');
  });

  it('retains rarity-based weights for the built-in catalog', () => {
    const container = {
      ...CONTAINERS[0],
      contents: [
        { ...CONTAINERS[0].contents[0], name: 'Common' },
        { ...CONTAINERS[0].contents[3], name: 'Rare' },
      ],
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    expect(pickDrop(container).name).toBe('Rare');
  });
});
