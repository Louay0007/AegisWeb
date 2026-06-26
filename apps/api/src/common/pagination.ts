import { z } from 'zod';

export type QueryRecord = Record<string, string | string[] | undefined>;

export type PageQuery = {
  page: number;
  limit: number;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export function parsePageQuery(query: QueryRecord): PageQuery {
  return pageSchema.parse({
    page: first(query.page),
    limit: first(query.limit)
  });
}

export function pageToSkip(query: PageQuery): number {
  return (query.page - 1) * query.limit;
}

export function paginationMeta(total: number, query: PageQuery): PaginationMeta {
  return {
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit))
  };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
