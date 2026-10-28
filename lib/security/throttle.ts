import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Atomic fixed-window counter. Returns true when the call is within the limit.
 * One upsert per call: the window resets when it has expired, otherwise increments.
 */
export async function consumeThrottle(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const result = await db.execute<{ count: number }>(sql`
    insert into throttle_buckets (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when throttle_buckets.window_start < now() - make_interval(secs => ${windowSeconds})
                   then 1 else throttle_buckets.count + 1 end,
      window_start = case when throttle_buckets.window_start < now() - make_interval(secs => ${windowSeconds})
                   then now() else throttle_buckets.window_start end
    returning count
  `);
  const count = Number(result.rows[0]?.count ?? 0);
  return count <= max;
}
