import { describe, expect, it } from 'vitest';
import { getCatalogPage } from './catalogPagination.js';

describe('catalog pagination', () => {
  it('shows a next page for ten catalog entries at five per page', () => {
    expect(getCatalogPage(10, 0, 5)).toEqual({
      currentPage: 0,
      start: 0,
      end: 5,
      totalPages: 2,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it('shows previous navigation on the second page', () => {
    expect(getCatalogPage(10, 1, 5)).toMatchObject({
      currentPage: 1,
      start: 5,
      end: 10,
      hasPrevious: true,
      hasNext: false,
    });
  });

  it('clamps stale page callbacks and hides navigation for a single page', () => {
    expect(getCatalogPage(10, 20, 5).currentPage).toBe(1);
    expect(getCatalogPage(4, 20, 5)).toMatchObject({
      currentPage: 0,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    });
  });
});
