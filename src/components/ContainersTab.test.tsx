import { describe, expect, it } from 'vitest';
import { CONTAINERS } from '../data/items';
import { filterContainers } from './ContainersTab';

describe('container catalog filters', () => {
  it('shows all containers in configured order', () => {
    expect(filterContainers(CONTAINERS, 'all').map(({ id }) => id)).toEqual([
      'second-hand-bale', 'hype-box', 'tokyo-archive', 'impound-lot', 'japanese-auction', 'dubai-transit',
    ]);
  });

  it('filters clothing, cars, and tier-three premium containers', () => {
    expect(filterContainers(CONTAINERS, 'clothing').every(({ category }) => category === 'clothing')).toBe(true);
    expect(filterContainers(CONTAINERS, 'car').every(({ category }) => category === 'car')).toBe(true);
    expect(filterContainers(CONTAINERS, 'premium').map(({ id }) => id)).toEqual(['tokyo-archive', 'dubai-transit']);
  });

  it('keeps plate roulette separate from the container card catalog', () => {
    expect(filterContainers(CONTAINERS, 'plates')).toEqual([]);
  });
});
