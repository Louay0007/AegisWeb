export type PageRequest = {
  page: number;
  pageSize: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type Page<TItem> = {
  data: TItem[];
  meta: PageMeta;
};

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function normalizePageRequest(input: Partial<PageRequest> = {}): PageRequest {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const requestedSize = Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE));

  return {
    page,
    pageSize: Math.min(requestedSize, MAX_PAGE_SIZE)
  };
}

export function createPageMeta(request: PageRequest, totalItems: number): PageMeta {
  return {
    page: request.page,
    pageSize: request.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / request.pageSize))
  };
}
