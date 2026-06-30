/** Matches AuthService PagedResult<T> JSON (camelCase or PascalCase). */
export type PagedResult<T> = {
  items?: T[];
  Items?: T[];
  totalCount?: number;
  TotalCount?: number;
  currentPage?: number;
  CurrentPage?: number;
  pageSize?: number;
  PageSize?: number;
};

export function unwrapPagedItems<T>(
  payload: T[] | PagedResult<T> | null | undefined,
): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items ?? payload.Items ?? [];
}
