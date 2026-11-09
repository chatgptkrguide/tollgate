import { and, eq, gt, lte, sql, type SQL } from "drizzle-orm";
import { REVIEW_LIMITS_PER_COPY, REVIEW_LIMITS_PER_SERVER } from "../../domain/review-limit";
import type { SendLimit } from "../../domain/send-limit";
import type { Db } from "./client";
import { claudeCalls } from "./schema";

export interface ReviewLimits {
  perCopy: readonly SendLimit[];
  perServer: readonly SendLimit[];
}

const DEFAULT_LIMITS: ReviewLimits = { perCopy: REVIEW_LIMITS_PER_COPY, perServer: REVIEW_LIMITS_PER_SERVER };

// Takes one place under every limit, or answers false and records nothing. Like takePayPalSend: one INSERT … SELECT …
// WHERE, so two requests can't both take the last place. A failed review still counts: Claude may have billed it.
export async function takeClaudeCall(db: Db, projectId: string, at: Date, limits: ReviewLimits = DEFAULT_LIMITS): Promise<boolean> {
  const now = at.getTime();
  const since = (windowMs: number) => new Date(now - windowMs).toISOString();
  const all = [...limits.perCopy, ...limits.perServer];
  const longestWindowMs = Math.max(...all.map((limit) => limit.windowMs));

  const room = (limit: SendLimit, where: SQL | undefined) =>
    sql`(SELECT count(*) FROM ${claudeCalls} WHERE ${where}) < ${limit.max}`;
  const roomInEveryWindow = sql.join(
    [
      ...limits.perCopy.map((limit) => room(limit, and(eq(claudeCalls.projectId, projectId), gt(claudeCalls.at, since(limit.windowMs))))),
      ...limits.perServer.map((limit) => room(limit, gt(claudeCalls.at, since(limit.windowMs)))),
    ],
    sql` AND `,
  );

  const [, taken] = await db.batch([
    db.delete(claudeCalls).where(lte(claudeCalls.at, since(longestWindowMs))),
    db.run(sql`INSERT INTO ${claudeCalls} (project_id, at) SELECT ${projectId}, ${at.toISOString()} WHERE ${roomInEveryWindow}`),
  ]);
  return taken.rowsAffected > 0;
}
