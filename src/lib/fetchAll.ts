import type { PostgrestBuilder } from "@supabase/postgrest-js";

/**
 * Fetches all rows from a Supabase query bypassing the server-side max-rows limit.
 * Paginates in batches of 1000 using .range() until the table is exhausted.
 *
 * Usage:
 *   const rows = await fetchAll((from, to) =>
 *     supabase.from("table").select("*").range(from, to)
 *   );
 */
export async function fetchAll<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const PAGE = 1000;
  let result: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryFn(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    result = result.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return result;
}
