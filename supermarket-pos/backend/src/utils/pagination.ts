const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination(query: { page?: unknown; pageSize?: unknown }): PaginationParams {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(query.pageSize)) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toPaginatedResult<T>(items: T[], total: number, page: number, pageSize: number): PaginatedResult<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
