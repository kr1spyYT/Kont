export interface CatalogPage {
  currentPage: number;
  start: number;
  end: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function getCatalogPage(totalItems: number, requestedPage: number, pageSize: number): CatalogPage {
  const safeTotal = Number.isFinite(totalItems) ? Math.max(0, Math.floor(totalItems)) : 0;
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 5;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const page = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0;
  const currentPage = Math.min(totalPages - 1, Math.max(0, page));

  return {
    currentPage,
    start: currentPage * safePageSize,
    end: Math.min((currentPage + 1) * safePageSize, safeTotal),
    totalPages,
    hasPrevious: currentPage > 0,
    hasNext: currentPage + 1 < totalPages,
  };
}
