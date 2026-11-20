import { eq, sql } from "drizzle-orm";
import { db } from "#db";
import { users } from "@/db/schema";
import { provisionAccount } from "@/lib/accounts/provision";
import { DEMO_MIGRATIONS } from "./db/migrations.generated";
import { seedDemoData } from "./seed";

/**
 * Builds a demo visitor's database: the production schema (every migration in
 * db/migrations), the demo account, its personal workspace and about 60 days of sample
 * work. Runs in the browser against the demo's PGlite (`#db` resolves to db/browser.ts),
 * and in tests against PGlite in Node.
 *
 * Safe to run on every page load: applied migrations are recorded in demo_meta, the
 * account is created once, and the seed is one transaction that sets onboardedAt last,
 * so a demo closed halfway through seeding is seeded again next time.
 */

export const demoUserId = (demoId: string) => `demo-${demoId}`;
const DEMO_DOMAIN = "demo.state.invalid";

/** Applies migrations this database has not seen. True when it applied any. */
async function migrate(): Promise<boolean> {
  await db.execute(sql`create table if not exists demo_meta (key text primary key, value text not null)`);
  const rows = await db.execute<{ value: string }>(sql`select value from demo_meta where key = 'migrations'`);
  const list = ("rows" in rows ? rows.rows : rows) as { value: string }[];
  const applied = Number(list[0]?.value ?? 0);
  if (applied >= DEMO_MIGRATIONS.length) return false;
  await db.transaction(async (tx) => {
    for (const migration of DEMO_MIGRATIONS.slice(applied)) {
      for (const statement of migration.statements) await tx.execute(sql.raw(statement));
    }
    await tx.execute(
      sql`insert into demo_meta (key, value) values ('migrations', ${String(DEMO_MIGRATIONS.length)}) on conflict (key) do update set value = excluded.value`
    );
  });
  return true;
}

/** Prepares the demo's database: the demo account's user id, and whether anything was written. */
export async function setupDemo(demoId: string, timezone: string, now = Date.now()): Promise<{ userId: string; changed: boolean }> {
  const migrated = await migrate();
  const userId = demoUserId(demoId);
  const [user] = await db.select({ onboardedAt: users.onboardedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.onboardedAt) return { userId, changed: migrated };
  if (!user) {
    await db.insert(users).values({ id: userId, name: "Demo visitor", email: `${userId}@${DEMO_DOMAIN}`, emailVerified: true, isDemo: true, timezone });
  }
  await provisionAccount(userId);
  await seedDemoData(userId, now, timezone);
  return { userId, changed: true };
}
